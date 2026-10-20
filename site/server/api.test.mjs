import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { createApi } from './api.mjs';
import { GatewayError, loadConfig } from './ai.mjs';

// A provider whose behaviour each test picks through the last message's content.
const provider = {
  async *chat(messages) {
    const q = messages.at(-1).content;
    if (q === 'fail-early') throw Object.assign(new Error('bad key'), { status: 401 });
    yield 'Hello ';
    if (q === 'fail-late') throw new GatewayError('refused', 'no', 200);
    yield 'there.';
    return { truncated: q === 'long', usage: { input: 12, output: 3 } };
  },
};

let server, port;
const quiet = { error() {} };
before(async () => {
  const config = { ...loadConfig({ AI_PROVIDER: 'mock' }), ratePerMinute: 1000 };
  const api = createApi({ config, provider, log: quiet });
  server = http.createServer(async (req, res) => { if (!(await api(req, res))) { res.writeHead(404); res.end(); } });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  port = server.address().port;
});
after(() => server.close());

// Raw request so tests can set Host and Origin freely.
function request(path, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method, headers: { host: `127.0.0.1:${port}`, ...headers } }, res => {
      let data = ''; res.setEncoding('utf8');
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body !== undefined) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}
const post = (body, headers = {}) => request('/api/ai/sample', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body });
const lines = body => body.trim().split('\n').map(l => JSON.parse(l));

test('status reports provider and availability', async () => {
  const r = await request('/api/ai/status');
  assert.equal(r.status, 200);
  assert.deepEqual(JSON.parse(r.body), { provider: 'mock', model: 'mock', available: true, reason: '' });
  assert.equal(r.headers['cache-control'], 'no-store');
});

test('sample streams NDJSON text then done', async () => {
  const r = await post({ messages: [{ role: 'user', content: 'hi' }] }, { origin: `http://127.0.0.1:${port}` });
  assert.equal(r.status, 200);
  assert.match(r.headers['content-type'], /application\/x-ndjson/);
  assert.deepEqual(lines(r.body), [{ text: 'Hello ' }, { text: 'there.' }, { done: true, truncated: false, usage: { input: 12, output: 3 } }]);
});

test('sample passes through truncation', async () => {
  assert.deepEqual(lines((await post({ prompt: 'long' })).body).at(-1), { done: true, truncated: true, usage: { input: 12, output: 3 } });
});

test('provider errors before and after output become error lines', async () => {
  const early = lines((await post({ prompt: 'fail-early' })).body);
  assert.equal(early.length, 1);
  assert.equal(early[0].error.code, 'auth_failed');
  const late = lines((await post({ prompt: 'fail-late' })).body);
  assert.deepEqual(late[0], { text: 'Hello ' });
  assert.equal(late.at(-1).error.code, 'refused');
});

test('cross-origin POST is refused (CSRF)', async () => {
  const r = await post({ prompt: 'hi' }, { origin: 'https://evil.example' });
  assert.equal(r.status, 403);
  assert.equal(JSON.parse(r.body).error.code, 'forbidden');
});

test('requests under a foreign host name are refused (DNS rebinding)', async () => {
  for (const host of [`evil.example:${port}`, 'rebind.attacker.test']) {
    const r = await request('/api/ai/status', { headers: { host } });
    assert.equal(r.status, 403, host);
  }
  assert.equal((await request('/api/ai/status', { headers: { host: `localhost:${port}` } })).status, 200);
});

test('non-JSON content types are refused', async () => {
  const r = await post('{"prompt":"hi"}', { 'content-type': 'text/plain' });
  assert.equal(r.status, 415);
});

test('invalid bodies get 400 and oversized ones 413', async () => {
  assert.equal((await post('not json')).status, 400);
  assert.equal((await post({ messages: [{ role: 'system', content: 'x' }] })).status, 400);
  const big = await post({ prompt: 'x'.repeat(1_100_000) });
  assert.equal(big.status, 413);
});

test('unknown API paths are 404', async () => {
  assert.equal((await request('/api/nope')).status, 404);
  assert.equal((await request('/api/ai/sample')).status, 404);
});

test('rate limit returns 429 with rate_limited', async () => {
  const config = { ...loadConfig({ AI_PROVIDER: 'mock' }), ratePerMinute: 1 };
  const api = createApi({ config, provider, log: quiet });
  const s = http.createServer((req, res) => api(req, res));
  await new Promise(r => s.listen(0, '127.0.0.1', r));
  const p = s.address().port;
  const send = () => fetch(`http://127.0.0.1:${p}/api/ai/sample`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"prompt":"hi"}' });
  assert.equal((await send()).status, 200);
  const r = await send();
  assert.equal(r.status, 429);
  assert.equal((await r.json()).error.code, 'rate_limited');
  s.close();
});

test('unavailable provider returns 503 with the reason', async () => {
  const config = loadConfig({ AI_PROVIDER: 'anthropic' });
  const api = createApi({ config, log: quiet });
  const s = http.createServer((req, res) => api(req, res));
  await new Promise(r => s.listen(0, '127.0.0.1', r));
  const r = await fetch(`http://127.0.0.1:${s.address().port}/api/ai/sample`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"prompt":"hi"}' });
  assert.equal(r.status, 503);
  assert.match((await r.json()).error.message, /ANTHROPIC_API_KEY/);
  s.close();
});
