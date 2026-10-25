import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { createApi } from './api.mjs';
import { createEmbedder, createProvider, loadConfig, loadEmbeddingConfig } from './ai.mjs';
import { toolsUnsupported } from '../src/coach/coach-tools.js';

for (const name of ['anthropic', 'openai', 'mistral', 'ollama']) test(`${name}: reflected HTTP 400 prose stays private on all AI routes, with safe tool feedback`, async t => {
  const key = 'dummyMistralCredential0123456789abcd', privateText = key + ' PROMPT_PRIVATE https://private.invalid/path?account=ACCOUNT_PRIVATE\nFORGED_EVENT';
  let reason = privateText, requests = 0;
  const logs = [], fetcher = async () => {
    requests++;
    return new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: reason } }), { status: 400, headers: { 'content-type': 'application/json' } });
  };
  const client = provider => {
    const opts = { apiKey: key, baseURL: 'https://fixture.invalid/v1', fetch: fetcher, maxRetries: 0, logger: { debug() {}, info() {}, warn() {}, error() {} } };
    return provider === 'anthropic' ? new Anthropic(opts) : new OpenAI(opts);
  };
  const config = loadConfig({ AI_PROVIDER: name, ANTHROPIC_API_KEY: key, OPENAI_API_KEY: key, MISTRAL_API_KEY: key, OLLAMA_MODEL: 'fixture-model', AI_RATE_LIMIT_PER_MINUTE: '1000', AI_RATE_LIMIT_PER_USER_PER_MINUTE: '1000' });
  const embeddingConfig = loadEmbeddingConfig({ EMBEDDING_PROVIDER: 'mistral', MISTRAL_API_KEY: key });
  const api = createApi({ allowInsecureHttp: true, config, provider: createProvider(config, { client: client(name) }), embeddingConfig,
    embedder: createEmbedder(embeddingConfig, { client: client('mistral') }), log: { info: line => logs.push(line), error: line => logs.push(line) } });
  const server = http.createServer((req, res) => api(req, res)); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}/api/ai/`; let cookie = '';
  const request = async (action, body) => {
    const response = await fetch(base + action, { ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }), headers: {
      cookie, 'content-type': 'application/json', 'x-kibitz-consent': `v1:${action === 'embeddings' ? 'mistral:embeddings' : name + ':coach'}` } });
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    return { status: response.status, text: await response.text() };
  };
  const identity = JSON.parse((await request('embeddings')).text);
  for (const kind of ['unknown', 'tools', 'schema']) {
    reason = (kind === 'tools' ? 'Model does not support tools. ' : kind === 'schema' ? 'Invalid tool schema. ' : '') + privateText;
    for (const [action, body] of [
      ['sample', { prompt: 'question' }], ['test', {}], ['structured', { prompt: 'question', format: 'annotations' }],
      ['embeddings', { texts: ['note'], scope: identity.scope, fingerprint: identity.fingerprint }],
    ]) {
      const result = await request(action, body);
      assert.equal(result.status, action === 'sample' ? 200 : 502);
      const error = JSON.parse(result.text.trim().split('\n').at(-1)).error;
      assert.equal(error.code, 'provider_rejected'); assert.equal(toolsUnsupported(error), kind === 'tools');
      for (const marker of [key, 'PROMPT_PRIVATE', 'private.invalid', 'ACCOUNT_PRIVATE', 'FORGED_EVENT']) assert.equal((result.text + logs.join('\n')).includes(marker), false);
      assert.ok(error.message.length < 150);
    }
  }
  assert.equal(requests, 15); // Per kind: three single attempts plus native/fallback structured attempts.
  assert.equal(JSON.parse((await request('status')).text).usage.requests, 0);
});
