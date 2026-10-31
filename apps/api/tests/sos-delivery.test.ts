import axios from 'axios';
import {DeliveryError,loadSosDeliveryConfig,sendSosNotification,type NotificationJob} from '../src/sos-delivery';
import type {SosReport} from '../src/sos-report';

const config=loadSosDeliveryConfig({SOS_DELIVERY_ENABLED:'true',RESEND_API_KEY:'fake-email-key',SOS_FROM_EMAIL:'sender@example.test',
  TWILIO_ACCOUNT_SID:'AC'+'1'.repeat(32),TWILIO_AUTH_TOKEN:'fake-phone-key',TWILIO_FROM_NUMBER:'+12025550100'});
const report:SosReport={name:'Software Fixture',reason:'User requested help',generated_at:'2026-10-28T10:00:00Z',
  period_start:'2026-10-27T10:00:00Z',period_end:'2026-10-28T10:00:00Z',timezone:'Asia/Kolkata',device_name:'Fixture',
  latest:{heart_rate:72,spo2:98,observed_at:'2026-10-28T10:00:00Z'},stats:{count:1},rows:[],total_readings:1,ecg_note:'Unclassified'};
const job=(channel:'email'|'sms'|'call'):NotificationJob=>({id:1,user_id:1,incident_id:'00000000-0000-4000-8000-000000000001',
  contact_id:1,destination:channel==='email'?'recipient@example.test':'+919876543210',channel,attempts:0,kind:'manual',created_at:new Date(),include_report:true,report});
afterEach(()=>jest.restoreAllMocks());
test('email sends a readable report and base64 CSV with a stable idempotency key',async()=>{
  const post=jest.spyOn(axios,'post').mockResolvedValue({data:{id:'email-fixture'}});
  expect(await sendSosNotification(job('email'),config)).toBe('email-fixture');
  const [url,body,options]=post.mock.calls[0];
  expect(url).toBe('https://api.resend.com/emails');
  expect(body).toMatchObject({to:['recipient@example.test'],attachments:[{filename:'vyaana-monitoring-report.csv'}]});
  expect(Buffer.from((body as {attachments:{content:string}[]}).attachments[0].content,'base64').toString()).toContain('heart_rate_bpm');
  expect(options?.headers).toMatchObject({'Idempotency-Key':`vyaana-sos-${job('email').incident_id}-1`});
});
test('SMS contains recorded data and voice uses inline escaped TwiML',async()=>{
  const post=jest.spyOn(axios,'post').mockResolvedValue({data:{sid:'phone-fixture'}});
  await sendSosNotification(job('sms'),config);
  expect(new URLSearchParams(post.mock.calls[0][1] as string).get('Body')).toContain('72 bpm');
  await sendSosNotification({...job('call'),report:{...report,name:'<unsafe & name>'}},config);
  const twiml=new URLSearchParams(post.mock.calls[1][1] as string).get('Twiml');
  expect(twiml).toContain('&lt;unsafe &amp; name&gt;');expect(twiml).toContain('<Response><Say>');
  expect(post.mock.calls[1][0]).toContain('/Calls.json');
});
test('an ambiguous phone error is not retryable while email can retry idempotently',async()=>{
  jest.spyOn(axios,'post').mockRejectedValue(new Error('network failure'));
  await expect(sendSosNotification(job('call'),config)).rejects.toMatchObject({uncertain:true,retryable:false});
  await expect(sendSosNotification(job('email'),config)).rejects.toMatchObject({uncertain:false,retryable:true});
});
test('provider rejection is terminal and explicit rate limiting is retryable',async()=>{
  const post=jest.spyOn(axios,'post').mockRejectedValue({isAxiosError:true,response:{status:401}});
  await expect(sendSosNotification(job('email'),config)).rejects.toBeInstanceOf(DeliveryError);
  await expect(sendSosNotification(job('email'),config)).rejects.toMatchObject({code:'provider_rejected',retryable:false});
  post.mockRejectedValue({isAxiosError:true,response:{status:429}});
  await expect(sendSosNotification(job('sms'),config)).rejects.toMatchObject({code:'provider_rate_limit',retryable:true,uncertain:false});
});
