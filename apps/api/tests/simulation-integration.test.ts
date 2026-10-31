import request from 'supertest';
import axios from 'axios';
import {randomUUID} from 'crypto';
import {Pool} from 'pg';
import {createPool,migrate} from '../src/db';
import {createApplication} from '../src/app';
import {loadConfig} from '../src/config';

(process.env.TEST_DATABASE_URL?describe:describe.skip)('Simulation backend boundaries',()=>{
  let pool:Pool,runtime:ReturnType<typeof createApplication>,token:string,hardware:string,hardwareKey:string;
  const api=()=>request(runtime.app),auth=()=>({Authorization:`Bearer ${token}`});
  const input={heart_rate:76,spo2:98,temperature:36.6,ecg_status:'Normal',generate_ecg_batch:true};
  beforeAll(async()=>{
    const db=process.env.TEST_DATABASE_URL!;
    if(!new URL(db).pathname.endsWith('_test')||process.env.ALLOW_TEST_RESET!=='1')throw Error('Explicit disposable database required');
    pool=createPool(db);await pool.query('DROP SCHEMA public CASCADE; DROP SCHEMA IF EXISTS legacy CASCADE; CREATE SCHEMA public');await migrate(pool);
    runtime=createApplication(pool,loadConfig({DATABASE_URL:db,JWT_SECRET:'simulation-signing-secret-at-least-32-characters',AI_INTERNAL_SECRET:'simulation-internal-secret-at-least-32-characters'}));
    token=(await api().post('/api/v1/auth/register').send({email:'simulation@example.test',password:'synthetic-simulation-password'}).expect(201)).body.token;
    const created=(await api().post('/api/v1/devices').set(auth()).send({name:'Physical sensor hub'}).expect(201)).body;
    hardware=created.id;hardwareKey=created.credential;
  },30000);
  afterAll(async()=>{if(runtime)await new Promise<void>(resolve=>runtime.io.close(()=>resolve()));await pool?.end();});
  it('requires authentication and rejects a forged physical source',async()=>{
    await api().post('/api/v1/admin/simulate').send(input).expect(401);
    await api().post('/api/v1/admin/simulate').set(auth()).send({...input,source:'ESP32_MAX30102_DS18B20_AD8232'}).expect(400);
    await api().post('/api/v1/admin/simulate/report').set(auth()).expect(400);
  });
  it('isolates generated readings from the active physical device, including concurrent requests',async()=>{
    const responses=await Promise.all([1,2].map(()=>api().post('/api/v1/admin/simulate').set(auth()).send(input).expect(200)));
    const simulator=responses[0].body.device.id;
    expect(simulator).not.toBe(hardware);expect(responses[1].body.device.id).toBe(simulator);
    expect(responses.map(r=>r.body.vitals.id)[0]).not.toBe(responses[1].body.vitals.id);
    expect(responses.every(r=>r.body.vitals.source==='BackOffice_Simulator'&&r.body.device.source==='BackOffice_Simulator')).toBe(true);
    expect((await pool.query('SELECT active,source,equipment FROM devices WHERE id=$1',[hardware])).rows[0]).toEqual({active:true,source:'Unknown',equipment:null});
    const batches=(await pool.query('SELECT session_id,sequence,source FROM ecg_batches WHERE device_id=$1',[simulator])).rows;
    expect(batches).toHaveLength(2);expect(batches.every(row=>row.source==='BackOffice_Simulator')).toBe(true);
    const summary=(await api().get('/api/v1/health/summary').set(auth()).expect(200)).body;
    expect(summary.device.id).toBe(hardware);expect(summary.vitals).toBeNull();
    await api().post(`/api/v1/devices/${simulator}/activate`).set(auth()).expect(200);
    expect((await api().get('/api/v1/ecg/stream').set(auth()).expect(200)).body.batches).toEqual([]);
  });
  it('keeps seeded history labelled as simulation',async()=>{
    const seeded=(await api().post('/api/v1/admin/simulate/seed').set(auth()).send({hours:1}).expect(200)).body;
    const sources=(await pool.query('SELECT DISTINCT source FROM vitals WHERE device_id=$1',[seeded.device.id])).rows;
    expect(sources).toEqual([{source:'BackOffice_Simulator'}]);
  });
  it('saves a readable original containing the actual labelled simulation summary',async()=>{
    const report=(await api().post('/api/v1/admin/simulate/report').set(auth()).expect(201)).body;
    expect(report.filename).toContain('Simulation');
    expect(report.analysis).toMatchObject({source:'rules',offline:true});
    const original=(await api().get(`/api/v1/reports/${report.id}`).set(auth()).expect(200)).body;
    const pdf=Buffer.from(original.base64,'base64').toString();
    expect(pdf).toContain('GENERATED TEST DATA');expect(pdf).toContain('Heart rate: mean');
    expect(pdf).toContain('/Contents 5 0 R');
    const xref=Number(pdf.match(/startxref\n(\d+)/)![1]);expect(pdf.slice(xref,xref+4)).toBe('xref');
  });
  it('keeps generated and unselected readings out of the physical AI history',async()=>{
    await api().post(`/api/v1/devices/${hardware}/activate`).set(auth()).expect(200);
    await api().post('/api/v1/ingest/vitals').set('X-Device-Key',hardwareKey).send({
      session_id:randomUUID(),sequence:1,observed_at:new Date().toISOString(),source:'ESP32_MAX30102_DS18B20_AD8232',
      heart_rate:82,spo2:98,temperature:36.7,ecg_status:'Normal',
    }).expect(200);
    const ai=jest.spyOn(axios,'post').mockResolvedValue({data:{reply:'Synthetic response',disclaimer:'Test only',offline:true}});
    try {
      await api().post('/api/v1/assistant/chat').set(auth()).send({message:'Test context'}).expect(200);
      expect(ai.mock.calls[0][1]).toMatchObject({historical_vitals:{sample_count:1,average_heart_rate:82}});
    } finally {ai.mockRestore();}
  });
  it('blocks all simulation operations in production even for an authenticated account',async()=>{
    const production=createApplication(pool,loadConfig({DATABASE_URL:process.env.TEST_DATABASE_URL!,
      JWT_SECRET:'simulation-signing-secret-at-least-32-characters',AI_INTERNAL_SECRET:'simulation-internal-secret-at-least-32-characters',
      NODE_ENV:'production',WEB_ORIGIN:'https://vyana.example.test'}));
    try {
      await request(production.app).get('/api/v1/admin/simulate/status').set(auth()).expect(403);
      for(const route of ['','/seed','/report'])await request(production.app).post(`/api/v1/admin/simulate${route}`).set(auth()).send(input).expect(403);
    } finally {await new Promise<void>(resolve=>production.io.close(()=>resolve()));}
  });
});
