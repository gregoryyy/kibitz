import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { recordFixture, publishFixture } from '../../scripts/fixture-recording.mjs';
import { loadConfig } from '../../server/ai.mjs';
import { annotations, wire } from '../fixtures/ai-wire.mjs';
const secret = 'synthetic-api-credential-with-32-characters';
const cfg = provider => loadConfig({ AI_PROVIDER: provider, [`${provider.toUpperCase()}_API_KEY`]: secret, OLLAMA_MODEL: 'fixture-model', ANTHROPIC_MODEL: 'claude-sonnet-5-5' });
const response = body => async () => new Response(body, { headers: { 'content-type': 'text/event-stream' } });
const directory = () => fs.mkdtemp(path.join(os.tmpdir(), 'kibitz-fixture-unit-'));

test('all four SDK adapters retain exact successful wire bytes, fixed token caps and no fallback/tools', async () => {
  for (const provider of ['anthropic', 'openai', 'mistral', 'ollama']) for (const label of ['chat', 'json']) {
    let requests = 0;
    const body = wire(provider, [label === 'json' ? JSON.stringify(annotations) : 'Control the centre.']);
    const saved = await recordFixture(cfg(provider), label, { fetcher: async (url, init) => {
      requests++;
      const sent = JSON.parse(init.body);
      assert.equal(sent.model, cfg(provider).model);
      assert.equal(sent.max_tokens ?? sent.max_completion_tokens, label === 'chat' ? 400 : 1500);
      for (const key of ['tools', 'fallbacks', 'betas']) assert.equal(sent[key], undefined);
      assert.equal(init.redirect, 'error');
      return new Response(body, { headers: { 'content-type': 'text/event-stream', 'x-private-account': 'hidden' } });
    } });
    assert.equal(requests, 1); assert.equal(saved.body, body); assert.equal(saved.status, 200);
    assert.equal(saved.provider, provider); assert.equal(saved.case, label); assert.equal(JSON.stringify(saved).includes('hidden'), false);
  }
});

test('HTTP/SDK errors, incomplete streams and invalid annotations fail after one attempt', async () => {
  const cases = [
    [async () => new Response(secret, { status: 401 }), 'invalid_http_response'],
    [async () => { throw Error(secret); }, 'capture_failed'],
    [async () => new Response(secret), 'invalid_http_response'],
    [response('not SSE'), 'incomplete_stream'],
    [response(wire('openai').replace('data: [DONE]\n\n', '')), 'incomplete_stream'],
    [response(wire('openai', ['partial'], 'length')), 'incomplete_stream'],
    [response(wire('anthropic', ['partial'], 'length')), 'invalid_completion', 'chat', 'anthropic'],
    [response(wire('openai', [''])), 'invalid_completion'],
    [response(wire('openai', ['{"text":"missing fields"}'])), 'invalid_annotations', 'json'],
    [response(wire('openai', ['not JSON'])), 'provider_failed', 'json'],
    [response(new Uint8Array([0xff])), 'capture_failed'],
  ];
  for (const [fetcher, code, label = 'chat', provider = 'openai'] of cases) {
    let calls = 0;
    await assert.rejects(recordFixture(cfg(provider), label, { fetcher: (...args) => { calls++; return fetcher(...args); } }), error => {
      assert.equal(error.code, code); assert.equal(error.message.includes(secret), false); return true;
    });
    assert.equal(calls, 1);
  }
});

test('credentials in raw fields, metadata and decoded text split over SSE events are refused', async () => {
  for (const parts of [[secret], [secret.slice(0, 18), secret.slice(18)]])
    await assert.rejects(recordFixture(cfg('openai'), 'chat', { fetcher: response(wire('openai', parts)) }), { code: 'credential_in_capture' });
  const key = 'synthetic-credential-"/punctuation';
  for (const value of [JSON.stringify(key).slice(1, -1), encodeURIComponent(key)])
    await assert.rejects(recordFixture(cfg('openai'), 'chat', { secrets: [key], fetcher: response(wire('openai').replace('fixture', value)) }), { code: 'credential_in_capture' });
  let calls = 0;
  await assert.rejects(recordFixture({ ...cfg('openai'), model: secret }, 'chat', { fetcher: async () => { calls++; } }), { code: 'credential_in_capture' });
  assert.equal(calls, 0);
});

test('byte cap and total deadline stop oversized and stalled headers/body and cancel streams', async () => {
  await assert.rejects(recordFixture(cfg('openai'), 'chat', { fetcher: response('x'.repeat(101)), maxBytes: 100 }), { code: 'response_too_large' });
  for (const phase of ['headers', 'body']) {
    let cancelled = false;
    const fetcher = phase === 'headers' ? async () => new Promise(() => {}) : response(new ReadableStream({ cancel() { cancelled = true; } }));
    const start = Date.now();
    await assert.rejects(recordFixture(cfg('openai'), 'chat', { fetcher, timeoutMs: 35 }), { code: 'capture_timeout' });
    assert.ok(Date.now() - start < 2000); if (phase === 'body') assert.equal(cancelled, true);
  }
});

test('invalid selections and limits fail before fetching', async () => {
  let calls = 0;
  const fetcher = async () => { calls++; };
  for (const label of ['../escape', '__proto__', 'constructor']) await assert.rejects(recordFixture(cfg('openai'), label, { fetcher }), { code: 'invalid_selection' });
  for (const provider of ['../escape', '__proto__', 'browser', 'mock']) await assert.rejects(recordFixture({ ...cfg('openai'), provider }, 'chat', { fetcher }), { code: 'invalid_selection' });
  for (const timeoutMs of [0, Infinity, 1.5, 300001]) await assert.rejects(recordFixture(cfg('openai'), 'chat', { fetcher, timeoutMs }), { code: 'invalid_limits' });
  assert.equal(calls, 0);
});

test('atomic publication replaces a symlink entry without touching its target; files are private', async () => {
  const dir = await directory(), target = path.join(dir, 'operator-file'), file = path.join(dir, 'openai-chat.json');
  try {
    await fs.writeFile(target, 'preserve'); await fs.symlink(target, file);
    const saved = await recordFixture(cfg('openai'), 'chat', { fetcher: response(wire('openai')) });
    await publishFixture(dir, saved);
    assert.equal(await fs.readFile(target, 'utf8'), 'preserve'); assert.equal((await fs.lstat(file)).isSymbolicLink(), false);
    assert.deepEqual(JSON.parse(await fs.readFile(file, 'utf8')), saved);
    if (process.platform !== 'win32') assert.equal((await fs.stat(file)).mode & 0o777, 0o600);
    assert.deepEqual((await fs.readdir(dir)).sort(), ['openai-chat.json', 'operator-file']);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('failed publication preserves an existing directory and removes temporary files', async () => {
  const dir = await directory(), file = path.join(dir, 'openai-chat.json');
  try {
    await fs.mkdir(file); await fs.writeFile(path.join(file, 'prior'), 'preserve');
    await assert.rejects(publishFixture(dir, await recordFixture(cfg('openai'), 'chat', { fetcher: response(wire('openai')) })));
    assert.equal(await fs.readFile(path.join(file, 'prior'), 'utf8'), 'preserve'); assert.deepEqual(await fs.readdir(dir), ['openai-chat.json']);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
