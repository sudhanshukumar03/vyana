import request from 'supertest';
import type {Pool} from 'pg';
import {bodyReview,reviewAge,shiftDay} from '../src/health-review';
import {createPool,migrate} from '../src/db';
import {createApplication} from '../src/app';
import {loadConfig} from '../src/config';
import {googleCalendarDay} from '../src/google-health';
import {startGoogleWorker} from '../src/google-worker';
const base={dob:'1996-10-30',height_cm:175,weight_kg:70,nutrition_review:'standard' as const};
describe('deterministic body review',()=>{
  it.each([
    ['male','inactive',2550],['male','low_active',2750],['male','active',2930],['male','very_active',3230],
    ['female','inactive',2200],['female','low_active',2370],['female','active',2510],['female','very_active',2770],
  ] as const)('matches the published %s %s adult EER case', (sex,energy_activity,expected)=>{
    expect(bodyReview({...base,sex,energy_activity},'2026-10-30')).toMatchObject({age_years:30,energy_status:'ready',maintenance_kcal:expected,model:'DRI-EER-2023'});
  });
  it('uses the exact birthday and rejects invalid ages rather than treating them as adults',()=>{
    expect(reviewAge('2006-10-31','2026-10-30')).toBe(19);expect(reviewAge('2006-10-30','2026-10-30')).toBe(20);
    expect(reviewAge('2026-02-30','2026-10-30')).toBeNull();expect(reviewAge('2027-01-01','2026-10-30')).toBeNull();
    expect(bodyReview({...base,dob:'2007-01-01',sex:'male',energy_activity:'active'},'2026-10-30')).toMatchObject({bmi_category:null,reference_kg:null,energy_status:'age_restricted',maintenance_kcal:null});
  });
  it('keeps unrounded BMI boundaries and requires explicit energy inputs and review',()=>{
    expect(bodyReview({...base,height_cm:200,weight_kg:99.99},'2026-10-30')).toMatchObject({bmi:25,bmi_category:'Healthy range',energy_status:'profile_needed',maintenance_kcal:null});
    expect(bodyReview({...base,sex:'other',energy_activity:'active'},'2026-10-30').maintenance_kcal).toBeNull();
    expect(bodyReview({...base,sex:'male',energy_activity:'active',nutrition_review:'required'},'2026-10-30').energy_status).toBe('review_required');
    expect(bodyReview({...base,sex:'male',energy_activity:'active',weight_kg:50},'2026-10-30').maintenance_kcal).toBeNull();
    expect(bodyReview({...base,sex:'male',energy_activity:'active',medications:'Recorded medicine'},'2026-10-30').energy_status).toBe('review_required');
  });
  it('runs cloud work without a browser and stops scheduling after shutdown',async()=>{
    const pool={query:jest.fn().mockResolvedValue({rows:[{user_id:17}]})} as unknown as Pool;
    const integration={sync:jest.fn().mockResolvedValue(undefined),abortAll:jest.fn()};
    const worker=startGoogleWorker(pool,integration,true);await new Promise(resolve=>setImmediate(resolve));
    expect(integration.sync).toHaveBeenCalledWith(17);worker.stop();await worker.run();
    expect(integration.abortAll).toHaveBeenCalledTimes(1);expect(integration.sync).toHaveBeenCalledTimes(1);
  });
});
const db=process.env.TEST_DATABASE_URL?describe:describe.skip;
db('owned health review and weight records',()=>{
  let pool:Pool,runtime:ReturnType<typeof createApplication>,owner:number,token:string,other:string;
  const headers=(value=token)=>({Authorization:`Bearer ${value}`});const api=()=>request(runtime.app);
  beforeAll(async()=>{
    const url=process.env.TEST_DATABASE_URL!;
    if(!new URL(url).pathname.endsWith('_test')||process.env.ALLOW_TEST_RESET!=='1')throw Error('Explicit disposable database required');
    pool=createPool(url);await pool.query('DROP SCHEMA public CASCADE; DROP SCHEMA IF EXISTS legacy CASCADE; CREATE SCHEMA public');await migrate(pool);
    runtime=createApplication(pool,loadConfig({DATABASE_URL:url,JWT_SECRET:'synthetic-review-signing-secret-long-enough',AI_INTERNAL_SECRET:'synthetic-review-internal-secret-long-enough'}));
    const signup=await api().post('/api/v1/auth/register').send({email:'review-owner@example.test',password:'synthetic-review-password'}).expect(201);
    token=signup.body.token;owner=signup.body.user.id;
    other=(await api().post('/api/v1/auth/register').send({email:'review-other@example.test',password:'synthetic-review-password'}).expect(201)).body.token;
    await api().patch('/api/v1/profile').set(headers()).send({...base,sex:'male',energy_activity:'inactive'}).expect(200);
  },30000);
  afterAll(async()=>{runtime?.io.close();await pool?.end();});
  it('requires authentication and keeps body/weight information account-owned',async()=>{
    await api().get('/api/v1/health/review').expect(401);
    const result=(await api().get('/api/v1/health/review').set(headers()).expect(200)).body;
    expect(result.body).toMatchObject({energy_status:'ready',model:'DRI-EER-2023'});expect(result.weights).toHaveLength(1);
    const isolated=(await api().get('/api/v1/health/review').set(headers(other)).expect(200)).body;
    expect(isolated.weights).toEqual([]);expect(isolated.body.maintenance_kcal).toBeNull();expect(isolated.activity.connected).toBe(false);
  });
  it('records idempotent current weights and leaves the current profile unchanged for historical entries',async()=>{
    const observed_at=new Date(Date.now()+1).toISOString();
    await api().post('/api/v1/health/weight').set(headers()).send({weight_kg:71,observed_at}).expect(201);
    await api().post('/api/v1/health/weight').set(headers()).send({weight_kg:71,observed_at}).expect(201);
    await api().post('/api/v1/health/weight').set(headers()).send({weight_kg:72,observed_at}).expect(409);
    await api().post('/api/v1/health/weight').set(headers()).send({weight_kg:69,observed_at:new Date(Date.now()-86400000).toISOString()}).expect(201);
    expect((await api().get('/api/v1/profile').set(headers())).body.weight_kg).toBe(71);
    await api().post('/api/v1/health/weight').set(headers()).send({weight_kg:71,observed_at:new Date(Date.now()+86400000).toISOString()}).expect(400);
    await api().patch('/api/v1/profile').set(headers()).send({weight_goal_type:'reduce',goal_weight_kg:40}).expect(400);
  });
  it('compares completed local weeks and never substitutes missing records for zero',async()=>{
    const today=googleCalendarDay(Date.now(),'Asia/Kolkata');
    await pool.query("INSERT INTO google_health_connections(user_id,generation,provider_subject,account_email,encrypted_tokens,access_expires_at,last_synced_at) VALUES($1,gen_random_uuid(),'review-fixture','fixture@example.test','synthetic-not-a-token',NOW()+INTERVAL '1 hour',NOW())",[owner]);
    for(let offset=-14;offset<0;offset++)await pool.query('INSERT INTO google_health_days(user_id,timezone,day,steps,distance_km,active_minutes) VALUES($1,$2,$3,$4,1,10)',[owner,'Asia/Kolkata',shiftDay(today,offset),offset>=-7?1200:1000]);
    await pool.query("INSERT INTO google_health_feed_state(user_id,feed,last_success_at) VALUES($1,'steps',NOW())",[owner]);
    const result=(await api().get('/api/v1/health/review').set(headers()).expect(200)).body;
    expect(result.activity).toMatchObject({recorded_days:7,movement_days:7,steps:8400,comparison:{status:'ready',step_percent:20,step_delta:1400}});
    await pool.query('UPDATE google_health_days SET steps=NULL WHERE user_id=$1 AND day=$2',[owner,shiftDay(today,-2)]);
    expect((await api().get('/api/v1/health/review').set(headers())).body.activity.comparison).toMatchObject({status:'insufficient',step_percent:null});
  });
  it('matches only eligible observations using an end-exclusive interval and the selected owned device',async()=>{
    const added=(await api().post('/api/v1/devices').set(headers()).send({name:'Physical source fixture'}).expect(201)).body;
    const observed_at=new Date(Date.now()-120000).toISOString(),start=new Date(Date.parse(observed_at)-60000).toISOString();
    await api().post('/api/v1/ingest/vitals').set('X-Device-Key',added.credential).send({session_id:crypto.randomUUID(),sequence:1,observed_at,heart_rate:88,spo2:98,temperature:36.5,ecg_status:'Unknown',source:'ESP32_MAX30102_DS18B20_AD8232'}).expect(200);
    const date=googleCalendarDay(observed_at,'Asia/Kolkata');
    await pool.query("INSERT INTO google_health_intervals(user_id,timezone,day,metric,start_at,end_at,value) VALUES($1,'Asia/Kolkata',$2,'steps',$3,$4,12)",[owner,date,start,observed_at]);
    expect((await api().get('/api/v1/health/review').set(headers())).body.activity.matches).toEqual([]);
    await pool.query('UPDATE google_health_intervals SET end_at=$2 WHERE user_id=$1',[owner,new Date(Date.parse(observed_at)+1).toISOString()]);
    const result=(await api().get('/api/v1/health/review').set(headers())).body;
    expect(result.activity.matches).toHaveLength(1);expect(result.activity.matches[0]).toMatchObject({heart_rate:88,observed_at});
    expect((await api().get('/api/v1/health/review').set(headers(other))).body.activity.matches).toEqual([]);
  });
});
