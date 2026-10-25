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
    if (opts.tools?.length && q === 'use-a-tool') return { truncated: false, toolCalls: [{ id: 't1', name: opts.tools[0].name, input: { fen: 'f' } }], usage: { input: 5, output: 2 } };
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
  const api = createApi({ allowInsecureHttp: true, config, provider, log: quiet });
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
  const { usage, user, ...status } = JSON.parse(r.body);
  const { providers, ...rest } = status;
  assert.deepEqual(rest, { provider: 'mock', model: 'mock', models: { quick: 'mock', chat: 'mock', review: 'mock' }, available: true, reason: '', localOnly: false, browser: null, paid: false });
  assert.equal(typeof user.requests, 'number');
  assert.deepEqual(providers.map(p => [p.name, p.available, p.local]), [['anthropic', false, false], ['openai', false, false], ['mistral', false, false], ['ollama', false, true], ['browser', false, true], ['mock', true, true]]);
  assert.equal(typeof usage.requests, 'number');
  assert.equal(r.headers['cache-control'], 'no-store');
});

test('sample streams NDJSON text then done', async () => {
  const r = await post({ messages: [{ role: 'user', content: 'hi' }] }, { origin: `http://127.0.0.1:${port}` });
  assert.equal(r.status, 200);
  assert.match(r.headers['content-type'], /application\/x-ndjson/);
  const out = lines(r.body);
  assert.deepEqual(out.slice(0, 2), [{ text: 'Hello ' }, { text: 'there.' }]);
  const { user, ...done } = out[2];
  assert.deepEqual(done, { done: true, truncated: false, usage: { input: 12, output: 3, cost: null } });
  assert.equal(typeof user.requests, 'number');
});

test('sample passes through truncation', async () => {
  const last = lines((await post({ prompt: 'long' })).body).at(-1);
  assert.deepEqual([last.done, last.truncated, last.usage], [true, true, { input: 12, output: 3, cost: null }]);
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
  const api = createApi({ allowInsecureHttp: true, config, provider, log: quiet });
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
  const api = createApi({ allowInsecureHttp: true, config, log: quiet });
  const s = http.createServer((req, res) => api(req, res));
  await new Promise(r => s.listen(0, '127.0.0.1', r));
  const r = await fetch(`http://127.0.0.1:${s.address().port}/api/ai/sample`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"prompt":"hi"}' });
  assert.equal(r.status, 503);
  assert.match((await r.json()).error.message, /ANTHROPIC_API_KEY/);
  s.close();
});

