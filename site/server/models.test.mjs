import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { BROWSER_MODELS, DEFAULT_BROWSER_MODEL, browserModel, sha256File, verifyModel, modelEnv, servableModel } from './models.mjs';

test('catalog: unique ids and files, pinned sizes and SHA-256, Hugging Face sources, open licences', () => {
  assert.equal(new Set(BROWSER_MODELS.map(m => m.id)).size, BROWSER_MODELS.length);
  assert.equal(new Set(BROWSER_MODELS.map(m => m.file)).size, BROWSER_MODELS.length);
  for (const m of BROWSER_MODELS) {
    assert.match(m.file, /^[\w.-]+\.gguf$/, m.id);
    assert.match(m.sha256, /^[0-9a-f]{64}$/, m.id);
    assert.ok(Number.isInteger(m.bytes) && m.bytes > 1e8 && m.bytes < 2 ** 31, `${m.id}: under wllama's 2 GB per-file limit`);
    assert.ok(m.source.startsWith('https://huggingface.co/') && m.source.endsWith('/' + m.file), m.id);
    assert.ok(['Apache-2.0', 'MIT'].includes(m.licence), m.id);
  }
  assert.equal(browserModel().id, DEFAULT_BROWSER_MODEL);
  assert.equal(browserModel('').id, DEFAULT_BROWSER_MODEL);
  assert.throws(() => browserModel('gpt-9'), /Unknown in-browser model/);
});

test('verify and the quick check: size, hash, marker', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kibitz-models-'));
  const body = Buffer.from('not really a model');
  const m = { ...BROWSER_MODELS[0], bytes: body.length, sha256: crypto.createHash('sha256').update(body).digest('hex') };
  const real = BROWSER_MODELS[0];
  BROWSER_MODELS[0] = m; // modelEnv looks the entry up by id
  try {
    assert.deepEqual(await verifyModel(dir, m), { ok: false, reason: 'missing' });
    assert.match(modelEnv(dir, m.id).reason, /just offline/);
    fs.writeFileSync(path.join(dir, m.file), 'short');
    assert.match((await verifyModel(dir, m)).reason, /^size 5/);
    fs.writeFileSync(path.join(dir, m.file), Buffer.from('not really a modeX'));
    assert.match((await verifyModel(dir, m)).reason, /^SHA-256/);
    assert.match(modelEnv(dir, m.id).reason, /just offline/, 'no marker without a passing check');
    fs.writeFileSync(path.join(dir, m.file), body);
    assert.equal(await sha256File(path.join(dir, m.file)), m.sha256);
    assert.deepEqual(await verifyModel(dir, m), { ok: true, reason: '' });
    assert.deepEqual(modelEnv(dir, m.id), { env: { BROWSER_MODEL_URL: `models/${m.file}`, BROWSER_MODEL_NAME: m.name, BROWSER_MODEL_BYTES: String(m.bytes) }, reason: '' });
    fs.appendFileSync(path.join(dir, m.file), 'x'); // changed after the check
    assert.match(modelEnv(dir, m.id).reason, /just offline/);
  } finally {
    BROWSER_MODELS[0] = real;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('only catalog files are servable', () => {
  assert.equal(servableModel(BROWSER_MODELS[0].file), true);
  for (const name of [BROWSER_MODELS[0].file + '.sha256', 'other.gguf', '../.env', '']) assert.equal(servableModel(name), false, name);
});
