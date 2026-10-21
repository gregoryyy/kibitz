// scripts/serve.mjs as a process: the model folder and offline mode (TODO 2.16).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { BROWSER_MODELS } from './models.mjs';

const serve = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../scripts/serve.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kibitz-serve-'));
const dist = path.join(tmp, 'dist'), models = path.join(tmp, 'models');
const MODEL = BROWSER_MODELS[0].file;
let proc, base;

before(async () => {
  fs.mkdirSync(dist); fs.mkdirSync(models);
  fs.writeFileSync(path.join(dist, 'index.html'), '<title>K</title>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=X">\n<p>board</p>\n');
  fs.writeFileSync(path.join(models, MODEL), 'weights');
  fs.writeFileSync(path.join(models, MODEL + '.sha256'), 'abc\n');
  fs.writeFileSync(path.join(models, 'other.gguf'), 'not in the catalog');
  const port = 20000 + Math.floor(Math.random() * 20000);
  proc = spawn(process.execPath, [serve, dist, '--models', models, '--offline', '--port', String(port)], { stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((resolve, reject) => {
    proc.stdout.on('data', d => { if (String(d).includes('Serving')) resolve(null); });
    proc.on('exit', code => reject(new Error(`serve.mjs exited with ${code}`)));
  });
  base = `http://127.0.0.1:${port}`;
});
after(() => { proc?.kill(); fs.rmSync(tmp, { recursive: true, force: true }); });

test('offline: the page comes without Google Fonts and with a CSP that allows no other host', async () => {
  const r = await fetch(base + '/');
  const body = await r.text();
  assert.equal(r.status, 200);
  assert.doesNotMatch(body, /fonts\.googleapis/);
  assert.match(body, /<p>board<\/p>/);
  assert.equal(Number(r.headers.get('content-length')), Buffer.byteLength(body));
  assert.doesNotMatch(r.headers.get('content-security-policy'), /https:/);
});

test('models: catalog files only, with an ETag; nothing else from the folder', async () => {
  const r = await fetch(`${base}/models/${MODEL}`);
  assert.equal(r.status, 200);
  assert.equal(await r.text(), 'weights');
  assert.equal(r.headers.get('content-type'), 'application/octet-stream');
  assert.match(r.headers.get('etag'), /^"[0-9a-f]+-[0-9a-f]+"$/);
  assert.equal(r.headers.get('cross-origin-resource-policy'), 'same-origin');
  for (const p of [`/models/${MODEL}.sha256`, '/models/other.gguf', '/models/', '/models/%2e%2e/dist/index.html']) {
    assert.equal((await fetch(base + p)).status, 404, p);
  }
});
