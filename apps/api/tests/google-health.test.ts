import request from 'supertest';
import axios from 'axios';
import type {Pool} from 'pg';
import {createPool,migrate} from '../src/db';
import {createApplication} from '../src/app';
import {loadConfig} from '../src/config';
import {aggregateGoogleDays,googleCalendarDay,loadGoogleHealthConfig,openGoogleSecret,sealGoogleSecret,GOOGLE_ACTIVITY_SCOPE} from '../src/google-health';
import {readGoogleTimeline} from '../src/google-timeline';
import type {GoogleActivityInterval} from '../../../shared/types/google-health';
import {googleHealthIntegration} from '../src/google-health';
import {parseExercises} from '../src/google-activity-import';

const secret='synthetic-google-integration-internal-key-at-least-32';
const clientId='synthetic-client.apps.googleusercontent.com',clientSecret='synthetic-local-client-secret';
const tokens={access_token:'synthetic-access',refresh_token:'synthetic-refresh',expires_in:3600,scope:`openid email ${GOOGLE_ACTIVITY_SCOPE}`};
function point(count:number,start=new Date(Date.now()-120000).toISOString()) {
  return {steps:{count:String(count),interval:{startTime:start,endTime:new Date(Date.parse(start)+60000).toISOString()}}};
}
describe('Google Health boundaries',()=>{
  it('preserves reported exercise types and rejects impossible session durations',()=>{
    const exercise={interval:{startTime:'2026-10-28T09:00:00Z',endTime:'2026-10-28T09:20:00Z'},exerciseType:'RUNNING',activeDuration:'1200s'};
    expect(parseExercises([{exercise},{exercise}])).toHaveLength(1);
    expect(parseExercises([{exercise}])[0]).toMatchObject({exercise_type:'RUNNING',active_seconds:1200,source:'Google Health'});
    expect(()=>parseExercises([{exercise:{...exercise,activeDuration:'1201s'}}])).toThrow();
  });
  it('requires complete server-only OAuth configuration and an exact callback',()=>{
    expect(loadGoogleHealthConfig({},'http://localhost:5173')).toBeNull();
    expect(()=>loadGoogleHealthConfig({GOOGLE_HEALTH_CLIENT_ID:clientId},'http://localhost:5173')).toThrow();
    expect(()=>loadGoogleHealthConfig({GOOGLE_HEALTH_CLIENT_ID:clientId,GOOGLE_HEALTH_CLIENT_SECRET:clientSecret,GOOGLE_HEALTH_REDIRECT_URI:'https://other.example/callback'},'http://localhost:5173')).toThrow();
  });
  it('encrypts tokens with owner binding and rejects modified ciphertext',()=>{
    const sealed=sealGoogleSecret(secret,1,tokens);
    expect(sealed).not.toContain(tokens.access_token);expect(openGoogleSecret(secret,1,sealed)).toEqual(tokens);
    expect(()=>openGoogleSecret(secret,2,sealed)).toThrow();
    const bytes=Buffer.from(sealed,'base64');bytes[15]^=1;
    expect(()=>openGoogleSecret(secret,1,bytes.toString('base64'))).toThrow();
  });
  it('distinguishes recorded zero from absent data and groups in the account timezone',()=>{
    const start='2026-10-28T20:00:00Z',date='2026-10-29';
    const distances=[{distance:{millimeters:'1500000',interval:{startTime:start,endTime:'2026-10-28T20:01:00Z'}}}];
    const days=aggregateGoogleDays([point(0,start)],distances,'Asia/Kolkata',['2026-10-28',date]);
    expect(days).toEqual([{date:'2026-10-28',steps:null,distance_km:null,active_calories_kcal:null,active_minutes:null},{date,steps:0,distance_km:1.5,active_calories_kcal:null,active_minutes:null}]);
  });
  it('rejects duplicate reconciled intervals instead of double-counting',()=>{
    const p=point(20),date=googleCalendarDay(Date.now(),'UTC');
    expect(()=>aggregateGoogleDays([p,p],[],'UTC',[date])).toThrow('Duplicate');
  });
  it('preserves exact interval timestamps and units separately from daily totals',()=>{
    const intervals:GoogleActivityInterval[]=[],start='2026-10-28T20:00:00.123+00:00',end='2026-10-28T20:01:00.456Z';
    aggregateGoogleDays([{steps:{count:'12',interval:{startTime:start,endTime:end}}}],
      [{distance:{millimeters:'12345',interval:{startTime:start,endTime:end}}}],'Asia/Kolkata',['2026-10-29'],[],[],intervals);
    expect(intervals).toEqual([{metric:'steps',start_time:'2026-10-28T20:00:00.123Z',end_time:end,value:12},
      {metric:'distance_km',start_time:'2026-10-28T20:00:00.123Z',end_time:end,value:0.012345}]);
  });
  it('aggregates provider active energy and unweighted minutes while keeping absent metrics null',()=>{
    const interval={startTime:'2026-10-28T20:00:00Z',endTime:'2026-10-28T20:30:00Z'};
    const minutes={activeMinutes:{interval,activeMinutesByActivityLevel:[{activityLevel:'LIGHT',activeMinutes:'10'},{activityLevel:'MODERATE',activeMinutes:'5'},{activityLevel:'VIGOROUS',activeMinutes:'2'}]}};
    const [day]=aggregateGoogleDays([],[],'Asia/Kolkata',['2026-10-29'],[{activeEnergyBurned:{interval,kcal:150.75}}],[minutes]);
    expect(day).toMatchObject({steps:null,distance_km:null,active_calories_kcal:150.75,active_minutes:17});
    expect(aggregateGoogleDays([],[],'Asia/Kolkata',['2026-10-29'],[{activeEnergyBurned:{interval,kcal:0}}],
      [{activeMinutes:{interval,activeMinutesByActivityLevel:[{activityLevel:'LIGHT',activeMinutes:'0'}]}}])[0]).toMatchObject({active_calories_kcal:0,active_minutes:0});
  });
  it('rejects missing calorie values, unknown/duplicated levels and impossible active minutes',()=>{
    const interval={startTime:'2026-10-28T20:00:00Z',endTime:'2026-10-28T20:01:00Z'},date='2026-10-29';
    for(const kcal of [null,-1,Infinity])expect(()=>aggregateGoogleDays([],[],'Asia/Kolkata',[date],[{activeEnergyBurned:{interval,kcal}}])).toThrow();
    for(const levels of [[{activityLevel:'LIGHT',activeMinutes:'2'}],[{activityLevel:'LIGHT',activeMinutes:'0.5'}],
      [{activityLevel:'ACTIVITY_LEVEL_UNSPECIFIED',activeMinutes:'1'}],[{activityLevel:'LIGHT',activeMinutes:'1'},{activityLevel:'LIGHT',activeMinutes:'0'}]])
      expect(()=>aggregateGoogleDays([],[],'Asia/Kolkata',[date],[],[{activeMinutes:{interval,activeMinutesByActivityLevel:levels}}])).toThrow();
    expect(()=>aggregateGoogleDays([{steps:{interval,count:null}}],[],'Asia/Kolkata',[date])).toThrow();
  });
});

