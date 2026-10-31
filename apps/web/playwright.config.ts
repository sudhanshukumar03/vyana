import { defineConfig } from '@playwright/test';
export default defineConfig({
  outputDir:process.env.PLAYWRIGHT_OUTPUT_DIR||'test-results',
  testDir:'./e2e',workers:1,fullyParallel:false,timeout:45000,
  use:{baseURL:'http://127.0.0.1:4173',trace:'retain-on-failure',screenshot:'only-on-failure'},
  webServer:[
    {command:'node ../../scripts/e2e-server.cjs',url:'http://127.0.0.1:18000/health/ready',reuseExistingServer:false,timeout:30000},
    {command:'pnpm dev --host 127.0.0.1 --port 4173 --strictPort',url:'http://127.0.0.1:4173',env:{API_PROXY_TARGET:'http://127.0.0.1:18000'},reuseExistingServer:false,timeout:30000},
  ],
});
