const { createApplication } = require('../apps/api/dist/app');
const { createPool, migrate } = require('../apps/api/dist/db');
const { loadConfig } = require('../apps/api/dist/config');
async function main() {
  const databaseUrl=process.env.TEST_DATABASE_URL;
  if(!databaseUrl || !new URL(databaseUrl).pathname.endsWith('_test')) throw new Error('Browser checks require a disposable *_test database');
  const pool=createPool(databaseUrl);
  await migrate(pool);
  const config=loadConfig({DATABASE_URL:databaseUrl,JWT_SECRET:'browser-test-secret-at-least-32-characters',AI_INTERNAL_SECRET:'browser-internal-secret-at-least-32-characters',
    WEB_ORIGIN:'http://127.0.0.1:4173',AI_URL:'http://127.0.0.1:9',
    ...(process.env.E2E_SOS_FIXTURE==='1'?{STALE_SECONDS:'60',SOS_DELIVERY_ENABLED:'true',
      RESEND_API_KEY:'browser-fixture-not-a-real-key',SOS_FROM_EMAIL:'browser@example.test'}:{})});
  const {server,io}=createApplication(pool,config);
  server.listen(18000,'127.0.0.1');
  const stop=()=>{io.close();server.close();void pool.end();};
  process.on('SIGTERM',stop);process.on('SIGINT',stop);
}
main().catch(error=>{console.error(error.message);process.exit(1);});