const withDatabase=process.env.TEST_DATABASE_URL?describe:describe.skip;
withDatabase('Google Health owned OAuth and sync against disposable PostgreSQL',()=>{
  let pool:Pool,runtime:ReturnType<typeof createApplication>,ownerToken:string,otherToken:string,ownerId:number;
  const api=()=>request(runtime.app),auth=(token=ownerToken)=>({Authorization:`Bearer ${token}`});
  beforeAll(async()=>{
    const database=process.env.TEST_DATABASE_URL!;
    if(!new URL(database).pathname.endsWith('_test')||process.env.ALLOW_TEST_RESET!=='1')throw Error('Explicit disposable test database required');
    pool=createPool(database);
    await pool.query('DROP SCHEMA public CASCADE; DROP SCHEMA IF EXISTS legacy CASCADE; CREATE SCHEMA public');await migrate(pool);
    runtime=createApplication(pool,loadConfig({DATABASE_URL:database,JWT_SECRET:'synthetic-google-signing-secret-at-least-32',AI_INTERNAL_SECRET:secret,
      GOOGLE_HEALTH_CLIENT_ID:clientId,GOOGLE_HEALTH_CLIENT_SECRET:clientSecret,WEB_ORIGIN:'http://localhost:5173'}));
    await new Promise<void>(resolve=>runtime.server.listen(0,'127.0.0.1',resolve));
    const owner=await api().post('/api/v1/auth/register').send({email:'google-owner@example.test',password:'synthetic-google-test-password'}).expect(201);
    ownerToken=owner.body.token;ownerId=owner.body.user.id;
    otherToken=(await api().post('/api/v1/auth/register').send({email:'google-other@example.test',password:'synthetic-google-test-password'}).expect(201)).body.token;
  },30000);
  afterAll(async()=>{if(runtime)await new Promise<void>(resolve=>runtime.io.close(()=>resolve()));await pool?.end();});
  afterEach(()=>jest.restoreAllMocks());
  async function begin() {
    const response=await api().post('/api/v1/integrations/google-health/connect').set(auth()).expect(200);
    return {url:new URL(response.body.url),cookie:response.headers['set-cookie'][0].split(';')[0]};
  }
  function provider() {
    const post=jest.spyOn(axios,'post').mockResolvedValue({data:tokens});
    const get=jest.spyOn(axios,'get').mockImplementation(async url=>{
      if(String(url).endsWith('/identity'))return {data:{healthUserId:'synthetic-health-id'}};
      if(String(url).includes('/userinfo'))return {data:{sub:'synthetic-subject',email:'google-owner@example.test',email_verified:true}};
      if(String(url).includes('/steps/'))return {data:{dataPoints:[point(1234)]}};
      return {data:{dataPoints:[]}};
    });
    return {post,get};
  }
  async function connect() {
    const attempt=await begin();
    await api().get('/api/v1/integrations/google-health/callback').set('Cookie',attempt.cookie)
      .query({state:attempt.url.searchParams.get('state'),code:'synthetic-authorization-code'}).expect(303).expect('Location','http://localhost:5173/activity?google=connected');
  }
  it('requires a Vyana session and exposes no tokens in disconnected status',async()=>{
    await api().get('/api/v1/integrations/google-health').expect(401);
    const result=await api().get('/api/v1/integrations/google-health').set(auth()).expect(200);
    expect(result.body).toMatchObject({provider:'GoogleHealth',configured:true,connected:false,account_email:null});
    expect(result.body.days.every((d:{steps:null})=>d.steps===null)).toBe(true);
  });
  it('uses read-only permissions, PKCE and a cookie-bound one-use state',async()=>{
    const attempt=await begin();
    expect(attempt.url.searchParams.get('scope')).toBe(`openid email ${GOOGLE_ACTIVITY_SCOPE}`);
    expect(attempt.url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(attempt.url.searchParams.get('login_hint')).toBe('google-owner@example.test');
    await api().get('/api/v1/integrations/google-health/callback').query({state:attempt.url.searchParams.get('state'),code:'synthetic-code'}).expect(303)
      .expect('Location','http://localhost:5173/activity?google=invalid_state');
    await api().get('/api/v1/integrations/google-health/callback').set('Cookie',attempt.cookie).query({state:attempt.url.searchParams.get('state'),error:'access_denied'}).expect(303)
      .expect('Location','http://localhost:5173/activity?google=denied');
    await api().get('/api/v1/integrations/google-health/callback').set('Cookie',attempt.cookie).query({state:attempt.url.searchParams.get('state'),code:'replay'}).expect(303)
      .expect('Location','http://localhost:5173/activity?google=invalid_state');
  });
  it('connects an owner with encrypted tokens and never changes the active ESP32',async()=>{
    provider();const device=await api().post('/api/v1/devices').set(auth()).send({name:'ESP32 fixture'}).expect(201);
    await connect();
    const stored=(await pool.query('SELECT encrypted_tokens FROM google_health_connections WHERE user_id=$1',[ownerId])).rows[0];
    expect(openGoogleSecret(secret,ownerId,stored.encrypted_tokens)).toEqual(tokens);
    const status=await api().get('/api/v1/integrations/google-health').set(auth()).expect(200);
    expect(status.body.connected).toBe(true);expect(JSON.stringify(status.body)).not.toContain(tokens.access_token);
    expect((await pool.query('SELECT id FROM devices WHERE user_id=$1 AND active',[ownerId])).rows[0].id).toBe(device.body.id);
  });
  it('syncs reconciled steps independently of hardware and isolates another account',async()=>{
    const mock=provider();
    const result=await api().post('/api/v1/integrations/google-health/sync').set(auth()).expect(200);
    expect(result.body.error_code).toBeNull();expect(result.body.days.find((d:{date:string})=>d.date===result.body.today).steps).toBe(1234);
    expect(result.body.days.find((d:{date:string})=>d.date===result.body.today).distance_km).toBeNull();
    const summary=await api().get('/api/v1/health/summary').set(auth()).expect(200);
    expect(summary.body.activity).toMatchObject({steps:1234,calories:null,active_minutes:null,source:'GoogleHealth'});
    expect(summary.body.device.connected).toBe(false);
    const calls=mock.get.mock.calls.length;await api().post('/api/v1/integrations/google-health/sync').set(auth()).expect(200);
    expect(mock.get.mock.calls).toHaveLength(calls);
    const other=await api().get('/api/v1/integrations/google-health').set(auth(otherToken)).expect(200);
    expect(other.body.connected).toBe(false);expect(other.body.days.every((d:{steps:null})=>d.steps===null)).toBe(true);
  });
  it('keeps recorded zero and distance-only days without inventing missing steps',async()=>{
    const date=googleCalendarDay(Date.now(),'Asia/Kolkata');
    for(const [steps,distance] of [[0,0],[null,1.2]] as const){
      await pool.query('UPDATE google_health_days SET steps=$1,distance_km=$2 WHERE user_id=$3 AND day=$4',[steps,distance,ownerId,date]);
      expect((await api().get('/api/v1/health/summary').set(auth())).body.activity).toMatchObject({steps,distance_km:distance,source:'GoogleHealth'});
    }
    await pool.query('UPDATE google_health_days SET steps=1234,distance_km=NULL WHERE user_id=$1 AND day=$2',[ownerId,date]);
  });
  it('retains previous data with a truthful error when the provider fails',async()=>{
    const mock=provider();mock.get.mockRejectedValue(Error('synthetic-provider-failure'));
    await pool.query('UPDATE google_health_connections SET last_attempt_at=NULL WHERE user_id=$1',[ownerId]);
    const result=await api().post('/api/v1/integrations/google-health/sync').set(auth()).expect(200);
    expect(result.body.error_code).toBe('sync_failed');expect(result.body.days.some((d:{steps:number})=>d.steps===1234)).toBe(true);
    expect(JSON.stringify(result.body)).not.toContain('synthetic-provider-failure');
  });
  it('refreshes an expired access token without losing the original refresh token',async()=>{
    const mock=provider();mock.post.mockResolvedValue({data:{access_token:'synthetic-renewed-access',expires_in:3600}});
    await pool.query("UPDATE google_health_connections SET last_attempt_at=NULL,access_expires_at=NOW()-INTERVAL '1 minute' WHERE user_id=$1",[ownerId]);
    const result=await api().post('/api/v1/integrations/google-health/sync').set(auth()).expect(200);
    expect(result.body.error_code).toBeNull();expect(mock.post).toHaveBeenCalledTimes(1);
    const encrypted=(await pool.query('SELECT encrypted_tokens FROM google_health_connections WHERE user_id=$1',[ownerId])).rows[0].encrypted_tokens;
    expect(openGoogleSecret<{refresh_token:string}>(secret,ownerId,encrypted).refresh_token).toBe(tokens.refresh_token);
  });
  it('imports active metrics and preserves them with warnings when only those provider requests fail',async()=>{
    const mock=provider();const interval=point(1).steps.interval;
    mock.get.mockImplementation(async url=>({data:{dataPoints:String(url).includes('/active-energy-burned/')?[{activeEnergyBurned:{interval,kcal:250.75}}]:
      String(url).includes('/active-minutes/')?[{activeMinutes:{interval,activeMinutesByActivityLevel:[{activityLevel:'LIGHT',activeMinutes:'1'}]}}]:String(url).includes('/steps/')?[point(1234)]:[]}}));
    await pool.query('UPDATE google_health_connections SET last_attempt_at=NULL WHERE user_id=$1',[ownerId]);
    const synced=(await api().post('/api/v1/integrations/google-health/sync').set(auth()).expect(200)).body;
    expect(synced.days.find((d:{date:string})=>d.date===synced.today)).toMatchObject({active_calories_kcal:250.75,active_minutes:1});
    expect((await api().get('/api/v1/health/summary').set(auth())).body.activity).toMatchObject({calories:250.75,active_minutes:1,calories_type:'active'});
    const calls=mock.get.mock.calls;
    expect(calls.find(call=>String(call[0]).includes('/active-energy-burned/'))?.[1]).toMatchObject({params:{filter:expect.stringContaining('active_energy_burned.interval')}});
    expect(calls.find(call=>String(call[0]).includes('/exercise/'))?.[1]).toMatchObject({params:{pageSize:25,filter:expect.stringMatching(/^exercise\.interval\.civil_start_time >= "\d{4}-\d{2}-\d{2}" AND exercise\.interval\.civil_start_time < "\d{4}-\d{2}-\d{2}"$/)}});
    mock.get.mockImplementation(async url=>{
      if(String(url).includes('/active-'))throw Error('Synthetic optional-metric outage');
      return {data:{dataPoints:String(url).includes('/steps/')?[point(2222)]:[]}};
    });
    await pool.query('UPDATE google_health_connections SET last_attempt_at=NULL WHERE user_id=$1',[ownerId]);
    const partial=(await api().post('/api/v1/integrations/google-health/sync').set(auth()).expect(200)).body;
    expect(partial.error_code).toBeNull();expect(partial.metric_warnings.sort()).toEqual(['active_calories_kcal','active_minutes']);
    expect(partial.days.find((d:{date:string})=>d.date===partial.today)).toMatchObject({steps:2222,active_calories_kcal:250.75,active_minutes:1});
    const cached=(await pool.query("SELECT metric,value FROM google_health_intervals WHERE user_id=$1 AND metric IN ('active_calories_kcal','active_minutes') ORDER BY metric",[ownerId])).rows;
    expect(cached).toEqual([{metric:'active_calories_kcal',value:250.75},{metric:'active_minutes',value:1}]);
  });
  it('serves owned timestamped intervals and excludes cross-hour records without inventing a split',async()=>{
    const mock=provider(),date=googleCalendarDay(Date.now()-86400000,'Asia/Kolkata');
    const interval=(start:string,end:string)=>({startTime:`${date}T${start}+05:30`,endTime:`${date}T${end}+05:30`});
    const steps=[{steps:{count:'50',interval:interval('09:10:00.123','09:11:00.456')}},
      {steps:{count:'100',interval:interval('10:15:00','10:16:00')}},
      {steps:{count:'200',interval:interval('09:59:00','10:01:00')}},
      {steps:{count:'0',interval:interval('11:00:00','12:00:00')}}];
    mock.get.mockImplementation(async url=>({data:{dataPoints:String(url).includes('/steps/')?steps:[]}}));
    await pool.query('UPDATE google_health_connections SET last_attempt_at=NULL WHERE user_id=$1',[ownerId]);
    await api().post('/api/v1/integrations/google-health/sync').set(auth()).expect(200);
    await api().get('/api/v1/integrations/google-health/timeline').expect(401);
    const result=(await api().get('/api/v1/integrations/google-health/timeline').query({date}).set(auth()).expect(200)).body;
    expect(result).toMatchObject({date,timezone:'Asia/Kolkata',interval_count:4,unallocated_intervals:1,next_cursor:null});
    expect(result.hours).toHaveLength(24);
    expect(result.hours[9].steps).toBe(50);expect(result.hours[10].steps).toBe(100);expect(result.hours[11].steps).toBe(0);
    expect(result.hours[8].steps).toBeNull();expect(result.hours[9].active_minutes).toBeNull();
    expect(result.intervals[0]).toEqual({metric:'steps',start_time:`${date}T03:40:00.123Z`,end_time:`${date}T03:41:00.456Z`,value:50});
    const other=(await api().get('/api/v1/integrations/google-health/timeline').query({date}).set(auth(otherToken)).expect(200)).body;
    expect(other.interval_count).toBe(0);expect(other.intervals).toEqual([]);expect(other.hours.every((hour:{steps:null})=>hour.steps===null)).toBe(true);
    await api().get('/api/v1/integrations/google-health/timeline').query({date:'2020-01-01'}).set(auth()).expect(400);
    await api().get('/api/v1/integrations/google-health/timeline').query({date,cursor:'invalid'}).set(auth()).expect(400);
  });
  it('paginates exact intervals and rejects a cursor after the import changes',async()=>{
    const mock=provider(),date=googleCalendarDay(Date.now()-86400000,'Asia/Kolkata');
    const points=Array.from({length:101},(_,i)=>point(i,new Date(Date.parse(`${date}T09:00:00+05:30`)+i*60000).toISOString()));
    mock.get.mockImplementation(async url=>({data:{dataPoints:String(url).includes('/steps/')?points:[]}}));
    await pool.query('UPDATE google_health_connections SET last_attempt_at=NULL WHERE user_id=$1',[ownerId]);
    await api().post('/api/v1/integrations/google-health/sync').set(auth()).expect(200);
    const first=(await api().get('/api/v1/integrations/google-health/timeline').query({date}).set(auth()).expect(200)).body;
    expect(first.interval_count).toBe(101);expect(first.intervals).toHaveLength(100);expect(first.next_cursor).toEqual(expect.any(String));
    const second=(await api().get('/api/v1/integrations/google-health/timeline').query({date,cursor:first.next_cursor}).set(auth()).expect(200)).body;
    expect(second.intervals).toHaveLength(1);expect(second.intervals[0].value).toBe(100);expect(second.next_cursor).toBeNull();
    await pool.query("UPDATE google_health_connections SET last_synced_at=last_synced_at+INTERVAL '1 second' WHERE user_id=$1",[ownerId]);
    await api().get('/api/v1/integrations/google-health/timeline').query({date,cursor:first.next_cursor}).set(auth()).expect(409);
    mock.get.mockResolvedValue({data:{dataPoints:[]}});
    await pool.query('UPDATE google_health_connections SET last_attempt_at=NULL WHERE user_id=$1',[ownerId]);
    await api().post('/api/v1/integrations/google-health/sync').set(auth()).expect(200);
    expect((await pool.query('SELECT * FROM google_health_intervals WHERE user_id=$1',[ownerId])).rowCount).toBe(0);
  });
  it('backfills fifteen daily/hourly dates and preserves older hours during a short incremental sync',async()=>{
    const mock=provider(),today=googleCalendarDay(Date.now(),'Asia/Kolkata');
    const day=(offset:number)=>new Date(Date.parse(`${today}T12:00:00Z`)+offset*86400000).toISOString().slice(0,10);
    const old=day(-10),recent=day(-1),oldPoint=point(50,`${old}T09:15:00+05:30`),recentPoint=point(100,`${recent}T18:15:00+05:30`);
    const interval={startTime:`${recent}T18:00:00+05:30`,endTime:`${recent}T18:30:00+05:30`};
    mock.get.mockImplementation(async url=>({data:{dataPoints:String(url).includes('/steps/')?[oldPoint,recentPoint]:String(url).includes('/active-minutes/')?[{activeMinutes:{interval,activeMinutesByActivityLevel:[{activityLevel:'LIGHT',activeMinutes:'10'},{activityLevel:'MODERATE',activeMinutes:'5'},{activityLevel:'VIGOROUS',activeMinutes:'3'}]}}]:String(url).includes('/exercise/')?[{exercise:{interval,exerciseType:'RUNNING',activeDuration:'1800s'}}]:[]}}));
    await pool.query('UPDATE google_health_connections SET last_attempt_at=NULL,history_synced_at=NULL WHERE user_id=$1',[ownerId]);
    const initial=(await api().post('/api/v1/integrations/google-health/sync').set(auth()).expect(200)).body;
    expect(initial.error_code).toBeNull();
    expect((await pool.query('SELECT steps FROM google_health_days WHERE user_id=$1 AND day=$2',[ownerId,old])).rows[0].steps).toBe(50);
    expect((await pool.query("SELECT value FROM google_health_hour_totals WHERE user_id=$1 AND day=$2 AND metric='steps'",[ownerId,old])).rows[0].value).toBe(50);
    expect((await pool.query('SELECT * FROM google_health_intervals WHERE user_id=$1 AND day=$2',[ownerId,old])).rowCount).toBe(0);
    const review=(await api().get('/api/v1/health/review').set(auth()).expect(200)).body;
    expect(review.activity.intensity).toEqual({light:10,moderate:5,vigorous:3});
    expect(review.activity.exercises[0]).toMatchObject({type:'RUNNING',source:'Google Health'});
    mock.get.mockImplementation(async url=>{if(String(url).includes('/exercise/'))throw Error('Optional exercise outage');return {data:{dataPoints:String(url).includes('/steps/')?[point(150,`${recent}T18:15:00+05:30`)]:[]}};});
    await pool.query('UPDATE google_health_connections SET last_attempt_at=NULL WHERE user_id=$1',[ownerId]);
    expect((await api().post('/api/v1/integrations/google-health/sync').set(auth()).expect(200)).body.error_code).toBeNull();
    expect((await pool.query("SELECT value FROM google_health_hour_totals WHERE user_id=$1 AND day=$2 AND metric='steps'",[ownerId,old])).rows[0].value).toBe(50);
    expect((await pool.query('SELECT * FROM google_health_exercises WHERE user_id=$1',[ownerId])).rowCount).toBe(1);
    expect((await pool.query("SELECT error_code FROM google_health_feed_state WHERE user_id=$1 AND feed='exercise'",[ownerId])).rows[0].error_code).toBe('unavailable');
  });
  it('shares a database sync lock across integration instances',async()=>{
    const mock=provider();let release!:(value:unknown)=>void;
    mock.get.mockImplementation(async url=>String(url).includes('/steps/')?new Promise(resolve=>{release=resolve;}):{data:{dataPoints:[]}});
    await pool.query('UPDATE google_health_connections SET last_attempt_at=NULL WHERE user_id=$1',[ownerId]);
    const first=runtime.googleHealth.sync(ownerId);
    const until=Date.now()+3000;while(!release){if(Date.now()>until)throw Error('Provider request did not start');await new Promise(resolve=>setTimeout(resolve,10));}
    const calls=mock.get.mock.calls.length;
    await pool.query('UPDATE google_health_connections SET last_attempt_at=NULL WHERE user_id=$1',[ownerId]);
    const second=googleHealthIntegration(pool,{googleHealth:{clientId,clientSecret,redirectUri:'http://localhost:5173/api/v1/integrations/google-health/callback'},internalSecret:secret,origin:'http://localhost:5173',production:false});
    await second.sync(ownerId);expect(mock.get.mock.calls).toHaveLength(calls);
    release({data:{dataPoints:[point(1234)]}});await first;
  });
  it('uses actual local-day boundaries for daylight saving time without merging repeated hours',async()=>{
    const fall=await readGoogleTimeline(pool,ownerId,'Europe/London','2026-10-25',undefined);
    const spring=await readGoogleTimeline(pool,ownerId,'Europe/London','2026-03-29',undefined);
    expect(fall.hours).toHaveLength(25);expect(spring.hours).toHaveLength(23);
    expect(new Set(fall.hours.map(hour=>hour.start_time)).size).toBe(25);
    expect(fall.hours[1].start_time).not.toBe(fall.hours[2].start_time);
  });
  it('does not recreate cached records when disconnect occurs during a provider request',async()=>{
    const mock=provider();let release!:(value:unknown)=>void;
    mock.get.mockImplementation(async url=>String(url).includes('/steps/')?new Promise(resolve=>{release=resolve;}):{data:{dataPoints:[]}});
    await pool.query('UPDATE google_health_connections SET last_attempt_at=NULL WHERE user_id=$1',[ownerId]);
    const pending=api().post('/api/v1/integrations/google-health/sync').set(auth()).then(response=>response);
    const deadline=Date.now()+3000;
    while(!release){if(Date.now()>deadline)throw Error('Provider request did not start');await new Promise(resolve=>setTimeout(resolve,10));}
    await api().delete('/api/v1/integrations/google-health').set(auth()).expect(200);
    release({data:{dataPoints:[point(999)]}});const result=await pending;
    expect(result.body.connected).toBe(false);
    expect((await pool.query('SELECT * FROM google_health_days WHERE user_id=$1',[ownerId])).rowCount).toBe(0);
    expect((await pool.query('SELECT * FROM google_health_intervals WHERE user_id=$1',[ownerId])).rowCount).toBe(0);
    mock.get.mockRestore();mock.post.mockRestore();provider();await connect();
  });
  it('removes only the caller connection and cached days on disconnect',async()=>{
    provider();
    await api().post('/api/v1/integrations/google-health/sync').set(auth()).expect(200);
    expect((await pool.query('SELECT * FROM google_health_intervals WHERE user_id=$1',[ownerId])).rowCount).toBeGreaterThan(0);
    await api().delete('/api/v1/integrations/google-health').set(auth(otherToken)).expect(200);
    expect((await pool.query('SELECT user_id FROM google_health_connections WHERE user_id=$1',[ownerId])).rowCount).toBe(1);
    const result=await api().delete('/api/v1/integrations/google-health').set(auth()).expect(200);
    expect(result.body.connected).toBe(false);expect((await pool.query('SELECT * FROM google_health_days WHERE user_id=$1',[ownerId])).rowCount).toBe(0);
    expect((await pool.query('SELECT * FROM google_health_intervals WHERE user_id=$1',[ownerId])).rowCount).toBe(0);
  });
  it('rejects a callback after the initiating Vyana session is revoked',async()=>{
    const mock=provider(),attempt=await begin();
    await pool.query('UPDATE sessions SET revoked_at=NOW() WHERE user_id=$1',[ownerId]);
    await api().get('/api/v1/integrations/google-health/callback').set('Cookie',attempt.cookie).query({state:attempt.url.searchParams.get('state'),code:'synthetic-code'}).expect(303)
      .expect('Location','http://localhost:5173/activity?google=session_expired');
    expect(mock.post).not.toHaveBeenCalled();
  });
});
