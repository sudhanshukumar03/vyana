const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { selectPython, localAITarget, healthyAI, pythonArguments } = require('./dev.cjs');

test('local development selects the project Python environment on Windows and Unix', () => {
  assert.equal(selectPython('/project', {}, 'win32', () => true), path.join('/project', '.venv/Scripts/python.exe'));
  assert.equal(selectPython('/project', {}, 'linux', () => true), path.join('/project', '.venv/bin/python'));
  assert.equal(selectPython('/project', {}, 'win32', () => false), 'python');
  assert.equal(selectPython('/project', {}, 'linux', () => false), 'python3');
  assert.equal(selectPython('/project', { HEALTHGUARD_PYTHON: 'custom-python' }, 'linux', () => true), 'custom-python');
});
test('AI startup follows the configured loopback host and port', () => {
  assert.deepEqual(localAITarget('http://127.0.0.1:8001'), { url: 'http://127.0.0.1:8001', host: '127.0.0.1', port: '8001' });
  assert.equal(localAITarget('http://localhost:8100').port, '8100');
  assert.equal(localAITarget('http://[::1]:8100').host, '::1');
  assert.equal(localAITarget('https://ai.example.test'), null);
  assert.equal(localAITarget('http://ai.example.test'), null);
  assert.throws(() => localAITarget('http://user:private@localhost:8001'));
  assert.throws(() => localAITarget('http://localhost:8001/prefix'));
});
test('a missing, failed or unrelated service is not treated as a healthy AI', async () => {
  assert.equal(await healthyAI('http://local', async () => ({ ok: true, json: async () => ({ status: 'alive' }) })), true);
  assert.equal(await healthyAI('http://local', async () => ({ ok: false })), false);
  assert.equal(await healthyAI('http://local', async () => ({ ok: true, json: async () => ({ status: 'other' }) })), false);
  assert.equal(await healthyAI('http://local', async () => { throw new Error('Connection refused'); }), false);
});
test('Python startup uses the configured target and project-local AI module', () => {
  const args = pythonArguments({ host: '127.0.0.1', port: '8001' });
  assert.deepEqual(args.slice(0, 3), ['-m', 'uvicorn', 'main:app']);
  assert.equal(args[args.indexOf('--port') + 1], '8001');
  assert.equal(args[args.indexOf('--host') + 1], '127.0.0.1');
  assert.equal(path.basename(args[args.indexOf('--app-dir') + 1]), 'ai');
});

test('launcher starts a missing AI, reuses a healthy AI, and stops only its own service', { timeout: 30000 }, async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vyana-dev-launcher-'));
  const apiDirectory = path.join(directory, 'apps/api'), aiDirectory = path.join(directory, 'ai');
  fs.mkdirSync(apiDirectory, { recursive: true }); fs.mkdirSync(aiDirectory);
  const port = await new Promise(resolve => {
    const reservation = net.createServer();
    reservation.listen(0, '127.0.0.1', () => { const value = reservation.address().port; reservation.close(() => resolve(value)); });
  });
  const target = `http://127.0.0.1:${port}`;
  fs.writeFileSync(path.join(apiDirectory, '.env'), `AI_URL=${target}\nAI_INTERNAL_SECRET=synthetic-launcher-secret-at-least-32-characters\n`);
  fs.writeFileSync(path.join(aiDirectory, '.env'), 'AI_INTERNAL_SECRET=synthetic-launcher-secret-at-least-32-characters\n');
  fs.writeFileSync(path.join(aiDirectory, 'main.py'), 'from fastapi import FastAPI\napp = FastAPI()\n@app.get("/health/live")\ndef health():\n    return {"status": "alive"}\n');
  const launcher = path.join(directory, 'launcher.cjs');
  fs.writeFileSync(launcher, `const { run } = require(${JSON.stringify(path.join(__dirname, 'dev.cjs'))});
process.on('message', message => { if (message === 'stop') process.emit('SIGTERM'); });
run({ directory: __dirname, args: ['--ai-only'] }).catch(() => process.exit(1));\n`);
  const started = [];
  async function start(marker) {
    const child = spawn(process.execPath, [launcher], {
      env: { ...process.env, HEALTHGUARD_PYTHON: selectPython(path.resolve(__dirname, '..')) },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'], windowsHide: true,
    });
    started.push(child);
    await new Promise((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(new Error('Launcher readiness timed out')), 15000);
      child.stdout.on('data', bytes => { output += bytes; if (output.includes(marker)) { clearTimeout(timer); resolve(); } });
      child.stderr.resume();
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', () => { clearTimeout(timer); reject(new Error('Launcher exited before readiness')); });
    });
    return child;
  }
  async function stop(child) {
    if (child.exitCode !== null || child.signalCode !== null) return;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Launcher shutdown timed out')), 10000);
      child.once('exit', () => { clearTimeout(timer); resolve(); });
      child.send('stop');
    });
  }
  try {
    const owner = await start('AI service ready.');
    assert.equal(await healthyAI(target), true);
    const borrower = await start('reusing it.');
    await stop(borrower);
    assert.equal(await healthyAI(target), true, 'Reusing an AI must not take ownership of it');
    await stop(owner);
    assert.equal(await healthyAI(target), false, 'The AI process must exit with its owning launcher');
  } finally {
    for (const child of started.reverse()) await stop(child);
    // Only remove the files/directories this fixture created. Uvicorn may also
    // create Python bytecode in its private test module directory.
    const resolved = fs.realpathSync(directory);
    assert(resolved.startsWith(fs.realpathSync(os.tmpdir()) + path.sep));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});
