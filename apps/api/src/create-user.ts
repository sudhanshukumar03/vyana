/** Closed-deployment operator provisioning; the password is read from the environment, not argv. */
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { credentialsSchema } from './schemas';
import { createPool } from './db';
dotenv.config();
async function main() {
  const input=credentialsSchema.parse({email:process.argv[2],password:process.env.PROVISION_PASSWORD});
  const url=process.env.MIGRATION_DATABASE_URL;
  if(!url)throw new Error('MIGRATION_DATABASE_URL is required for operator provisioning');
  const pool=createPool(url);
  try {
    const hash=await bcrypt.hash(input.password,12);
    const result=await pool.query('INSERT INTO users(email,password_hash,email_verified) VALUES($1,$2,TRUE) ON CONFLICT(email) DO NOTHING',[input.email,hash]);
    if(!result.rowCount)throw new Error('Account already exists; use the recovery workflow to change its password');
    console.log('Account provisioned. The operator must deliver credentials through an approved channel.');
  }finally{await pool.end();}
}
main().catch(()=>{console.error('Provisioning failed. Supply a valid email, PROVISION_PASSWORD and MIGRATION_DATABASE_URL.');process.exit(1);});
