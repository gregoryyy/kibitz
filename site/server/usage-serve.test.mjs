// Actual CLI restart with mock-only inference and a private on-disk ledger.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const script = fileURLToPath(new URL('../scripts/serve.mjs', import.meta.url));
async function start(root, database, extra = {}) {
  const child = spawn(process.execPath, [script, root, '--port', '0', '--host', '127.0.0.1', '--api', '--http-dev', '--env=', '--usage', database], {
    stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, AI_PROVIDER: 'mock', AI_LOCAL_ONLY: '', EMBEDDING_PROVIDER: 'mock',
      ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', MISTRAL_API_KEY: '', AI_RATE_LIMIT_PER_MINUTE: '10', AI_RATE_LIMIT_PER_USER_PER_MINUTE: '1', AI_TOKEN_BUDGET_PER_DAY: '0', ...extra },
  });
  let output = '', errors = '', base = '';
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(Error('Usage server startup timed out')); }, 20_000);
    child.stdout.on('data', chunk => { output += String(chunk); const ready = output.match(/^Serving Kibitz at (http:\/\/127\.0\.0\.1:[1-9]\d*)\/\r?$/m); if (ready) { base = ready[1]; clearTimeout(timer); resolve(null); } });
    child.stderr.on('data', chunk => { errors += String(chunk); });
    child.once('exit', code => { clearTimeout(timer); reject(Error(`Usage server exited (${code}): ${errors}`)); });
    child.once('error', error => { clearTimeout(timer); reject(error); });
  });
  return { base, output: () => output, stop: async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const done = new Promise(resolve => child.once('exit', resolve)); child.kill(); await done;
  } };
}
const send = (base, cookie = '') => fetch(base + '/api/ai/sample', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: '{"prompt":"private-question-never-stored"}' });

test('CLI persists usage and rate refusals across restart, isolates cookies and never serves or logs the ledger', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kibitz-usage-cli-')), root = path.join(dir, 'dist'), file = path.join(dir, 'data', 'usage.sqlite');
  fs.mkdirSync(root); fs.writeFileSync(path.join(root, 'index.html'), '<p>Usage test</p>'); let server;
  try {
    server = await start(root, file);
    const first = await send(server.base), cookie = first.headers.get('set-cookie').split(';')[0];
    await first.text(); const before = await (await fetch(server.base + '/api/ai/status', { headers: { cookie } })).json();
    assert.equal(before.user.requests, 1); assert.equal((await send(server.base, cookie)).status, 429);
    assert.ok(!server.output().includes(cookie)); assert.ok(!server.output().includes('private-question-never-stored'));
    await server.stop(); server = await start(root, file);
    const restored = await (await fetch(server.base + '/api/ai/status', { headers: { cookie } })).json();
    assert.deepEqual(restored.user, before.user); assert.deepEqual(restored.usage, before.usage);
    assert.equal((await send(server.base, cookie)).status, 429);
    const bob = await send(server.base); assert.equal(bob.status, 200); await bob.text();
    for (const name of ['/usage.sqlite', '/usage.sqlite-wal', '/usage.sqlite-shm', '/data/usage.sqlite']) assert.equal((await fetch(server.base + name)).status, 404);
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    await server.stop();
    for (const name of fs.readdirSync(path.dirname(file))) {
      const bytes = fs.readFileSync(path.join(path.dirname(file), name));
      assert.equal(bytes.includes(Buffer.from('private-question-never-stored')), false);
      assert.equal(bytes.includes(Buffer.from(cookie.split('=')[1])), false);
    }
    server = await start(root, file, { AI_TOKEN_BUDGET_PER_DAY: '1' });
    const over = await send(server.base); assert.equal(over.status, 429); assert.equal((await over.json()).error.code, 'budget_exceeded');
  } finally { await server?.stop(); fs.rmSync(dir, { recursive: true, force: true }); }
});
