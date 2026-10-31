import request from 'supertest';
import axios from 'axios';
import type {Pool} from 'pg';
import {createPool,migrate} from '../src/db';
import {createApplication} from '../src/app';
import {loadConfig} from '../src/config';
import {randomUUID} from 'crypto';

const databaseTests=process.env.TEST_DATABASE_URL?describe:describe.skip;
databaseTests('Software-only report, contact and location regressions',()=>{
  let pool:Pool,runtime:ReturnType<typeof createApplication>,owner:string,other:string;
  const api=()=>request(runtime.app),auth=(token=owner)=>({Authorization:`Bearer ${token}`});
  const file={filename:'private-fixture.pdf',mime_type:'application/pdf',data_base64:Buffer.from('%PDF- synthetic software fixture').toString('base64')};
  const analysis={summary:'Synthetic review for this test only.',discussion_points:['Synthetic discussion point.'],document_status:'readable',
    source:'gemini',reason:null,retry_after_seconds:null,sections:[],disclaimer:'Synthetic fixture; not medical advice.',offline:false};
  beforeAll(async()=>{
    const database=process.env.TEST_DATABASE_URL!;
    if(!new URL(database).pathname.endsWith('_test')||process.env.ALLOW_TEST_RESET!=='1')throw Error('Explicit disposable database required');
    pool=createPool(database);await pool.query('DROP SCHEMA public CASCADE; DROP SCHEMA IF EXISTS legacy CASCADE; CREATE SCHEMA public');await migrate(pool);
    runtime=createApplication(pool,loadConfig({DATABASE_URL:database,JWT_SECRET:'synthetic-software-signing-key-at-least-32',AI_INTERNAL_SECRET:'synthetic-software-internal-key-at-least-32',GEOAPIFY_API_KEY:'synthetic-server-only-location-key'}));
    await new Promise<void>(resolve=>runtime.server.listen(0,'127.0.0.1',resolve));
    owner=(await api().post('/api/v1/auth/register').send({email:'software-owner@example.test',password:'synthetic-software-password'}).expect(201)).body.token;
    other=(await api().post('/api/v1/auth/register').send({email:'software-other@example.test',password:'synthetic-software-password'}).expect(201)).body.token;
  },30000);
  afterAll(async()=>{if(runtime)await new Promise<void>(resolve=>runtime.io.close(()=>resolve()));await pool?.end();});
  afterEach(()=>jest.restoreAllMocks());
  it('starts empty and requires authentication for report access',async()=>{
    await api().get('/api/v1/reports').expect(401);
    expect((await api().get('/api/v1/reports').set(auth()).expect(200)).body).toEqual([]);
  });
  it('encrypts originals and reviews and isolates every report operation by owner',async()=>{
    jest.spyOn(axios,'post').mockResolvedValue({data:analysis});
    const saved=(await api().post('/api/v1/reports').set(auth()).send(file).expect(201)).body;
    expect(saved.status).toBe('reviewed');expect(saved.base64).toBeUndefined();
    const row=(await pool.query('SELECT encrypted_metadata,encrypted_document FROM saved_reports WHERE id=$1',[saved.id])).rows[0];
    expect(JSON.stringify(row)).not.toContain(file.filename);expect(JSON.stringify(row)).not.toContain(file.data_base64);
    expect((await api().get(`/api/v1/reports/${saved.id}`).set(auth()).expect(200)).body.base64).toBe(file.data_base64);
    await api().get(`/api/v1/reports/${saved.id}`).set(auth(other)).expect(404);
    await api().post(`/api/v1/reports/${saved.id}/review`).set(auth(other)).send({}).expect(404);
    await api().delete(`/api/v1/reports/${saved.id}`).set(auth(other)).expect(404);
    expect((await api().get('/api/v1/reports').set(auth(other)).expect(200)).body).toEqual([]);
    await api().delete(`/api/v1/reports/${saved.id}`).set(auth()).expect(200);
    await api().get(`/api/v1/reports/${saved.id}`).set(auth()).expect(404);
  });
  it('preserves failed review provenance and retries the actual original',async()=>{
    const call=jest.spyOn(axios,'post').mockRejectedValueOnce(Error('synthetic provider failure'));
    const saved=(await api().post('/api/v1/reports').set(auth()).send(file).expect(201)).body;
    expect(saved).toMatchObject({status:'pending',documentStatus:'not_reviewed',analysis:{source:'fallback',offline:true}});
    call.mockResolvedValueOnce({data:analysis});
    const retry=(await api().post(`/api/v1/reports/${saved.id}/review`).set(auth()).send({}).expect(200)).body;
    expect(retry.status).toBe('reviewed');expect(call.mock.calls[1][1]).toMatchObject(file);
    await api().delete(`/api/v1/reports/${saved.id}`).set(auth()).expect(200);
  });
  it('rejects fabricated client analysis and invalid files before provider access',async()=>{
    const call=jest.spyOn(axios,'post');
    await api().post('/api/v1/reports').set(auth()).send({...file,analysis}).expect(400);
    await api().post('/api/v1/reports').set(auth()).send({...file,data_base64:'%%%%'}).expect(400);
    expect(call).not.toHaveBeenCalled();
  });
  it('does not resurrect a report deleted while a retry is running',async()=>{
    const call=jest.spyOn(axios,'post').mockResolvedValue({data:analysis});
    const saved=(await api().post('/api/v1/reports').set(auth()).send(file).expect(201)).body;
    let release:(value:unknown)=>void=()=>{},started:()=>void=()=>{};
    const began=new Promise<void>(resolve=>{started=resolve;});
    call.mockImplementationOnce(()=>{started();return new Promise(resolve=>{release=resolve;});});
    const retry=api().post(`/api/v1/reports/${saved.id}/review`).set(auth()).send({}).then(result=>result);
    await began;await api().delete(`/api/v1/reports/${saved.id}`).set(auth()).expect(200);release({data:analysis});
    expect((await retry).status).toBe(404);
    await api().get(`/api/v1/reports/${saved.id}`).set(auth()).expect(404);
  });
  it('stores office and personal telephone numbers in separate fields',async()=>{
    const contact=(await api().post('/api/v1/profile/contacts').set(auth()).send({name:'Synthetic doctor',office_phone:'+15550102020',is_doctor:true}).expect(201)).body;
    expect(contact.phone).toBeNull();expect(contact.office_phone).toBe('+15550102020');
    const others=(await api().get('/api/v1/profile/contacts').set(auth(other)).expect(200)).body;
    expect(others).toEqual([]);
  });
  it('proxies location keys only server-side and bounds provider inputs',async()=>{
    const get=jest.spyOn(axios,'get').mockResolvedValue({data:{features:[]}});
    await api().get('/api/v1/locations/geoapify/places?lat=28&lon=77&radius=15000').expect(401);
    await api().get('/api/v1/locations/geoapify/places?lat=91&lon=77&radius=15000').set(auth()).expect(400);
    const result=await api().get('/api/v1/locations/geoapify/places?lat=28&lon=77&radius=15000').set(auth()).expect(200);
    expect(JSON.stringify(result.body)).not.toContain('synthetic-server-only');
    expect(get.mock.calls[0][0]).toBe('https://api.geoapify.com/v2/places');
    expect(get.mock.calls[0][1]).toMatchObject({params:{apiKey:'synthetic-server-only-location-key',categories:'healthcare.hospital,healthcare.clinic_or_praxis',filter:'circle:77,28,15000'}});
    await api().get('/api/v1/locations/ninjas/hospitals?city=Delhi').set(auth()).expect(503);
  });
  it('records partial snapshots without inventing missing vital channels and isolates history',async()=>{
    const device=(await api().post('/api/v1/devices').set(auth()).send({name:'Partial-sensor fixture'}).expect(201)).body;
    const equipment={observed_at:new Date().toISOString(),temperature_c:24.5,heart_rate:null,spo2:null,ecg_status:'Unknown',ecg_raw_adc:2030,ecg_millivolts:1400,ecg_samples:100,ecg_clipped_samples:0};
    const status={device_name:'Partial-sensor fixture',connected:true,battery:null,source:'ESP32_MAX30102_DS18B20_AD8232',equipment};
    await api().post('/api/v1/device/status').set('X-Device-Key',device.credential).send(status).expect(200);
    await api().post('/api/v1/device/status').set('X-Device-Key',device.credential).send(status).expect(200);
    const history=(await api().get('/api/v1/equipment/history').set(auth()).expect(200)).body;
    expect(history).toHaveLength(1);expect(history[0].equipment).toMatchObject({temperature_c:24.5,heart_rate:null,spo2:null});
    expect((await api().get('/api/v1/vitals/trends').set(auth()).expect(200)).body).toEqual([]);
    expect((await api().get('/api/v1/equipment/history').set(auth(other)).expect(200)).body).toEqual([]);
    await api().get('/api/v1/equipment/history?limit=1000').set(auth()).expect(400);
  });
  it('enforces the account byte quota before requesting paid AI work',async()=>{
    const user=(await pool.query("SELECT id FROM users WHERE email='software-other@example.test'")).rows[0].id;
    const ids=Array.from({length:8},()=>randomUUID());
    for(const id of ids)await pool.query('INSERT INTO saved_reports(id,user_id,encrypted_metadata,encrypted_document,size_bytes) VALUES($1,$2,$3,$3,$4)',[id,user,'synthetic quota fixture',10485760]);
    const call=jest.spyOn(axios,'post');
    await api().post('/api/v1/reports').set(auth(other)).send(file).expect(409);
    expect(call).not.toHaveBeenCalled();
    await pool.query('DELETE FROM saved_reports WHERE id=ANY($1::uuid[])',[ids]);
  });
});
