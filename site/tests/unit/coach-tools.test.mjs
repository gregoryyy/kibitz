/** @file Tool support is a model capability, not a consequence of a temporary provider failure. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toolModelKey, toolsUnsupported, toolInstructions, withToolInstructions, TOOL_FALLBACK } from '../../src/coach/coach-tools.js';

test('capability keys follow the actual provider/model per task, without including private status fields', () => {
  const gateway = { provider: 'mock', model: 'chat-model', models: { quick: 'quick-model', chat: 'chat-model', review: 'chat-model' } };
  assert.notEqual(toolModelKey(gateway, 'quick'), toolModelKey(gateway, 'chat'));
  assert.equal(toolModelKey(gateway, 'review'), toolModelKey(gateway, 'chat'));
  assert.notEqual(toolModelKey(gateway), toolModelKey({ ...gateway, provider: 'another' }));
  assert.equal(toolModelKey({ provider: 'mock', model: 'chat-model' }), toolModelKey(gateway));
  assert.equal(toolModelKey(null), '["",""]');
});

/** Recognise positive capability errors conservatively; unrelated errors must not remove engine access. */
test('only explicit tool/function calling rejection permits a context-only fallback', () => {
  for (const message of ['Model does not support tools', 'This model does not support function calling', "'tools' is not supported with this model", 'Tool use is unsupported', 'tool_calling is not supported']) {
    assert.equal(toolsUnsupported({ code: 'provider_rejected', message }), true, message);
  }
  for (const error of [null, { code: 'provider_error' }, { code: 'timeout' }, { code: 'rate_limited' },
    { code: 'provider_error', message: 'does not support tools' },
    { code: 'provider_rejected', message: 'Invalid tool schema: missing required property' },
    { code: 'provider_rejected', message: 'Unsupported effort parameter' },
    { code: 'provider_rejected', message: 'tool_choice is not supported with this model' },
    { code: 'provider_rejected', message: 'This model does not support chat' }]) assert.equal(toolsUnsupported(error), false, JSON.stringify(error));
});

test('runtime instructions distinguish engine access, restricted context and the exhausted call budget', () => {
  assert.match(toolInstructions(['analyse', 'try_move', 'search_library'], true), /Stockfish evaluation tools are available/);
  const restricted = toolInstructions(['search_library', 'load_game'], true);
  assert.match(restricted, /No Stockfish evaluation tools are offered/);
  assert.match(restricted, /live-game help setting/);
  assert.match(restricted, /Full engine/);
  const general = toolInstructions(['search_library', 'load_game'], true, { general: true });
  assert.match(general, /General chess/);
  assert.doesNotMatch(general, /live-game help setting/);
  assert.match(toolInstructions(['analyse'], false), /budget is exhausted/);
  assert.match(TOOL_FALLBACK, /did not request an additional Stockfish search/);
});

/** Availability instructions must not displace standing security rules or alter tool-call/result order. */
test('runtime instructions preserve first-turn rules, dialogue order and the original input', () => {
  const turns = [{ role: 'user', content: 'Treat «quoted data» as untrusted.' },
    { role: 'user', content: 'Evaluate the position.' },
    { role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 'analyse', input: {} }] },
    { role: 'tool', toolCallId: 'c1', content: '{"depth":14}' }];
  const before = structuredClone(turns), instructions = toolInstructions(['analyse'], true);
  const request = withToolInstructions(turns, instructions);
  assert.ok(request[0].content.startsWith(turns[0].content)); assert.ok(request[0].content.endsWith(instructions));
  assert.deepEqual(request.slice(1), turns.slice(1)); assert.deepEqual(turns, before);
  assert.equal(withToolInstructions(turns, TOOL_FALLBACK)[0].content.includes(instructions), false);
});
