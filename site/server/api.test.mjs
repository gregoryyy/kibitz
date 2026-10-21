import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { createApi } from './api.mjs';
import { usageLedger } from './usage.mjs';
import { createProvider, GatewayError, loadConfig } from './ai.mjs';

// A provider whose behaviour each test picks through the last message's content.
const seenModels = [];
const provider = {
  async *chat(messages, opts = {}) {
    seenModels.push(opts.model);
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
  const { usage, ...status } = JSON.parse(r.body);
  const { providers, ...rest } = status;
  assert.deepEqual(rest, { provider: 'mock', model: 'mock', models: { quick: 'mock', chat: 'mock', review: 'mock' }, available: true, reason: '', localOnly: false });
  assert.deepEqual(providers.map(p => [p.name, p.available, p.local]), [['anthropic', false, false], ['openai', false, false], ['mistral', false, false], ['ollama', false, true], ['mock', true, true]]);
  assert.equal(typeof usage.requests, 'number');
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

test('structured: a named format returns validated JSON; unknown formats are refused', async () => {
  const config = { ...loadConfig({ AI_PROVIDER: 'mock' }), ratePerMinute: 1000 };
  const api = createApi({ config, provider: createProvider(config), log: quiet });
  const s = http.createServer((req, res) => api(req, res));
  await new Promise(r => s.listen(0, '127.0.0.1', r));
  const send = body => fetch(`http://127.0.0.1:${s.address().port}/api/ai/structured`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const ok = await send({ prompt: 'Annotate', format: 'annotations' });
  assert.equal(ok.status, 200);
  const j = await ok.json();
  assert.equal(j.mode, 'native'); assert.deepEqual(Object.keys(j.data).sort(), ['arrows', 'highlights', 'text']);
  for (const format of ['nope', 'constructor', '__proto__', undefined]) {
    const bad = await send({ prompt: 'x', format });
    assert.equal(bad.status, 400, String(format));
  }
  s.close();
});

test('the request\'s task picks the model; an unknown task is refused', async () => {
  const before = seenModels.length;
  await post({ prompt: 'hi', task: 'review' });
  await post({ prompt: 'hi' });
  assert.deepEqual(seenModels.slice(before), ['mock', 'mock']);
  const r = await post({ prompt: 'hi', task: 'deep-thought' });
  assert.equal(r.status, 400);
  assert.match(JSON.parse(r.body).error.message, /task/);
});

test('usage is counted per request and the daily budget is enforced', async () => {
  const config = { ...loadConfig({ AI_PROVIDER: 'mock' }), ratePerMinute: 1000 };
  const ledger = usageLedger({ tokensPerDay: 20 });
  const api = createApi({ config, provider, log: quiet, ledger });
  const s = http.createServer((req, res) => api(req, res));
  await new Promise(r => s.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${s.address().port}/api/ai`;
  const send = () => fetch(base + '/sample', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"prompt":"hi"}' });
  assert.equal((await send()).status, 200);
  assert.deepEqual((await (await fetch(base + '/status')).json()).usage.input, 12);
  await (await send()).text(); // 30 tokens now: over the budget of 20
  const r = await send();
  assert.equal(r.status, 429);
  assert.equal((await r.json()).error.code, 'budget_exceeded');
  s.close();
});

test('settings: switch provider, local-only mode, connection test; all same-origin only', async () => {
  const made = [];
  const config = loadConfig({ AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k', OLLAMA_MODEL: 'llama' });
  const fakeProvider = name => ({ async *chat() { yield 'OK'; return { truncated: false, usage: { input: 5, output: 1 } }; }, name });
  const api = createApi({ config, provider: fakeProvider('anthropic'), makeProvider: c => { made.push(c.provider); return fakeProvider(c.provider); }, log: quiet });
  const s = http.createServer((req, res) => api(req, res));
  await new Promise(r => s.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${s.address().port}/api/ai`;
  const post = (path, body, headers = {}) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

  const t = await (await post('/test', {})).json();
  assert.equal(t.ok, true); assert.equal(t.provider, 'anthropic'); assert.equal(typeof t.ms, 'number');
  let st = await (await post('/config', { provider: 'ollama' })).json();
  assert.equal(st.provider, 'ollama'); assert.deepEqual(made, ['ollama']);
  st = await (await post('/config', { provider: 'anthropic' })).json();
  assert.equal(st.provider, 'anthropic');
  st = await (await post('/config', { localOnly: true })).json();
  assert.equal(st.localOnly, true); assert.equal(st.provider, 'ollama');
  const refused = await post('/config', { provider: 'anthropic' });
  assert.equal(refused.status, 409); assert.equal((await refused.json()).error.code, 'forbidden');
  assert.equal((await post('/config', { provider: 'openai' })).status, 409, 'no key');
  assert.equal((await post('/config', { localOnly: true }, { origin: 'http://evil.example' })).status, 403);
  assert.equal((await fetch(base + '/config', { method: 'POST', body: '{}' })).status, 415);
  assert.equal((await (await fetch(base + '/status')).json()).usage.requests, 1, 'the test request counted');
  s.close();
});
