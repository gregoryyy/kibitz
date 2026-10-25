import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import http from 'node:http';
import { aiConfigEvent, aiErrorEvent, fileErrorEvent, logRequest, routeCategory, serverErrorEvent } from './logging.mjs';
import { createApi } from './api.mjs';
import { createEmbedder, createProvider, GatewayError, loadConfig, loadEmbeddingConfig } from './ai.mjs';

const secret = 'PROMPT_PRIVATE COOKIE_PRIVATE sk-synthetic-secret ANSWER_PRIVATE MODEL_PRIVATE';
const hostile = secret + '\n\x1b[31mFORGED_EVENT';
const checkPrivate = lines => {
  const output = lines.join('\n');
  for (const token of secret.split(' ').concat('FORGED_EVENT')) assert.ok(!output.includes(token), token);
  assert.ok([...output].every(ch => ch === '\n' || ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) !== 127));
  for (const line of lines) { assert.ok(line.length < 500); assert.ok(!line.includes('\n')); JSON.parse(line); }
};

test('log fields use a closed vocabulary even for hostile codes, statuses and config values', () => {
  const lines = [aiErrorEvent(hostile, hostile, hostile, hostile), aiConfigEvent({ provider: hostile, model: hostile, reason: hostile }), serverErrorEvent({ code: hostile, message: hostile, stack: hostile }), fileErrorEvent(hostile, hostile)];
  checkPrivate(lines);
  assert.deepEqual(JSON.parse(lines[0]), { at: JSON.parse(lines[0]).at, event: 'ai_error', action: 'other', provider: 'other', code: 'other', status: 0 });
  for (const value of [-1, NaN, Infinity, 600, '401', {}, null]) assert.equal(JSON.parse(aiErrorEvent('sample', 'openai', 'auth_failed', value)).status, 0);
  assert.equal(JSON.parse(aiErrorEvent('sample', 'openai', 'auth_failed', 401)).status, 401);
  assert.match(serverErrorEvent({ code: 'EADDRINUSE', message: hostile }), /Listener already in use/);
});

test('access events classify paths, count disconnects once and omit request identity/content', () => {
  const lines = [], req = { method: hostile, url: '/api/library/' + encodeURIComponent(hostile), headers: { cookie: hostile }, body: hostile };
  const res = Object.assign(new EventEmitter(), { statusCode: 200, writableFinished: false });
  logRequest(req, res, { log: line => lines.push(line) });
  res.emit('close'); res.emit('finish');
  assert.equal(lines.length, 1);
  const event = JSON.parse(lines[0]);
  assert.deepEqual(Object.keys(event), ['at', 'event', 'method', 'route', 'status', 'complete', 'ms']);
  assert.equal(event.method, 'OTHER'); assert.equal(event.route, 'library'); assert.equal(event.status, 0); assert.equal(event.complete, false);
  assert.ok(Number.isInteger(event.ms) && event.ms >= 0);
  const completed = Object.assign(new EventEmitter(), { statusCode: 404, writableFinished: true });
  logRequest({ method: 'GET', url: '/private?query=' + encodeURIComponent(hostile) }, completed, { log: line => lines.push(line) });
  completed.emit('finish'); completed.emit('close');
  assert.equal(lines.length, 2); assert.equal(JSON.parse(lines[1]).status, 404);
  checkPrivate(lines);
  for (const [url, category] of [['/api/ai/sample?q=private', 'ai.sample'], ['/models/private', 'model'], ['/api/private', 'api.other'], ['http://[', 'invalid']]) assert.equal(routeCategory(url), category);
});

