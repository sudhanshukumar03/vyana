import {randomUUID} from 'crypto';
import type {Pool,PoolClient} from 'pg';
import type {SosCapabilities,SosPreferences} from '../../../shared/types/sos';
import {transaction} from './db';
import {HttpError} from './auth';
import {advanceSignals,criticalSignals,defaultSosPreferences,hardwareSources,internationalPhone,sosPreferencesSchema,
  type Signal,type SosObservation} from './sos-policy';
import {buildSosReport} from './sos-report';

type Device={id:string;user_id:number;active?:boolean};
type Kind='manual'|'automatic'|'daily'|'sensor_fault';
type Broadcast=(owner:number,event:string,data:unknown)=>void;
const lock=(client:PoolClient,userId:number)=>client.query('SELECT pg_advisory_xact_lock(742901,$1)',[userId]);
export async function preferences(client:Pool|PoolClient,userId:number):Promise<SosPreferences> {
  const row=(await client.query('SELECT settings FROM sos_preferences WHERE user_id=$1',[userId])).rows[0];
  return sosPreferencesSchema.parse({...defaultSosPreferences,...row?.settings});
}
export async function saveSosPreferences(pool:Pool,userId:number,input:unknown,capabilities:SosCapabilities) {
  const settings=sosPreferencesSchema.parse(input);
  return transaction(pool,async client=>{
    await lock(client,userId);
    const selected=[...new Set([...settings.emergency_contact_ids,...settings.report_contact_ids])];
    const contacts=(await client.query('SELECT id,email,phone FROM emergency_contact WHERE user_id=$1 AND id=ANY($2::int[])',[userId,selected])).rows;
    if(contacts.length!==selected.length)throw new HttpError(400,'Choose contacts saved in your account');
    if((settings.auto_enabled||settings.daily_report_enabled||settings.fault_report_enabled)&&!settings.sharing_enabled)
      throw new HttpError(400,'Enable report sharing before automatic notifications');
    if(settings.auto_enabled) {
      if(!settings.emergency_contact_ids.length)throw new HttpError(400,'Select an emergency recipient');
      if(!(settings.email_enabled&&capabilities.email||settings.sms_enabled&&capabilities.sms||settings.call_enabled&&capabilities.call))
        throw new HttpError(400,'Configure an enabled delivery service before enabling automatic SOS');
    }
    if(settings.daily_report_enabled||settings.fault_report_enabled) {
      if(!settings.email_enabled||!capabilities.email)throw new HttpError(400,'Configure email delivery before enabling scheduled reports');
      if(!settings.report_contact_ids.length)throw new HttpError(400,'Select a report recipient');
    }
    for(const contact of contacts) {
      if(settings.report_contact_ids.includes(contact.id)&&!contact.email)
        throw new HttpError(400,'Report recipients need an email address');
      if(settings.emergency_contact_ids.includes(contact.id)) {
        const email=Boolean(settings.email_enabled&&contact.email);
        const phone=Boolean((settings.sms_enabled||settings.call_enabled)&&internationalPhone(contact.phone));
        if(!email&&!phone)throw new HttpError(400,'Each emergency recipient needs an enabled email channel or an international phone number, for example +919876543210');
        if(settings.auto_enabled&&!(email&&capabilities.email||phone&&(settings.sms_enabled&&capabilities.sms||settings.call_enabled&&capabilities.call)))
          throw new HttpError(400,'Each automatic SOS recipient needs a configured delivery channel');
      }
    }
    await client.query(`INSERT INTO sos_preferences(user_id,settings) VALUES($1,$2)
      ON CONFLICT(user_id) DO UPDATE SET settings=EXCLUDED.settings,updated_at=NOW()`,[userId,JSON.stringify(settings)]);
    // Disabling automation cancels its countdown; disabling sharing also cancels
    // all undelivered jobs. Accepted provider requests cannot be recalled here.
    if(!settings.auto_enabled||!settings.sharing_enabled) {
      const cancelled=(await client.query("UPDATE sos_incidents SET status='cancelled' WHERE user_id=$1 AND status='pending' AND kind='automatic' RETURNING alert_id",[userId])).rows;
      await client.query("UPDATE alerts SET status='resolved',resolved_at=NOW() WHERE user_id=$1 AND id=ANY($2::int[])",[userId,cancelled.map(row=>row.alert_id).filter(Boolean)]);
    }
    if(!settings.sharing_enabled)await client.query("UPDATE sos_notifications SET status='cancelled',updated_at=NOW() WHERE user_id=$1 AND status IN ('pending','blocked')",[userId]);
    return settings;
  });
}

