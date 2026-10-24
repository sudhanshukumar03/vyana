/** Explicit administrator migration; never run automatically during signup/startup. */
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { createPool, transaction } from './db';
import { digest, randomToken } from './auth';
dotenv.config();
async function main() {
  const [email,timezone,confirmation]=process.argv.slice(2);
  if(!email||!timezone||confirmation!=='--confirm-backup') throw new Error('Usage: legacy-import email timezone --confirm-backup. Verify a database backup before importing.');
  new Intl.DateTimeFormat('en',{timeZone:timezone});
  const url=process.env.MIGRATION_DATABASE_URL;
  if(!url)throw new Error('MIGRATION_DATABASE_URL with legacy-schema access is required');
  const pool=createPool(url);
  try {
    await transaction(pool,async(client)=>{
      await client.query('SELECT pg_advisory_xact_lock(73492017)');
      const user=(await client.query('SELECT id FROM users WHERE email=$1',[email.toLowerCase()])).rows[0];
      if(!user)throw new Error('Target account does not exist');
      await client.query('CREATE TABLE IF NOT EXISTS legacy.imports(user_id INT PRIMARY KEY, imported_at TIMESTAMPTZ DEFAULT NOW())');
      const prior=await client.query('SELECT user_id FROM legacy.imports');
      if(prior.rowCount)throw new Error('Legacy data was already mapped. Review the existing import before making any reassignment.');
      const device=randomUUID(),session=randomUUID();
      await client.query("INSERT INTO devices(id,user_id,device_name,credential_hash,active,source) VALUES($1,$2,'Legacy archived source',$3,FALSE,'Legacy import')",[device,user.id,digest(randomToken())]);
      for(const table of ['vitals','activity'] as const) {
        const exists=(await client.query('SELECT to_regclass($1) AS name',[`legacy.${table}`])).rows[0].name;
        if(!exists)continue;
        const fields=table==='vitals'?['heart_rate','spo2','temperature','ecg_status']:['steps','distance_km','calories','active_minutes'];
        // This transaction fails rather than silently coercing missing/out-of-range legacy data.
        await client.query(`INSERT INTO ${table}(user_id,device_id,session_id,sequence,observed_at,source,${fields.join(',')})
          SELECT $1,$2,$3,id,timestamp AT TIME ZONE $4,LEFT(COALESCE(source,'Legacy'),50),${fields.join(',')} FROM legacy.${table}`,[user.id,device,session,timezone]);
      }
      const profileExists=(await client.query("SELECT to_regclass('legacy.profile') AS name")).rows[0].name;
      if(profileExists)await client.query(`INSERT INTO profile(user_id,full_name,dob,sex,height_cm,weight_kg,conditions,medications,allergies,activity_level,goal,onboarded,timezone)
        SELECT $1,full_name,dob,sex,height_cm,weight_kg,conditions,medications,allergies,activity_level,goal,onboarded,$2 FROM legacy.profile ORDER BY id LIMIT 1
        ON CONFLICT(user_id) DO NOTHING`,[user.id,timezone]);
      const contactsExist=(await client.query("SELECT to_regclass('legacy.emergency_contact') AS name")).rows[0].name;
      if(contactsExist)await client.query(`INSERT INTO emergency_contact(user_id,name,phone,email,relation,is_doctor)
        SELECT $1,name,phone,email,relation,is_doctor FROM legacy.emergency_contact`,[user.id]);
      const alertsExist=(await client.query("SELECT to_regclass('legacy.alerts') AS name")).rows[0].name;
      if(alertsExist)await client.query(`INSERT INTO alerts(user_id,timestamp,severity,title,detail,status,metric,resolved_at)
        SELECT $1,timestamp AT TIME ZONE $2,severity,title,detail,'resolved',metric,NOW() FROM legacy.alerts`,[user.id,timezone]);
      await client.query('INSERT INTO legacy.imports(user_id) VALUES($1)',[user.id]);
    });console.log('Legacy records imported to the explicitly selected owner. Original records remain in the restricted legacy schema.');
  }finally{await pool.end();}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Import failed');process.exit(1);});
