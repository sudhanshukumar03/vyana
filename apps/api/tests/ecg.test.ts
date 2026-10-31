import request from 'supertest';
import {randomUUID} from 'crypto';
import type {Pool} from 'pg';
import {createPool,migrate} from '../src/db';
import {loadConfig} from '../src/config';
import {createApplication} from '../src/app';

(process.env.TEST_DATABASE_URL?describe:describe.skip)('bounded owned ECG transport',()=>{
  let pool:Pool,runtime:ReturnType<typeof createApplication>,token:string,other:string,key:string,device:string,owner:number;
  const session=randomUUID(),api=()=>request(runtime.app),auth=(t=token)=>({Authorization:`Bearer ${t}`});
  const batch=(sequence=1)=>({session_id:session,sequence,observed_at:new Date(Date.now()-1000).toISOString(),source:'ESP32_MAX30102_DS18B20_AD8232',samples:[[0,2000,0],[4,4095,0],[12,1800,1]]});
  beforeAll(async()=>{
    const db=process.env.TEST_DATABASE_URL!;
    if(!new URL(db).pathname.endsWith('_test')||process.env.ALLOW_TEST_RESET!=='1')throw Error('Explicit disposable database required');
    pool=createPool(db);await pool.query('DROP SCHEMA public CASCADE; DROP SCHEMA IF EXISTS legacy CASCADE; CREATE SCHEMA public');await migrate(pool);
    runtime=createApplication(pool,loadConfig({DATABASE_URL:db,JWT_SECRET:'synthetic-ecg-signing-secret-at-least-32',AI_INTERNAL_SECRET:'synthetic-ecg-internal-secret-at-least-32'}));
    await new Promise<void>(resolve=>runtime.server.listen(0,'127.0.0.1',resolve));
    const login=(await api().post('/api/v1/auth/register').send({email:'ecg@example.test',password:'synthetic-ecg-password'}).expect(201)).body;
    token=login.token;owner=login.user.id;
    other=(await api().post('/api/v1/auth/register').send({email:'ecg-other@example.test',password:'synthetic-ecg-password'}).expect(201)).body.token;
    const created=(await api().post('/api/v1/devices').set(auth()).send({name:'ECG fixture'}).expect(201)).body;key=created.credential;device=created.id;
  },30000);
  afterAll(async()=>{if(runtime)await new Promise<void>(resolve=>runtime.io.close(()=>resolve()));await pool?.end();});
  it('requires ownership and validates sample values, clock, source and bounded size',async()=>{
    await api().post('/api/v1/ingest/ecg').send(batch()).expect(401);await api().get('/api/v1/ecg/stream').expect(401);
    for(const patch of [{samples:[]},{samples:[[1,2000,0]]},{samples:[[0,2000,0],[0,2100,0]]},
      {samples:[[0,4096,0]]},{samples:[[0,2000,4]]},{samples:Array.from({length:129},(_,i)=>[i,2000,0])},
      {source:'DisplayPreview'},{source:'BackOffice_Simulator'},{observed_at:new Date(Date.now()+60000).toISOString()},{sequence:9007199254740991}])
      await api().post('/api/v1/ingest/ecg').set('X-Device-Key',key).send({...batch(),...patch}).expect(400);
  });
  it('deduplicates exact retries and rejects changed or overlapping samples',async()=>{
    const input=batch();const first=(await api().post('/api/v1/ingest/ecg').set('X-Device-Key',key).send(input).expect(200)).body;
    expect(first.duplicate).toBe(false);
    expect((await api().post('/api/v1/ingest/ecg').set('X-Device-Key',key).send(input).expect(200)).body).toMatchObject({duplicate:true,id:first.id});
    await api().post('/api/v1/ingest/ecg').set('X-Device-Key',key).send({...input,samples:[[0,1000,0]]}).expect(409);
    await api().post('/api/v1/ingest/ecg').set('X-Device-Key',key).send({...input,sequence:2}).expect(409);
    const stream=(await api().get('/api/v1/ecg/stream').set(auth()).expect(200)).body;
    expect(stream.device_id).toBe(device);expect(stream.batches).toHaveLength(1);expect(stream.batches[0].samples).toEqual(input.samples);
    expect((await api().get('/api/v1/ecg/stream').set(auth(other)).expect(200)).body.batches).toEqual([]);
  });
  it('accepts disjoint out-of-order batches and reboot sessions with incremental cursors',async()=>{
    const cursor=(await api().get('/api/v1/ecg/stream').set(auth())).body.cursor;
    for(const input of [batch(300),batch(100),{...batch(),session_id:randomUUID()}])
      await api().post('/api/v1/ingest/ecg').set('X-Device-Key',key).send(input).expect(200);
    const stream=(await api().get(`/api/v1/ecg/stream?after=${cursor}&device=${device}`).set(auth()).expect(200)).body;
    expect(stream.batches).toHaveLength(3);expect(stream.batches.map((b:{sequence:number})=>b.sequence)).toEqual([300,100,1]);
    expect((await api().get(`/api/v1/ecg/stream?after=${stream.cursor}`).set(auth())).body.batches).toEqual([]);
    await api().get('/api/v1/ecg/stream?after=-1').set(auth()).expect(400);
    await api().get('/api/v1/ecg/stream?limit=999999').set(auth()).expect(400);
    expect((await api().get(`/api/v1/ecg/stream?device=${randomUUID()}`).set(auth())).body.batches).toEqual([]);
  });
  it('hides expired data and bounds device storage and response size',async()=>{
    await pool.query("UPDATE ecg_batches SET observed_at=NOW()-INTERVAL '11 minutes'");
    expect((await api().get('/api/v1/ecg/stream').set(auth())).body.batches).toEqual([]);
    await pool.query(`INSERT INTO ecg_batches(user_id,device_id,session_id,sequence,observed_at,source,samples)
      SELECT $1,$2,$3,50000+n,NOW(),$4,'[[0,2000,0]]'::jsonb FROM generate_series(1,1205)n`,[owner,device,session,batch().source]);
    await api().post('/api/v1/ingest/ecg').set('X-Device-Key',key).send(batch(900000)).expect(200);
    expect((await pool.query('SELECT COUNT(*)::int n FROM ecg_batches WHERE device_id=$1',[device])).rows[0].n).toBe(1200);
    expect((await api().get('/api/v1/ecg/stream').set(auth())).body.batches).toHaveLength(24);
  });
  it('stops a revoked device from uploading or appearing in the selected stream',async()=>{
    await api().delete(`/api/v1/devices/${device}`).set(auth()).expect(200);
    await api().post('/api/v1/ingest/ecg').set('X-Device-Key',key).send(batch(1000000)).expect(401);
    expect((await api().get('/api/v1/ecg/stream').set(auth())).body).toMatchObject({device_id:null,batches:[]});
  });
});
