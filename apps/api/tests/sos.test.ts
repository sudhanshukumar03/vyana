import request from 'supertest';
import {randomUUID} from 'crypto';
import type {Pool} from 'pg';
import {createPool,migrate} from '../src/db';
import {loadConfig} from '../src/config';
import {createApplication} from '../src/app';
import {defaultSosPreferences} from '../src/sos-policy';
import {scheduleSos} from '../src/sos';
import {DeliveryError,processSosNotifications,type NotificationSender} from '../src/sos-delivery';

const withDatabase=process.env.TEST_DATABASE_URL?describe:describe.skip;
withDatabase('SOS settings, reports and durable dispatch against disposable PostgreSQL',()=>{
  let pool:Pool,runtime:ReturnType<typeof createApplication>,alice:string,bob:string,key:string,deviceId:string;
  let doctor:number,family:number,foreignContact:number,userId:number;
  const config=loadConfig({DATABASE_URL:process.env.TEST_DATABASE_URL||'postgresql://postgres@127.0.0.1/test_test',
    JWT_SECRET:'sos-test-signing-key-at-least-32-characters',AI_INTERNAL_SECRET:'sos-test-internal-key-at-least-32-characters',
    WEB_ORIGIN:'http://localhost:5173',STALE_SECONDS:'60',SOS_DELIVERY_ENABLED:'true',RESEND_API_KEY:'not-a-real-key',
    SOS_FROM_EMAIL:'sender@example.test',TWILIO_ACCOUNT_SID:'AC'+'1'.repeat(32),TWILIO_AUTH_TOKEN:'not-a-real-token',TWILIO_FROM_NUMBER:'+12025550100'});
  const api=()=>request(runtime.app),auth=(token:string)=>({Authorization:`Bearer ${token}`});
  const settings=(patch={})=>({...defaultSosPreferences,sharing_enabled:true,emergency_contact_ids:[family],report_contact_ids:[doctor],...patch});
  const save=(patch={})=>api().put('/api/v1/sos/preferences').set(auth(alice)).send(settings(patch));
  const reading=(at:number,patch:Record<string,unknown>={},source='ESP32_RealVitals_SimulatedSteps')=>api().post('/api/v1/device/status').set('X-Device-Key',key).send({
    device_name:'Software SOS fixture',connected:true,battery:null,source,equipment:{observed_at:new Date(at).toISOString(),
      heart_rate:160,spo2:98,temperature_c:null,ecg_status:'Unknown',ecg_raw_adc:2048,ecg_millivolts:1650,
      ecg_samples:1250,ecg_clipped_samples:0,...patch}});
  const trigger=async()=>{
    await save({auto_enabled:true}).then(res=>expect(res.status).toBe(200));
    const now=Date.now();for(const offset of [-31000,-16000,-1000])await reading(now+offset).expect(200);
    return (await api().get('/api/v1/sos').set(auth(alice)).expect(200)).body.incidents[0];
  };
  beforeAll(async()=>{
    const db=process.env.TEST_DATABASE_URL!;
    if(!new URL(db).pathname.endsWith('_test')||process.env.ALLOW_TEST_RESET!=='1')throw new Error('Explicit disposable *_test database required');
    pool=createPool(db);await pool.query('DROP SCHEMA public CASCADE; DROP SCHEMA IF EXISTS legacy CASCADE; CREATE SCHEMA public');await migrate(pool);
    runtime=createApplication(pool,config);await new Promise<void>(resolve=>runtime.server.listen(0,'127.0.0.1',resolve));
    const account=await api().post('/api/v1/auth/register').send({email:'sos-owner@example.test',password:'sos-testing-password'}).expect(201);
    alice=account.body.token;userId=account.body.user.id;
    bob=(await api().post('/api/v1/auth/register').send({email:'sos-other@example.test',password:'sos-testing-password'}).expect(201)).body.token;
    await api().post('/api/v1/profile').set(auth(alice)).send({full_name:'Software Fixture',height_cm:175,weight_kg:72,dob:'1990-01-01'}).expect(200);
    doctor=(await api().post('/api/v1/profile/contacts').set(auth(alice)).send({name:'Doctor Fixture',email:'doctor@example.test',is_doctor:true}).expect(201)).body.id;
    family=(await api().post('/api/v1/profile/contacts').set(auth(alice)).send({name:'Contact Fixture',email:'family@example.test',phone:'+919876543210'}).expect(201)).body.id;
    foreignContact=(await api().post('/api/v1/profile/contacts').set(auth(bob)).send({name:'Other Contact',email:'other@example.test'}).expect(201)).body.id;
    const device=(await api().post('/api/v1/devices').set(auth(alice)).send({name:'SOS test hardware'}).expect(201)).body;
    key=device.credential;deviceId=device.id;
  },30000);
  beforeEach(async()=>{
    await pool.query('TRUNCATE sos_notifications,sos_incidents,sos_monitor_state,sos_observations,vitals,activity,alerts RESTART IDENTITY');
    await pool.query('DELETE FROM sos_preferences');
    await pool.query('UPDATE devices SET active=TRUE,revoked_at=NULL WHERE id=$1',[deviceId]);
  });
  afterAll(async()=>{if(runtime)await new Promise<void>(resolve=>runtime.io.close(()=>resolve()));await pool?.end();});
  test('preferences enforce consent, ownership and channel readiness',async()=>{
    expect((await api().get('/api/v1/sos').set(auth(alice))).body.preferences.auto_enabled).toBe(false);
    await save({emergency_contact_ids:[foreignContact]}).expect(400);
    await save({auto_enabled:true,sharing_enabled:false}).expect(400);
    await save({report_contact_ids:[family],sms_enabled:true}).expect(200);
    await save({sms_enabled:true,email_enabled:false,emergency_contact_ids:[doctor]}).expect(400);
    await api().put('/api/v1/sos/preferences').send(settings()).expect(401);
  });
  test('repeated fresh valid optical readings create one cancellable incident without needing temperature',async()=>{
    const incident=await trigger();expect(incident.kind).toBe('automatic');expect(incident.status).toBe('pending');
    expect((await pool.query('SELECT * FROM sos_notifications')).rowCount).toBe(0);
    await reading(Date.now(),{heart_rate:170}).expect(200);
    expect((await pool.query('SELECT * FROM sos_incidents')).rowCount).toBe(1);
    await api().post(`/api/v1/sos/${incident.id}/cancel`).set(auth(bob)).expect(409);
    await api().post(`/api/v1/sos/${incident.id}/cancel`).set(auth(alice)).expect(200);
    await reading(Date.now()+1000).expect(200);
    expect((await pool.query('SELECT * FROM sos_incidents')).rowCount).toBe(1);
    await pool.query('UPDATE sos_incidents SET due_at=NOW()-INTERVAL \'1 second\'');await scheduleSos(pool);
    expect((await pool.query('SELECT * FROM sos_notifications')).rowCount).toBe(0);
  });
  test('recovery cancels a pending threshold incident and resolves its alert',async()=>{
    await trigger();await reading(Date.now(),{heart_rate:72}).expect(200);
    expect((await pool.query('SELECT status FROM sos_incidents')).rows[0].status).toBe('cancelled');
    expect((await pool.query("SELECT status FROM alerts WHERE metric='emergency'")).rows[0].status).toBe('resolved');
  });
  test('invalid sensor data and unverified sources never auto-call',async()=>{
    await save({auto_enabled:true}).expect(200);
    const now=Date.now();
    for(const offset of [-31000,-16000,-1000])await reading(now+offset,{heart_rate:null,spo2:null,ecg_status:'Leads Off'}).expect(200);
    for(const offset of [0,1000,2000])await reading(now+offset,{},'Simulator').expect(200);
    expect((await pool.query('SELECT * FROM sos_incidents')).rowCount).toBe(0);
    expect((await pool.query('SELECT * FROM sos_observations')).rowCount).toBe(6);
  });
  test('an unverified interlude resets a critical streak and complete vitals cannot double-count it',async()=>{
    await save({auto_enabled:true}).expect(200);const now=Date.now();
    await reading(now-35000).expect(200);await reading(now-20000).expect(200);
    await reading(now-10000,{},'Simulator').expect(200);await reading(now-1000).expect(200);
    expect((await pool.query('SELECT * FROM sos_incidents')).rowCount).toBe(0);
    await api().post('/api/v1/ingest/vitals').set('X-Device-Key',key).send({session_id:randomUUID(),sequence:1,
      observed_at:new Date(now).toISOString(),heart_rate:160,spo2:98,temperature:36.5,ecg_status:'Unknown',source:'ESP32_MAX30102_DS18B20_AD8232'}).expect(200);
    expect((await pool.query('SELECT signals FROM sos_monitor_state')).rows[0].signals['High heart rate'].count).toBe(1);
  });
  test('persistent lead/sensor faults queue only a review email, never SMS or a call',async()=>{
    await save({auto_enabled:true,fault_report_enabled:true,sms_enabled:true,call_enabled:true}).expect(200);
    const now=Date.now();
    await pool.query(`INSERT INTO sos_monitor_state(user_id,device_id,observed_at,fault_since)
      VALUES($1,$2,$3,$4)`,[userId,deviceId,new Date(now-1000),new Date(now-360000)]);
    await reading(now,{heart_rate:null,spo2:null,ecg_status:'Leads Off'}).expect(200);
    const jobs=(await pool.query('SELECT channel FROM sos_notifications')).rows;
    expect(jobs).toEqual([{channel:'email'}]);
    expect((await pool.query('SELECT kind FROM sos_incidents')).rows[0].kind).toBe('sensor_fault');
  });
  test('the explicit device SOS route is authenticated, cancellable and rate-cooled',async()=>{
    await save({auto_enabled:true}).expect(200);
    const event={session_id:randomUUID(),sequence:1,observed_at:new Date().toISOString()};
    await api().post('/api/v1/device/emergency').send(event).expect(401);
    const first=await api().post('/api/v1/device/emergency').set('X-Device-Key',key).send(event).expect(202);
    const second=await api().post('/api/v1/device/emergency').set('X-Device-Key',key).send({...event,sequence:2}).expect(202);
    expect(second.body.id).toBe(first.body.id);
    await api().post('/api/v1/device/emergency').set('X-Device-Key',key).send({...event,observed_at:new Date(Date.now()-60000).toISOString()}).expect(400);
  });
  test('manual SOS submits configured channels and reports provider acceptance accurately',async()=>{
    await save({sms_enabled:true,call_enabled:true}).expect(200);
    await reading(Date.now(),{heart_rate:72}).expect(200);
    const response=await api().post('/api/v1/sos').set(auth(alice)).send({note:'Software test; no real emergency'}).expect(201);
    expect(response.body).toMatchObject({notification_count:3,delivery_status:'queued'});
    const send=jest.fn<ReturnType<NotificationSender>,Parameters<NotificationSender>>().mockResolvedValue('provider-fixture-id');
    await processSosNotifications(pool,config.sosDelivery,send);
    expect(send).toHaveBeenCalledTimes(3);
    expect(send.mock.calls[0][0].report.latest).toMatchObject({ecg_raw_adc:2048,ecg_samples:1250});
    expect((await pool.query('SELECT DISTINCT status FROM sos_notifications')).rows).toEqual([{status:'submitted'}]);
    expect((await api().get('/api/v1/sos').set(auth(bob))).body.incidents).toEqual([]);
    expect((await api().get('/api/v1/sos/report').set(auth(bob))).body.total_readings).toBe(0);
  });
  test('opt-out cancels queued work and ambiguous phone submissions never retry',async()=>{
    await save({sms_enabled:true,email_enabled:false}).expect(200);
    await api().post('/api/v1/sos').set(auth(alice)).send({}).expect(201);
    const send=jest.fn<ReturnType<NotificationSender>,Parameters<NotificationSender>>().mockRejectedValue(new DeliveryError('timeout',false,true));
    await processSosNotifications(pool,config.sosDelivery,send);await processSosNotifications(pool,config.sosDelivery,send);
    expect(send).toHaveBeenCalledTimes(1);expect((await pool.query('SELECT status FROM sos_notifications')).rows[0].status).toBe('unknown');
    await api().post('/api/v1/sos').set(auth(alice)).send({}).expect(201);await save({sharing_enabled:false}).expect(200);
    await processSosNotifications(pool,config.sosDelivery,send);expect(send).toHaveBeenCalledTimes(1);
  });
  test('a retried or concurrent manual request creates one alert and one set of notifications',async()=>{
    const account=(await api().post('/api/v1/auth/register').send({email:'sos-retry@example.test',password:'sos-testing-password'}).expect(201)).body;
    const token=account.token;
    const contact=(await api().post('/api/v1/profile/contacts').set(auth(token)).send({name:'Retry Fixture',email:'retry@example.test'}).expect(201)).body;
    await api().put('/api/v1/sos/preferences').set(auth(token)).send({...defaultSosPreferences,sharing_enabled:true,emergency_contact_ids:[contact.id]}).expect(200);
    const request_id=randomUUID();
    const [first,retry]=await Promise.all([1,2].map(()=>api().post('/api/v1/sos').set(auth(token)).send({request_id,note:'Software retry fixture'}).expect(201)));
    expect(first.body.sos_incident_id).toBe(retry.body.sos_incident_id);
    expect(first.body.id).toBe(retry.body.id);
    expect(first.body).toMatchObject({notification_count:1,delivery_status:'queued'});
    expect((await pool.query('SELECT id FROM alerts WHERE user_id=$1',[account.user.id])).rowCount).toBe(1);
    expect((await pool.query('SELECT id FROM sos_notifications WHERE user_id=$1',[account.user.id])).rowCount).toBe(1);
    const other=await api().post('/api/v1/sos').set(auth(bob)).send({request_id}).expect(201);
    expect(other.body.sos_incident_id).not.toBe(first.body.sos_incident_id);
    expect(other.body).toMatchObject({notification_count:0,delivery_status:'recorded'});
    const send=jest.fn<ReturnType<NotificationSender>,Parameters<NotificationSender>>().mockResolvedValue('retry-provider-fixture');
    await processSosNotifications(pool,config.sosDelivery,send);
    expect(send).toHaveBeenCalledTimes(1);
  });
  test('manual SOS reports missing sending services without claiming notification success',async()=>{
    await save().expect(200);
    const wasEnabled=config.sosDelivery.enabled;config.sosDelivery.enabled=false;
    try{
      const response=await api().post('/api/v1/sos').set(auth(alice)).send({}).expect(201);
      expect(response.body).toMatchObject({notification_count:1,delivery_status:'setup_required'});
      const send=jest.fn<ReturnType<NotificationSender>,Parameters<NotificationSender>>();
      await processSosNotifications(pool,config.sosDelivery,send);
      expect(send).not.toHaveBeenCalled();
      expect((await pool.query('SELECT status FROM sos_notifications')).rows).toEqual([{status:'blocked'}]);
    }finally{config.sosDelivery.enabled=wasEnabled;}
  });
  test('daily reports are timezone scheduled once per local day',async()=>{
    await save({daily_report_enabled:true,daily_hour:0}).expect(200);
    await scheduleSos(pool);await scheduleSos(pool);
    expect((await pool.query("SELECT * FROM sos_incidents WHERE kind='daily'")).rowCount).toBe(1);
    const report=(await pool.query('SELECT report FROM sos_incidents')).rows[0].report;
    expect(report.total_readings).toBe(0);expect(report.ecg_note).toContain('does not classify');
  });
  test('backfill reuses prior hardware history and reports exclude unverified data',async()=>{
    const observed_at=new Date(Date.now()-1000).toISOString();
    for(const source of ['ESP32_MAX30102_DS18B20_AD8232','Simulator'])await api().post('/api/v1/ingest/vitals').set('X-Device-Key',key).send({
      session_id:randomUUID(),sequence:1,observed_at,heart_rate:72,spo2:98,temperature:36.5,ecg_status:'Unknown',source}).expect(200);
    await pool.query('DELETE FROM sos_observations');
    await pool.query("DELETE FROM schema_migrations WHERE name='007_sos_recent_history.sql'");await migrate(pool);
    expect((await pool.query('SELECT source FROM sos_observations')).rows).toEqual([{source:'ESP32_MAX30102_DS18B20_AD8232'}]);
    await reading(Date.now(),{heart_rate:250},'Simulator').expect(200);
    const report=(await api().get('/api/v1/sos/report').set(auth(alice)).expect(200)).body;
    expect(report.total_readings).toBe(1);expect(report.stats.max_hr).toBe(72);expect(report.stats.excluded_unverified_count).toBe(1);
  });
});
