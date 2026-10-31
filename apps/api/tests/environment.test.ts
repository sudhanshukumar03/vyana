import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { Pool } from 'pg';
import { loadEnvironment } from '../src/environment';
import { loadConfig } from '../src/config';
import { createApplication } from '../src/app';

let directory: string, filename: string;
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vyana-dev-env-'));
  filename = path.join(directory, '.env');
  fs.writeFileSync(filename, 'WEB_ORIGIN=http://localhost:5173\nPORT=8000\n');
});
afterEach(() => { fs.unlinkSync(filename); fs.rmdirSync(directory); });

test('host dev loads its service origin over an inherited Compose origin', async () => {
  const env = { TS_NODE_DEV: 'true', WEB_ORIGIN: 'http://localhost:18082',
    DATABASE_URL: 'postgresql://localhost/environment_test',
    JWT_SECRET: 'environment-test-signing-secret-at-least-32-characters',
    AI_INTERNAL_SECRET: 'environment-test-internal-secret-at-least-32-characters' };
  expect(loadEnvironment(env, filename).error).toBeUndefined();
  const config = loadConfig(env);
  expect(config.origin).toBe('http://localhost:5173');
  const runtime = createApplication({} as Pool, config);
  try {
    // Invalid credentials reach validation, rather than the origin rejection.
    await request(runtime.app).post('/api/v1/auth/login').set('Origin', 'http://localhost:5173')
      .send({}).expect(400);
    await request(runtime.app).post('/api/v1/auth/register').set('Origin', 'http://localhost:5173')
      .send({}).expect(400);
    const denied = await request(runtime.app).post('/api/v1/auth/login')
      .set('Origin', 'https://untrusted.example.test').send({}).expect(403);
    expect(denied.body.error).toBe('Origin not allowed');
  } finally { await new Promise<void>(resolve => runtime.io.close(() => resolve())); }
});

test.each([
  { WEB_ORIGIN: 'https://configured.example.test' },
  { NODE_ENV: 'production', TS_NODE_DEV: 'true', WEB_ORIGIN: 'https://configured.example.test' },
])('explicit deployment configuration keeps precedence: %j', env => {
  loadEnvironment(env, filename);
  expect(env.WEB_ORIGIN).toBe('https://configured.example.test');
});

test('development without a service file preserves the supplied configuration', () => {
  const env = { TS_NODE_DEV: 'true', WEB_ORIGIN: 'http://localhost:5173' };
  loadEnvironment(env, path.join(directory, 'absent.env'));
  expect(env.WEB_ORIGIN).toBe('http://localhost:5173');
});
