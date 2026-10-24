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
import { activitySchema, bmi, chatSchema, contactSchema, deviceSchema, insightsSchema, profileSchema, reportSchema, validateReport, vitalsSchema } from './schemas';
import { ingest, summary } from './telemetry';
import { transaction } from './db';

export function createApplication(pool: Pool, config: Config) {
  const app=express(),server=http.createServer(app);
  app.disable('x-powered-by'); app.set('query parser','simple');
  const io=new Server(server,{cors:{origin:config.origin,credentials:true},maxHttpBufferSize:100000});
  const broadcast=(owner:number,event:string,data:unknown)=>io.to(`user:${owner}`).emit(event,data);
  const auth=authServices(pool,config,(id)=>io.in(`session:${id}`).disconnectSockets(true));
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
  app.use((req,res,next)=>{
    res.setHeader('X-Request-Id',randomUUID());res.setHeader('Cache-Control','no-store');
    if(req.headers.origin && req.headers.origin!==config.origin) return next(new HttpError(403,'Origin not allowed'));
    next();
  });
  app.use(cors({origin:config.origin,credentials:true}));
  app.use(rateLimit({windowMs:60000,limit:3000,standardHeaders:'draft-8',legacyHeaders:false,
    message:{error:'Too many requests. Retry in a minute.'}}));
  const parseSmall=express.json({limit:'100kb'});
  app.use((req,res,next)=>req.path==='/api/v1/assistant/report'?next():parseSmall(req,res,next));
  app.get('/health/live',(_req,res)=>res.json({status:'alive'}));
  app.get('/health/ready',asyncRoute(async(_req,res)=>{
    await pool.query('SELECT 1');res.json({status:'ready'});
  }));
  app.use('/api/v1/auth',rateLimit({windowMs:60000,limit:20,standardHeaders:'draft-8',legacyHeaders:false,
    message:{error:'Too many authentication attempts. Retry in a minute.'}}),auth.router);
  const deviceLimit=rateLimit({windowMs:60000,limit:120,keyGenerator:(_req,res)=>String(res.locals.device.id),
    standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Device rate limit. Retry later.'}});
  app.post('/api/v1/device/status',auth.deviceMiddleware,deviceLimit,asyncRoute(async(req,res)=>{
    const input=deviceSchema.parse(req.body);
    const {rows}=await pool.query(`UPDATE devices SET device_name=$1,connected=$2,battery=$3,source=$4,last_seen=NOW()
      WHERE id=$5 AND revoked_at IS NULL RETURNING id,device_name,connected,battery,last_seen,source,active`,
    [input.device_name,input.connected,input.battery,input.source,res.locals.device.id]);
    if(!rows[0]) throw new HttpError(401,'Device revoked');
    broadcast(res.locals.device.user_id,'health_update',{type:'device',data:rows[0]});res.json({success:true});
  }));
  for(const kind of ['vitals','activity'] as const) app.post(`/api/v1/ingest/${kind}`,auth.deviceMiddleware,deviceLimit,asyncRoute(async(req,res)=>{
    const input=kind==='vitals'?vitalsSchema.parse(req.body):activitySchema.parse(req.body);
    res.json(await ingest(pool,res.locals.device,kind,input,config.staleSeconds,broadcast));
  }));
  app.use('/api/v1',auth.userMiddleware);
  const userId=(res:Response):number=>Number(res.locals.user.id);
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
      const fields=['full_name','dob','sex','height_cm','weight_kg','conditions','medications','allergies','activity_level','goal','timezone'];
      const values=[userId(res),...fields.map(field=>merged[field]??(field==='timezone'?'Asia/Kolkata':null))];
      return (await client.query(`INSERT INTO profile(user_id,${fields.join(',')},onboarded) VALUES(${values.map((_,i)=>`$${i+1}`).join(',')},TRUE)
        ON CONFLICT(user_id) DO UPDATE SET ${fields.map(field=>`${field}=EXCLUDED.${field}`).join(',')},onboarded=TRUE,updated_at=NOW() RETURNING *`,values)).rows[0];
    });res.json(row);
  });
  app.post('/api/v1/profile',saveProfile);app.patch('/api/v1/profile',saveProfile);
  app.get('/api/v1/profile/contacts',asyncRoute(async(_req,res)=>res.json((await pool.query('SELECT * FROM emergency_contact WHERE user_id=$1 ORDER BY id DESC LIMIT 100',[userId(res)])).rows)));
  app.post('/api/v1/profile/contacts',asyncRoute(async(req,res)=>{
    const c=contactSchema.parse(req.body);
    const {rows}=await pool.query('INSERT INTO emergency_contact(user_id,name,phone,email,relation,is_doctor) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
      [userId(res),c.name,c.phone??null,c.email??null,c.relation??null,c.is_doctor]);res.status(201).json(rows[0]);
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
  app.post('/api/v1/sos',asyncRoute(async(req,res)=>{
    const {note}=z.object({note:z.string().max(200).default('')}).parse(req.body||{});
    const {rows}=await pool.query(`INSERT INTO alerts(user_id,severity,title,detail,metric) VALUES($1,'critical','SOS Emergency',$2,'emergency') RETURNING *`,
      [userId(res),`Emergency logged by user. ${note}`]);broadcast(userId(res),'new_alert',rows[0]);res.status(201).json(rows[0]);
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
    const history=await pool.query(`SELECT COUNT(*)::int AS sample_count,AVG(heart_rate)::float AS average_heart_rate,
      AVG(spo2)::float AS average_spo2,MIN(temperature)::float AS minimum_temperature,
      MAX(temperature)::float AS maximum_temperature FROM vitals WHERE user_id=$1 AND observed_at>=NOW()-INTERVAL '7 days'`,[owner]);
    return {owner_id:String(owner),vitals:data.vitals||{},activity:data.activity||{},profile:data.profile||{},bmi:bmi(data.profile||{}),
      alerts:data.alerts,historical_vitals:{period_days:7,...history.rows[0]},wellness_score:data.wellness_score,fresh:data.freshness.state==='fresh'};
  }
  async function callAI(owner:number,path:string,body:object,signal:AbortSignal) {
    const result=await axios.post(`${config.aiUrl}/api/ai/${path}`,body,{timeout:12000,maxBodyLength:15*1024*1024,
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
      const data=z.object({reply:z.string().max(16000),disclaimer:z.string().max(500),offline:z.boolean()}).parse(await callAI(userId(res),'chat',{...context,...input},res.locals.aiSignal));res.json(data);
    } catch {res.json({reply:'The assistant is unavailable. Please try again later.',disclaimer:'AI wellness guidance only; not professional medical care.',offline:true});}
  }));
  app.post('/api/v1/assistant/report',aiLimit,aiCapacity,express.json({limit:'15mb'}),asyncRoute(async(req,res)=>{
    const input=reportSchema.parse(req.body);
    try {validateReport(input);}catch(error){throw new HttpError((error as {status?:number}).status||400,(error as Error).message);}
    try {
      const data=z.object({summary:z.string().max(16000),discussion_points:z.array(z.string().max(1000)).max(20),
        disclaimer:z.string().max(500),offline:z.boolean()}).parse(await callAI(userId(res),'report',{...input,owner_id:String(userId(res))},res.locals.aiSignal));res.json(data);
    } catch {res.json({summary:'Report analysis is unavailable. Please try again later.',discussion_points:[],disclaimer:'AI wellness guidance only; not professional medical care.',offline:true});}
  }));
  app.use((_req,_res,next)=>next(new HttpError(404,'Route not found')));
  app.use((error:unknown,_req:Request,res:Response,_next:NextFunction)=>{
    if(error instanceof z.ZodError) return res.status(400).json({error:'Validation failed',details:error.issues.map(issue=>({path:issue.path,message:issue.message}))});
    const e=error as {status?:number;type?:string;code?:string;message?:string};
    const status=e.type==='entity.too.large'?413:e.status||503;
    const message=e instanceof HttpError?e.message:status===413?(_req.path==='/api/v1/assistant/report'?'File too large (maximum 10 MiB)':'Request body too large (maximum 100 KiB)'):status===400?'Invalid JSON body':'Service temporarily unavailable. Please retry.';
    if(status>=500) console.error(JSON.stringify({event:'request_failed',request_id:res.getHeader('X-Request-Id'),code:e.code||'dependency_error'}));
    res.status(status).json({error:message,request_id:res.getHeader('X-Request-Id')});
  });
  return {app,server,io};
}
