import axios from 'axios';
import {z} from 'zod';
import type {Pool} from 'pg';
import type {SosCapabilities} from '../../../shared/types/sos';
import {transaction} from './db';
import {preferences,scheduleSos} from './sos';
import {internationalPhone} from './sos-policy';
import {escapeHtml,reportCsv,reportHtml,reportText,type SosReport} from './sos-report';

export interface SosDeliveryConfig {
  enabled:boolean;emailKey:string;fromEmail:string;twilioSid:string;twilioToken:string;fromPhone:string;
}
export function loadSosDeliveryConfig(env:NodeJS.ProcessEnv):SosDeliveryConfig {
  if(env.SOS_DELIVERY_ENABLED&&!['true','false'].includes(env.SOS_DELIVERY_ENABLED))throw new Error('SOS_DELIVERY_ENABLED must be true or false');
  const config={enabled:env.SOS_DELIVERY_ENABLED==='true',emailKey:env.RESEND_API_KEY||'',fromEmail:env.SOS_FROM_EMAIL||'',
    twilioSid:env.TWILIO_ACCOUNT_SID||'',twilioToken:env.TWILIO_AUTH_TOKEN||'',fromPhone:env.TWILIO_FROM_NUMBER||''};
  if(config.fromEmail&&!z.email().safeParse(config.fromEmail).success)throw new Error('SOS_FROM_EMAIL must be an email address');
  if(config.fromPhone&&!internationalPhone(config.fromPhone))throw new Error('TWILIO_FROM_NUMBER must include its country code');
  if(config.twilioSid&&!/^AC[0-9a-f]{32}$/i.test(config.twilioSid))throw new Error('TWILIO_ACCOUNT_SID must be an account SID');
  return config;
}
export function sosCapabilities(config:SosDeliveryConfig):SosCapabilities {
  const phone=Boolean(config.enabled&&config.twilioSid&&config.twilioToken&&config.fromPhone);
  return {email:Boolean(config.enabled&&config.emailKey&&config.fromEmail),sms:phone,call:phone,phone_sos:false};
}
export interface NotificationJob {
  id:string|number;user_id:number;incident_id:string;contact_id:number|null;destination:string;channel:'email'|'sms'|'call';
  attempts:number;report:SosReport;kind:string;created_at:Date;include_report:boolean;
  incident_device_id?:string|null;
}
export type NotificationSender=(job:NotificationJob,config:SosDeliveryConfig)=>Promise<string>;
export class DeliveryError extends Error {
  constructor(public code:string,public retryable=false,public uncertain=false){super(code);}
}
export const sendSosNotification:NotificationSender=async(job,config)=>{
  try {
    if(job.channel==='email') {
      const response=await axios.post('https://api.resend.com/emails',{
        from:config.fromEmail,to:[job.destination],subject:`Vyaana ${job.kind==='daily'?'monitoring report':'monitoring alert'}`,
        text:reportText(job.report),html:reportHtml(job.report),
        ...(job.include_report?{attachments:[{filename:'vyaana-monitoring-report.csv',content:Buffer.from(reportCsv(job.report)).toString('base64')}]}:{}),
      },{timeout:15000,maxRedirects:0,headers:{Authorization:`Bearer ${config.emailKey}`,'Idempotency-Key':`vyaana-sos-${job.incident_id}-${job.id}`}});
      if(typeof response.data.id!=='string')throw new DeliveryError('invalid_provider_response',false,true);
      return response.data.id;
    }
    const latest=job.report.latest;
    const message=`Vyaana monitoring alert for ${job.report.name}. ${job.report.reason} Latest recorded heart rate: ${latest?.heart_rate??'unavailable'} bpm, oxygen: ${latest?.spo2??'unavailable'} percent; observed ${latest?.observed_at??'time unavailable'}. Please contact them to check on them. This is an automated notification, not a confirmed medical emergency.`;
    const params=new URLSearchParams({To:job.destination,From:config.fromPhone});
    if(job.channel==='sms')params.set('Body',message);
    else {params.set('Twiml',`<Response><Say>${escapeHtml(message)}</Say></Response>`);params.set('Timeout','25');params.set('TimeLimit','60');}
    const response=await axios.post(`https://api.twilio.com/2010-04-01/Accounts/${config.twilioSid}/${job.channel==='sms'?'Messages':'Calls'}.json`,params.toString(),
      {timeout:15000,maxRedirects:0,auth:{username:config.twilioSid,password:config.twilioToken},headers:{'Content-Type':'application/x-www-form-urlencoded'}});
    if(typeof response.data.sid!=='string')throw new DeliveryError('invalid_provider_response',false,true);
    return response.data.sid;
  }catch(error) {
    if(error instanceof DeliveryError)throw error;
    const status=axios.isAxiosError(error)?error.response?.status:undefined;
    if(status===429)throw new DeliveryError('provider_rate_limit',true);
    if(status&&status>=400&&status<500)throw new DeliveryError('provider_rejected');
    // Resend supports a stable idempotency key. Twilio SMS/calls are never
    // retried after an ambiguous response, preventing duplicate calls/texts.
    throw new DeliveryError('provider_response_uncertain',job.channel==='email',job.channel!=='email');
  }
};

