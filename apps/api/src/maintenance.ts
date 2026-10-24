/** Explicit retention job. Back up and review policy before running against existing data. */
import dotenv from 'dotenv';
import { createPool, transaction } from './db';
dotenv.config();
async function main() {
  const days=Number(process.env.RETENTION_DAYS);
  if(!process.env.DATABASE_URL||!Number.isInteger(days)||days<7||days>3650) throw new Error('Set DATABASE_URL and RETENTION_DAYS (7–3650). Back up before enabling cleanup.');
  const pool=createPool(process.env.DATABASE_URL);
  try {
    const result=await transaction(pool,async(client)=>{
      // Preserve one baseline per session so the next retained cumulative activity delta stays correct.
      const activity=await client.query(`DELETE FROM activity a WHERE observed_at<NOW()-make_interval(days=>$1)
        AND id NOT IN (SELECT DISTINCT ON (device_id,session_id) id FROM activity
          WHERE observed_at<NOW()-make_interval(days=>$1) ORDER BY device_id,session_id,sequence DESC)`,[days]);
      const vitals=await client.query('DELETE FROM vitals WHERE observed_at<NOW()-make_interval(days=>$1)',[days]);
      await client.query("DELETE FROM sessions WHERE expires_at<NOW()-INTERVAL '7 days'");
      await client.query("DELETE FROM account_tokens WHERE expires_at<NOW()-INTERVAL '1 day'");
      await client.query("DELETE FROM delivery_outbox WHERE created_at<NOW()-INTERVAL '1 day'");
      return {activity:activity.rowCount,vitals:vitals.rowCount};
    });console.log(JSON.stringify({event:'retention_complete',days,...result}));
  }finally{await pool.end();}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Retention failed');process.exit(1);});
