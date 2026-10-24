import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import axios from 'axios';
import { createApplication } from '../src/app';
import { loadConfig } from '../src/config';
import { summary } from '../src/telemetry';
import { io as connect } from 'socket.io-client';
import { AddressInfo } from 'net';

jest.mock('axios');
jest.mock('../src/telemetry',()=>({...jest.requireActual('../src/telemetry'),summary:jest.fn()}));
const config=loadConfig({DATABASE_URL:'postgresql://unused/unit_test',JWT_SECRET:'unit-signing-secret-at-least-32-characters',
  AI_INTERNAL_SECRET:'different-internal-secret-at-least-32-characters'});
const sid=randomUUID();
const token=jwt.sign({sid},config.jwtSecret,{subject:'1',issuer:'healthguard',audience:'healthguard-web',expiresIn:'1m'});
const headers={Authorization:`Bearer ${token}`};
const owner={id:1,email:'unit@example.test',session_id:sid};

afterEach(()=>jest.restoreAllMocks());

test('database failures remain JSON 503 responses and liveness survives',async()=>{
  jest.spyOn(console,'error').mockImplementation(()=>{});
  const query=jest.fn(async(sql:string)=>{
    if(sql.includes('JOIN sessions'))return {rows:[owner]};
    if(sql.includes('credential_hash'))return {rows:[{id:randomUUID(),user_id:1,active:true}]};
    throw Object.assign(new Error('private database failure'),{code:'08006'});
  });
  const pool={query,connect:jest.fn().mockRejectedValue(new Error('unavailable'))} as unknown as Pool;
  const runtime=createApplication(pool,config);
  try {
    for(const path of ['/health/ready','/api/v1/profile','/api/v1/profile/contacts','/api/v1/vitals/trends']) {
      const result=await request(runtime.app).get(path).set(headers).expect(503);
      expect(result.type).toMatch(/json/);expect(result.body.error).toContain('temporarily unavailable');
      expect(JSON.stringify(result.body)).not.toContain('private database');
    }
    await request(runtime.app).post('/api/v1/device/status').set('X-Device-Key','synthetic-device-credential-with-32-chars')
      .send({device_name:'Test',connected:true,battery:null,source:'Unit'}).expect(503);
    await request(runtime.app).post('/api/v1/ingest/vitals').set('X-Device-Key','synthetic-device-credential-with-32-chars')
      .send({session_id:randomUUID(),sequence:1,observed_at:new Date().toISOString(),heart_rate:72,spo2:98,temperature:36.7,ecg_status:'Normal',source:'Unit'}).expect(503);
    await request(runtime.app).get('/health/live').expect(200);
    const oversized=await request(runtime.app).post('/api/v1/assistant/chat').set(headers).send({message:'x'.repeat(103000)}).expect(413);
    expect(oversized.body.error).toContain('100 KiB');
    const logout=await request(runtime.app).post('/api/v1/auth/logout').set('X-HealthGuard-Client','web').set(headers).expect(503);
    expect(logout.headers['set-cookie'][0]).toMatch(/hg_refresh=;/);
  } finally {runtime.io.close();}
});

test('AI capacity rejects before upload parsing and releases slots after completion',async()=>{
  const query=jest.fn(async(sql:string)=>({rows:sql.includes('JOIN sessions')?[owner]:[{sample_count:1,average_heart_rate:72}]}));
  const runtime=createApplication({query} as unknown as Pool,config);
  jest.mocked(summary).mockResolvedValue({vitals:null,activity:null,profile:null,alerts:[],insights:[],wellness_score:null,
    device:null,wellness_version:'prototype-v2',freshness:{state:'missing',age_seconds:null,stale_seconds:30},server_time:new Date().toISOString()});
  const pending:Array<(value:{data:unknown})=>void>=[];
  jest.mocked(axios.post).mockImplementation(()=>new Promise(resolve=>pending.push(resolve)));
  try {
    const active=[1,2,3].map(()=>request(runtime.app).post('/api/v1/assistant/chat').set(headers).send({message:'Synthetic question',history:[]}).then(result=>result));
    const until=Date.now()+3000;
    while(pending.length<3 && Date.now()<until)await new Promise(resolve=>setTimeout(resolve,10));
    expect(pending).toHaveLength(3);
    const busy=await request(runtime.app).post('/api/v1/assistant/report').set(headers).send({unvalidated:'not a report'}).expect(429);
    expect(busy.headers['retry-after']).toBe('5');
    pending.forEach(resolve=>resolve({data:{reply:'Synthetic answer',disclaimer:'Wellness guidance',offline:false}}));
    expect((await Promise.all(active)).every(result=>result.status===200)).toBe(true);
    jest.mocked(axios.post).mockResolvedValue({data:{reply:{invalid:true}}});
    const fallback=await request(runtime.app).post('/api/v1/assistant/chat').set(headers).send({message:'Question',history:[]}).expect(200);
    expect(fallback.body.offline).toBe(true);expect(typeof fallback.body.reply).toBe('string');
    jest.mocked(axios.post).mockResolvedValue({data:{insights:[{type:'info',title:'Synthetic',detail:'Rule-based guidance'}],offline:true}});
    const insights=await request(runtime.app).get('/api/v1/health/insights').set(headers).expect(200);
    expect(insights.body.offline).toBe(true);
    const context=jest.mocked(axios.post).mock.calls.at(-1)![1] as {owner_id:string;historical_vitals:{sample_count:number}};
    expect(context.owner_id).toBe('1');expect(context.historical_vitals.sample_count).toBe(1);
  } finally {
    pending.forEach(resolve=>resolve({data:{}}));runtime.io.close();
  }
});

test('a socket authentication database outage is reported as retryable, not an invalid identity',async()=>{
  const pool={query:jest.fn().mockRejectedValue(Object.assign(new Error('unavailable'),{code:'08006'}))} as unknown as Pool;
  const runtime=createApplication(pool,config);
  await new Promise<void>(resolve=>runtime.server.listen(0,'127.0.0.1',resolve));
  const address=runtime.server.address() as AddressInfo;
  const socket=connect(`http://127.0.0.1:${address.port}`,{auth:{token},forceNew:true,reconnection:false});
  try {
    const result=await new Promise<{message:string;status?:number}>(resolve=>socket.once('connect_error',error=>
      resolve({message:error.message,status:(error as Error&{data?:{status:number}}).data?.status})));
    expect(result).toEqual({message:'Service temporarily unavailable',status:503});
  }finally{socket.disconnect();await new Promise<void>(resolve=>runtime.io.close(()=>resolve()));}
});