async function enqueueIncident(client:PoolClient,incident:Record<string,any>,settings:SosPreferences) {
  const reportsOnly=incident.kind==='daily'||incident.kind==='sensor_fault';
  const ids=reportsOnly?settings.report_contact_ids:settings.emergency_contact_ids;
  if(settings.sharing_enabled&&ids.length) {
    const contacts=(await client.query('SELECT * FROM emergency_contact WHERE user_id=$1 AND id=ANY($2::int[])',[incident.user_id,ids])).rows;
    for(const contact of contacts)for(const channel of ['email','sms','call'] as const) {
      if(!settings[`${channel}_enabled`]||reportsOnly&&channel!=='email')continue;
      const destination=channel==='email'?contact.email:internationalPhone(contact.phone);
      if(!destination)continue;
      await client.query(`INSERT INTO sos_notifications(user_id,incident_id,contact_id,contact_name,destination,channel,include_report)
        VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
      [incident.user_id,incident.id,contact.id,contact.name,destination,channel,settings.attach_report]);
    }
  }
  const count=(await client.query('SELECT COUNT(*)::int AS count FROM sos_notifications WHERE incident_id=$1',[incident.id])).rows[0].count;
  await client.query('UPDATE sos_incidents SET status=$1 WHERE id=$2',[count?'queued':'recorded',incident.id]);
}

async function createIncident(client:PoolClient,userId:number,kind:Kind,reason:string,key:string,
  settings:SosPreferences,deviceId:string|null=null,delay=0,existingAlert?:Record<string,any>) {
  const existing=(await client.query('SELECT * FROM sos_incidents WHERE user_id=$1 AND dedupe_key=$2',[userId,key])).rows[0];
  if(existing)return {incident:existing,alert:null};
  const report=await buildSosReport(client,userId,reason),id=randomUUID();
  let alert=existingAlert||null;
  if(!alert&&(kind==='manual'||kind==='automatic'))alert=(await client.query(`INSERT INTO alerts(user_id,device_id,severity,title,detail,metric)
    VALUES($1,$2,'critical',$3,$4,'emergency') RETURNING *`,[userId,deviceId,kind==='automatic'?'Automatic SOS countdown':'SOS Emergency',reason])).rows[0];
  const incident=(await client.query(`INSERT INTO sos_incidents(id,user_id,device_id,alert_id,kind,status,reason,report,dedupe_key,due_at)
    VALUES($1,$2,$3,$4,$5,'pending',$6,$7,$8,NOW()+$9*INTERVAL '1 second') RETURNING *`,
  [id,userId,deviceId,alert?.id||null,kind,reason,JSON.stringify(report),key,delay])).rows[0];
  if(!delay)await enqueueIncident(client,incident,settings);
  return {incident,alert};
}

export async function createManualSos(pool:Pool,userId:number,note:string,broadcast:Broadcast,
  capabilities:SosCapabilities,requestId?:string) {
  const result=await transaction(pool,async client=>{
    await lock(client,userId);
    const settings=await preferences(client,userId);
    const created=await createIncident(client,userId,'manual',`SOS requested by the user. ${note}`.trim(),`manual:${requestId??randomUUID()}`,settings);
    const notifications=(await client.query('SELECT channel FROM sos_notifications WHERE incident_id=$1',[created.incident.id])).rows;
    const alert=created.alert??(await client.query('SELECT * FROM alerts WHERE id=$1 AND user_id=$2',[created.incident.alert_id,userId])).rows[0];
    return {...created,alert,isNew:Boolean(created.alert),notificationCount:notifications.length,
      deliveryStatus:!notifications.length?'recorded':notifications.some(job=>!capabilities[job.channel as keyof SosCapabilities])?'setup_required':'queued'};
  });
  if(result.isNew&&result.alert)broadcast(userId,'new_alert',result.alert);
  return {...result.alert,sos_incident_id:result.incident.id,notification_count:result.notificationCount,delivery_status:result.deliveryStatus};
}

export function observationFromVitals(value:Record<string,any>):SosObservation {
  const quality:string[]=[];
  if(value.ecg_status==='Leads Off')quality.push('ECG leads off');
  if(!value.heart_rate||!value.spo2)quality.push('Optical result unavailable');
  if(!hardwareSources.has(value.source))quality.push('Unverified or generated source');
  return {observed_at:value.observed_at,source:value.source,priority:0,
    heart_rate:value.heart_rate>0?value.heart_rate:null,spo2:value.spo2>0?value.spo2:null,
    temperature:value.temperature,ecg_status:value.ecg_status,
    quality};
}
export function observationFromEquipment(value:Record<string,any>,source:string):SosObservation {
  const quality:string[]=[];
  if(value.heart_rate==null||value.spo2==null||value.spo2===0)quality.push('Optical result unavailable');
  if(value.temperature_c==null)quality.push('Temperature unavailable');
  if(value.ecg_status==='Leads Off')quality.push('ECG leads off');
  if(value.ecg_samples>=20&&value.ecg_clipped_samples/value.ecg_samples>=.1)quality.push('ECG input clipping');
  if(!hardwareSources.has(source))quality.push('Unverified or generated source');
  return {observed_at:value.observed_at,source,priority:1,heart_rate:value.heart_rate??null,
    spo2:value.spo2>0?value.spo2:null,temperature:value.temperature_c,ecg_status:value.ecg_status,quality,
    ecg_raw_adc:value.ecg_raw_adc,ecg_millivolts:value.ecg_millivolts,ecg_samples:value.ecg_samples,ecg_clipped_samples:value.ecg_clipped_samples};
}

async function cancelPendingThresholds(client:PoolClient,device:Device) {
  const cancelled=(await client.query(`UPDATE sos_incidents SET status='cancelled' WHERE user_id=$1 AND device_id=$2
    AND kind='automatic' AND status='pending' AND dedupe_key LIKE 'automatic:%' RETURNING alert_id`,[device.user_id,device.id])).rows;
  if(!cancelled.length)return null;
  return (await client.query("UPDATE alerts SET status='resolved',resolved_at=NOW() WHERE user_id=$1 AND id=ANY($2::int[]) RETURNING *",
    [device.user_id,cancelled.map(row=>row.alert_id).filter(Boolean)])).rows[0]||null;
}

export async function recordSosObservation(client:PoolClient,device:Device,reading:SosObservation,
  staleSeconds:number,monitor=true):Promise<Record<string,any>|null> {
  await lock(client,device.user_id);
  await client.query(`INSERT INTO sos_observations(user_id,device_id,observed_at,source,priority,heart_rate,spo2,temperature,ecg_status,quality,
      ecg_raw_adc,ecg_millivolts,ecg_samples,ecg_clipped_samples)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT(device_id,observed_at) DO UPDATE
    SET heart_rate=EXCLUDED.heart_rate,spo2=EXCLUDED.spo2,temperature=EXCLUDED.temperature,
      ecg_status=EXCLUDED.ecg_status,quality=EXCLUDED.quality,source=EXCLUDED.source,priority=EXCLUDED.priority,
      ecg_raw_adc=EXCLUDED.ecg_raw_adc,ecg_millivolts=EXCLUDED.ecg_millivolts,
      ecg_samples=EXCLUDED.ecg_samples,ecg_clipped_samples=EXCLUDED.ecg_clipped_samples
    WHERE EXCLUDED.priority>=sos_observations.priority`,
  [device.user_id,device.id,reading.observed_at,reading.source,reading.priority,reading.heart_rate,reading.spo2,reading.temperature,reading.ecg_status,reading.quality,
    reading.ecg_raw_adc??null,reading.ecg_millivolts??null,reading.ecg_samples??null,reading.ecg_clipped_samples??null]);
  // Full vital records contribute to reports. The independent equipment
  // snapshot drives automation so a single acquisition is counted once and
  // its ECG clipping/contact information is available for quality reporting.
  if(!monitor)return null;
  const settings=await preferences(client,device.user_id);
  const at=Date.parse(reading.observed_at),age=Date.now()-at;
  if(!settings.sharing_enabled||!device.active||age < -5000||age>staleSeconds*1000)return null;
  if(!hardwareSources.has(reading.source)) {
    await client.query('DELETE FROM sos_monitor_state WHERE user_id=$1 AND device_id=$2',[device.user_id,device.id]);
    return cancelPendingThresholds(client,device);
  }
  const state=(await client.query('SELECT * FROM sos_monitor_state WHERE user_id=$1 FOR UPDATE',[device.user_id])).rows[0];
  const sameDevice=state?.device_id===device.id,last=state?new Date(state.observed_at).getTime():0;
  if(sameDevice&&at<=last)return null;
  const continuous=Boolean(sameDevice&&at-last<=staleSeconds*1000);
  const {signals,trigger}=advanceSignals(state?.signals as Record<string,Signal>||{},reading,continuous,settings);
  const faultSince=reading.quality.length?(continuous&&state?.fault_since?new Date(state.fault_since):new Date(at)):null;
  await client.query(`INSERT INTO sos_monitor_state(user_id,device_id,observed_at,signals,fault_since) VALUES($1,$2,$3,$4,$5)
    ON CONFLICT(user_id) DO UPDATE SET device_id=EXCLUDED.device_id,observed_at=EXCLUDED.observed_at,
      signals=EXCLUDED.signals,fault_since=EXCLUDED.fault_since`,[device.user_id,device.id,reading.observed_at,JSON.stringify(signals),faultSince]);
  if(!criticalSignals(reading).length) {
    const resolved=await cancelPendingThresholds(client,device);if(resolved)return resolved;
  }
  if(settings.fault_report_enabled&&faultSince&&at-faultSince.getTime()>=300000) {
    await createIncident(client,device.user_id,'sensor_fault',`Sensor quality review requested: ${reading.quality.join(', ')}. This is not an automatic emergency determination.`,
      `fault:${device.id}:${new Date(at).toISOString().slice(0,10)}`,settings,device.id);
  }
  if(!settings.auto_enabled||!trigger)return null;
  const recent=(await client.query(`SELECT id FROM sos_incidents WHERE user_id=$1 AND kind IN ('manual','automatic')
    AND (status='pending' OR status!='recorded' AND created_at>NOW()-$2*INTERVAL '1 minute') LIMIT 1`,[device.user_id,settings.cooldown_minutes])).rowCount;
  if(recent)return null;
  return (await createIncident(client,device.user_id,'automatic',`${trigger} persisted across ${signals[trigger].count} fresh observations for at least ${settings.critical_seconds} seconds.`,
    `automatic:${randomUUID()}`,settings,device.id,settings.cancel_seconds)).alert;
}

export async function receiveDeviceSos(pool:Pool,device:Device,input:{session_id:string;sequence:number;observed_at:string},broadcast:Broadcast) {
  const result=await transaction(pool,async client=>{
    await lock(client,device.user_id);
    const current=(await client.query('SELECT active FROM devices WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL',[device.id,device.user_id])).rows[0];
    if(!current?.active)throw new HttpError(409,'SOS signal must come from the active device');
    const settings=await preferences(client,device.user_id);
    if(!settings.auto_enabled||!settings.sharing_enabled)throw new HttpError(409,'Automatic SOS is disabled');
    const age=Date.now()-Date.parse(input.observed_at);
    if(age < -5000||age>30000)throw new HttpError(400,'SOS signal is stale');
    const previous=(await client.query(`SELECT * FROM sos_incidents WHERE user_id=$1 AND kind IN ('manual','automatic')
      AND (status='pending' OR status!='recorded' AND created_at>NOW()-$2*INTERVAL '1 minute') ORDER BY created_at DESC LIMIT 1`,[device.user_id,settings.cooldown_minutes])).rows[0];
    if(previous)return {incident:previous,alert:null};
    return createIncident(client,device.user_id,'automatic','An explicit SOS signal was received from the registered device.',
      `device:${device.id}:${input.session_id}:${input.sequence}`,settings,device.id,settings.cancel_seconds);
  });
  if(result.alert)broadcast(device.user_id,'new_alert',result.alert);
  return {id:result.incident.id,status:result.incident.status};
}

export async function cancelSos(pool:Pool,userId:number,id:string) {
  return transaction(pool,async client=>{
    await lock(client,userId);
    const row=(await client.query("UPDATE sos_incidents SET status='cancelled' WHERE id=$1 AND user_id=$2 AND status='pending' AND due_at>NOW() RETURNING *",[id,userId])).rows[0];
    if(!row)throw new HttpError(409,'This countdown has ended or was already cancelled');
    if(row.alert_id)await client.query("UPDATE alerts SET status='resolved',resolved_at=NOW() WHERE id=$1 AND user_id=$2",[row.alert_id,userId]);
    return {success:true};
  });
}
export async function sosOverview(pool:Pool,userId:number,capabilities:SosCapabilities) {
  const settings=await preferences(pool,userId);
  const rows=(await pool.query(`SELECT id,kind,status,reason,created_at,due_at FROM sos_incidents WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20`,[userId])).rows;
  const notifications=(await pool.query(`SELECT n.id,n.incident_id,n.contact_name,n.channel,n.status,n.error_code FROM sos_notifications n
    WHERE n.user_id=$1 AND n.incident_id=ANY($2::uuid[]) ORDER BY n.id`,[userId,rows.map(row=>row.id)])).rows;
  const timezone=(await pool.query('SELECT timezone FROM profile WHERE user_id=$1',[userId])).rows[0]?.timezone||'Asia/Kolkata';
  return {preferences:settings,capabilities,timezone,server_time:new Date().toISOString(),incidents:rows.map(row=>({...row,notifications:notifications.filter(n=>n.incident_id===row.id)}))};
}
export async function requestReport(pool:Pool,userId:number,capabilities:SosCapabilities) {
  return transaction(pool,async client=>{
    await lock(client,userId);const settings=await preferences(client,userId);
    if(!settings.sharing_enabled||!settings.email_enabled||!settings.report_contact_ids.length||!capabilities.email)
      throw new HttpError(400,'Enable sharing, configure email and select report recipients first');
    const key=`requested-report:${Math.floor(Date.now()/60000)}`;
    return (await createIncident(client,userId,'daily','Monitoring report requested by the user.',key,settings)).incident.id;
  });
}
export async function scheduleSos(pool:Pool) {
  const due=(await pool.query(`SELECT id,user_id FROM sos_incidents WHERE status='pending' AND due_at<=NOW() ORDER BY due_at LIMIT 25`)).rows;
  for(const item of due)await transaction(pool,async client=>{
    await lock(client,item.user_id);
    const row=(await client.query("SELECT * FROM sos_incidents WHERE id=$1 AND status='pending' FOR UPDATE",[item.id])).rows[0];
    if(!row)return;
    const settings=await preferences(client,item.user_id);
    if(!settings.auto_enabled||!settings.sharing_enabled)await client.query("UPDATE sos_incidents SET status='cancelled' WHERE id=$1",[row.id]);
    else await enqueueIncident(client,row,settings);
  });
  const schedules=(await pool.query(`SELECT s.user_id,s.settings,COALESCE(p.timezone,'Asia/Kolkata') AS timezone,
    TO_CHAR(NOW() AT TIME ZONE COALESCE(p.timezone,'Asia/Kolkata'),'YYYY-MM-DD') AS local_date
    FROM sos_preferences s LEFT JOIN profile p ON p.user_id=s.user_id
    WHERE s.settings->>'daily_report_enabled'='true' AND s.settings->>'sharing_enabled'='true'
    AND EXTRACT(HOUR FROM NOW() AT TIME ZONE COALESCE(p.timezone,'Asia/Kolkata')) >= (s.settings->>'daily_hour')::int
    AND NOT EXISTS(SELECT 1 FROM sos_incidents i WHERE i.user_id=s.user_id AND i.dedupe_key='daily:'||TO_CHAR(NOW() AT TIME ZONE COALESCE(p.timezone,'Asia/Kolkata'),'YYYY-MM-DD'))
    LIMIT 25`)).rows;
  for(const item of schedules)await transaction(pool,async client=>{
    await lock(client,item.user_id);const settings=await preferences(client,item.user_id);
    if(settings.sharing_enabled&&settings.daily_report_enabled)await createIncident(client,item.user_id,'daily',
      'Scheduled daily monitoring report covering the preceding 24 hours.',`daily:${item.local_date}`,settings);
  });
}
