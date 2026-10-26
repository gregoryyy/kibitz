// Production SDK construction and fetch, against real loopback HTTP only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApi } from './api.mjs';
import { complete, createEmbedder, createProvider, loadConfig, loadEmbeddingConfig, toGatewayError } from './ai.mjs';
import { completeJson, FORMATS } from './schema.mjs';
import { wire } from '../tests/fixtures/ai-wire.mjs';
async function serve(t, handler) {
  const server = http.createServer(handler); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  return `http://127.0.0.1:${server.address().port}`;
}
const config = (name, url, timeout = 500) => loadConfig({ AI_PROVIDER: name, [`${name.toUpperCase()}_API_KEY`]: 'synthetic-key',
  [`${name.toUpperCase()}_BASE_URL`]: url + (['openai', 'mistral'].includes(name) ? '/v1' : ''),
  [`${name.toUpperCase()}_MODEL`]: name === 'anthropic' ? 'claude-haiku-fixture' : 'fixture', AI_TIMEOUT_MS: String(timeout) }, { allowInsecureLoopback: true });
const partial = name => name === 'anthropic' ? wire(name).split('event: content_block_stop')[0] : wire(name).split('\n\n')[0] + '\n\n';
const question = [{ role: 'user', content: 'synthetic question' }];

for (const name of ['anthropic', 'openai', 'mistral', 'ollama']) test(`${name}: real SDK headers and partial-body stalls end at the total deadline and close the socket`, async t => {
  let kind = 'normal', calls = 0, closed = 0;
  const url = await serve(t, (req, res) => {
    calls++; req.resume(); res.on('close', () => closed++);
    if (kind === 'headers') return;
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    if (kind === 'body') res.write(partial(name)); else res.end(wire(name));
  });
  const provider = createProvider(config(name, url));
  assert.equal((await complete(provider, question)).text, 'Control the centre.');
  for (const phase of ['headers', 'body']) {
    kind = phase; const before = calls, started = Date.now();
    await assert.rejects(complete(provider, question), error => { assert.equal(toGatewayError(error).code, 'timeout'); return true; });
    assert.equal(calls, before + 1); assert.ok(Date.now() - started < 2000);
    for (let i = 0; i < 50 && closed < calls; i++) await new Promise(resolve => setTimeout(resolve,5));
    assert.equal(closed, calls, 'No response socket remains open');
  }
});

test('wire overhead and HTTP error bodies are capped before SDK buffering, without retries', async t => {
  let status = 200, calls = 0;
  const payload = Buffer.alloc(9 * 1024 * 1024, 120);
  const url = await serve(t, (req, res) => {
    calls++; req.resume(); res.writeHead(status, { 'content-type': status === 200 ? 'text/event-stream' : 'application/json' });
    // The SSE contains no useful visible text. Error data is equally untrusted.
    res.end(payload);
  });
  const provider = createProvider(config('openai', url, 5000));
  for (const code of [200, 400]) {
    status = code; const before = calls;
    await assert.rejects(complete(provider, question), { code: 'response_too_large' }); assert.equal(calls, before + 1);
  }
  const before = calls;
  await assert.rejects(completeJson(provider, question, FORMATS.annotations), { code: 'response_too_large' }); assert.equal(calls, before + 1);
});

test('structured and connection-test-style completion stop stalled bodies without a format retry', async t => {
  let calls = 0;
  const url = await serve(t, (req, res) => { calls++; req.resume(); res.writeHead(200, { 'content-type': 'text/event-stream' }); res.write(partial('mistral')); });
  const provider = createProvider(config('mistral', url));
  await assert.rejects(completeJson(provider, question, FORMATS.annotations), { code: 'timeout' }); assert.equal(calls, 1);
  await assert.rejects(complete(provider, question, { maxTokens: 256 }), { code: 'timeout' }); assert.equal(calls, 2);
});

test('decoded coaching text is rejected before a large first chunk can reach the caller', async t => {
  const url = await serve(t, (req, res) => { req.resume(); res.writeHead(200, { 'content-type': 'text/event-stream' }); res.end(wire('openai', ['x'.repeat(256 * 1024)])); });
  const received = [], provider = createProvider(config('openai', url, 5000));
  await assert.rejects(async () => { for await (const text of provider.chat(question)) received.push(text); }, { code: 'response_too_large' });
  assert.deepEqual(received, []);
});

