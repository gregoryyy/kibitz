import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApi } from './api.mjs';
import { createEmbedder, loadConfig, loadEmbeddingConfig } from './ai.mjs';

/** Isolated cookie-scoped gateway; every SDK call is fake and no real provider is contacted. */
async function gateway(t, options = {}) {
  const seen = [], signals = [];
  const client = { async post(path, { body, signal }) { seen.push(body); signals.push(signal); return options.response ? options.response(body, signal) : { model: 'actual-v1', data: body.input.map((_, index) => ({ index, embedding: [1, index + 1] })), usage: { prompt_tokens: 12 } }; } };
  const embeddingConfig = loadEmbeddingConfig({ EMBEDDING_PROVIDER: 'openai', EMBEDDING_MODEL: 'vectors', EMBEDDING_REVISION: 'v1', OPENAI_API_KEY: 'server-secret', OPENAI_BASE_URL: 'https://private.invalid/v1', ...options.embeddingEnv });
  const config = loadConfig({ AI_PROVIDER: 'mock', AI_RATE_LIMIT_PER_MINUTE: '1000', ...options.env });
  const api = createApi({ allowInsecureHttp: true, config, embeddingConfig, embedder: createEmbedder(embeddingConfig, { client }) });
  const server = http.createServer(async (req, res) => { await api(req, res); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => { server.closeAllConnections(); return new Promise(r => server.close(r)); });
  const base = `http://127.0.0.1:${server.address().port}/api/ai/`;
  let cookie = '';
  const request = async (path, body, headers = {}, signal) => {
    const res = await fetch(base + path, { ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }), headers: { 'Content-Type': 'application/json', cookie, ...(path === 'embeddings' && body !== undefined ? { 'x-kibitz-consent': `v1:${embeddingConfig.provider}:embeddings` } : {}), ...headers }, signal });
    const next = res.headers.get('set-cookie'); if (next) cookie = next.split(';')[0];
    return { status: res.status, data: await res.json() };
  };
  const status = async () => (await request('embeddings')).data;
  const send = async (texts, descriptor = null, extra = {}) => { const d = descriptor || await status(); return request('embeddings', { texts, fingerprint: d.fingerprint, scope: d.scope, ...extra }); };
  return { request, status, send, seen, signals };
}

test('embedding endpoint exposes only safe metadata and counts the embedding provider as paid independently of chat', async t => {
  const g = await gateway(t), d = await g.status();
  assert.equal(d.provider, 'openai'); assert.equal(d.revision, 'v1'); assert.equal(d.available, true);
  assert.doesNotMatch(JSON.stringify(d), /server-secret|private.invalid/);
  const response = await g.send(['one', 'two'], d);
  assert.equal(response.status, 200); assert.deepEqual(response.data.vectors, [[1, 1], [1, 2]]);
  assert.equal(response.data.metadata.providerModel, 'actual-v1'); assert.equal(response.data.metadata.dimensions, 2);
  assert.equal(response.data.user.paid.tokens, 12);
  assert.deepEqual(g.seen[0], { model: 'vectors', input: ['one', 'two'], encoding_format: 'float' });
  const other = await g.request('embeddings', undefined, { cookie: 'kibitz_dev_uid=abcdefghijklmnopqrstuv' });
  assert.notEqual(other.data.scope, d.scope);
  assert.equal((await g.request('embeddings', { texts: ['mine'], fingerprint: d.fingerprint, scope: d.scope }, { cookie: 'kibitz_dev_uid=abcdefghijklmnopqrstuv' })).status, 409); assert.equal(g.seen.length, 1);
});

test('source identifiers cannot select another owner and malformed, cross-origin or oversized requests never reach a provider', async t => {
  const g = await gateway(t), d = await g.status();
  assert.equal((await g.send(['text'], d, { owner: 'someone-else' })).status, 409);
  assert.equal((await g.send(['text'], { ...d, fingerprint: 'old' })).status, 409);
  assert.equal((await g.send([''])).status, 400);
  assert.equal((await g.send(Array(17).fill('text'))).status, 413);
  assert.equal((await g.send(['x'.repeat(8001)])).status, 413);
  assert.equal((await g.request('embeddings', { texts: ['text'], fingerprint: d.fingerprint, scope: d.scope }, { origin: 'https://evil.invalid' })).status, 403);
  assert.equal(g.seen.length, 0);
});

