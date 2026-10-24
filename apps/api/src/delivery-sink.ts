/** Local operator-only recovery sink. Never expose this command through an HTTP endpoint. */
import dotenv from 'dotenv';
import { createDecipheriv, createHash } from 'crypto';
import { createPool } from './db';
dotenv.config();
async function main() {
  const email=process.argv[2];
  if(!email||!process.env.MIGRATION_DATABASE_URL||!process.env.AI_INTERNAL_SECRET)throw new Error('Usage: delivery-sink email. Requires operator database access and AI_INTERNAL_SECRET.');
  const pool=createPool(process.env.MIGRATION_DATABASE_URL);
  try {
    const {rows}=await pool.query(`SELECT o.id,o.purpose,o.encrypted_payload FROM delivery_outbox o JOIN users u ON u.id=o.user_id
      WHERE u.email=$1 AND o.created_at>NOW()-INTERVAL '30 minutes' ORDER BY o.id DESC LIMIT 1`,[email.toLowerCase()]);
    if(!rows[0])throw new Error('No recent recovery/verification request');
    const bytes=Buffer.from(rows[0].encrypted_payload,'base64');
    const decipher=createDecipheriv('aes-256-gcm',createHash('sha256').update(process.env.AI_INTERNAL_SECRET).digest(),bytes.subarray(0,12));
    decipher.setAuthTag(bytes.subarray(12,28));
    const payload=JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString());
    console.log(JSON.stringify({purpose:rows[0].purpose,token:payload.token}));
  }finally{await pool.end();}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Sink unavailable');process.exit(1);});