test('embedding JSON and Ollama inspection are bounded before another text upload', async t => {
  const paths = [];
  const url = await serve(t, (req, res) => { paths.push(req.url); req.resume(); res.writeHead(200, { 'content-type': 'application/json' }); res.write('{"data":['); });
  for (const name of ['openai', 'ollama']) {
    const cfg = loadEmbeddingConfig({ EMBEDDING_PROVIDER: name, EMBEDDING_MODEL: 'fixture', OPENAI_API_KEY: 'synthetic-key', AI_TIMEOUT_MS: '500',
      [`${name.toUpperCase()}_BASE_URL`]: url + (name === 'openai' ? '/v1' : '') }, { allowInsecureLoopback: true });
    const before = paths.length;
    // The SDK's own JSON timer can win the race. Both paths must expose the same safe gateway error.
    await assert.rejects(createEmbedder(cfg).embed(['synthetic note']), error => { const mapped = toGatewayError(error); assert.equal(mapped.code, 'timeout'); assert.equal(mapped.status, 504); return true; });
    assert.equal(paths.length, before + 1);
  }
  assert.deepEqual(paths, ['/v1/embeddings', '/api/show']);
});

test('SDK rate-error backoff is disabled', async t => {
  let calls = 0;
  const url = await serve(t, (req, res) => { calls++; req.resume(); res.writeHead(429, { 'content-type': 'application/json', 'retry-after': '60' }); res.end('{"error":{"message":"synthetic rate error"}}'); });
  const provider = createProvider(config('openai', url));
  await assert.rejects(complete(provider, question), error => { assert.equal(toGatewayError(error).code, 'rate_limited'); return true; });
  assert.equal(calls, 1);
});

test('concurrent calls on one production provider own independent abort and response lifetimes', async t => {
  let enter; const entered = new Promise(resolve => { enter = resolve; });
  const url = await serve(t, (req, res) => {
    let body = ''; req.on('data', chunk => body += chunk); req.on('end', () => {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      if (JSON.parse(body).messages[0].content === 'held') { res.write(partial('openai')); enter(); }
      else res.end(wire('openai'));
    });
  });
  const provider = createProvider(config('openai', url, 5000)), ctl = new AbortController();
  const held = complete(provider, [{ role: 'user', content: 'held' }], { signal: ctl.signal });
  await entered; assert.equal((await complete(provider, question)).text, 'Control the centre.');
  ctl.abort(); await assert.rejects(held, { code: 'cancelled' });
});

test('disconnecting an actual gateway connection test closes upstream work and logs no AI failure', async t => {
  let enter, closed = false; const entered = new Promise(resolve => { enter = resolve; });
  const upstream = await serve(t, (req, res) => {
    req.resume(); res.on('close', () => { closed = true; });
    res.writeHead(200, { 'content-type': 'text/event-stream' }); res.write(partial('openai')); enter();
  });
  const logs = [], cfg = config('openai', upstream, 5000);
  const api = createApi({ allowInsecureHttp: true, config: cfg, embeddingConfig: loadEmbeddingConfig({ EMBEDDING_PROVIDER: 'mock' }), log: { info: line => logs.push(line), error: line => logs.push(line) } });
  const gateway = await serve(t, (req, res) => api(req, res));
  const ctl = new AbortController();
  const request = fetch(gateway + '/api/ai/test', { method: 'POST', headers: { 'content-type': 'application/json', 'x-kibitz-consent': 'v1:openai:coach' }, body: '{}', signal: ctl.signal });
  await entered; ctl.abort(); await assert.rejects(request, { name: 'AbortError' });
  for (let i = 0; i < 100 && !closed; i++) await new Promise(resolve => setTimeout(resolve,5));
  assert.equal(closed, true); assert.deepEqual(logs, []);
  const status = await (await fetch(gateway + '/api/ai/status')).json(); assert.equal(status.usage.requests, 0);
});
