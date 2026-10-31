import {createCipheriv,createDecipheriv,createHash,randomBytes,randomUUID,timingSafeEqual} from 'crypto';
import {Router,type Request,type Response} from 'express';
import type {Pool} from 'pg';
import axios from 'axios';
import {z} from 'zod';
import type {GoogleActivityInterval,GoogleActivityMetric,GoogleHealthDay,GoogleHealthOverview,GoogleTimelineMetric} from '../../../shared/types/google-health';
import {readGoogleTimeline} from './google-timeline';
import {asyncRoute,HttpError} from './auth';
import {transaction} from './db';
import {parseExercises,persistGoogleActivity,type ExerciseRecord} from './google-activity-import';

export const GOOGLE_ACTIVITY_SCOPE='https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly';
export interface GoogleHealthConfig {clientId:string;clientSecret:string;redirectUri:string}
const callbackPath='/api/v1/integrations/google-health/callback';
const cookieName='vyana_google_state';
const tokenSchema=z.object({access_token:z.string().min(1),refresh_token:z.string().min(1).optional(),
  expires_in:z.number().int().min(1).max(86400),scope:z.string().optional()});
type Tokens=z.infer<typeof tokenSchema>;
const requestOptions={timeout:12000,maxRedirects:0,maxContentLength:4*1024*1024};

export function loadGoogleHealthConfig(env:NodeJS.ProcessEnv,origin:string):GoogleHealthConfig|null {
  const clientId=env.GOOGLE_HEALTH_CLIENT_ID?.trim(),clientSecret=env.GOOGLE_HEALTH_CLIENT_SECRET?.trim();
  if(!clientId&&!clientSecret)return null;
  if(!clientId||!clientSecret)throw Error('Configure both Google Health OAuth credentials.');
  const redirectUri=env.GOOGLE_HEALTH_REDIRECT_URI||`${origin}${callbackPath}`;
  const redirect=new URL(redirectUri);
  if(redirect.origin!==origin||redirect.pathname!==callbackPath||redirect.search||redirect.hash)
    throw Error('Google Health redirect must use the web origin and integration callback path.');
  return {clientId,clientSecret,redirectUri};
}