async function gateway(t, { error, delayed = false, late = false } = {}) {
  const logs = [], calls = [];
  let release, enter;
  const entered = new Promise(resolve => { enter = resolve; }), wait = new Promise(resolve => { release = resolve; });
  const client = { chat: { completions: { async create(body) {
    calls.push(body); enter(); if (delayed) await wait;
    if (late) return (async function* () { yield { choices: [{ delta: { content: 'ANSWER_PRIVATE' } }] }; throw Object.assign(new Error(hostile), { status: 500 }); })();
    throw error || Object.assign(new Error(hostile), { status: 500, error: { message: hostile }, headers: { cookie: hostile } });
  } } } };
  const config = loadConfig({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-synthetic-secret', OPENAI_MODEL: 'MODEL_PRIVATE', AI_RATE_LIMIT_PER_MINUTE: '1000' });
  const embeddingConfig = loadEmbeddingConfig({ EMBEDDING_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-synthetic-secret', EMBEDDING_MODEL: 'MODEL_PRIVATE' });
  const api = createApi({ config, provider: createProvider(config, { client }), embeddingConfig,
    embedder: createEmbedder(embeddingConfig, { client: { async post() { throw error || Object.assign(new Error(hostile), { status: 500 }); } } }),
    log: { error: line => logs.push(line), info: line => logs.push(line) } });
  const server = http.createServer((req, res) => api(req, res));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}/api/ai/`;
  const request = async (action, body) => {
    const res = await fetch(base + action, { ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }),
      headers: { 'content-type': 'application/json', cookie: 'kibitz_uid=abcdefghijklmnopqrstuv; private=COOKIE_PRIVATE', 'x-kibitz-consent': `v1:openai:${action === 'embeddings' ? 'embeddings' : 'coach'}` } });
    return { status: res.status, text: await res.text() };
  };
  return { logs, calls, entered, release, request };
}

test('fake SDK failures on all four AI routes log categories without reflected personal text', async t => {
  for (const status of [400, 401, 429, 500]) {
    const g = await gateway(t, { error: Object.assign(new Error(hostile), { status, error: { message: hostile } }) });
    const sample = await g.request('sample', { prompt: 'PROMPT_PRIVATE' });
    assert.equal(sample.status, 200); assert.ok(sample.text.includes('error'));
    assert.notEqual((await g.request('structured', { prompt: 'PROMPT_PRIVATE', format: 'annotations' })).status, 200);
    assert.notEqual((await g.request('test', {})).status, 200);
    const d = JSON.parse((await g.request('embeddings')).text);
    assert.notEqual((await g.request('embeddings', { texts: ['PROMPT_PRIVATE'], fingerprint: d.fingerprint, scope: d.scope })).status, 200);
    const events = g.logs.map(line => JSON.parse(line));
    assert.deepEqual(events.map(e => e.action), ['sample', 'structured', 'test', 'embeddings']);
    assert.ok(events.every(e => e.provider === 'openai' && e.status === status));
    assert.ok(events.every(e => e.code === ({ 400: 'provider_rejected', 401: 'auth_failed', 429: 'rate_limited', 500: 'provider_error' })[status]));
    await g.request('config', { provider: 'openai' });
    assert.equal(JSON.parse(g.logs.at(-1)).event, 'ai_config');
    checkPrivate(g.logs);
  }
});

test('an in-flight failure retains its accepted provider after a settings change', async t => {
  const g = await gateway(t, { delayed: true });
  const pending = g.request('sample', { prompt: 'PROMPT_PRIVATE' });
  await g.entered;
  try { assert.equal((await g.request('config', { localOnly: true })).status, 200); }
  finally { g.release(); await pending; }
  assert.equal(JSON.parse(g.logs.at(-1)).provider, 'openai'); checkPrivate(g.logs);
});

test('untrusted GatewayError codes and statuses cannot become arbitrary log fields', async t => {
  const g = await gateway(t, { error: new GatewayError(hostile, hostile, 200) });
  await g.request('sample', { prompt: 'PROMPT_PRIVATE' });
  assert.equal(JSON.parse(g.logs[0]).code, 'other'); checkPrivate(g.logs);
});

test('provider failure after streamed answer text logs only its category', async t => {
  const g = await gateway(t, { late: true });
  const response = await g.request('sample', { prompt: 'PROMPT_PRIVATE' });
  const parts = response.text.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(parts[0].text, 'ANSWER_PRIVATE'); assert.equal(parts[1].error.code, 'provider_error');
  assert.equal(g.logs.length, 1); checkPrivate(g.logs);
});
