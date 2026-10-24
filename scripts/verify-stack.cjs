/** Synthetic load/ownership probe. Only the explicitly isolated verification stack is allowed. */
const fs=require('fs');
const {createRequire}=require('module');
const apiRequire=createRequire(require('path').resolve('apps/api/package.json'));
const {Pool}=apiRequire('pg');
const {io}=require('../apps/web/node_modules/socket.io-client');
const {randomUUID}=require('crypto');
const base=process.env.STACK_BASE_URL||'http://127.0.0.1:18080';
if(base!=='http://127.0.0.1:18080'||process.env.VERIFY_DISPOSABLE!=='1')throw new Error('Requires the isolated loopback verification stack and VERIFY_DISPOSABLE=1');
const nativeDatabase=process.env.VERIFY_DATABASE_URL;
if(nativeDatabase && (new URL(nativeDatabase).hostname!=='127.0.0.1'||new URL(nativeDatabase).port!=='55434'||new URL(nativeDatabase).pathname!=='/healthguard_soak_test'))throw new Error('Native verification requires the dedicated loopback healthguard_soak_test database');
const env=nativeDatabase?{}:Object.fromEntries(fs.readFileSync('.audit-runtime/compose.env','utf8').trim().split(/\r?\n/).map(line=>{const i=line.indexOf('=');return[line.slice(0,i),line.slice(i+1)];}));
const duration=Number(process.env.SOAK_SECONDS||1800);
const metrics={duration_seconds:duration,users:10,socket_clients:20,ingest_success:0,duplicates:0,owner_leaks:0,errors:[],summary_ms:[],delivery_ms:[],seed_rows_per_kind:518400,snapshot_interval_seconds:5};
const clients=[],sockets=[];
async function call(path,body,headers={}){
  const response=await fetch(base+'/api/v1'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Origin:base,...headers},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  const json=await response.json();if(!response.ok)throw new Error(`${path}: ${response.status}`);
  return {json,cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
async function refresh(client){
  if(client.refreshing)return client.refreshing;
  client.refreshing=(async()=>{
    const result=await call('/auth/refresh',{}, {Cookie:client.cookie,'X-HealthGuard-Client':'web'});
    client.token=result.json.token;client.cookie=result.cookie;
    client.sockets.forEach(socket=>{socket.auth={token:client.token};if(!socket.connected)socket.connect();});
  })();
  try{await client.refreshing;}finally{client.refreshing=null;}
}
function percentile(values,p){const sorted=values.toSorted((a,b)=>a-b);return sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))]||0;}
async function main(){
  for(let index=0;index<10;index++){
    const result=await call('/auth/register',{email:`soak-${Date.now()}-${index}@example.test`,password:'synthetic-soak-password'});
    const client={id:result.json.user.id,token:result.json.token,cookie:result.cookie,sockets:[],session:randomUUID(),sequence:0};
    const device=await call('/devices',{name:'Synthetic soak band'},{Authorization:`Bearer ${client.token}`});
    client.key=device.json.credential;client.device=device.json.id;clients.push(client);
  }
  const pool=new Pool({connectionString:nativeDatabase||`postgresql://postgres:${env.POSTGRES_PASSWORD}@127.0.0.1:55433/healthguard`});
  const user=clients[0];
  const historySession=randomUUID(),activitySession=randomUUID();
  for(let first=1;first<=518400;first+=10000)await pool.query(`INSERT INTO vitals(user_id,device_id,session_id,sequence,observed_at,source,heart_rate,spo2,temperature,ecg_status)
    SELECT $1,$2,$3,n,NOW()-INTERVAL '30 days'+n*INTERVAL '5 seconds','Synthetic load',72,98,36.7,'Normal'
    FROM generate_series($4::int,$5::int) n`,[user.id,user.device,historySession,first,Math.min(518400,first+9999)]);
  console.log('Seeded 518400 synthetic vital readings');
  for(let first=1;first<=518400;first+=10000)await pool.query(`INSERT INTO activity(user_id,device_id,session_id,sequence,observed_at,source,steps,distance_km,calories,active_minutes)
    SELECT $1,$2,$3,n,NOW()-INTERVAL '30 days'+n*INTERVAL '5 seconds','Synthetic load',n,n*.000762,(n*.04)::int,(n/12)::int
    FROM generate_series($4::int,$5::int) n`,[user.id,user.device,activitySession,first,Math.min(518400,first+9999)]);
  console.log('Seeded 518400 synthetic activity readings');
  await pool.query('ANALYZE vitals; ANALYZE activity');await pool.end();
  for(const client of clients)for(let index=0;index<2;index++){
    const socket=io(base,{auth:{token:client.token},reconnection:true});sockets.push(socket);client.sockets.push(socket);
    socket.on('health_update',event=>{if(event.type==='vitals'){
      if(event.data.user_id!==client.id)metrics.owner_leaks++;
      metrics.delivery_ms.push(Date.now()-Date.parse(event.data.observed_at));
    }});
    socket.on('new_alert',event=>{if(event.user_id!==client.id)metrics.owner_leaks++;});
    socket.on('disconnect',reason=>{if(reason==='io server disconnect')void refresh(client).catch(error=>metrics.errors.push(error.message));});
    await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});
  }
  const start=Date.now();let tick=0;
  while(Date.now()-start<duration*1000){
    const cycle=Date.now();
    await Promise.all(clients.map(async client=>{
      const envelope={session_id:client.session,sequence:++client.sequence,observed_at:new Date().toISOString(),source:'Synthetic soak'};
      try{
        await Promise.all([
          call('/ingest/vitals',{...envelope,heart_rate:72,spo2:98,temperature:36.7,ecg_status:'Normal'},{'X-Device-Key':client.key}),
          call('/ingest/activity',{...envelope,steps:client.sequence*25,distance_km:client.sequence*.02,calories:client.sequence,active_minutes:Math.floor(client.sequence/12)},{'X-Device-Key':client.key}),
          call('/device/status',{device_name:'Synthetic soak band',connected:true,battery:85,source:'Synthetic soak'},{'X-Device-Key':client.key}),
        ]);metrics.ingest_success+=3;
      }catch(error){metrics.errors.push(error.message);}
    }));
    await Promise.all(clients.flatMap(client=>[0,1].map(async()=>{
        try{const then=performance.now();const headers={Authorization:`Bearer ${client.token}`};
          const [{json},...feeds]=await Promise.all(['/health/summary','/vitals/trends','/activity/summary','/alerts'].map(endpoint=>call(endpoint,undefined,headers)));
          metrics.summary_ms.push(performance.now()-then);if(json.vitals?.user_id!==client.id)metrics.owner_leaks++;
          if(feeds.some(feed=>feed.json.some(row=>row.user_id!==client.id)))metrics.owner_leaks++;}
        catch(error){metrics.errors.push(error.message);}
      })));
    if(tick%12===0)await Promise.all(clients.map(async client=>{
      try{const replay={session_id:client.session,sequence:client.sequence,observed_at:new Date().toISOString(),source:'Synthetic soak',heart_rate:72,spo2:98,temperature:36.7,ecg_status:'Normal'};
        const {json}=await call('/ingest/vitals',replay,{'X-Device-Key':client.key});if(json.duplicate)metrics.duplicates++;else metrics.errors.push('Replay was not deduplicated');}
      catch(error){metrics.errors.push(error.message);}
    }));
    if(tick%6===0){
      console.log(JSON.stringify({elapsed_seconds:Math.round((Date.now()-start)/1000),ingest_success:metrics.ingest_success,errors:metrics.errors.length,owner_leaks:metrics.owner_leaks}));
      fs.writeFileSync('artifacts/stack-soak-progress.json',JSON.stringify({elapsed_seconds:Math.round((Date.now()-start)/1000),ingest_success:metrics.ingest_success,errors:metrics.errors.length,owner_leaks:metrics.owner_leaks}));
    }
    tick++;await new Promise(resolve=>setTimeout(resolve,Math.max(0,5000-(Date.now()-cycle))));
  }
  sockets.forEach(socket=>socket.disconnect());
  const checkPool=new Pool({connectionString:nativeDatabase||`postgresql://postgres:${env.POSTGRES_PASSWORD}@127.0.0.1:55433/healthguard`});
  try{for(const client of clients)for(const table of ['vitals','activity']){
    const stored=Number((await checkPool.query(`SELECT COUNT(*) FROM ${table} WHERE device_id=$1 AND session_id=$2`,[client.device,client.session])).rows[0].count);
    if(stored!==client.sequence)metrics.errors.push(`Acknowledged ${table} count mismatch`);
  }}finally{await checkPool.end();}
  const result={...metrics,summary_ms:undefined,delivery_ms:undefined,summary_samples:metrics.summary_ms.length,delivery_samples:metrics.delivery_ms.length,
    summary_p95_ms:percentile(metrics.summary_ms,.95),delivery_p95_ms:percentile(metrics.delivery_ms,.95)};
  result.budgets_met=result.summary_p95_ms<=500&&result.delivery_p95_ms<=1000;
  fs.writeFileSync('artifacts/stack-soak.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  if(result.errors.length||result.owner_leaks||!result.budgets_met)process.exitCode=1;
}
main().catch(error=>{sockets.forEach(socket=>socket.disconnect());console.error(error.message);process.exitCode=1;});
