import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApi } from './api.mjs';
import { loadConfig, loadEmbeddingConfig } from './ai.mjs';

test('gateway refuses missing/wrong-purpose/wrong-provider consent before SDK work, including connection tests and embeddings', async t => {
  const calls = [], provider = { async *chat() { calls.push('coach'); yield 'OK'; return { usage: { input: 1, output: 1 } }; } };
  const config = loadConfig({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'fake', MISTRAL_API_KEY: 'fake' });
  const embeddingConfig = loadEmbeddingConfig({ EMBEDDING_PROVIDER: 'mistral', MISTRAL_API_KEY: 'fake', EMBEDDING_MODEL: 'embed' });
  const embedder = { async embedBatch() { calls.push('embedding'); return { usage: { input: 1, output: 0 }, vectors: [[1, 0]], providerModel: 'embed' }; } };
  const api = createApi({ config, provider, makeProvider: () => provider, embeddingConfig, embedder, log: { error() {} } });
  const server = http.createServer((req, res) => api(req, res)); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}/api/ai/`; let cookie = '';
  const request = async (path, body = undefined, consent = '') => {
    const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', cookie, 'x-kibitz-consent': consent }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    return response;
  };
  for (const path of ['sample', 'structured', 'test']) for (const consent of ['', 'v1:mistral:coach', 'v1:openai:embeddings', 'v99:openai:coach']) {
    const response = await request(path, { prompt: 'PRIVATE' }, consent); assert.equal(response.status, 403); assert.equal((await response.json()).error.code, 'consent_required');
  }
  assert.deepEqual(calls, []); assert.equal((await (await request('status')).json()).usage.requests, 0);
  const permitted = await request('test', {}, 'v1:openai:coach'); assert.equal(permitted.status, 200); await permitted.json(); assert.deepEqual(calls, ['coach']);
  const d = await (await request('embeddings')).json(), body = { texts: ['PRIVATE'], fingerprint: d.fingerprint, scope: d.scope };
  for (const consent of ['', 'v1:openai:embeddings', 'v1:mistral:coach']) assert.equal((await request('embeddings', body, consent)).status, 403);
  assert.equal((await request('embeddings', body, 'v1:mistral:embeddings')).status, 200); assert.deepEqual(calls, ['coach', 'embedding']);
  assert.equal((await request('config', { provider: 'mistral' })).status, 200);
  assert.equal((await request('test', {}, 'v1:openai:coach')).status, 403); assert.deepEqual(calls, ['coach', 'embedding']);
});