export function sealGoogleSecret(secret:string,owner:number,value:unknown):string {
  const key=createHash('sha256').update('vyana-google-health:'+secret).digest(),iv=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(String(owner)));
  return Buffer.concat([iv,cipher.update(JSON.stringify(value),'utf8'),cipher.final(),cipher.getAuthTag()]).toString('base64');
}
export function openGoogleSecret<T>(secret:string,owner:number,value:string):T {
  const bytes=Buffer.from(value,'base64'),key=createHash('sha256').update('vyana-google-health:'+secret).digest();
  const decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));
  decipher.setAAD(Buffer.from(String(owner)));decipher.setAuthTag(bytes.subarray(-16));
  return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(12,-16)),decipher.final()]).toString('utf8')) as T;
}
export function googleCalendarDay(timestamp:string|number,timezone:string):string {
  return new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(timestamp));
}
function dateRange(timezone:string,length=7) {
  const today=googleCalendarDay(Date.now(),timezone),first=new Date(`${today}T00:00:00Z`);
  first.setUTCDate(first.getUTCDate()-(length-1));
  return {today,dates:Array.from({length},(_,i)=>new Date(first.getTime()+i*86400000).toISOString().slice(0,10)),
    // Include the whole first local day, even in UTC+14, then group by profile timezone.
    start:new Date(first.getTime()-86400000).toISOString(),end:new Date().toISOString()};
}
const intervalSchema=z.object({startTime:z.iso.datetime({offset:true}),endTime:z.iso.datetime({offset:true})});
const pageSchema=z.object({dataPoints:z.array(z.record(z.string(),z.unknown())).max(10000).default([]),nextPageToken:z.string().optional()});
const countSchema=(max:number)=>z.union([z.number(),z.string().regex(/^\d+$/)]).transform(value=>Number(value)).pipe(z.number().int().min(0).max(max));
export function aggregateGoogleDays(stepPoints:unknown[],distancePoints:unknown[],timezone:string,dates:string[],caloriePoints:unknown[]=[],minutePoints:unknown[]=[],intervals?:GoogleActivityInterval[]):GoogleHealthDay[] {
  const days=new Map(dates.map(date=>[date,{date,steps:null,distance_km:null,active_calories_kcal:null,active_minutes:null} as GoogleHealthDay]));
  for(const [points,field,metric,max] of [[stepPoints,'steps','count',1000000],[distancePoints,'distance','millimeters',1000000000],
    [caloriePoints,'activeEnergyBurned','kcal',1000000],[minutePoints,'activeMinutes','activeMinutesByActivityLevel',2880]] as const) {
    const seen=new Set<string>();
    for(const point of points) {
      const p=z.record(z.string(),z.unknown()).parse(point),record=z.record(z.string(),z.unknown()).parse(p[field]);
      const interval=intervalSchema.parse(record.interval),start=Date.parse(interval.startTime),end=Date.parse(interval.endTime);
      if(end<=start||end>Date.now()+300000)throw Error('Invalid Google activity interval');
      const date=googleCalendarDay(start,timezone),day=days.get(date);if(!day)continue;
      if(googleCalendarDay(end-1,timezone)!==date)throw Error('Google activity interval crosses a calendar day');
      let value:number;
      if(field==='activeMinutes'){
        const levels=z.array(z.object({activityLevel:z.enum(['LIGHT','MODERATE','VIGOROUS']),activeMinutes:countSchema(2880)})).max(3).parse(record[metric]);
        if(new Set(levels.map(level=>level.activityLevel)).size!==levels.length)throw Error('Duplicate active-minute level');
        value=levels.reduce((sum,level)=>sum+level.activeMinutes,0);
        for(const level of levels){const key=`${level.activityLevel.toLowerCase()}_minutes` as 'light_minutes'|'moderate_minutes'|'vigorous_minutes';day[key]=(day[key]??0)+level.activeMinutes;}
        if(value>Math.ceil((end-start)/60000))throw Error('Active minutes exceed their observed interval');
      }else value=field==='activeEnergyBurned'?z.number().min(0).max(max).parse(record[metric]):countSchema(max).parse(record[metric]);
      const signature=`${start}:${end}`;if(seen.has(signature))throw Error('Duplicate reconciled activity interval');seen.add(signature);
      if(field==='steps')day.steps=(day.steps??0)+value;
      else if(field==='distance')day.distance_km=(day.distance_km??0)+value/1000000;
      else if(field==='activeEnergyBurned')day.active_calories_kcal=(day.active_calories_kcal??0)+value;
      else day.active_minutes=(day.active_minutes??0)+value;
      const timelineMetric:GoogleTimelineMetric=field==='steps'?'steps':field==='distance'?'distance_km':field==='activeEnergyBurned'?'active_calories_kcal':'active_minutes';
      intervals?.push({metric:timelineMetric,start_time:new Date(start).toISOString(),end_time:new Date(end).toISOString(),value:field==='distance'?value/1000000:value});
      if((day.active_calories_kcal??0)>1000000000||(day.active_minutes??0)>2880)throw Error('Google daily activity exceeds storage bounds');
    }
  }
  return [...days.values()].map(day=>({...day,distance_km:day.distance_km===null?null:Number(day.distance_km.toFixed(3)),
    active_calories_kcal:day.active_calories_kcal==null?null:Number(day.active_calories_kcal.toFixed(3))}));
}

