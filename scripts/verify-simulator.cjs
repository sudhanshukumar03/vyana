const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {createPool}=require('../apps/api/dist/db');
if(process.env.VERIFY_DISPOSABLE!=='1'||process.env.VERIFY_DATABASE_URL!=='postgresql://postgres@127.0.0.1:55434/healthguard_soak_test')throw new Error('Requires the isolated synthetic verification stack');
const base='http://127.0.0.1:18080/api/v1';
async function call(route,data,headers={}){
  const response=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(data),signal:AbortSignal.timeout(10000)});
  assert.equal(response.ok,true,`${route}: ${response.status}`);return response.json();
}
async function main(){
  const user=await call('/auth/register',{email:`simulator-smoke-${Date.now()}@example.test`,password:'synthetic-simulator-test-password'});
  const device=await call('/devices',{name:'Simulator smoke fixture'},{Authorization:`Bearer ${user.token}`});
  const executable=process.env.VERIFY_PYTHON||path.resolve('.audit-runtime/clean-python/Scripts/python.exe');
  const child=spawn(executable,[path.resolve('simulator/main.py')],{cwd:path.resolve('simulator'),windowsHide:true,
    env:{...process.env,DEVICE_KEY:device.credential,API_BASE_URL:base,SIMULATION_INTERVAL:'1',SIMULATION_SCENARIO:'normal'},stdio:['ignore','ignore','pipe']});
  let stderr='';child.stderr.on('data',data=>{stderr+=data.toString();});
  await new Promise((resolve,reject)=>{
    child.once('error',reject);
    const timer=setTimeout(()=>{child.kill();resolve();},8000);
    child.once('exit',code=>{clearTimeout(timer);if(code!==null&&code!==0)reject(new Error('Simulator exited before smoke completion'));else resolve();});
  });
  const pool=createPool(process.env.VERIFY_DATABASE_URL);
  try {
    assert.equal(stderr,'');
    const vitals=(await pool.query('SELECT source,session_id,sequence FROM vitals WHERE device_id=$1 ORDER BY sequence',[device.id])).rows;
    const activity=(await pool.query('SELECT steps FROM activity WHERE device_id=$1 ORDER BY sequence',[device.id])).rows;
    assert.ok(vitals.length>=3);assert.equal(activity.length,vitals.length);
    assert.ok(vitals.every(row=>row.source==='Simulator'));
    assert.equal(new Set(vitals.map(row=>row.session_id)).size,1);
    assert.ok(activity.every((row,index)=>index===0||row.steps>activity[index-1].steps));
    await call('/device/status',{device_name:'Simulator smoke fixture',connected:false,battery:null,source:'Simulator'},{'X-Device-Key':device.credential});
    const result={passed:true,vitals:vitals.length,activity:activity.length,source:'Simulator',session_consistent:true,counters_increase:true};
    fs.writeFileSync('artifacts/simulator-smoke.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  }finally{await pool.end();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
