/** Isolated native verification, never pointed at a user's application database. */
const {createApplication}=require('../apps/api/dist/app');
const {createPool,migrate}=require('../apps/api/dist/db');
const {loadConfig}=require('../apps/api/dist/config');
async function main(){
  const database=process.env.VERIFY_DATABASE_URL;
  if(process.env.VERIFY_DISPOSABLE!=='1'||database!=='postgresql://postgres@127.0.0.1:55434/healthguard_soak_test')throw new Error('Requires the dedicated disposable native cluster');
  const operator=createPool(database);await migrate(operator);await operator.end();
  const pool=createPool(database.replace('postgres@','healthguard_app@'));
  const config=loadConfig({DATABASE_URL:database,JWT_SECRET:'synthetic-verification-signing-key-at-least-32-characters',
    AI_INTERNAL_SECRET:'synthetic-verification-internal-key-at-least-32-characters',WEB_ORIGIN:'http://127.0.0.1:18080',
    AI_URL:'http://127.0.0.1:18082',PORT:'18081'});
  const runtime=createApplication(pool,config);
  runtime.server.listen(18081,'127.0.0.1',()=>console.log('Isolated verification API ready on loopback 18081'));
  const stop=()=>{runtime.io.close();runtime.server.close();void pool.end();};
  process.on('SIGTERM',stop);process.on('SIGINT',stop);
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