export function googleHealthIntegration(pool:Pool,settings:{googleHealth?:GoogleHealthConfig|null;internalSecret:string;origin:string;production:boolean;googleSyncSeconds?:number}) {
  const router=Router(),inflight=new Map<number,Promise<void>>();
  const controllers=new Map<number,AbortController>();
  const config=()=>{if(!settings.googleHealth)throw new HttpError(503,'Google Health connection is not configured yet.');return settings.googleHealth;};
  const owner=(res:Response)=>Number(res.locals.user.id);
  const cookieOptions={httpOnly:true,secure:settings.production,sameSite:'lax' as const,path:callbackPath};
  const returnToActivity=(res:Response,status:string)=>res.redirect(303,`${settings.origin}/activity?google=${status}`);
  async function timezone(user:number) {
    return (await pool.query('SELECT timezone FROM profile WHERE user_id=$1',[user])).rows[0]?.timezone||'Asia/Kolkata';
  }
  async function overview(user:number):Promise<GoogleHealthOverview> {
    const zone=await timezone(user),range=dateRange(zone);
    const connection=(await pool.query('SELECT account_email,last_synced_at,last_attempt_at,error_code,metric_warnings FROM google_health_connections WHERE user_id=$1',[user])).rows[0];
    const days=(await pool.query("SELECT day::text AS date,steps,distance_km,active_calories_kcal,active_minutes FROM google_health_days WHERE user_id=$1 AND timezone=$2 AND day BETWEEN $3 AND $4 ORDER BY day",[user,zone,range.dates[0],range.today])).rows;
    return {provider:'GoogleHealth',configured:Boolean(settings.googleHealth),connected:Boolean(connection),account_email:connection?.account_email??null,
      timezone:zone,today:range.today,last_synced_at:connection?.last_synced_at?.toISOString()??null,
      last_attempt_at:connection?.last_attempt_at?.toISOString()??null,error_code:connection?.error_code??null,metric_warnings:connection?.metric_warnings??[],
      days:range.dates.map(date=>days.find(day=>day.date===date)??{date,steps:null,distance_km:null,active_calories_kcal:null,active_minutes:null})};
  }
  async function dataPoints(kind:'steps'|'distance'|'active-energy-burned'|'active-minutes'|'exercise',access:string,start:string,end:string,signal:AbortSignal) {
    const points:unknown[]=[],tokens=new Set<string>();let token:string|undefined;
    // Exercise sessions support civil_start_time filtering rather than the
    // physical start_time filter used by interval metrics. Pad the date bounds
    // for all source offsets, then retain only the requested profile-local days.
    const filter=kind==='exercise'
      ?`exercise.interval.civil_start_time >= "${start.slice(0,10)}" AND exercise.interval.civil_start_time < "${new Date(Date.parse(end)+86400000).toISOString().slice(0,10)}"`
      :`${kind.replace(/-/g,'_')}.interval.start_time >= "${start}" AND ${kind.replace(/-/g,'_')}.interval.start_time < "${end}"`;
    for(let page=0;page<(kind==='exercise'?8:4);page++) {
      const response=await axios.get(`https://health.googleapis.com/v4/users/me/dataTypes/${kind}/dataPoints:reconcile`,{
        ...requestOptions,signal,headers:{Authorization:`Bearer ${access}`},params:{pageSize:kind==='exercise'?25:10000,
          filter,...(token?{pageToken:token}:{})}});
      const parsed=pageSchema.parse(response.data);points.push(...parsed.dataPoints);token=parsed.nextPageToken;
      if(!token)return points;
      if(tokens.has(token))throw Error('Repeated provider page');tokens.add(token);
    }
    throw Error('Activity pagination exceeds the sync limit');
  }
  async function performSync(user:number) {
    const c=config();
    const lock=await pool.connect();let acquired=false,connection:Record<string,any>|undefined;
    const controller=new AbortController();let deadline:ReturnType<typeof setTimeout>|undefined;
    try {
      acquired=(await lock.query('SELECT pg_try_advisory_lock(781941,$1) AS locked',[user])).rows[0].locked;
      if(!acquired)return;
      connection=(await lock.query(`UPDATE google_health_connections SET last_attempt_at=NOW()
        WHERE user_id=$1 AND (error_code IS NULL OR error_code NOT IN ('reconnect_required','access_denied')) AND (last_attempt_at IS NULL OR last_attempt_at<NOW()-INTERVAL '60 seconds')
        AND (error_code IS NULL OR next_sync_at<=NOW() OR last_attempt_at IS NULL) RETURNING *`,[user])).rows[0];
      if(!connection)return;
      controllers.set(user,controller);deadline=setTimeout(()=>controller.abort(),35000);deadline.unref();
      let tokens=openGoogleSecret<Tokens>(settings.internalSecret,user,connection.encrypted_tokens);
      if(new Date(connection.access_expires_at).getTime()<Date.now()+60000) {
        if(!tokens.refresh_token)throw Error('reconnect_required');
        const refreshed=tokenSchema.parse((await axios.post('https://oauth2.googleapis.com/token',new URLSearchParams({client_id:c.clientId,
          client_secret:c.clientSecret,refresh_token:tokens.refresh_token,grant_type:'refresh_token'}),{...requestOptions,signal:controller.signal})).data);
        tokens={...refreshed,refresh_token:refreshed.refresh_token||tokens.refresh_token};
        await pool.query('UPDATE google_health_connections SET encrypted_tokens=$1,access_expires_at=$2 WHERE user_id=$3 AND generation=$4',
          [sealGoogleSecret(settings.internalSecret,user,tokens),new Date(Date.now()+tokens.expires_in*1000),user,connection.generation]);
      }
      const zone=await timezone(user),fullRange=dateRange(zone,15);
      const cached=(await pool.query('SELECT COUNT(*)::int AS count FROM google_health_days WHERE user_id=$1 AND timezone=$2 AND day BETWEEN $3 AND $4',[user,zone,fullRange.dates[0],fullRange.today])).rows[0].count;
      const backfill=!connection.history_synced_at||Date.now()-Date.parse(connection.history_synced_at)>86400000||cached<15;
      const range=backfill?fullRange:dateRange(zone,3),rawRange=dateRange(zone);
      const optional=(kind:'active-energy-burned'|'active-minutes'|'exercise')=>dataPoints(kind,tokens.access_token,range.start,range.end,controller.signal).catch(()=>null);
      const [steps,distance,calories,minutes,exercisePoints]=await Promise.all([
        dataPoints('steps',tokens.access_token,range.start,range.end,controller.signal),dataPoints('distance',tokens.access_token,range.start,range.end,controller.signal),
        optional('active-energy-burned'),optional('active-minutes'),optional('exercise')]);
      const intervals:GoogleActivityInterval[]=[];
      const days=aggregateGoogleDays(steps,distance,zone,range.dates,[],[],intervals);
      const warnings:GoogleActivityMetric[]=[];
      for(const [metric,points] of [['active_calories_kcal',calories],['active_minutes',minutes]] as const){
        try{
          if(points===null)throw Error('Metric unavailable');
          const extraIntervals:GoogleActivityInterval[]=[];
          const extra=aggregateGoogleDays([],[],zone,range.dates,metric==='active_calories_kcal'?points:[],metric==='active_minutes'?points:[],extraIntervals);
          days.forEach((day,i)=>{day[metric]=extra[i][metric];if(metric==='active_minutes')for(const level of ['light_minutes','moderate_minutes','vigorous_minutes'] as const)day[level]=extra[i][level]??null;});
          intervals.push(...extraIntervals);
        }catch{warnings.push(metric);}
      }
      let exercises:ExerciseRecord[]|null=null;
      try{if(exercisePoints===null)throw Error();exercises=parseExercises(exercisePoints).filter(record=>{const day=googleCalendarDay(record.start_time,zone);return day>=range.dates[0]&&day<=range.today;});}catch{/* Optional exercise records must not block movement totals. */}
      const failedFeeds=[...(warnings.includes('active_calories_kcal')?['active-energy-burned']:[]),...(warnings.includes('active_minutes')?['active-minutes']:[]),...(exercises===null?['exercise']:[])];
      await transaction(pool,client=>persistGoogleActivity(client,{user,generation:connection!.generation,zone,first:range.dates[0],today:range.today,rawFirst:rawRange.dates[0],days,intervals,warnings,exercises,backfill,failedFeeds,intervalSeconds:settings.googleSyncSeconds}));
    } catch(error) {
      const status=axios.isAxiosError(error)?error.response?.status:null;
      const code=status===401||(error instanceof Error&&error.message==='reconnect_required')?'reconnect_required':status===403?'access_denied':status===429?'rate_limited':'sync_failed';
      if(connection)await pool.query(`UPDATE google_health_connections SET error_code=$1,sync_failures=sync_failures+1,
        next_sync_at=NOW()+make_interval(secs=>LEAST(3600,120*POWER(2,LEAST(sync_failures,5)))::int)
        WHERE user_id=$2 AND generation=$3`,[code,user,connection.generation]);
    } finally {
      if(deadline)clearTimeout(deadline);controllers.delete(user);
      try{if(acquired)await lock.query('SELECT pg_advisory_unlock(781941,$1)',[user]);}catch(error){lock.release(true);throw error;}lock.release();
    }
  }
  async function sync(user:number) {
    if(!inflight.has(user))inflight.set(user,performSync(user).finally(()=>inflight.delete(user)));
    await inflight.get(user);
  }
  router.get('/',asyncRoute(async(_req,res)=>res.json(await overview(owner(res)))));
  router.post('/connect',asyncRoute(async(_req,res)=>{
    const c=config(),user=owner(res),state=randomBytes(32).toString('base64url'),verifier=randomBytes(48).toString('base64url');
    await pool.query('DELETE FROM google_health_oauth_states WHERE user_id=$1 OR expires_at<NOW()',[user]);
    await pool.query("INSERT INTO google_health_oauth_states(state_hash,user_id,session_id,encrypted_verifier,expires_at) VALUES($1,$2,$3,$4,NOW()+INTERVAL '10 minutes')",
      [createHash('sha256').update(state).digest('hex'),user,res.locals.user.session_id,sealGoogleSecret(settings.internalSecret,user,verifier)]);
    res.cookie(cookieName,state,{...cookieOptions,maxAge:600000});
    const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search=new URLSearchParams({client_id:c.clientId,redirect_uri:c.redirectUri,response_type:'code',
      scope:`openid email ${GOOGLE_ACTIVITY_SCOPE}`,access_type:'offline',prompt:'consent',state,
      code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',login_hint:res.locals.user.email}).toString();
    res.json({url:url.href});
  }));
  const callback=asyncRoute(async(req:Request,res:Response)=>{
    const c=config(),state=typeof req.query.state==='string'?req.query.state:'';
    const cookie=req.headers.cookie?.split(';').map(part=>part.trim()).find(part=>part.startsWith(`${cookieName}=`))?.slice(cookieName.length+1)||'';
    res.clearCookie(cookieName,cookieOptions);
    if(!/^[A-Za-z0-9_-]{43}$/.test(state)||!/^[A-Za-z0-9_-]{43}$/.test(cookie)||!timingSafeEqual(Buffer.from(state),Buffer.from(cookie)))return returnToActivity(res,'invalid_state');
    const attempt=(await pool.query(`DELETE FROM google_health_oauth_states WHERE state_hash=$1 AND expires_at>NOW()
      RETURNING user_id,session_id,encrypted_verifier`,[createHash('sha256').update(state).digest('hex')])).rows[0];
    if(!attempt)return returnToActivity(res,'invalid_state');
    if(req.query.error)return returnToActivity(res,'denied');
    const code=z.string().min(1).max(4096).safeParse(req.query.code);if(!code.success)return returnToActivity(res,'failed');
    try {
      const session=await pool.query('SELECT id FROM sessions WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL AND expires_at>NOW()',[attempt.session_id,attempt.user_id]);
      if(!session.rowCount)return returnToActivity(res,'session_expired');
      const tokens=tokenSchema.parse((await axios.post('https://oauth2.googleapis.com/token',new URLSearchParams({client_id:c.clientId,client_secret:c.clientSecret,
        code:code.data,redirect_uri:c.redirectUri,grant_type:'authorization_code',
        code_verifier:openGoogleSecret<string>(settings.internalSecret,attempt.user_id,attempt.encrypted_verifier)}),requestOptions)).data);
      if(!tokens.refresh_token||!tokens.scope?.split(' ').includes(GOOGLE_ACTIVITY_SCOPE))return returnToActivity(res,'permission_missing');
      const [identity,profile]=await Promise.all([
        axios.get('https://health.googleapis.com/v4/users/me/identity',{...requestOptions,headers:{Authorization:`Bearer ${tokens.access_token}`}}),
        axios.get('https://openidconnect.googleapis.com/v1/userinfo',{...requestOptions,headers:{Authorization:`Bearer ${tokens.access_token}`}})]);
      z.object({healthUserId:z.string().min(1)}).parse(identity.data);
      const google=z.object({sub:z.string().min(1),email:z.email(),email_verified:z.literal(true)}).parse(profile.data);
      await transaction(pool,async client=>{
        const valid=await client.query('SELECT id FROM sessions WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL AND expires_at>NOW() FOR UPDATE',[attempt.session_id,attempt.user_id]);
        if(!valid.rowCount)throw Error('Session expired');
        await client.query('DELETE FROM google_health_days WHERE user_id=$1',[attempt.user_id]);
        await client.query('DELETE FROM google_health_intervals WHERE user_id=$1',[attempt.user_id]);
        await client.query('DELETE FROM google_health_hour_totals WHERE user_id=$1',[attempt.user_id]);
        await client.query('DELETE FROM google_health_feed_state WHERE user_id=$1',[attempt.user_id]);
        await client.query('DELETE FROM google_health_exercises WHERE user_id=$1',[attempt.user_id]);
        await client.query(`INSERT INTO google_health_connections(user_id,generation,provider_subject,account_email,encrypted_tokens,access_expires_at)
          VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id) DO UPDATE SET generation=EXCLUDED.generation,provider_subject=EXCLUDED.provider_subject,
          account_email=EXCLUDED.account_email,encrypted_tokens=EXCLUDED.encrypted_tokens,access_expires_at=EXCLUDED.access_expires_at,
          last_synced_at=NULL,last_attempt_at=NULL,error_code=NULL,metric_warnings='{}',next_sync_at=NOW(),sync_failures=0,history_synced_at=NULL`,[attempt.user_id,randomUUID(),google.sub,google.email,
          sealGoogleSecret(settings.internalSecret,attempt.user_id,tokens),new Date(Date.now()+tokens.expires_in*1000)]);
      });
      return returnToActivity(res,'connected');
    } catch { return returnToActivity(res,'failed'); }
  });
  router.get('/timeline',asyncRoute(async(req,res)=>{
    const zone=await timezone(owner(res)),range=dateRange(zone),date=req.query.date??range.today;
    if(typeof date!=='string'||!range.dates.includes(date))throw new HttpError(400,'Choose a date within the last seven days.');
    res.json(await readGoogleTimeline(pool,owner(res),zone,date,req.query.cursor));
  }));
  router.post('/sync',asyncRoute(async(_req,res)=>{config();await sync(owner(res));res.json(await overview(owner(res)));}));
  router.delete('/',asyncRoute(async(_req,res)=>{
    await pool.query('DELETE FROM google_health_oauth_states WHERE user_id=$1',[owner(res)]);
    await pool.query('DELETE FROM google_health_connections WHERE user_id=$1',[owner(res)]);
    res.json(await overview(owner(res)));
  }));
  return {router,callback,sync,abortAll:()=>{for(const controller of controllers.values())controller.abort();}};
}
