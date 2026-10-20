import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProvider, loadConfig } from './ai.mjs';
import { ANNOTATION_SCHEMA, FORMATS, completeJson, exampleFor, parseJsonReply, providerSchema, validate } from './schema.mjs';

const good = { text: 'Nf3 develops.', arrows: [{ from: 'g1', to: 'f3', kind: 'best' }], highlights: [{ square: 'e5', kind: 'target' }] };
const msgs = [{ role: 'user', content: 'Annotate.' }];

test('annotation schema: valid replies pass, broken ones say why', () => {
  assert.deepEqual(validate(ANNOTATION_SCHEMA, good), []);
  assert.match(validate(ANNOTATION_SCHEMA, { ...good, arrows: [{ from: 'z9', to: 'f3', kind: 'best' }] }).join(), /from: doesn't match/);
  assert.match(validate(ANNOTATION_SCHEMA, { ...good, arrows: [{ from: 'g1', to: 'f3', kind: 'nuke' }] }).join(), /not one of/);
  assert.match(validate(ANNOTATION_SCHEMA, { text: 'x', arrows: [] }).join(), /highlights: missing/);
  assert.match(validate(ANNOTATION_SCHEMA, { ...good, html: '<script>' }).join(), /html: not allowed/);
  assert.match(validate(ANNOTATION_SCHEMA, { ...good, arrows: Array(9).fill(good.arrows[0]) }).join(), /more than 8/);
  assert.match(validate(ANNOTATION_SCHEMA, { ...good, text: 'x'.repeat(2001) }).join(), /longer than 2000/);
  assert.match(validate(ANNOTATION_SCHEMA, []).join(), /expected object, got array/);
  assert.deepEqual(validate({ type: 'integer', minimum: 1 }, 0), ['$: below 1']);
  assert.deepEqual(validate({ type: 'integer' }, 1.5), ['$: expected integer, got number']);
});

test('provider schema drops the keywords strict modes reject; enums stay', () => {
  const p = providerSchema(ANNOTATION_SCHEMA);
  const json = JSON.stringify(p);
  for (const k of ['maxLength', 'maxItems', 'pattern']) assert.ok(!json.includes(k), k);
  assert.deepEqual(p.properties.arrows.items.properties.kind.enum, ['best', 'threat', 'plan', 'mistake']);
  assert.equal(p.additionalProperties, false);
  assert.ok(JSON.stringify(ANNOTATION_SCHEMA).includes('pattern'), 'the original is left alone');
});

test('JSON is found in plain replies, code fences and prose', () => {
  assert.deepEqual(parseJsonReply(JSON.stringify(good)), good);
  assert.deepEqual(parseJsonReply('```json\n' + JSON.stringify(good) + '\n```'), good);
  assert.deepEqual(parseJsonReply('Here you go: ' + JSON.stringify(good) + ' Hope it helps!'), good);
  assert.throws(() => parseJsonReply('No JSON here.'), { code: 'bad_output' });
  assert.throws(() => parseJsonReply('[1, 2]'), { code: 'bad_output' });
  assert.deepEqual(validate(ANNOTATION_SCHEMA, exampleFor(ANNOTATION_SCHEMA)), [], 'the mock example is valid');
});

// Providers whose replies a test scripts: native output first, then the fallback call.
function scripted(...replies) {
  const calls = [];
  return { calls, async *chat(m, opts) { calls.push(opts); const r = replies.shift(); if (r instanceof Error) throw r; yield r; return { truncated: false, usage: { input: 10, output: 5 } }; } };
}

test('completeJson: native JSON output is used when it validates', async () => {
  const p = scripted(JSON.stringify(good));
  const r = await completeJson(p, msgs, FORMATS.annotations);
  assert.deepEqual(r, { data: good, truncated: false, usage: { input: 10, output: 5 }, mode: 'native' });
  assert.equal(p.calls[0].schema, FORMATS.annotations);
});

test('completeJson: invalid native output or a rejected format falls back to instructions', async () => {
  const p = scripted('{"text": 1}', 'Sure! ' + JSON.stringify(good));
  const r = await completeJson(p, msgs, FORMATS.annotations, { system: 'Be a coach.' });
  assert.equal(r.mode, 'fallback'); assert.deepEqual(r.data, good); assert.deepEqual(r.usage, { input: 20, output: 10 });
  assert.equal(p.calls[1].schema, undefined);
  assert.match(p.calls[1].system, /^Be a coach\.\n\nReply with one JSON object/);
  const rejected = scripted(Object.assign(new Error('response_format not supported'), { status: 400 }), JSON.stringify(good));
  assert.equal((await completeJson(rejected, msgs, FORMATS.annotations)).mode, 'fallback');
});

test('completeJson: other errors are not retried; a bad fallback is bad_output', async () => {
  await assert.rejects(completeJson(scripted(Object.assign(new Error('bad key'), { status: 401 })), msgs, FORMATS.annotations), { status: 401 });
  await assert.rejects(completeJson(scripted('nope', 'still nope'), msgs, FORMATS.annotations), { code: 'bad_output' });
  await assert.rejects(completeJson(scripted('{}', '{"text":"x","arrows":[],"highlights":[],"extra":1}'), msgs, FORMATS.annotations), /extra: not allowed/);
});

test('providers are asked for JSON natively: Anthropic output_config.format, others response_format', async () => {
  const anthropic = { calls: [], beta: { messages: { stream(params) { anthropic.calls.push(params); return { async *[Symbol.asyncIterator]() {}, finalMessage: async () => ({ stop_reason: 'end_turn' }) }; } } } };
  await completeJson(createProvider(loadConfig({ AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k' }), { client: anthropic }), msgs, FORMATS.annotations).catch(() => {});
  assert.equal(anthropic.calls[0].output_config.effort, 'medium');
  assert.equal(anthropic.calls[0].output_config.format.type, 'json_schema');
  assert.equal(anthropic.calls[0].output_config.format.schema.properties.text.type, 'string');
  const openai = { calls: [], chat: { completions: { async create(params) { openai.calls.push(params); return (async function* () { yield { choices: [{ delta: { content: JSON.stringify(good) }, finish_reason: 'stop' }] }; })(); } } } };
  const r = await completeJson(createProvider(loadConfig({ AI_PROVIDER: 'mistral', MISTRAL_API_KEY: 'k' }), { client: openai }), msgs, FORMATS.annotations);
  assert.equal(r.mode, 'native');
  assert.deepEqual(Object.keys(openai.calls[0].response_format.json_schema).sort(), ['name', 'schema', 'strict']);
  assert.equal(openai.calls[0].response_format.json_schema.name, 'board_annotations');
});

test('the mock provider answers structured requests with a valid example', async () => {
  const r = await completeJson(createProvider(loadConfig({ AI_PROVIDER: 'mock' })), msgs, FORMATS.annotations);
  assert.equal(r.mode, 'native');
  assert.deepEqual(validate(ANNOTATION_SCHEMA, r.data), []);
});
