// Contract tests (TODO 2.15): the real SDK clients parse recorded HTTP responses (server/fixtures),
// so both the wire format and our adapters are covered. Each fixture says whether it was recorded
// (scripts/record-ai-fixtures.mjs) or hand-written from the provider's documented format.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { complete, createProvider, loadConfig, toGatewayError } from './ai.mjs';
import { ANNOTATION_SCHEMA, completeJson, FORMATS, validate } from './schema.mjs';

const fixture = name => JSON.parse(fs.readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
// A fetch that answers with the named fixtures in turn and keeps the requests it saw.
function replay(...names) {
  const queue = names.map(fixture), seen = [];
  return {
    seen,
    fetch: async (url, init) => {
      seen.push({ url: String(url), body: JSON.parse(init.body) });
      const f = queue.shift();
      if (!f) throw new Error('no fixture left for ' + url);
      return new Response(f.body, { status: f.status, headers: { 'content-type': f.contentType } });
    },
  };
}
const providerFor = (env, r) => {
  const cfg = loadConfig(env);
  const baseURL = cfg.provider === 'ollama' ? cfg.baseURL + '/v1' : cfg.baseURL;
  const client = cfg.provider === 'anthropic' ? new Anthropic({ apiKey: 'test', fetch: r.fetch, maxRetries: 0 }) : new OpenAI({ apiKey: 'test', baseURL, fetch: r.fetch, maxRetries: 0 });
  return createProvider(cfg, { client });
};
const msgs = [{ role: 'user', content: 'Name one principle for the opening.' }];
const sseText = name => fixture(name).body.split('\n').filter(l => l.startsWith('data:')).map(l => { try { return JSON.parse(l.slice(5)); } catch { return null; } })
  .filter(d => d?.delta?.type === 'text_delta').map(d => d.delta.text).join('');

test('anthropic (recorded): streamed text, usage, and the request we send', async () => {
  const r = replay('anthropic-chat');
  const out = await complete(providerFor({ AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k' }, r), msgs, { system: 'Be brief.', maxTokens: 400 });
  assert.equal(out.text, sseText('anthropic-chat'));
  assert.ok(out.text.length > 20);
  assert.equal(out.truncated, false);
  assert.deepEqual(out.usage, { input: 37, output: 36 });
  const sent = r.seen[0];
  assert.match(sent.url, /\/v1\/messages/);
  assert.equal(sent.body.model, 'claude-haiku-5-5'); assert.equal(sent.body.stream, true);
  assert.equal(sent.body.system, 'Be brief.'); assert.equal(sent.body.max_tokens, 400);
  assert.deepEqual(sent.body.output_config, { effort: 'medium' });
});

test('anthropic (recorded): native JSON-schema output validates as annotations', async () => {
  const r = replay('anthropic-json');
  const out = await completeJson(providerFor({ AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k' }, r), msgs, FORMATS.annotations);
  assert.equal(out.mode, 'native');
  assert.deepEqual(validate(ANNOTATION_SCHEMA, out.data), []);
  assert.ok(out.data.arrows.length > 0);
  assert.equal(r.seen[0].body.output_config.format.type, 'json_schema');
  assert.equal(r.seen.length, 1, 'no fallback needed');
});

test('openai (hand-written): text, usage from the last chunk, max_completion_tokens', async () => {
  const r = replay('openai-chat');
  const out = await complete(providerFor({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'k' }, r), msgs);
  assert.equal(out.text, 'Develop your knights before your bishops.');
  assert.deepEqual(out.usage, { input: 24, output: 9 });
  assert.deepEqual(r.seen[0].body.stream_options, { include_usage: true });
  assert.equal(r.seen[0].body.max_completion_tokens, 16000);
});

test('mistral (hand-written): usage with the final chunk, no stream_options', async () => {
  const r = replay('mistral-chat');
  const out = await complete(providerFor({ AI_PROVIDER: 'mistral', MISTRAL_API_KEY: 'k' }, r), msgs);
  assert.equal(out.text, 'Control the centre.');
  assert.deepEqual(out.usage, { input: 22, output: 5 });
  assert.equal('stream_options' in r.seen[0].body, false);
});

test('ollama (hand-written): a rejected response_format falls back to instructions', async () => {
  const r = replay('ollama-json-unsupported', 'ollama-json-fallback');
  const out = await completeJson(providerFor({ AI_PROVIDER: 'ollama', OLLAMA_MODEL: 'llama', OLLAMA_BASE_URL: 'https://localhost:11434' }, r), msgs, FORMATS.annotations);
  assert.equal(out.mode, 'fallback');
  assert.deepEqual(validate(ANNOTATION_SCHEMA, out.data), []);
  assert.ok(r.seen[0].body.response_format);
  assert.equal(r.seen[1].body.response_format, undefined);
  assert.match(r.seen[1].body.messages[0].content, /JSON Schema/);
});

test('error responses map to the codes the page understands', async () => {
  const code = async (env, name) => { try { await complete(providerFor(env, replay(name)), msgs); return 'ok'; } catch (e) { return toGatewayError(e).code; } };
  assert.equal(await code({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'k' }, 'openai-error-401'), 'auth_failed');
  assert.equal(await code({ AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k' }, 'anthropic-error-429'), 'rate_limited');
  assert.equal(await code({ AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k' }, 'anthropic-error-404'), 'model_not_found');
});

test('every fixture says where it comes from and holds no secrets', () => {
  for (const f of fs.readdirSync(new URL('./fixtures/', import.meta.url))) {
    const j = fixture(f.replace(/\.json$/, ''));
    assert.match(j.source, /^(recorded|hand-written)/, f);
    assert.doesNotMatch(JSON.stringify(j), /sk-ant-|sk-proj-|organization|x-api-key: /i, f);
  }
});