test('local-only blocks cloud embedding even with a local chat provider, and embedding credentials are never substituted', async t => {
  const cfg = loadEmbeddingConfig({ EMBEDDING_PROVIDER: 'openai', OPENAI_API_KEY: 'cloud-key', AI_LOCAL_ONLY: 'true', OLLAMA_MODEL: 'chat' });
  assert.equal(cfg.provider, 'openai'); assert.equal(cfg.apiKey, 'cloud-key'); assert.equal(cfg.baseURL, 'https://api.openai.com/v1');
  const g = await gateway(t, { env: { AI_LOCAL_ONLY: 'true' } });
  assert.equal((await g.status()).available, false); assert.equal((await g.send(['private'])).status, 503); assert.equal(g.seen.length, 0);
});

test('Ollama cloud relays and unknown model metadata are refused before any text is sent', async () => {
  let calls = 0;
  const cfg = loadEmbeddingConfig({ EMBEDDING_PROVIDER: 'ollama', EMBEDDING_MODEL: 'alias', OLLAMA_BASE_URL: 'https://localhost:11434' });
  const client = { post: async () => { calls++; return { data: [{ index: 0, embedding: [1, 0] }] }; } };
  const local = { details: { format: 'gguf' }, model_info: { 'general.architecture': 'bert' }, capabilities: ['embedding'] };
  for (const info of [{}, { ...local, remote_host: 'ollama.com', remote_model: 'remote' }, { ...local, capabilities: ['completion'] }]) {
    const e = createEmbedder(cfg, { client, inspectModel: async () => info });
    await assert.rejects(e.embed(['private']), { code: 'forbidden' });
  }
  assert.equal(calls, 0);
  const e = createEmbedder(cfg, { client, inspectModel: async () => local });
  assert.deepEqual(await e.embed(['private']), [[1, 0]]); assert.equal(calls, 1);
});

test('shared token budgets apply to paid embeddings and invalid provider data is rejected', async t => {
  const g = await gateway(t, { env: { AI_TOKEN_BUDGET_PER_USER_PER_DAY: '10' } });
  assert.equal((await g.send(['first'])).status, 200); assert.equal((await g.send(['second'])).status, 429); assert.equal(g.seen.length, 1);
  for (const data of [[{ index: 1, embedding: [1, 0] }], [{ index: 0, embedding: [0, 0] }], [{ index: 0, embedding: [1, NaN] }], [{ index: 0, embedding: ['1', 0] }]]) {
    const invalid = await gateway(t, { response: () => ({ data }) });
    const r = await invalid.send(['text']); assert.equal(r.status, 502); assert.equal(r.data.error.code, 'provider_error');
  }
});

test('changing local-only policy aborts accepted cloud work; a late result cannot return vectors', async t => {
  let finish, started;
  const ready = new Promise(r => { started = r; });
  const g = await gateway(t, { response: (body, signal) => new Promise(resolve => { finish = () => resolve({ data: [{ index: 0, embedding: [1, 0] }], usage: { prompt_tokens: 1 } }); started(signal); }) });
  const d = await g.status(), pending = g.send(['private'], d), signal = await ready;
  assert.equal((await g.send(['another'], d)).status, 429);
  assert.equal((await g.request('config', { localOnly: true })).status, 200); assert.equal(signal.aborted, true);
  finish(); const r = await pending; assert.equal(r.status, 499); assert.equal(r.data.vectors, undefined);
});

test('a disconnected browser aborts embedding work and absent provider usage is conservatively estimated', async t => {
  let started;
  const ready = new Promise(r => { started = r; });
  const g = await gateway(t, { response: (body, signal) => new Promise((resolve, reject) => { started(signal); signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true }); }) });
  const d = await g.status(), ctl = new AbortController();
  const request = g.request('embeddings', { texts: ['private'], fingerprint: d.fingerprint, scope: d.scope }, {}, ctl.signal);
  const signal = await ready; ctl.abort(); await assert.rejects(request, { name: 'AbortError' });
  for (let i = 0; i < 20 && !signal.aborted; i++) await new Promise(r => setTimeout(r, 10));
  assert.equal(signal.aborted, true);
  const estimated = await gateway(t, { response: () => ({ data: [{ index: 0, embedding: [1, 0] }] }) });
  const result = await estimated.send(['ä']); assert.equal(result.data.usage.input, 3); assert.equal(result.data.usage.estimated, true);
});