export async function processSosNotifications(pool:Pool,config:SosDeliveryConfig,send:NotificationSender=sendSosNotification) {
  const capabilities=sosCapabilities(config);
  await pool.query("UPDATE sos_notifications SET status='unknown',error_code='worker_interrupted',updated_at=NOW() WHERE status='sending' AND updated_at<NOW()-INTERVAL '2 minutes'");
  for(let index=0;index<10;index++) {
    const job=await transaction(pool,async client=>{
      const row=(await client.query(`SELECT n.*,i.report,i.kind,i.created_at,i.device_id AS incident_device_id FROM sos_notifications n
        JOIN sos_incidents i ON i.id=n.incident_id AND i.user_id=n.user_id
        WHERE n.status IN ('pending','blocked') AND n.next_attempt_at<=NOW()
        ORDER BY CASE WHEN i.kind IN ('manual','automatic') THEN 0 ELSE 1 END,n.id
        LIMIT 1 FOR UPDATE OF n SKIP LOCKED`)).rows[0] as NotificationJob|undefined;
      if(!row)return null;
      const settings=await preferences(client,row.user_id);
      const ids=row.kind==='daily'||row.kind==='sensor_fault'?settings.report_contact_ids:settings.emergency_contact_ids;
      const contact=(await client.query('SELECT email,phone FROM emergency_contact WHERE id=$1 AND user_id=$2',[row.contact_id,row.user_id])).rows[0];
      const channelEnabled=settings[`${row.channel}_enabled`];
      const validDevice=row.kind!=='automatic'||(await client.query('SELECT id FROM devices WHERE id=$1 AND user_id=$2 AND active AND revoked_at IS NULL',[row.incident_device_id,row.user_id])).rowCount;
      if(!settings.sharing_enabled||!channelEnabled||!row.contact_id||!ids.includes(row.contact_id)||!contact||
        !validDevice||
        (row.channel==='email'?contact.email:internationalPhone(contact.phone))!==row.destination||
        row.kind==='automatic'&&!settings.auto_enabled||row.kind==='sensor_fault'&&!settings.fault_report_enabled) {
        await client.query("UPDATE sos_notifications SET status='cancelled',error_code='sharing_changed',updated_at=NOW() WHERE id=$1",[row.id]);
        return {skip:true} as const;
      }
      const age=Date.now()-new Date(row.created_at).getTime();
      if(age>(row.kind==='manual'||row.kind==='automatic'?600000:86400000)) {
        await client.query("UPDATE sos_notifications SET status='failed',error_code='notification_expired',updated_at=NOW() WHERE id=$1",[row.id]);
        return {skip:true} as const;
      }
      if(!capabilities[row.channel]) {
        await client.query("UPDATE sos_notifications SET status='blocked',error_code='service_not_configured',next_attempt_at=NOW()+INTERVAL '30 seconds',updated_at=NOW() WHERE id=$1",[row.id]);
        return {skip:true} as const;
      }
      await client.query("UPDATE sos_notifications SET status='sending',attempts=attempts+1,updated_at=NOW(),error_code=NULL WHERE id=$1",[row.id]);
      return row;
    });
    if(!job)break;
    if('skip' in job)continue;
    try {
      const providerId=await send(job,config);
      await pool.query("UPDATE sos_notifications SET status='submitted',provider_id=$1,updated_at=NOW() WHERE id=$2 AND status='sending'",[providerId,job.id]);
    }catch(error) {
      const failure=error instanceof DeliveryError?error:new DeliveryError('provider_response_uncertain',false,true);
      const state=failure.uncertain?'unknown':failure.retryable&&job.attempts<2?'pending':'failed';
      await pool.query(`UPDATE sos_notifications SET status=$1,error_code=$2,next_attempt_at=NOW()+INTERVAL '1 minute',updated_at=NOW()
        WHERE id=$3 AND status='sending'`,[state,failure.code,job.id]);
    }
  }
  await pool.query(`UPDATE sos_incidents i SET status='processed' WHERE status='queued'
    AND NOT EXISTS(SELECT 1 FROM sos_notifications n WHERE n.incident_id=i.id AND n.status IN ('pending','blocked','sending'))`);
}
export function startSosWorker(pool:Pool,config:SosDeliveryConfig) {
  let busy=false,stopped=false;
  const tick=async()=>{
    if(busy||stopped)return;busy=true;
    try {await scheduleSos(pool);await processSosNotifications(pool,config);}
    catch {console.error('SOS notification worker unavailable; queued records retained.');}
    finally {busy=false;}
  };
  const timer=setInterval(()=>void tick(),5000);timer.unref();void tick();
  return ()=>{stopped=true;clearInterval(timer);};
}
