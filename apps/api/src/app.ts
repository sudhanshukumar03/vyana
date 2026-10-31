import {reportStorage} from './reports';
import {ecgStorage} from './ecg';
import {locationRoutes} from './locations';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { Pool } from 'pg';
import http from 'http';
import { Server } from 'socket.io';
import axios from 'axios';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { Config } from './config';
import { authServices, asyncRoute, digest, HttpError, randomToken } from './auth';
import { activitySchema, bmi, chatSchema, chatResponseSchema, contactSchema, deviceSchema, insightsSchema, profileSchema, reportSchema, reportResponseSchema, validateReport, vitalsSchema } from './schemas';
import { ingest, summary } from './telemetry';
import { transaction } from './db';
import {cancelSos,createManualSos,observationFromEquipment,receiveDeviceSos,recordSosObservation,
  requestReport,saveSosPreferences,sosOverview} from './sos';
import {sosCapabilities} from './sos-delivery';
import {buildSosReport} from './sos-report';
import {googleHealthIntegration} from './google-health';
import {healthReview,reviewAge} from './health-review';
import {googleCalendarDay} from './google-health';
import {simulateVitalsSchema,simulateTelemetry,seedHistoricalTelemetry,produceSimulationReport} from './admin-simulation';

export function isAllowedOrigin(origin: string | undefined, configuredOrigin: string, production: boolean): boolean {
  if (!origin) return true;
  if (origin === configuredOrigin) return true;
  if (!production) {
    try {
      const parsed = new URL(origin);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        const host = parsed.hostname;
        if (
          host === 'localhost' ||
          host === '127.0.0.1' ||
          /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
          /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
          /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)
        ) {
          return true;
        }
      }
    } catch {
      return false;
    }
  }
  return false;
}

