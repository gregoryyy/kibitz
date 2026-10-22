// Paid runs ask first (scripts/paid.mjs): the plan names the models and the calls, and only a paid
// provider needs --yes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAID, paidPlan, mayRun, statusModels } from '../../scripts/paid.mjs';

test('a run with a paid coach or judge needs --yes; free providers run without', () => {
  const coach = { role: 'coach', provider: 'anthropic', models: ['claude-haiku-5-5'], calls: 10 };
  const judge = { role: 'judge', provider: 'anthropic', models: ['claude-haiku-5-5'], calls: 10 };
  assert.equal(mayRun([coach], false), false);
  assert.equal(mayRun([coach], true), true);
  assert.equal(mayRun([{ ...coach, provider: 'ollama' }, { ...judge, provider: 'mistral' }], false), false, 'a paid judge counts');
  for (const provider of ['mock', 'ollama', 'browser']) assert.equal(mayRun([{ ...coach, provider }], false), true, provider);
  assert.equal(mayRun([{ ...coach, calls: 0 }], false), true, 'no calls, nothing to pay');
  assert.deepEqual(PAID, ['anthropic', 'openai', 'mistral']);
});

test('the plan names each role, its models once, the calls and whether they are paid', () => {
  assert.deepEqual(paidPlan([
    { role: 'coach', provider: 'anthropic', models: ['claude-haiku-5-5', 'claude-haiku-5-5', 'claude-sonnet-5-5'], calls: 10 },
    { role: 'judge', provider: 'ollama', models: [''], calls: 1 },
  ]), [
    'coach: anthropic (claude-haiku-5-5, claude-sonnet-5-5), about 10 calls, paid',
    'judge: ollama (the default model), about 1 call, free',
  ]);
  assert.deepEqual(statusModels({ models: { quick: 'a', chat: 'b', review: 'c' } }), ['a', 'b', 'c']);
  assert.deepEqual(statusModels({ model: 'm' }), ['m']);
});
