import request from 'supertest';
import {Pool} from 'pg';
import {createPool,migrate} from '../src/db';
import {createApplication} from '../src/app';
import {loadConfig} from '../src/config';

const withDatabase=process.env.TEST_DATABASE_URL?describe:describe.skip;
withDatabase('independent live equipment against disposable PostgreSQL',()=>{
  let pool:Pool,runtime:ReturnType<typeof createApplication>,token:string,other:string,key:string,id:string;
  const status={device_name:'ESP32',connected:true,battery:null,source:'ESP32_RealVitals_SimulatedSteps'};
  const equipment=(observed_at=new Date().toISOString())=>({observed_at,temperature_c:25.1875,
    ecg_status:'Leads Off',ecg_raw_adc:4095,ecg_millivolts:3160,ecg_samples:0,ecg_clipped_samples:0});
  const api=()=>request(runtime.app);
  const auth=(value:string)=>({Authorization:`Bearer ${value}`});
  beforeAll(async()=>{
    const db=process.env.TEST_DATABASE_URL!;
    if(!new URL(db).pathname.endsWith('_test')||process.env.ALLOW_TEST_RESET!=='1')throw new Error('Disposable *_test database required');
    pool=createPool(db);
    await pool.query('DROP SCHEMA public CASCADE; DROP SCHEMA IF EXISTS legacy CASCADE; CREATE SCHEMA public');
    await migrate(pool);
    runtime=createApplication(pool,loadConfig({DATABASE_URL:db,JWT_SECRET:'equipment-test-signing-key-at-least-32-characters',
      AI_INTERNAL_SECRET:'equipment-test-internal-key-at-least-32-characters',WEB_ORIGIN:'http://localhost:5173'}));
    await new Promise<void>(resolve=>runtime.server.listen(0,'127.0.0.1',resolve));
    token=(await api().post('/api/v1/auth/register').send({email:'probe@example.test',password:'equipment-tests-password'}).expect(201)).body.token;
    other=(await api().post('/api/v1/auth/register').send({email:'other@example.test',password:'equipment-tests-password'}).expect(201)).body.token;
    const device=await api().post('/api/v1/devices').set(auth(token)).send({name:'ESP32'}).expect(201);
    key=device.body.credential;id=device.body.id;
  },30000);
  afterAll(async()=>{
    if(runtime)await new Promise<void>(resolve=>runtime.io.close(()=>resolve()));
    await pool?.end();
  });
  it('exposes probe and lead data to its owner without inventing a vital record',async()=>{
    const snapshot=equipment();
    await api().post('/api/v1/device/status').set('X-Device-Key',key).send({...status,equipment:snapshot}).expect(200);
    const summary=(await api().get('/api/v1/health/summary').set(auth(token)).expect(200)).body;
    expect(summary.device.equipment).toEqual(snapshot);expect(summary.vitals).toBeNull();
    expect(summary.wellness_score).toBeNull();expect(summary.freshness.state).toBe('missing');
    expect((await api().get('/api/v1/health/summary').set(auth(other))).body.device).toBeNull();
    await api().post('/api/v1/device/status').send({...status,equipment:snapshot}).expect(401);
  });
  it('keeps the latest observation during replay and lets a missing probe clear its value',async()=>{
    const current=equipment();
    await api().post('/api/v1/device/status').set('X-Device-Key',key).send({...status,equipment:current}).expect(200);
    await api().post('/api/v1/device/status').set('X-Device-Key',key).send({...status,equipment:{...equipment(new Date(Date.now()-60000).toISOString()),temperature_c:90}}).expect(200);
    expect((await api().get('/api/v1/device').set(auth(token))).body.equipment).toEqual(current);
    await api().post('/api/v1/device/status').set('X-Device-Key',key).send(status).expect(200);
    expect((await api().get('/api/v1/device').set(auth(token))).body.equipment).toEqual(current);
    await api().post('/api/v1/device/status').set('X-Device-Key',key).send({...status,equipment:{...equipment(),temperature_c:null}}).expect(200);
    expect((await api().get('/api/v1/device').set(auth(token))).body.equipment.temperature_c).toBeNull();
  });
  it('rejects malformed or impossible equipment measurements',async()=>{
    for(const patch of [{temperature_c:126},{ecg_status:'Normal'},{ecg_raw_adc:4096},
      {heart_rate:0},{heart_rate:301},{heart_rate:72.5},{spo2:-1},{spo2:101},
      {ecg_clipped_samples:1,ecg_samples:0},{observed_at:new Date(Date.now()+60000).toISOString()}])
      await api().post('/api/v1/device/status').set('X-Device-Key',key).send({...status,equipment:{...equipment(),...patch}}).expect(400);
  });
  it('persists independent optical channels and explicit nulls without complete vitals',async()=>{
    for(const channels of [{heart_rate:72,spo2:null},{heart_rate:null,spo2:98},{heart_rate:null,spo2:null}]) {
      const snapshot={...equipment(),...channels,temperature_c:null};
      await api().post('/api/v1/device/status').set('X-Device-Key',key).send({...status,equipment:snapshot}).expect(200);
      const summary=(await api().get('/api/v1/health/summary').set(auth(token)).expect(200)).body;
      expect(summary.device.equipment).toEqual(snapshot);expect(summary.vitals).toBeNull();
      expect((await api().get('/api/v1/health/summary').set(auth(other))).body.device).toBeNull();
    }
  });
  it('removes access when the hardware credential is revoked',async()=>{
    await api().delete(`/api/v1/devices/${id}`).set(auth(token)).expect(200);
    await api().post('/api/v1/device/status').set('X-Device-Key',key).send({...status,equipment:equipment()}).expect(401);
  });
});
