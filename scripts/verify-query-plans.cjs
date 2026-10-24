const fs=require('node:fs');
const {createPool}=require('../apps/api/dist/db');
const {summary}=require('../apps/api/dist/telemetry');
const url=process.env.VERIFY_DATABASE_URL;
if(process.env.VERIFY_DISPOSABLE!=='1'||url!=='postgresql://postgres@127.0.0.1:55434/healthguard_soak_test')throw new Error('Requires the dedicated synthetic native database');
async function main(){
  const pool=createPool(url),plans=[];
  try {
    const owner=(await pool.query("SELECT user_id FROM vitals WHERE source='Synthetic load' ORDER BY id DESC LIMIT 1")).rows[0];
    if(!owner)throw new Error('Run the synthetic seed first');
    const measured={query:async(sql,values)=>{
      const result=await pool.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`,values);
      plans.push({sql,plan:result.rows[0]['QUERY PLAN'][0]});
      return pool.query(sql,values);
    }};
    await summary(measured,owner.user_id,30);
    const result={owner_id:owner.user_id,query_count:plans.length,plans};
    fs.writeFileSync('artifacts/query-plans.json',JSON.stringify(result,null,2));
    console.log(JSON.stringify({queries:plans.length,execution_ms:plans.map(item=>item.plan['Execution Time'])}));
  }finally{await pool.end();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
