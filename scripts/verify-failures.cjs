/** Stop/start only the workspace's disposable native DB and this script's AI child. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawn,execFileSync}=require('node:child_process');
const {randomUUID}=require('node:crypto');
const {io}=require('../apps/web/node_modules/socket.io-client');
if(process.env.VERIFY_DISPOSABLE!=='1'||process.env.VERIFY_DATABASE_URL!=='postgresql://postgres@127.0.0.1:55434/healthguard_soak_test')throw new Error('Requires the isolated synthetic native stack');
const directory=path.resolve('.audit-runtime/native-postgres');
if(!directory.startsWith(path.resolve('.audit-runtime')+path.sep))throw new Error('Unexpected database directory');
const base='http://127.0.0.1:18080',sockets=[];
let ai,dbStopped=false;
async function request(route,{body,headers={},status=200}={}){
  const response=await fetch((route.startsWith('/health/')?'http://127.0.0.1:18081':base)+route,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
  assert.equal(response.status,status,route);return {data:await response.json(),headers:response.headers};
}
function databaseStart(){execFileSync('pg_ctl',['-D',directory,'-l',path.resolve('.audit-runtime/native-postgres.log'),'-o','-h 127.0.0.1 -p 55434 -c shared_buffers=32MB -c max_connections=40','start'],{timeout:30000,windowsHide:true,stdio:'ignore'});dbStopped=false;}
async function startAI(){
  ai=spawn(process.env.VERIFY_PYTHON||path.resolve('.audit-runtime/clean-python/Scripts/python.exe'),['-m','uvicorn','main:app','--app-dir','ai','--host','127.0.0.1','--port','18082'],
    {windowsHide:true,stdio:'ignore',env:{...process.env,GEMINI_API_KEY:'',AI_INTERNAL_SECRET:'synthetic-verification-internal-key-at-least-32-characters'}});
  const until=Date.now()+10000;
  while(Date.now()<until){try{if((await fetch('http://127.0.0.1:18082/health/live',{signal:AbortSignal.timeout(500)})).ok)return;}catch{/* Startup is not yet ready. */}await new Promise(resolve=>setTimeout(resolve,100));}
  throw new Error('Synthetic AI did not start');
}
async function stopAI(){if(ai&&ai.exitCode===null){const child=ai;await new Promise(resolve=>{child.once('close',resolve);child.kill();});}ai=null;}
async function main(){
  const signup=await request('/api/v1/auth/register',{body:{email:`fault-${Date.now()}@example.test`,password:'synthetic-fault-test-password'},status:201});
  const headers={Authorization:`Bearer ${signup.data.token}`};
  const device=(await request('/api/v1/devices',{body:{name:'Fault fixture'},headers,status:201})).data;
  const envelope={session_id:randomUUID(),sequence:1,observed_at:new Date().toISOString(),source:'Fault fixture',heart_rate:72,spo2:98,temperature:36.7,ecg_status:'Normal'};
  await request('/api/v1/ingest/vitals',{body:envelope,headers:{'X-Device-Key':device.credential}});
  await startAI();
  assert.equal((await request('/api/v1/health/insights',{headers})).data.offline,true);
  await stopAI();
  assert.equal((await request('/api/v1/health/insights',{headers})).data.offline,true);
  await request('/api/v1/health/summary',{headers});
  await startAI();await request('/api/v1/health/insights',{headers});
  execFileSync('pg_ctl',['-D',directory,'stop','-m','fast'],{timeout:30000,windowsHide:true,stdio:'pipe'});dbStopped=true;
  await request('/health/live');await request('/health/ready',{status:503});
  const unavailable=await request('/api/v1/profile',{headers,status:503});assert.match(unavailable.data.error,/temporarily unavailable/);
  const rejected=io('http://127.0.0.1:18081',{auth:{token:signup.data.token},forceNew:true,reconnection:false,timeout:5000});sockets.push(rejected);
  const error=await new Promise(resolve=>rejected.once('connect_error',resolve));assert.equal(error.data.status,503);rejected.disconnect();
  const logout=await request('/api/v1/auth/logout',{body:{},headers:{...headers,'X-HealthGuard-Client':'web'},status:503});
  assert.match(logout.headers.get('set-cookie'),/hg_refresh=;/);
  databaseStart();await request('/health/ready');await request('/api/v1/profile',{headers});
  const socket=io('http://127.0.0.1:18081',{auth:{token:signup.data.token},forceNew:true,reconnection:false,timeout:5000});sockets.push(socket);
  await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});
  const delivered=new Promise(resolve=>socket.once('health_update',resolve));
  await request('/api/v1/ingest/vitals',{body:{...envelope,sequence:2,observed_at:new Date().toISOString()},headers:{'X-Device-Key':device.credential}});
  assert.equal((await delivered).data.user_id,signup.data.user.id);
  const result={passed:true,checks:['AI stop/start with explicit fallback','core summary independent of AI','DB outage JSON 503 and liveness','retryable socket authentication outage','logout cookie cleared despite DB outage','DB pool recovers without API restart','owner-scoped socket delivery resumes']};
  fs.writeFileSync('artifacts/failure-verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(async()=>{sockets.forEach(socket=>socket.disconnect());await stopAI();if(dbStopped)databaseStart();});
