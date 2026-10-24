import request from 'supertest';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { io as connect, Socket } from 'socket.io-client';
import { Pool } from 'pg';
import { createPool, migrate } from '../src/db';
import { createApplication } from '../src/app';
import { loadConfig } from '../src/config';
import { AddressInfo } from 'net';
import { digest } from '../src/auth';

const describeDatabase=process.env.TEST_DATABASE_URL?describe:describe.skip;
describeDatabase('Owned API integration against disposable PostgreSQL',()=>{
  let pool:Pool;
  let runtime:ReturnType<typeof createApplication>;
  let url:string;
  let alice:string,bob:string,key:string,deviceId:string,cookie:string;
  const sockets:Socket[]=[];
  const secret='integration-test-signing-key-at-least-32-characters';
  const session=randomUUID();
  const vital=(sequence:number,heart_rate=72,observed_at=new Date().toISOString())=>({session_id:session,sequence,observed_at,heart_rate,spo2:98,temperature:36.7,ecg_status:'Normal',source:'Test'});
  const api=()=>request(runtime.app);
  const auth=(token:string)=>({Authorization:`Bearer ${token}`});
  beforeAll(async()=>{
    const db=process.env.TEST_DATABASE_URL!;
    if(!new URL(db).pathname.endsWith('_test') || process.env.ALLOW_TEST_RESET!=='1') throw new Error('Integration reset requires an explicit disposable *_test database and ALLOW_TEST_RESET=1');
    pool=createPool(db);
    await pool.query('DROP SCHEMA public CASCADE; DROP SCHEMA IF EXISTS legacy CASCADE; CREATE SCHEMA public');
    await pool.query("CREATE TABLE profile(id SERIAL PRIMARY KEY,full_name TEXT); INSERT INTO profile(full_name) VALUES('Legacy unassigned')");
    await migrate(pool);
    const config=loadConfig({DATABASE_URL:db,JWT_SECRET:secret,AI_INTERNAL_SECRET:'integration-internal-key-at-least-32-characters',AI_URL:'http://127.0.0.1:1',WEB_ORIGIN:'http://localhost:5173'});
    runtime=createApplication(pool,config);
    await new Promise<void>(resolve=>runtime.server.listen(0,'127.0.0.1',resolve));
    url=`http://127.0.0.1:${(runtime.server.address() as AddressInfo).port}`;
  },30000);
  afterAll(async()=>{
    sockets.forEach(socket=>socket.disconnect());
    if(runtime) await new Promise<void>(resolve=>runtime.io.close(()=>resolve()));
    await pool?.end();
  });
  it('preserves unowned legacy records and migrates idempotently',async()=>{
    expect((await pool.query('SELECT full_name FROM legacy.profile')).rows[0].full_name).toBe('Legacy unassigned');
    expect((await pool.query('SELECT * FROM profile')).rows).toHaveLength(0);
    await migrate(pool);
  });
  it('creates isolated accounts with hashed refresh sessions',async()=>{
    const a=await api().post('/api/v1/auth/register').send({email:'alice@example.test',password:'password-for-tests'}).expect(201);
    alice=a.body.token;cookie=a.headers['set-cookie'][0].split(';')[0];
    const b=await api().post('/api/v1/auth/register').send({email:'bob@example.test',password:'password-for-tests'}).expect(201);bob=b.body.token;
    expect((await pool.query('SELECT token_hash FROM sessions')).rows.every(row=>row.token_hash.length===64)).toBe(true);
    await api().get('/api/v1/profile').expect(401);
  });
  it('rejects the published fallback secret and invented users',async()=>{
    const token=jwt.sign({sid:randomUUID()},'healthguard-dev-secret-change-me',{subject:'1',issuer:'healthguard',audience:'healthguard-web'});
    await api().get('/api/v1/profile').set(auth(token)).expect(401);
    const invented=jwt.sign({sid:randomUUID()},secret,{subject:'999999',issuer:'healthguard',audience:'healthguard-web'});
    await api().get('/api/v1/profile').set(auth(invented)).expect(401);
  });
  it('preserves optional profile fields and isolates profile/contact access',async()=>{
    await api().post('/api/v1/profile').set(auth(alice)).send({height_cm:200,weight_kg:99.9,dob:'1990-01-01',medications:'Keep this',allergies:'Keep too'}).expect(200);
    const edit=await api().patch('/api/v1/profile').set(auth(alice)).send({goal:'Test goal'}).expect(200);
    expect(edit.body.medications).toBe('Keep this');expect(edit.body.allergies).toBe('Keep too');
    expect((await api().get('/api/v1/profile').set(auth(bob))).body.onboarded).toBe(false);
    const contact=await api().post('/api/v1/profile/contacts').set(auth(alice)).send({name:'Doctor',phone:'12345678'}).expect(201);
    expect((await api().get('/api/v1/profile/contacts').set(auth(bob))).body).toEqual([]);
    await api().delete(`/api/v1/profile/contacts/${contact.body.id}`).set(auth(bob)).expect(404);
    await api().patch('/api/v1/profile').set(auth(alice)).send({dob:'not-a-date'}).expect(400);
  });
  it('requires provisioned devices and validates storage-compatible readings',async()=>{
    const device=await api().post('/api/v1/devices').set(auth(alice)).send({name:'Test band'}).expect(201);
    key=device.body.credential;deviceId=device.body.id;
    await api().post('/api/v1/ingest/vitals').send(vital(1)).expect(401);
    await api().post('/api/v1/ingest/vitals').set('X-Device-Key',key).send({...vital(1),heart_rate:72.5}).expect(400);
    await api().post('/api/v1/ingest/vitals').set('X-Device-Key',key).send({...vital(1),user_id:2}).expect(400);
    await api().delete(`/api/v1/devices/${deviceId}`).set(auth(bob)).expect(404);
  });
  it('escalates a warning immediately and deduplicates retries',async()=>{
    await api().post('/api/v1/ingest/vitals').set('X-Device-Key',key).send(vital(1,125)).expect(200);
    await api().post('/api/v1/ingest/vitals').set('X-Device-Key',key).send(vital(2,165)).expect(200);
    const duplicate=await api().post('/api/v1/ingest/vitals').set('X-Device-Key',key).send(vital(2,165)).expect(200);
    expect(duplicate.body.duplicate).toBe(true);
    const alerts=(await api().get('/api/v1/alerts').set(auth(alice))).body;
    expect(alerts).toHaveLength(1);expect(alerts[0].severity).toBe('critical');
    expect((await api().get('/api/v1/vitals/trends').set(auth(bob))).body).toEqual([]);
    expect((await api().get('/api/v1/alerts').set(auth(bob))).body).toEqual([]);
  });
  it('resolves on three recovery readings and starts a new episode on recurrence',async()=>{
    for(const seq of [3,4,5])await api().post('/api/v1/ingest/vitals').set('X-Device-Key',key).send(vital(seq)).expect(200);
    expect((await api().get('/api/v1/alerts').set(auth(alice))).body[0].status).toBe('resolved');
    await api().post('/api/v1/ingest/vitals').set('X-Device-Key',key).send(vital(6,165)).expect(200);
    expect((await api().get('/api/v1/alerts').set(auth(alice))).body).toHaveLength(2);
  });
  it('does not replace fresh readings or fire current alerts for offline replay',async()=>{
    const old=new Date(Date.now()-3600000).toISOString();
    await api().post('/api/v1/ingest/vitals').set('X-Device-Key',key).send(vital(7,250,old)).expect(200);
    const data=(await api().get('/api/v1/health/summary').set(auth(alice))).body;
    expect(data.vitals.heart_rate).toBe(165);expect(data.freshness.state).toBe('fresh');
    expect((await api().get('/api/v1/alerts').set(auth(alice))).body).toHaveLength(2);
  });
  it('keeps SOS critical and supports owner-scoped resolution',async()=>{
    const sos=await api().post('/api/v1/sos').set(auth(alice)).send({note:'Synthetic test'}).expect(201);
    await api().post(`/api/v1/alerts/${sos.body.id}/resolve`).set(auth(bob)).expect(404);
    await api().post(`/api/v1/alerts/${sos.body.id}/acknowledge`).set(auth(alice)).expect(200);
    expect((await api().get('/api/v1/health/summary').set(auth(alice))).body.alerts[0].severity).toBe('critical');
    await api().post(`/api/v1/alerts/${sos.body.id}/resolve`).set(auth(alice)).expect(200);
  });
  it('does not fabricate scores or normal states without data',async()=>{
    const result=(await api().get('/api/v1/health/summary').set(auth(bob))).body;
    expect(result.wellness_score).toBeNull();expect(result.vitals).toBeNull();expect(result.device).toBeNull();
    expect(result.freshness.state).toBe('missing');
  });
  it('rejects invalid uploads with structured errors before model calls',async()=>{
    await api().post('/api/v1/assistant/report').set(auth(alice)).send({data_base64:'%%%%',mime_type:'image/png'}).expect(400);
    const file=Buffer.alloc(10*1024*1024,48);file.write('%PDF-');
    const allowed=await api().post('/api/v1/assistant/report').set(auth(alice)).send({data_base64:file.toString('base64'),mime_type:'application/pdf'}).expect(200);
    expect(allowed.body.offline).toBe(true);
    const tooBig=await api().post('/api/v1/assistant/report').set(auth(alice)).send({data_base64:Buffer.concat([file,Buffer.from('0')]).toString('base64'),mime_type:'application/pdf'});
    expect([400,413]).toContain(tooBig.status);expect(tooBig.type).toMatch(/json/);
  });
  it('rejects unauthenticated sockets and isolates live events by owner',async()=>{
    const unauth=connect(url,{forceNew:true,reconnection:false});sockets.push(unauth);
    await new Promise<void>((resolve,reject)=>{unauth.once('connect',()=>reject(new Error('Unauthenticated connection')));unauth.once('connect_error',()=>resolve());});
    const a=connect(url,{auth:{token:alice},forceNew:true}),b=connect(url,{auth:{token:bob},forceNew:true});sockets.push(a,b);
    await Promise.all([a,b].map(socket=>new Promise<void>(resolve=>socket.once('connect',()=>resolve()))));
    const leaked:unknown[]=[];b.on('health_update',value=>leaked.push(value));
    const delivered=new Promise<void>(resolve=>a.once('health_update',()=>resolve()));
    await api().post('/api/v1/ingest/vitals').set('X-Device-Key',key).send(vital(8)).expect(200);
    await delivered;await new Promise(resolve=>setTimeout(resolve,50));expect(leaked).toHaveLength(0);
  });
  it('rolls back readings and alert state after an alert write failure, then retries once',async()=>{
    await pool.query("CREATE FUNCTION reject_test_alert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic write failure'; END $$; CREATE TRIGGER reject_test_alert BEFORE INSERT ON alerts FOR EACH ROW EXECUTE FUNCTION reject_test_alert()");
    const reading={...vital(20),temperature:40};
    try {
      await api().post('/api/v1/ingest/vitals').set('X-Device-Key',key).send(reading).expect(503);
      expect((await pool.query('SELECT id FROM vitals WHERE device_id=$1 AND sequence=20',[deviceId])).rowCount).toBe(0);
      await api().get('/health/live').expect(200);
    } finally { await pool.query('DROP TRIGGER reject_test_alert ON alerts; DROP FUNCTION reject_test_alert()'); }
    const results=await Promise.all([1,2].map(()=>api().post('/api/v1/ingest/vitals').set('X-Device-Key',key).send(reading)));
    expect(results.map(result=>result.status)).toEqual([200,200]);
    expect(results.filter(result=>result.body.duplicate)).toHaveLength(1);
    expect((await pool.query("SELECT id FROM alerts WHERE device_id=$1 AND metric='temperature'",[deviceId])).rowCount).toBe(1);
  });
  it('counts day deltas across old baselines, session resets and duplicate activity',async()=>{
    const activitySession=randomUUID();
    await pool.query(`INSERT INTO activity(user_id,device_id,session_id,sequence,observed_at,source,steps,distance_km,calories,active_minutes)
      VALUES($1,$2,$3,1,NOW()-INTERVAL '3 days','Test',1000,1,50,5)`,[Number(jwt.decode(alice)!.sub),deviceId,activitySession]);
    const reading={session_id:activitySession,sequence:2,observed_at:new Date().toISOString(),steps:1100,distance_km:1.1,calories:60,active_minutes:6,source:'Test'};
    await api().post('/api/v1/ingest/activity').set('X-Device-Key',key).send(reading).expect(200);
    await api().post('/api/v1/ingest/activity').set('X-Device-Key',key).send(reading).expect(200);
    await api().post('/api/v1/ingest/activity').set('X-Device-Key',key).send({...reading,session_id:randomUUID(),steps:25,distance_km:.02,calories:2,active_minutes:1}).expect(200);
    const result=(await api().get('/api/v1/health/summary').set(auth(alice))).body.activity;
    expect(result.steps).toBe(125);expect(result.calories).toBe(12);expect(result.active_minutes).toBe(2);
    expect((await api().get('/api/v1/activity/summary').set(auth(bob))).body).toEqual([]);
    const boundary=(await pool.query(`WITH starts AS (SELECT
      date_trunc('day',NOW() AT TIME ZONE 'Pacific/Kiritimati') AT TIME ZONE 'Pacific/Kiritimati' a,
      date_trunc('day',NOW() AT TIME ZONE 'Etc/GMT+12') AT TIME ZONE 'Etc/GMT+12' b)
      SELECT LEAST(a,b)+(GREATEST(a,b)-LEAST(a,b))/2 AS instant,a<b AS a_earlier FROM starts`)).rows[0];
    await api().post('/api/v1/ingest/activity').set('X-Device-Key',key).send({...reading,session_id:randomUUID(),observed_at:boundary.instant.toISOString(),steps:50,distance_km:.03,calories:3,active_minutes:1}).expect(200);
    for(const [zone,expected] of [['Pacific/Kiritimati',boundary.a_earlier?175:125],['Etc/GMT+12',boundary.a_earlier?125:175]] as const) {
      await api().patch('/api/v1/profile').set(auth(alice)).send({timezone:zone}).expect(200);
      expect((await api().get('/api/v1/health/summary').set(auth(alice))).body.activity.steps).toBe(expected);
    }
  });
  it('paginates equal-time history with a composite cursor without losing records',async()=>{
    const time=new Date(Date.now()-60000).toISOString(),historySession=randomUUID();
    await pool.query(`INSERT INTO vitals(user_id,device_id,session_id,sequence,observed_at,source,heart_rate,spo2,temperature,ecg_status)
      SELECT $1,$2,$3,n,$4,'Test',72,98,36.7,'Normal' FROM generate_series(1,105)n`,[Number(jwt.decode(alice)!.sub),deviceId,historySession,time]);
    const first=(await api().get('/api/v1/vitals/trends?limit=100').set(auth(alice)).expect(200)).body;
    const second=(await api().get(`/api/v1/vitals/trends?limit=100&cursor=${encodeURIComponent(`${first[0].observed_at}|${first[0].id}`)}`).set(auth(alice)).expect(200)).body;
    const combined=[...first,...second];
    expect(new Set(combined.map(row=>row.id)).size).toBe(combined.length);
    expect(combined.filter(row=>row.session_id===historySession)).toHaveLength(105);
  });
  it('selects an empty new source without exposing old-device history or activity',async()=>{
    const other=await api().post('/api/v1/devices').set(auth(alice)).send({name:'Empty source'}).expect(201);
    await api().post(`/api/v1/devices/${other.body.id}/activate`).set(auth(alice)).send({}).expect(200);
    const data=(await api().get('/api/v1/health/summary').set(auth(alice))).body;
    expect(data.device.id).toBe(other.body.id);expect(data.vitals).toBeNull();expect(data.activity).toBeNull();
    expect((await api().get('/api/v1/vitals/trends').set(auth(alice))).body).toEqual([]);
    await api().post(`/api/v1/devices/${other.body.id}/activate`).set(auth(bob)).send({}).expect(404);
    await api().post(`/api/v1/devices/${deviceId}/activate`).set(auth(alice)).send({}).expect(200);
  });
  it('uses one-time recovery and verification tokens and revokes prior sessions',async()=>{
    const owner=Number(jwt.decode(bob)!.sub),token='synthetic-recovery-token-with-more-than-32-characters';
    await api().post('/api/v1/auth/request-reset').send({email:'bob@example.test'}).expect(202);
    const queued=(await pool.query('SELECT encrypted_payload FROM delivery_outbox WHERE user_id=$1',[owner])).rows;
    expect(queued.length).toBeGreaterThan(0);expect(JSON.stringify(queued)).not.toContain(token);
    await pool.query("INSERT INTO account_tokens(user_id,purpose,token_hash,expires_at) VALUES($1,'reset',$2,NOW()+INTERVAL '1 minute')",[owner,digest(token)]);
    await api().post('/api/v1/auth/reset-password').send({token,password:'new-password-for-tests'}).expect(200);
    await api().post('/api/v1/auth/reset-password').send({token,password:'another-password-for-tests'}).expect(400);
    await api().get('/api/v1/profile').set(auth(bob)).expect(401);
    const verificationToken=token+'verify';
    await pool.query("INSERT INTO account_tokens(user_id,purpose,token_hash,expires_at) VALUES($1,'verify',$2,NOW()+INTERVAL '1 minute')",[owner,digest(verificationToken)]);
    await api().post('/api/v1/auth/verify').send({token:verificationToken}).expect(200);
    await api().post('/api/v1/auth/verify').send({token:verificationToken}).expect(400);
  });
  it('revokes device credentials and refresh sessions even during an expired-token logout race',async()=>{
    await api().delete(`/api/v1/devices/${deviceId}`).set(auth(alice)).expect(200);
    await api().post('/api/v1/ingest/vitals').set('X-Device-Key',key).send(vital(9)).expect(401);
    const refresh=await api().post('/api/v1/auth/refresh').set('Cookie',cookie).set('X-HealthGuard-Client','web').expect(200);
    const newCookie=refresh.headers['set-cookie'][0].split(';')[0];
    await api().post('/api/v1/auth/refresh').set('Cookie',cookie).set('X-HealthGuard-Client','web').expect(401);
    const original=jwt.decode(alice) as jwt.JwtPayload;
    const expired=jwt.sign({sid:original.sid},secret,{subject:original.sub,issuer:'healthguard',audience:'healthguard-web',expiresIn:-1});
    await api().get('/api/v1/profile').set(auth(expired)).expect(401);
    await api().post('/api/v1/auth/logout').set('Cookie',cookie).set(auth(expired)).set('X-HealthGuard-Client','web').expect(200);
    await api().post('/api/v1/auth/refresh').set('Cookie',newCookie).set('X-HealthGuard-Client','web').expect(401);
    await api().get('/api/v1/profile').set(auth(refresh.body.token)).expect(401);
  });
});
