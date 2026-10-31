const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const apiRequire = createRequire(path.join(root, 'apps/api/package.json'));
const dotenv = apiRequire('dotenv');

function selectPython(directory, env = process.env, platform = process.platform, exists = fs.existsSync) {
  if (env.HEALTHGUARD_PYTHON) return env.HEALTHGUARD_PYTHON;
  const local = path.join(directory, '.venv', platform === 'win32' ? 'Scripts' : 'bin', platform === 'win32' ? 'python.exe' : 'python');
  return exists(local) ? local : platform === 'win32' ? 'python' : 'python3';
}
function localAITarget(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    throw new Error('AI_URL must be an HTTP(S) URL without credentials, query or fragment.');
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return null;
  if (url.pathname !== '/') throw new Error('Local AI_URL must name the service origin without a path.');
  return { url: url.origin, host: url.hostname.replace(/^\[|\]$/g, ''), port: url.port || '80' };
}
async function healthyAI(url, request = fetch) {
  try {
    const response = await request(`${url}/health/live`, { signal: AbortSignal.timeout(1000) });
    return response.ok && (await response.json()).status === 'alive';
  } catch { return false; }
}
function environment(filename) {
  return fs.existsSync(filename) ? dotenv.parse(fs.readFileSync(filename)) : {};
}
function pythonArguments(target, directory = root) {
  const args = ['-m', 'uvicorn', 'main:app', '--app-dir', path.join(directory, 'ai'), '--host', target.host, '--port', target.port];
  const envFile = path.join(directory, 'ai/.env');
  if (fs.existsSync(envFile)) args.push('--env-file', envFile);
  return args;
}

async function run({ directory = root, env = process.env, args = process.argv } = {}) {
  const apiEnv = { ...env, ...environment(path.join(directory, 'apps/api/.env')) };
  const aiEnv = { ...env, ...environment(path.join(directory, 'ai/.env')) };
  if (apiEnv.AI_INTERNAL_SECRET && aiEnv.AI_INTERNAL_SECRET && apiEnv.AI_INTERNAL_SECRET !== aiEnv.AI_INTERNAL_SECRET)
    throw new Error('AI_INTERNAL_SECRET must match between the API and AI environments.');
  const target = localAITarget(apiEnv.AI_URL || 'http://127.0.0.1:8001');
  const children = new Set();
  let stopping = false;

  async function shutdown(code) {
    if (stopping) return;
    stopping = true;
    await Promise.all([...children].map(child => new Promise(resolve => {
      if (!child.pid) return resolve();
      if (process.platform === 'win32') {
        if (child.exitCode !== null || child.signalCode !== null) return resolve();
        const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
        killer.once('exit', resolve); killer.once('error', resolve);
      } else {
        const finished = () => { clearTimeout(timer); resolve(); };
        const timer = setTimeout(() => {
          try { process.kill(-child.pid, 'SIGKILL'); } catch { /* Group already exited. */ }
          resolve();
        }, 5000);
        child.once('exit', finished);
        try { process.kill(-child.pid, 'SIGTERM'); } catch { finished(); }
      }
    })));
    process.exit(code);
  }
  function launch(label, executable, childArgs, childEnv) {
    const child = spawn(executable, childArgs, { cwd: directory, env: childEnv, stdio: 'inherit', windowsHide: true,
      detached: process.platform !== 'win32' });
    children.add(child);
    child.once('error', () => {
      console.error(`${label} could not start. Check the installed runtime and project dependencies.`);
      void shutdown(1);
    });
    child.once('exit', () => {
      if (!stopping) { console.error(`${label} stopped; closing this launcher's services.`); void shutdown(1); }
    });
    return child;
  }
  process.once('SIGINT', () => { void shutdown(0); });
  process.once('SIGTERM', () => { void shutdown(0); });
  try {
    if (target) {
      if (await healthyAI(target.url)) console.log(`AI service already running on port ${target.port}; reusing it.`);
      else {
        console.log(`Starting Python AI service on port ${target.port}.`);
        const child = launch('AI service', selectPython(directory, env), pythonArguments(target, directory), aiEnv);
        const deadline = Date.now() + 30000;
        while (!await healthyAI(target.url)) {
          if (child.exitCode !== null || Date.now() >= deadline) throw new Error('AI service did not become ready. Check Python dependencies and the AI port.');
          await new Promise(resolve => setTimeout(resolve, 250));
        }
        console.log('AI service ready.');
      }
    } else console.log('Using the configured external AI service.');
    if (!args.includes('--ai-only')) {
      if (!env.npm_execpath) throw new Error('Run this launcher with pnpm dev.');
      launch('Web/API development servers', process.execPath,
        [env.npm_execpath, '--parallel', '--filter', './apps/**', 'dev'], env);
    }
  } catch (error) { console.error(error.message); await shutdown(1); }
}
module.exports = { selectPython, localAITarget, healthyAI, pythonArguments, run };
if (require.main === module) run().catch(error => { console.error(error.message); process.exitCode = 1; });