test('structured: a named format returns validated JSON; unknown formats are refused', async () => {
  const config = { ...loadConfig({ AI_PROVIDER: 'mock' }), ratePerMinute: 1000 };
  const api = createApi({ allowInsecureHttp: true, config, provider: createProvider(config), log: quiet });
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
  const api = createApi({ allowInsecureHttp: true, config, provider, log: quiet, ledger });
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
  const api = createApi({ allowInsecureHttp: true, config, provider: fakeProvider('anthropic'), makeProvider: c => { made.push(c.provider); return fakeProvider(c.provider); }, log: quiet });
  const s = http.createServer((req, res) => api(req, res));
  await new Promise(r => s.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${s.address().port}/api/ai`;
  const post = (path, body, headers = {}) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

  const t = await (await post('/test', {}, { 'x-kibitz-consent': 'v1:anthropic:coach' })).json();
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

// A server for one test, with its own config and ledgers; send() posts a sample request with the cookie jar.
async function serverWith({ provider: name = 'mock', env = {}, ...opts } = {}) {
  const config = { ...loadConfig({ AI_PROVIDER: 'mock', ...env }), provider: name, ratePerMinute: 1000 };
  const api = createApi({ allowInsecureHttp: true, config, provider, log: quiet, ...opts });
  const s = http.createServer((req, res) => api(req, res));
  await new Promise(r => s.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${s.address().port}/api/ai`;
  const send = (cookie = '') => fetch(base + '/sample', { method: 'POST', headers: { 'content-type': 'application/json', cookie, 'x-kibitz-consent': `v1:${name}:coach` }, body: '{"prompt":"hi"}' });
  return { s, base, send };
}
const uidOf = r => /kibitz_dev_uid=([^;]+)/.exec(r.headers.get('set-cookie') || '')?.[1];

test('a user gets a random HttpOnly cookie on the first API request, and keeps it', async () => {
  const { s, base, send } = await serverWith();
  const r = await fetch(base + '/status');
  const cookie = r.headers.get('set-cookie');
  assert.match(cookie, /^kibitz_dev_uid=[A-Za-z0-9_-]{22}; Path=\/api\/; HttpOnly; SameSite=Strict; Max-Age=\d+$/);
  const uid = uidOf(r);
  const again = await send(`kibitz_dev_uid=${uid}`);
  assert.equal(again.headers.get('set-cookie'), null);
  await again.text();
  assert.notEqual(uidOf(await fetch(base + '/status', { headers: { cookie: 'kibitz_dev_uid=../../etc' } })), undefined); // malformed: a new one
  s.close();
});

test('usage, cost and budgets are counted per user; the budgets apply to paid models only', async () => {
  const env = { AI_PRICES: 'mock=1000/2000', AI_TOKEN_BUDGET_PER_USER_PER_DAY: '20' };
  const { s, base, send } = await serverWith({ provider: 'anthropic', env });
  const first = await send();
  const alice = `kibitz_dev_uid=${uidOf(first)}`;
  const done = (await first.text()).trim().split('\n').map(l => JSON.parse(l)).at(-1);
  assert.deepEqual(done.usage, { input: 12, output: 3, cost: 0.018 }); // 12 * $1000/M + 3 * $2000/M
  assert.deepEqual([done.user.input, done.user.output, done.user.cost, done.user.paid.tokens, done.user.left.tokens], [12, 3, 0.018, 15, 5]);
  await (await send(alice)).text(); // 30 tokens: over Alice's budget of 20
  const over = await send(alice);
  assert.equal(over.status, 429);
  const err = (await over.json()).error;
  assert.equal(err.code, 'budget_exceeded');
  assert.match(err.message, /today's budget of 20 tokens on paid models/);
  const bob = await send(); // another user still has a budget
  assert.equal(bob.status, 200); await bob.text();
  const st = await (await fetch(base + '/status', { headers: { cookie: alice } })).json();
  assert.deepEqual([st.paid, st.user.requests, st.user.paid.tokens, st.user.left.tokens, st.usage.requests], [true, 2, 30, 0, 3]);
  s.close();
  // The same budget with a local model: counted, not limited.
  const local = await serverWith({ provider: 'mock', env });
  const r1 = await local.send(); const c = `kibitz_dev_uid=${uidOf(r1)}`; await r1.text();
  for (let k = 0; k < 3; k++) { const r = await local.send(c); assert.equal(r.status, 200); await r.text(); }
  const lst = await (await fetch(local.base + '/status', { headers: { cookie: c } })).json();
  assert.deepEqual([lst.paid, lst.user.requests, lst.user.paid.tokens], [false, 4, 0]);
  local.s.close();
});

test('a cost budget per user stops paid requests once it is spent', async () => {
  const { s, send } = await serverWith({ provider: 'openai', env: { AI_PRICES: 'mock=1000/2000', AI_COST_BUDGET_PER_USER_PER_DAY: '0.03' } });
  const r = await send(); const c = `kibitz_dev_uid=${uidOf(r)}`; await r.text(); // $0.018
  await (await send(c)).text(); // $0.036
  const over = await send(c);
  assert.equal(over.status, 429);
  assert.match((await over.json()).error.message, /today's budget of \$0\.03 on paid models/);
  s.close();
});

test('sample with tools: the tool calls come in the done line; unknown tools are refused', async () => {
  const origin = { origin: `http://127.0.0.1:${port}` };
  const r = await post({ messages: [{ role: 'user', content: 'use-a-tool' }], tools: ['threats'] }, origin);
  const done = lines(r.body).at(-1);
  assert.deepEqual(done.toolCalls, [{ id: 't1', name: 'threats', input: { fen: 'f' } }]);
  const plain = lines((await post({ messages: [{ role: 'user', content: 'hi' }] }, origin)).body).at(-1);
  assert.equal(plain.toolCalls, undefined, 'no tool calls, no field');
  const bad = await post({ messages: [{ role: 'user', content: 'hi' }], tools: ['format_disk'] }, origin);
  assert.equal(bad.status, 400);
  assert.match(JSON.parse(bad.body).error.message, /"tools" must name tools/);
});

test('cookie-scoped rates reject one browser while another can use the shared server allowance', async () => {
  const config = loadConfig({ AI_PROVIDER: 'mock', AI_RATE_LIMIT_PER_MINUTE: '10', AI_RATE_LIMIT_PER_USER_PER_MINUTE: '1' });
  const api = createApi({ allowInsecureHttp: true, config, provider, log: quiet });
  const s = http.createServer((req, res) => api(req, res)); await new Promise(r => s.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${s.address().port}/api/ai`;
  const send = cookie => fetch(base + '/sample', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: '{"prompt":"hi"}' });
  try {
    const status = await fetch(base + '/status'), alice = status.headers.get('set-cookie').split(';')[0];
    const first = await send(alice); assert.equal(first.status, 200); await first.text();
    const over = await send(alice); assert.equal(over.status, 429); assert.equal((await over.json()).error.code, 'rate_limited');
    const bob = await send(''); assert.equal(bob.status, 200); await bob.text();
    assert.equal((await (await fetch(base + '/status', { headers: { cookie: alice } })).json()).user.requests, 1);
  } finally { s.close(); }
});

test('a held paid request is counted as paid even after switching to a local provider', async () => {
  let finish, started;
  const held = new Promise(resolve => finish = resolve), ready = new Promise(resolve => started = resolve);
  const fake = { async *chat() { started(); await held; yield 'OK'; return { usage: { input: 20, output: 1 } }; } };
  const config = { ...loadConfig({ AI_PROVIDER: 'mock' }), provider: 'anthropic' };
  const api = createApi({ allowInsecureHttp: true, config, provider: fake, makeProvider: () => fake, log: quiet });
  const s = http.createServer((req, res) => api(req, res)); await new Promise(r => s.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${s.address().port}/api/ai`;
  try {
    const status = await fetch(base + '/status'), cookie = status.headers.get('set-cookie').split(';')[0];
    const pending = fetch(base + '/sample', { method: 'POST', headers: { 'content-type': 'application/json', cookie, 'x-kibitz-consent': 'v1:anthropic:coach' }, body: '{"prompt":"hi"}' });
    await ready;
    const switched = await fetch(base + '/config', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: '{"provider":"mock"}' }); assert.equal(switched.status, 200);
    finish(); const done = lines(await (await pending).text()).at(-1);
    assert.equal(done.user.paid.tokens, 21);
  } finally { finish(); s.close(); }
});

test('provider changes while a request body arrives cannot reuse consent for the previous route', async () => {
  const config = loadConfig({ AI_PROVIDER: 'mock', ANTHROPIC_API_KEY: 'fake-test-key' });
  let calls = 0; const fake = { async *chat() { calls++; yield 'unexpected'; return { usage: {} }; } };
  const api = createApi({ allowInsecureHttp: true, config, provider: fake, makeProvider: () => fake, log: quiet });
  const s = http.createServer((req, res) => api(req, res)); await new Promise(r => s.listen(0, '127.0.0.1', r));
  const port = s.address().port, body = '{"prompt":"hi"}'; let partial;
  try {
    const pending = new Promise((resolve, reject) => {
      partial = http.request({ host: '127.0.0.1', port, path: '/api/ai/sample', method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } }, res => {
        let data = ''; res.on('data', chunk => data += chunk); res.on('end', () => resolve({ status: res.statusCode, body: data }));
      });
      partial.on('error', reject); partial.write(body.slice(0, 5));
    });
    await new Promise(resolve => s.once('request', resolve));
    const switched = await fetch(`http://127.0.0.1:${port}/api/ai/config`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"provider":"anthropic"}' });
    assert.equal(switched.status, 200); partial.end(body.slice(5));
    const result = await pending; assert.equal(result.status, 403); assert.equal(JSON.parse(result.body).error.code, 'consent_required'); assert.equal(calls, 0);
  } finally { partial?.destroy(); s.close(); }
});
