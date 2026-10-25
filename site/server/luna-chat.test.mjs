import test from 'node:test';
import assert from 'node:assert/strict';
import OpenAI from 'openai';
import { complete, createProvider, loadConfig, validateTools } from './ai.mjs';
import { completeJson, FORMATS } from './schema.mjs';
import { wire, annotations } from '../tests/fixtures/ai-wire.mjs';

function fixture(provider = 'openai', model = 'gpt-6-luna') {
  const requests = [];
  const client = new OpenAI({ apiKey: 'synthetic-luna-key', baseURL: 'https://fixture.invalid/v1', maxRetries: 0,
    fetch: async (url, init) => {
      assert.ok(String(url).startsWith('https://fixture.invalid/'));
      const body = JSON.parse(init.body); requests.push(body);
      const needsNone = provider === 'openai' && body.model === 'gpt-6-luna';
      if (needsNone && body.reasoning_effort !== 'none') return new Response(JSON.stringify({ error: { message: 'Synthetic policy: GPT-6 Luna requires reasoning_effort none.' } }), { status: 400, headers: { 'content-type': 'application/json' } });
      if (!needsNone && 'reasoning_effort' in body) throw Error('Unexpected reasoning parameter for another model/provider');
      return new Response(wire('openai', [body.response_format ? JSON.stringify(annotations) : 'OK']), { headers: { 'content-type': 'text/event-stream' } });
    } });
  const env = { AI_PROVIDER: provider, OPENAI_API_KEY: 'synthetic-luna-key', MISTRAL_API_KEY: 'synthetic-mistral-key',
    OPENAI_MODEL: model, MISTRAL_MODEL: model, OLLAMA_MODEL: model };
  return { requests, provider: createProvider(loadConfig(env), { client }) };
}
const question = [{ role: 'user', content: 'Explain development.' }];

test('real SDK sends supported Luna mode for ordinary chat, tiny connection replies and function offers', async () => {
  const f = fixture();
  for (const options of [{}, { maxTokens: 256 }, { tools: validateTools(['analyse']) }]) {
    const result = await complete(f.provider, question, options);
    assert.equal(result.text, 'OK');
    assert.equal(f.requests.at(-1).model, 'gpt-6-luna');
    assert.equal(f.requests.at(-1).reasoning_effort, 'none');
    assert.ok(!JSON.stringify(f.requests.at(-1)).includes('synthetic-luna-key'));
  }
  assert.equal(f.requests[1].max_completion_tokens, 256);
  assert.equal(f.requests[2].tools[0].function.name, 'analyse');
});

test('actual per-task model selects the mode; other models and compatible providers receive no unsupported parameter', async () => {
  for (const [provider, configured, selected] of [
    ['openai', 'gpt-4.1', 'gpt-6-luna'], ['openai', 'gpt-6-luna', 'gpt-4.1'],
    ['openai', 'gpt-6-luna', 'gpt-6-astra'], ['openai', 'gpt-6-luna', 'gpt-6-luna-custom'],
    ['mistral', 'gpt-6-luna', 'gpt-6-luna'], ['ollama', 'gpt-6-luna', 'gpt-6-luna'],
  ]) {
    const f = fixture(provider, configured);
    assert.equal((await complete(f.provider, question, { model: selected })).text, 'OK');
    assert.equal(f.requests[0].model, selected);
    assert.equal('reasoning_effort' in f.requests[0], provider === 'openai' && selected === 'gpt-6-luna');
  }
});

test('Luna native JSON and tool-result continuations preserve the supported mode without losing protocol fields', async () => {
  const f = fixture();
  const structured = await completeJson(f.provider, question, FORMATS.annotations);
  assert.deepEqual(structured.data, annotations);
  assert.equal(structured.mode, 'native');
  assert.equal(f.requests[0].response_format.type, 'json_schema');
  assert.equal(f.requests[0].reasoning_effort, 'none');
  const turns = [...question, { role: 'assistant', content: '', toolCalls: [{ id: 'call1', name: 'analyse', input: { fen: 'f' } }] },
    { role: 'tool', toolCallId: 'call1', content: '{"lines":[]}' }];
  assert.equal((await complete(f.provider, turns)).text, 'OK');
  assert.equal(f.requests[1].reasoning_effort, 'none');
  assert.equal(f.requests[1].messages[1].tool_calls[0].function.arguments, '{"fen":"f"}');
  assert.equal(f.requests[1].messages[2].tool_call_id, 'call1');
});
