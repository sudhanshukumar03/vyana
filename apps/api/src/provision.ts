/** Local administrative provisioning. Credentials are deliberately shown once to the operator. */
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { createPool } from './db';
import { digest, randomToken } from './auth';
dotenv.config();
async function main() {
  const email=process.argv[2],name=process.argv[3]||'Demo wearable';
  if(!email||!process.env.DATABASE_URL)throw new Error('Usage: pnpm provision-device user@example.test "Device name"');
  const pool=createPool(process.env.DATABASE_URL);
  try{
    const {rows}=await pool.query('SELECT id FROM users WHERE email=$1 AND NOT disabled',[email.toLowerCase()]);
    if(!rows[0])throw new Error('Account not found. Register a local account first.');
    const key=randomToken();
    await pool.query(`INSERT INTO devices(id,user_id,device_name,credential_hash,active) VALUES($1,$2,$3,$4,
      NOT EXISTS(SELECT 1 FROM devices WHERE user_id=$2 AND active AND revoked_at IS NULL))`,[randomUUID(),rows[0].id,name,digest(key)]);
    console.log(`Device credential (save securely; shown once): ${key}`);
  }finally{await pool.end();}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Provisioning failed');process.exit(1);});