export function createApplication(pool: Pool, config: Config) {
  const app=express(),server=http.createServer(app);
  app.disable('x-powered-by'); app.set('query parser','simple');
  const io = new Server(server, {
    cors: {
      origin: (requestOrigin, callback) => {
        if (!requestOrigin || isAllowedOrigin(requestOrigin, config.origin, config.production)) {
          callback(null, true);
        } else {
          callback(new Error('Origin not allowed'));
        }
      },
      credentials: true,
    },
    maxHttpBufferSize: 100000,
  });
  const broadcast=(owner:number,event:string,data:unknown)=>io.to(`user:${owner}`).emit(event,data);
  const auth=authServices(pool,config,(id)=>io.in(`session:${id}`).disconnectSockets(true));
  const googleHealth=googleHealthIntegration(pool,config);
  io.use((socket,next)=>{
    auth.authenticate(typeof socket.handshake.auth.token==='string'?socket.handshake.auth.token:'')
      .then(user=>{socket.data.user=user;next();}).catch(error=>{
        const invalid=error instanceof HttpError;
        next(Object.assign(new Error(invalid?'Authentication required':'Service temporarily unavailable'),{data:{status:invalid?401:503}}));
      });
  });
  io.on('connection',socket=>{
    const user=socket.data.user;
    socket.join(`user:${user.id}`); socket.join(`session:${user.session_id}`);
    const timer=setTimeout(()=>socket.disconnect(true),Math.max(1,user.expires-Date.now()));timer.unref();
    socket.on('disconnect',()=>clearTimeout(timer));
  });
  app.use(helmet());
  app.use((req, res, next) => {
    res.setHeader('X-Request-Id', randomUUID());
    res.setHeader('Cache-Control', 'no-store');
    if (req.headers.origin && !isAllowedOrigin(req.headers.origin, config.origin, config.production)) {
      return next(new HttpError(403, 'Origin not allowed'));
    }
    next();
  });
  app.use(cors({
    origin: (requestOrigin, callback) => {
      if (!requestOrigin || isAllowedOrigin(requestOrigin, config.origin, config.production)) {
        callback(null, true);
      } else {
        callback(new HttpError(403, 'Origin not allowed'));
      }
    },
    credentials: true,
  }));
  app.use(rateLimit({windowMs:60000,limit:3000,standardHeaders:'draft-8',legacyHeaders:false,
    message:{error:'Too many requests. Retry in a minute.'}}));
  const reports=reportStorage(pool,config.internalSecret);
  const ecg=ecgStorage(pool);
  const parseSmall=express.json({limit:'100kb'});
  app.use((req,res,next)=>(req.path==='/api/v1/assistant/report'||req.path==='/api/v1/reports')?next():parseSmall(req,res,next));
  app.get('/health/live',(_req,res)=>res.json({status:'alive'}));
  app.get('/health/ready',asyncRoute(async(_req,res)=>{
    await pool.query('SELECT 1');res.json({status:'ready'});
  }));
  app.use('/api/v1/auth',rateLimit({windowMs:60000,limit:20,standardHeaders:'draft-8',legacyHeaders:false,
    message:{error:'Too many authentication attempts. Retry in a minute.'}}),auth.router);
  const deviceLimit=rateLimit({windowMs:60000,limit:120,keyGenerator:(_req,res)=>String(res.locals.device.id),
    standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Device rate limit. Retry later.'}});
  const ecgLimit=rateLimit({windowMs:60000,limit:360,keyGenerator:(_req,res)=>String(res.locals.device.id),standardHeaders:'draft-8',legacyHeaders:false});
  app.post('/api/v1/ingest/ecg',auth.deviceMiddleware,ecgLimit,asyncRoute(async(req,res)=>{
    res.json(await ecg.accept(res.locals.device.user_id,res.locals.device.id,req.body));
  }));
  app.post('/api/v1/device/status',auth.deviceMiddleware,deviceLimit,asyncRoute(async(req,res)=>{
    const input=deviceSchema.parse(req.body);
    const result=await transaction(pool,async client=>{
    const {rows}=await client.query(`UPDATE devices SET device_name=$1,connected=$2,battery=$3,source=$4,last_seen=NOW(),
      equipment=CASE WHEN $6::jsonb IS NOT NULL AND
        ($6::jsonb->>'observed_at')::timestamptz>=COALESCE((equipment->>'observed_at')::timestamptz,'-infinity'::timestamptz)
        THEN $6::jsonb ELSE equipment END
      WHERE id=$5 AND revoked_at IS NULL RETURNING id,device_name,connected,battery,last_seen,source,active,equipment`,
    [input.device_name,input.connected,input.battery,input.source,res.locals.device.id,
      input.equipment?JSON.stringify(input.equipment):null]);
    if(!rows[0]) throw new HttpError(401,'Device revoked');
    if(input.equipment&&Date.parse(input.equipment.observed_at)<=Date.now()+5000) {
      await client.query(`INSERT INTO equipment_history(user_id,device_id,observed_at,source,equipment)
        VALUES($1,$2,$3,$4,$5) ON CONFLICT(device_id,observed_at) DO NOTHING`,
        [res.locals.device.user_id,res.locals.device.id,input.equipment.observed_at,input.source,input.equipment]);
      await client.query("DELETE FROM equipment_history WHERE user_id=$1 AND observed_at<NOW()-INTERVAL '30 days'",[res.locals.device.user_id]);
    }
    const alert=input.equipment?await recordSosObservation(client,{...res.locals.device,active:rows[0].active&&input.connected},
      observationFromEquipment(input.equipment,input.source),config.staleSeconds):null;
    return {device:rows[0],alert};
    });
    broadcast(res.locals.device.user_id,'health_update',{type:'device',data:result.device});
    if(result.alert)broadcast(res.locals.device.user_id,'new_alert',result.alert);
    res.json({success:true});
  }));
  app.post('/api/v1/device/emergency',auth.deviceMiddleware,deviceLimit,asyncRoute(async(req,res)=>{
    const input=z.object({session_id:z.uuid(),sequence:z.number().int().min(0).max(2147483647),
      observed_at:z.iso.datetime({offset:true})}).strict().parse(req.body);
    res.status(202).json(await receiveDeviceSos(pool,res.locals.device,input,broadcast));
  }));
  for(const kind of ['vitals','activity'] as const) app.post(`/api/v1/ingest/${kind}`,auth.deviceMiddleware,deviceLimit,asyncRoute(async(req,res)=>{
    const input=kind==='vitals'?vitalsSchema.parse(req.body):activitySchema.parse(req.body);
    res.json(await ingest(pool,res.locals.device,kind,input,config.staleSeconds,broadcast));
  }));
  app.get('/api/v1/integrations/google-health/callback',googleHealth.callback);
  app.use('/api/v1',auth.userMiddleware);
  app.get('/api/v1/ecg/stream',asyncRoute(async(req,res)=>res.json(await ecg.read(Number(res.locals.user.id),req.query))));
  app.use('/api/v1/integrations/google-health',googleHealth.router);
  app.use('/api/v1/locations',locationRoutes(config.locationProviders));
  app.get('/api/v1/equipment/history',asyncRoute(async(req,res)=>{
    const query=z.object({before:z.coerce.number().int().positive().default(2147483647),limit:z.coerce.number().int().min(1).max(100).default(50)}).strict().parse(req.query);
    res.json((await pool.query(`SELECT id,device_id,observed_at,received_at,source,equipment FROM equipment_history WHERE user_id=$1 AND id<$2 AND observed_at>=NOW()-INTERVAL '30 days'
      AND device_id=(SELECT id FROM devices WHERE user_id=$1 AND active AND revoked_at IS NULL) ORDER BY id DESC LIMIT $3`,[Number(res.locals.user.id),query.before,query.limit])).rows);
  }));
  const userId=(res:Response):number=>Number(res.locals.user.id);
  const sosLimit=rateLimit({windowMs:60000,limit:5,keyGenerator:(_req,res)=>String(userId(res)),
    standardHeaders:'draft-8',legacyHeaders:false,message:{error:'SOS request limit reached. Use your phone directly if urgent.'}});
  app.get('/api/v1/sos',asyncRoute(async(_req,res)=>res.json(await sosOverview(pool,userId(res),sosCapabilities(config.sosDelivery)))));
  app.put('/api/v1/sos/preferences',asyncRoute(async(req,res)=>res.json(await saveSosPreferences(pool,userId(res),req.body,sosCapabilities(config.sosDelivery)))));
  app.post('/api/v1/sos/:id/cancel',asyncRoute(async(req,res)=>res.json(await cancelSos(pool,userId(res),z.uuid().parse(req.params.id)))));
  app.get('/api/v1/sos/report',asyncRoute(async(_req,res)=>res.json(await transaction(pool,client=>buildSosReport(client,userId(res),'Monitoring report preview')))));
  app.post('/api/v1/sos/report',sosLimit,asyncRoute(async(_req,res)=>res.status(202).json({id:await requestReport(pool,userId(res),sosCapabilities(config.sosDelivery))})));
  app.get('/api/v1/health/summary',asyncRoute(async(_req,res)=>res.json(await summary(pool,userId(res),config.staleSeconds))));
  app.get('/api/v1/vitals/latest',asyncRoute(async(_req,res)=>{
    const data=await summary(pool,userId(res),config.staleSeconds);res.json(data.vitals);
  }));
  for(const [url,table] of [['vitals/trends','vitals'],['activity/summary','activity']] as const) {
    app.get(`/api/v1/${url}`,asyncRoute(async(req,res)=>{
      const limit=z.coerce.number().int().min(1).max(100).default(20).parse(req.query.limit);
      const cursor=req.query.cursor?z.string().max(100).parse(req.query.cursor).split('|'):null;
      if(cursor && (cursor.length!==2||!z.iso.datetime({offset:true}).safeParse(cursor[0]).success||!/^\d+$/.test(cursor[1]))) throw new HttpError(400,'Invalid history cursor');
      const {rows}=await pool.query(`SELECT r.* FROM ${table} r WHERE r.user_id=$1
        AND r.device_id=(SELECT id FROM devices WHERE user_id=$1 AND active AND revoked_at IS NULL)
        AND ($2::timestamptz IS NULL OR (r.observed_at,r.id)<($2::timestamptz,$3::int)) ORDER BY r.observed_at DESC,r.id DESC LIMIT $4`,
      [userId(res),cursor?.[0]||null,cursor?.[1]||null,limit]);
      res.json(rows.reverse());
    }));
  }
  app.get('/api/v1/profile',asyncRoute(async(_req,res)=>{
    const {rows}=await pool.query('SELECT * FROM profile WHERE user_id=$1',[userId(res)]);res.json(rows[0]||{onboarded:false});
  }));
  const saveProfile=asyncRoute(async(req,res)=>{
    const patch=profileSchema.parse(req.body);
    const row=await transaction(pool,async(client)=>{
      await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[userId(res)]);
      const existing=(await client.query('SELECT * FROM profile WHERE user_id=$1',[userId(res)])).rows[0]||{};
      const merged={...existing,...patch};
      if(!merged.height_cm||!merged.weight_kg) throw new HttpError(400,'Height and weight are required to complete the profile');
      const age=reviewAge(merged.dob,googleCalendarDay(Date.now(),merged.timezone||'Asia/Kolkata'));
      const hasGoal=merged.goal_weight_kg!=null&&merged.weight_goal_type!=='maintain';
      const invalidGoal=hasGoal&&(age===null||age<20||merged.goal_weight_kg<18.5*(merged.height_cm/100)**2||
        merged.weight_goal_type==='reduce'&&merged.goal_weight_kg>=merged.weight_kg||merged.weight_goal_type==='gain'&&merged.goal_weight_kg<=merged.weight_kg);
      if(invalidGoal){if(patch.goal_weight_kg!=null||patch.weight_goal_type!==undefined)throw new HttpError(400,'Choose an adult goal that follows your selected direction and stays above the lower reference range.');merged.goal_weight_kg=null;}
      if(merged.weight_goal_type==='maintain')merged.goal_weight_kg=null;
      if(patch.weight_kg!==undefined&&patch.weight_kg!==existing.weight_kg)await client.query("INSERT INTO weight_measurements(user_id,weight_kg,observed_at,source) VALUES($1,$2,NOW(),'profile')",[userId(res),patch.weight_kg]);
      const fields=['full_name','dob','sex','height_cm','weight_kg','conditions','medications','allergies','activity_level','goal','timezone','energy_activity','nutrition_review','weight_goal_type','goal_weight_kg'];
      const defaults:Record<string,unknown>={timezone:'Asia/Kolkata',nutrition_review:'unknown',weight_goal_type:'maintain'};
      const values=[userId(res),...fields.map(field=>merged[field]??defaults[field]??null)];
      return (await client.query(`INSERT INTO profile(user_id,${fields.join(',')},onboarded) VALUES(${values.map((_,i)=>`$${i+1}`).join(',')},TRUE)
        ON CONFLICT(user_id) DO UPDATE SET ${fields.map(field=>`${field}=EXCLUDED.${field}`).join(',')},onboarded=TRUE,updated_at=NOW() RETURNING *`,values)).rows[0];
    });res.json(row);
  });
  app.post('/api/v1/profile',saveProfile);app.patch('/api/v1/profile',saveProfile);
  app.get('/api/v1/health/review',asyncRoute(async(_req,res)=>res.json(await healthReview(pool,userId(res)))));
  app.post('/api/v1/health/weight',asyncRoute(async(req,res)=>{
    const input=z.object({weight_kg:z.number().min(20).max(300),observed_at:z.iso.datetime({offset:true})}).strict().parse(req.body);
    const observed=Date.parse(input.observed_at);
    if(observed>Date.now()+5000||observed<Date.now()-366*86400000)throw new HttpError(400,'Choose a measurement within the past year, not in the future.');
    const result=await transaction(pool,async client=>{
      await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[userId(res)]);
      const profile=(await client.query('SELECT * FROM profile WHERE user_id=$1',[userId(res)])).rows[0];
      if(!profile?.onboarded)throw new HttpError(400,'Complete your profile before recording weight.');
      const existing=(await client.query('SELECT * FROM weight_measurements WHERE user_id=$1 AND observed_at=$2',[userId(res),input.observed_at])).rows[0];
      if(existing&&existing.weight_kg!==input.weight_kg)throw new HttpError(409,'A different weight already exists at that timestamp.');
      if(!existing)await client.query("INSERT INTO weight_measurements(user_id,weight_kg,observed_at,source) VALUES($1,$2,$3,'manual')",[userId(res),input.weight_kg,input.observed_at]);
      const latest=(await client.query('SELECT observed_at FROM weight_measurements WHERE user_id=$1 ORDER BY observed_at DESC LIMIT 1',[userId(res)])).rows[0];
      const zone=profile.timezone||'Asia/Kolkata';
      if(observed>=Date.parse(latest.observed_at)&&googleCalendarDay(observed,zone)===googleCalendarDay(Date.now(),zone))await client.query('UPDATE profile SET weight_kg=$2,updated_at=NOW() WHERE user_id=$1',[userId(res),input.weight_kg]);
      return {recorded:true,observed_at:new Date(observed).toISOString(),profile:(await client.query('SELECT * FROM profile WHERE user_id=$1',[userId(res)])).rows[0]};
    });res.status(201).json(result);
  }));
  app.get('/api/v1/profile/contacts',asyncRoute(async(_req,res)=>res.json((await pool.query('SELECT * FROM emergency_contact WHERE user_id=$1 ORDER BY id DESC LIMIT 100',[userId(res)])).rows)));
  app.post('/api/v1/profile/contacts',asyncRoute(async(req,res)=>{
    const c=contactSchema.parse(req.body);
    const {rows}=await pool.query('INSERT INTO emergency_contact(user_id,name,phone,email,relation,is_doctor,office_phone) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [userId(res),c.name,c.phone??null,c.email??null,c.relation??null,c.is_doctor,c.office_phone??null]);res.status(201).json(rows[0]);
  }));
  app.delete('/api/v1/profile/contacts/:id',asyncRoute(async(req,res)=>{
    const id=z.coerce.number().int().positive().parse(req.params.id);
    const result=await pool.query('DELETE FROM emergency_contact WHERE id=$1 AND user_id=$2',[id,userId(res)]);
    if(!result.rowCount) throw new HttpError(404,'Contact not found');res.json({success:true});
  }));
  app.get('/api/v1/devices',asyncRoute(async(_req,res)=>res.json((await pool.query('SELECT id,device_name,revoked_at,active,last_seen FROM devices WHERE user_id=$1 ORDER BY device_name',[userId(res)])).rows)));
  app.post('/api/v1/devices',asyncRoute(async(req,res)=>{
    const {name}=z.object({name:z.string().trim().min(1).max(100)}).strict().parse(req.body);
    const key=randomToken(),id=randomUUID();
    await transaction(pool,async(client)=>{
      await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[userId(res)]);
      const active=(await client.query('SELECT id FROM devices WHERE user_id=$1 AND active AND revoked_at IS NULL',[userId(res)])).rowCount;
      await client.query('INSERT INTO devices(id,user_id,device_name,credential_hash,active) VALUES($1,$2,$3,$4,$5)',[id,userId(res),name,digest(key),!active]);
    });res.status(201).json({id,credential:key,message:'Save this credential now. It is shown once.'});
  }));
  app.post('/api/v1/devices/:id/activate',asyncRoute(async(req,res)=>{
    const id=z.uuid().parse(req.params.id);
    await transaction(pool,async(client)=>{
      await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[userId(res)]);
      const device=await client.query('SELECT id FROM devices WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL',[id,userId(res)]);
      if(!device.rowCount) throw new HttpError(404,'Device not found');
      await client.query('UPDATE devices SET active=FALSE WHERE user_id=$1',[userId(res)]);
      await client.query('UPDATE devices SET active=TRUE WHERE id=$1',[id]);
    });res.json({success:true});
  }));
  app.delete('/api/v1/devices/:id',asyncRoute(async(req,res)=>{
    const id=z.uuid().parse(req.params.id);
    const {rowCount}=await pool.query('UPDATE devices SET revoked_at=NOW(),active=FALSE,connected=FALSE WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL',[id,userId(res)]);
    if(!rowCount) throw new HttpError(404,'Device not found');res.json({success:true});
  }));
  app.get('/api/v1/device',asyncRoute(async(_req,res)=>res.json((await summary(pool,userId(res),config.staleSeconds)).device)));
  app.post('/api/v1/sos',sosLimit,asyncRoute(async(req,res)=>{
    const {note,request_id}=z.object({note:z.string().max(200).default(''),request_id:z.uuid().optional()}).strict().parse(req.body||{});
    res.status(201).json(await createManualSos(pool,userId(res),note,broadcast,sosCapabilities(config.sosDelivery),request_id));
  }));
  app.get('/api/v1/alerts',asyncRoute(async(req,res)=>{
    const limit=z.coerce.number().int().min(1).max(100).default(50).parse(req.query.limit);
    const before=req.query.before?z.coerce.number().int().positive().parse(req.query.before):2147483647;
    res.json((await pool.query(`SELECT * FROM alerts WHERE user_id=$1 AND id<$2
      ORDER BY CASE WHEN status='active' AND severity='critical' THEN 0 ELSE 1 END,id DESC LIMIT $3`,[userId(res),before,limit])).rows);
  }));
  for(const action of ['acknowledge','resolve'] as const) app.post(`/api/v1/alerts/:id/${action}`,asyncRoute(async(req,res)=>{
    const id=z.coerce.number().int().positive().parse(req.params.id);
    const assignment=action==='acknowledge'?'acknowledged_at=NOW()':"status='resolved',resolved_at=NOW()";
    const {rows}=await pool.query(`UPDATE alerts SET ${assignment} WHERE id=$1 AND user_id=$2 RETURNING *`,[id,userId(res)]);
    if(!rows[0]) throw new HttpError(404,'Alert not found');broadcast(userId(res),'new_alert',rows[0]);res.json(rows[0]);
  }));

  // Back-office operations & hardware telemetry simulation
  app.use('/api/v1/admin/simulate',(_req,res,next)=>{
    if(config.production)return next(new HttpError(403,'Simulation tools are available only outside production'));
    next();
  });
  app.get('/api/v1/admin/simulate/status', asyncRoute(async (_req, res) => {
    const data = await summary(pool, userId(res), config.staleSeconds);
    const recent = (await pool.query(
      "SELECT id, observed_at, heart_rate, spo2, temperature, ecg_status, source FROM vitals WHERE user_id=$1 AND source='BackOffice_Simulator' ORDER BY observed_at DESC, id DESC LIMIT 15",
      [userId(res)]
    )).rows;
    res.json({
      device: data.device,
      vitals: data.vitals,
      wellness_score: data.wellness_score,
      freshness: data.freshness,
      recent,
      alerts_count: data.alerts.length,
    });
  }));

  app.post('/api/v1/admin/simulate', asyncRoute(async (req, res) => {
    const input = simulateVitalsSchema.parse(req.body);
    const result = await simulateTelemetry(pool, userId(res), input, config.staleSeconds, broadcast);
    res.json(result);
  }));

  app.post('/api/v1/admin/simulate/seed', asyncRoute(async (req, res) => {
    const { hours, heart_rate, spo2, temperature } = z.object({
      hours: z.number().min(1).max(72).default(12),
      heart_rate: z.number().int().min(30).max(220).default(74),
      spo2: z.number().min(70).max(100).default(98),
      temperature: z.number().min(34).max(42).default(36.6),
    }).strict().parse(req.body || {});
    const result = await seedHistoricalTelemetry(pool, userId(res), hours, heart_rate, spo2, temperature, config.staleSeconds, broadcast);
    res.json(result);
  }));

  app.post('/api/v1/admin/simulate/report', asyncRoute(async (_req, res) => {
    const report = await produceSimulationReport(pool, userId(res), reports);
    res.status(201).json(report);
  }));
  const aiLimit=rateLimit({windowMs:60000,limit:12,keyGenerator:(_req,res)=>String(userId(res)),
    standardHeaders:'draft-8',legacyHeaders:false,message:{error:'AI request limit reached. Retry in a minute.'}});
  let activeAI=0;
  const aiCapacity=(_req:Request,res:Response,next:NextFunction)=>{
    if(activeAI>=3){res.setHeader('Retry-After','5');return next(new HttpError(429,'AI capacity reached. Retry in a few seconds.'));}
    activeAI++;let released=false;const controller=new AbortController();res.locals.aiSignal=controller.signal;
    const release=()=>{if(!released){released=true;activeAI--;}};
    res.once('finish',release);res.once('close',()=>{controller.abort();release();});next();
  };
  async function aiContext(owner:number) {
    const data=await summary(pool,owner,config.staleSeconds);
    const review=await healthReview(pool,owner);
    const history=await pool.query(`SELECT COUNT(*)::int AS sample_count,AVG(heart_rate)::float AS average_heart_rate,
      AVG(spo2)::float AS average_spo2,MIN(temperature)::float AS minimum_temperature,
      MAX(temperature)::float AS maximum_temperature FROM vitals WHERE user_id=$1 AND observed_at>=NOW()-INTERVAL '7 days'
      AND device_id=(SELECT id FROM devices WHERE user_id=$1 AND active AND revoked_at IS NULL)
      AND source IN ('ESP32_MAX30102_DS18B20_AD8232','ESP32_RealVitals_SimulatedSteps')`,[owner]);
    // Send only relevant profile fields. Names and account/database identifiers have no role in generation.
    const profile=data.profile;
    const safeProfile=profile?{dob:profile.dob,sex:profile.sex,height_cm:profile.height_cm,weight_kg:profile.weight_kg,
      conditions:profile.conditions,medications:profile.medications,allergies:profile.allergies,
      activity_level:profile.activity_level,goal:profile.goal,timezone:profile.timezone}:{};
    return {owner_id:String(owner),vitals:data.vitals||{},activity:data.activity||{},profile:safeProfile,bmi:bmi(data.profile||{}),
      alerts:data.alerts,historical_vitals:{period_days:7,...history.rows[0]},wellness_score:data.wellness_score,fresh:data.freshness.state==='fresh',
      health_review:{facts:review.facts,period:review.activity.period,body:{bmi:review.body.bmi,maintenance_kcal:review.body.maintenance_kcal,energy_status:review.body.energy_status,model:review.body.model}}};
  }
  async function callAI(owner:number,path:string,body:object,signal:AbortSignal) {
    const result=await axios.post(`${config.aiUrl}/api/ai/${path}`,body,{timeout:35000,maxBodyLength:15*1024*1024,
      maxContentLength:100000,signal,headers:{'X-AI-Key':config.internalSecret,'X-Owner-Id':String(owner)}});
    return result.data;
  }
  app.get('/api/v1/health/insights',aiLimit,aiCapacity,asyncRoute(async(_req,res)=>{
    const context=await aiContext(userId(res));
    try {res.json(insightsSchema.parse(await callAI(userId(res),'insights',context,res.locals.aiSignal)));}
    catch {res.json({insights:(await summary(pool,userId(res),config.staleSeconds)).insights,offline:true});}
  }));
  app.post('/api/v1/assistant/chat',aiLimit,aiCapacity,asyncRoute(async(req,res)=>{
    const input=chatSchema.parse(req.body),context=await aiContext(userId(res));
    try {
      const data=chatResponseSchema.parse(await callAI(userId(res),'chat',{...context,...input},res.locals.aiSignal));res.json(data);
    } catch {res.json({reply:'I could not reach AI analysis. Please try again later. No AI assessment was produced.',sections:[],source:'fallback',reason:'unavailable',retry_after_seconds:5,disclaimer:'AI wellness guidance only; not professional medical care.',offline:true});}
  }));
  async function reviewReport(owner:number,input:z.infer<typeof reportSchema>,signal:AbortSignal) {
    try {validateReport(input);}catch(error){throw new HttpError((error as {status?:number}).status||400,(error as Error).message);}
    const context=await aiContext(owner);
    try {return reportResponseSchema.parse(await callAI(owner,'report',{...context,...input},signal));}
    catch {
      if(signal.aborted)throw new HttpError(408,'Review request cancelled. No review was saved.');
      return reportResponseSchema.parse({summary:'I could not review the report because AI analysis is unavailable. No findings were extracted. Please try again later or discuss the original report with a clinician.',sections:[],source:'fallback',reason:'unavailable',retry_after_seconds:5,document_status:'not_reviewed',discussion_points:[],disclaimer:'AI wellness guidance only; not professional medical care.',offline:true});
    }
  }
  app.post('/api/v1/assistant/report',aiLimit,aiCapacity,express.json({limit:'15mb'}),asyncRoute(async(req,res)=>{
    res.json(await reviewReport(userId(res),reportSchema.parse(req.body),res.locals.aiSignal));
  }));
  app.get('/api/v1/reports',asyncRoute(async(_req,res)=>res.json(await reports.list(userId(res)))));
  app.get('/api/v1/reports/:id',asyncRoute(async(req,res)=>res.json(await reports.get(userId(res),z.uuid().parse(req.params.id),true))));
  app.post('/api/v1/reports',aiLimit,aiCapacity,express.json({limit:'15mb'}),asyncRoute(async(req,res)=>{
    const input=reportSchema.parse(req.body);
    await reports.ensureCapacity(userId(res),Buffer.from(input.data_base64,'base64').length);
    const analysis=await reviewReport(userId(res),input,res.locals.aiSignal);
    res.status(201).json(await reports.save(userId(res),input,analysis));
  }));
  app.post('/api/v1/reports/:id/review',aiLimit,aiCapacity,asyncRoute(async(req,res)=>{
    const id=z.uuid().parse(req.params.id),input=await reports.document(userId(res),id);
    res.json(await reports.save(userId(res),input,await reviewReport(userId(res),input,res.locals.aiSignal),id));
  }));
  app.delete('/api/v1/reports/:id',asyncRoute(async(req,res)=>{
    await reports.remove(userId(res),z.uuid().parse(req.params.id));res.json({success:true});
  }));
  app.use((_req,_res,next)=>next(new HttpError(404,'Route not found')));
  app.use((error:unknown,_req:Request,res:Response,_next:NextFunction)=>{
    if(error instanceof z.ZodError) return res.status(400).json({error:'Validation failed',details:error.issues.map(issue=>({path:issue.path,message:issue.message}))});
    const e=error as {status?:number;type?:string;code?:string;message?:string};
    const status=e.type==='entity.too.large'?413:e.status||503;
    const message=e instanceof HttpError?e.message:status===413?(['/api/v1/assistant/report','/api/v1/reports'].includes(_req.path)?'File too large (maximum 10 MiB)':'Request body too large (maximum 100 KiB)'):status===400?'Invalid JSON body':'Service temporarily unavailable. Please retry.';
    if(status>=500) console.error(JSON.stringify({event:'request_failed',request_id:res.getHeader('X-Request-Id'),code:e.code||'dependency_error'}));
    res.status(status).json({error:message,request_id:res.getHeader('X-Request-Id')});
  });
  return {app,server,io,googleHealth};
}
