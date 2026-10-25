// Exercise the actual CLI/middleware order, private on-disk persistence, and no-AI mode.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const script = fileURLToPath(new URL('../scripts/serve.mjs', import.meta.url));
async function start(root, database, ai) {
  const args = [script, root, '--port', '0', '--host', '127.0.0.1', '--library', database, ...(ai ? ['--api', '--env='] : [])];
  const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, AI_PROVIDER: 'mock', AI_LOCAL_ONLY: '', EMBEDDING_PROVIDER: 'mock', ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', MISTRAL_API_KEY: '' } });
  let output = '', errors = '', base = '';
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(Error('Library server startup timed out')); }, 20_000);
    child.stdout.on('data', chunk => { output += String(chunk); const ready = output.match(/^Serving Kibitz at (http:\/\/127\.0\.0\.1:[1-9]\d*)\/\r?$/m); if (ready) { base = ready[1]; clearTimeout(timer); resolve(null); } });
    child.stderr.on('data', chunk => { errors += String(chunk); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Library server exited (${code}): ${errors}`)); });
    child.once('error', error => { clearTimeout(timer); reject(error); });
  });
  return { base, output: () => output, stop: async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const done = new Promise(resolve => child.once('exit', resolve)); child.kill(); await done;
  } };
}

for (const ai of [false, true]) test(`serve --library ${ai ? 'with the mock AI gateway' : 'without an AI gateway'} preserves data across restart and serves no DB files`, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kibitz-library-serve-')), root = path.join(dir, 'dist'), database = path.join(dir, '.kibitz-data', 'library.sqlite');
  fs.mkdirSync(root); fs.writeFileSync(path.join(root, 'index.html'), '<p>Library test</p>');
  let server;
  try {
    server = await start(root, database, ai);
    const status = await fetch(server.base + '/api/library/status'); assert.equal(status.status, 200); assert.equal((await status.json()).available, true); assert.equal(status.headers.get('set-cookie'), null);
    const first = await fetch(server.base + '/api/library/records'), snapshot = await first.json(), cookie = first.headers.get('set-cookie').split(';')[0];
    const pgn = '1. e4 {private-library-note-1234} *';
    const saved = await fetch(server.base + '/api/library/records', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ scope: snapshot.scope, revision: snapshot.revision, changes: [{ collection: 'games', id: 'restart', record: { id: 'restart', kind: 'study', pgn } }] }) });
    assert.equal(saved.status, 200); assert.equal((await saved.json()).games[0].pgn, pgn);
    assert.equal((await fetch(server.base + '/api/ai/status')).status, ai ? 200 : 404);
    for (const name of ['/.kibitz-data/library.sqlite', '/library.sqlite', '/library.sqlite-wal', '/library.sqlite-shm']) assert.equal((await fetch(server.base + name)).status, 404);
    assert.ok(!server.output().includes('private-library-note-1234')); assert.ok(!server.output().includes(cookie));
    await server.stop(); server = await start(root, database, ai);
    const restored = await fetch(server.base + '/api/library/records', { headers: { cookie } });
    assert.equal(restored.status, 200); assert.equal((await restored.json()).games[0].pgn, pgn);
    assert.equal(fs.statSync(database).mode & 0o777, 0o600);
  } finally { if (server) await server.stop(); fs.rmSync(dir, { recursive: true, force: true }); }
});
