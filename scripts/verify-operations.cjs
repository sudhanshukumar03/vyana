/** Backup, legacy mapping and retention rehearsal using synthetic data only. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync,spawnSync}=require('node:child_process');
const {createPool,migrate}=require('../apps/api/dist/db');
if(process.env.VERIFY_DISPOSABLE!=='1'||process.env.VERIFY_DATABASE_URL!=='postgresql://postgres@127.0.0.1:55434/healthguard_soak_test')throw new Error('Requires the dedicated disposable native cluster');
const prefix='postgresql://postgres@127.0.0.1:55434/';
const name=`healthguard_ops_${Date.now()}_test`,restore=`${name.slice(0,-5)}_restore_test`;
const ownerEmail='legacy-owner@example.test';
const pgArgs=['-h','127.0.0.1','-p','55434','-U','postgres'];
function cli(command,args){return execFileSync(command,args,{encoding:'utf8',timeout:30000,windowsHide:true});}
const tables=['users','profile','emergency_contact','devices','vitals','activity','alerts'];
async function counts(pool){return Object.fromEntries(await Promise.all(tables.map(async table=>[table,Number((await pool.query(`SELECT COUNT(*) FROM ${table}`)).rows[0].count)])));}
async function main(){
  cli('createdb',[...pgArgs,name]);
  const pool=createPool(prefix+name);
  let restored;
  try {
    await pool.query(`
      CREATE TABLE users(id SERIAL PRIMARY KEY,email VARCHAR(255) UNIQUE NOT NULL,password_hash VARCHAR(255) NOT NULL,created_at TIMESTAMPTZ DEFAULT NOW());
      INSERT INTO users(email,password_hash) VALUES('legacy-owner@example.test','original-synthetic-hash'),('other-owner@example.test','other-synthetic-hash');
      CREATE TABLE vitals(id SERIAL PRIMARY KEY,timestamp TIMESTAMP,heart_rate INT,spo2 FLOAT,temperature FLOAT,ecg_status VARCHAR(50),source VARCHAR(50));
      INSERT INTO vitals(timestamp,heart_rate,spo2,temperature,ecg_status,source) VALUES('2020-01-01 00:00:00',72,98,36.7,'Normal','Legacy fixture');
      CREATE TABLE activity(id SERIAL PRIMARY KEY,timestamp TIMESTAMP,steps INT,distance_km FLOAT,calories INT,active_minutes INT,source VARCHAR(50));
      INSERT INTO activity(timestamp,steps,distance_km,calories,active_minutes,source) VALUES('2020-01-01 00:00:00',100,0.1,2,1,'Legacy fixture');
      CREATE TABLE profile(id SERIAL PRIMARY KEY,full_name VARCHAR(100),dob DATE,sex VARCHAR(16),height_cm REAL,weight_kg REAL,conditions TEXT,medications TEXT,allergies TEXT,activity_level VARCHAR(20),goal VARCHAR(100),onboarded BOOLEAN);
      INSERT INTO profile(full_name,dob,height_cm,weight_kg,medications,allergies,onboarded) VALUES('Synthetic legacy user','1990-01-01',175,72,'Preserve medication','Preserve allergy',TRUE);
      CREATE TABLE emergency_contact(id SERIAL PRIMARY KEY,name VARCHAR(100),phone VARCHAR(32),email VARCHAR(120),relation VARCHAR(50),is_doctor BOOLEAN);
      INSERT INTO emergency_contact(name,phone,is_doctor) VALUES('Synthetic contact','12345678',TRUE);
      CREATE TABLE alerts(id SERIAL PRIMARY KEY,timestamp TIMESTAMP,severity VARCHAR(20),title VARCHAR(100),detail TEXT,status VARCHAR(20),metric VARCHAR(50));
      INSERT INTO alerts(timestamp,severity,title,detail,status,metric) VALUES('2020-01-01','warning','Synthetic old alert','Preserved','active','heart_rate');
    `);
    const before=path.resolve('artifacts/legacy-before.dump');
    cli('pg_dump',[...pgArgs,'-d',name,'-Fc','-f',before]);
    await migrate(pool);await migrate(pool);
    assert.equal((await pool.query('SELECT COUNT(*) FROM legacy.vitals')).rows[0].count,'1');
    assert.equal((await pool.query('SELECT COUNT(*) FROM public.vitals')).rows[0].count,'0');
    assert.equal((await pool.query("SELECT password_hash FROM users WHERE email=$1",[ownerEmail])).rows[0].password_hash,'original-synthetic-hash');
    assert.equal((await pool.query("SELECT has_schema_privilege('healthguard_app','legacy','USAGE') AS allowed")).rows[0].allowed,false);
    const importArgs=['apps/api/dist/legacy-import.js',ownerEmail,'Asia/Kolkata','--confirm-backup'];
    const childEnv={...process.env,MIGRATION_DATABASE_URL:prefix+name};
    execFileSync(process.execPath,importArgs,{env:childEnv,encoding:'utf8',timeout:30000,windowsHide:true});
    const row=(await pool.query('SELECT v.user_id,v.observed_at,d.active FROM vitals v JOIN devices d ON d.id=v.device_id')).rows[0];
    assert.equal(row.user_id,1);assert.equal(row.observed_at.toISOString(),'2019-12-31T18:30:00.000Z');assert.equal(row.active,false);
    assert.equal((await pool.query('SELECT COUNT(*) FROM vitals WHERE user_id=2')).rows[0].count,'0');
    assert.equal((await pool.query('SELECT medications FROM profile WHERE user_id=1')).rows[0].medications,'Preserve medication');
    assert.equal((await pool.query('SELECT status FROM alerts')).rows[0].status,'resolved');
    const repeat=spawnSync(process.execPath,importArgs,{env:childEnv,encoding:'utf8',timeout:30000,windowsHide:true});
    assert.equal(repeat.status,1);assert.match(repeat.stderr,/already mapped/);
    const mapped=path.resolve('artifacts/legacy-mapped.dump');
    const expected=await counts(pool);
    cli('pg_dump',[...pgArgs,'-d',name,'-Fc','-f',mapped]);
    cli('createdb',[...pgArgs,restore]);
    cli('pg_restore',[...pgArgs,'-d',restore,'--exit-on-error',mapped]);
    restored=createPool(prefix+restore);assert.deepEqual(await counts(restored),expected);
    assert.equal((await restored.query('SELECT user_id FROM vitals')).rows[0].user_id,1);
    const restricted=createPool(`postgresql://healthguard_app@127.0.0.1:55434/${restore}`);
    try {
      assert.equal((await restricted.query('SELECT COUNT(*) FROM vitals')).rows[0].count,'1');
      await assert.rejects(restricted.query('SELECT * FROM legacy.vitals'),{code:'42501'});
      await assert.rejects(restricted.query('CREATE TABLE unauthorized(id INT)'),{code:'42501'});
    } finally {await restricted.end();}
    const activity=(await pool.query('SELECT * FROM activity')).rows[0];
    await pool.query(`INSERT INTO activity(user_id,device_id,session_id,sequence,observed_at,source,steps,distance_km,calories,active_minutes)
      VALUES(1,$1,$2,2,NOW()-INTERVAL '10 days','Retention fixture',200,.2,4,2),
      (1,$1,$2,3,NOW(),'Retention fixture',250,.25,5,3)`,[activity.device_id,activity.session_id]);
    execFileSync(process.execPath,['apps/api/dist/maintenance.js'],{env:{...process.env,DATABASE_URL:prefix+name,RETENTION_DAYS:'7'},encoding:'utf8',timeout:30000,windowsHide:true});
    assert.equal((await pool.query('SELECT COUNT(*) FROM vitals')).rows[0].count,'0');
    assert.deepEqual((await pool.query('SELECT sequence FROM activity ORDER BY sequence')).rows.map(row=>row.sequence),[2,3]);
    assert.equal((await pool.query('SELECT COUNT(*) FROM legacy.vitals')).rows[0].count,'1');
    const failedStartup=spawnSync(process.execPath,['apps/api/dist/index.js'],{env:{...process.env,DATABASE_URL:prefix+name,
      MIGRATION_DATABASE_URL:'postgresql://postgres@127.0.0.1:1/unavailable_test',JWT_SECRET:'startup-synthetic-signing-secret-32-characters',
      AI_INTERNAL_SECRET:'startup-synthetic-internal-secret-32-characters',PORT:'18089',HOST:'127.0.0.1'},encoding:'utf8',timeout:15000,windowsHide:true});
    assert.equal(failedStartup.status,1);assert.match(failedStartup.stderr,/API startup failed/);
    const result={passed:true,postgresql:18,database:name,restored_database:restore,counts:expected,
      checks:['pre-upgrade backup','legacy quarantine','idempotent migrations','password hash preserved','explicit owner/timezone import','repeat mapping refused','custom-format restore/counts/ownership','restricted runtime role','retention preserves activity baseline and originals','failed migration prevents startup']};
    fs.writeFileSync('artifacts/operations-verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  } finally {await pool.end();if(restored)await restored.end();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
