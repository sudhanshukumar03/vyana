import dotenv from 'dotenv';
import { loadConfig } from './config';
import { createPool, migrate } from './db';
import { createApplication } from './app';

dotenv.config();
async function main() {
  const config=loadConfig(),pool=createPool(config.databaseUrl);
  const migrationPool=process.env.MIGRATION_DATABASE_URL?createPool(process.env.MIGRATION_DATABASE_URL):pool;
  await migrate(migrationPool);
  if(migrationPool!==pool) await migrationPool.end();
  const {server,io}=createApplication(pool,config);
  server.listen(config.port,process.env.HOST||'127.0.0.1',()=>console.log(`HealthGuard API listening on port ${config.port}`));
  const shutdown=()=>{
    io.close();server.close(()=>{void pool.end().then(()=>process.exit(0));});
    setTimeout(()=>process.exit(1),10000).unref();
  };
  process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown);
}
main().catch(()=>{console.error('API startup failed. Check required configuration, database connectivity and migrations.');process.exit(1);});
