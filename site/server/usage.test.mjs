import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePrices, usageLedger } from './usage.mjs';

test('prices: model=input/output per million tokens; malformed parts are skipped', () => {
  const p = parsePrices('claude-haiku-5-5=1/5, gpt-6-luna = 0.4 / 1.6,broken,x=1');
  assert.deepEqual([...p.keys()], ['claude-haiku-5-5', 'gpt-6-luna']);
  assert.deepEqual(p.get('gpt-6-luna'), { input: 0.4, output: 1.6 });
  assert.equal(parsePrices('').size, 0);
});

test('ledger: totals per day, cost from known prices, unpriced tokens counted apart', () => {
  const l = usageLedger({ prices: parsePrices('m1=1/5') });
  assert.deepEqual(l.today().cost, 0, 'nothing used yet');
  l.add('m1', { input: 1_000_000, output: 100_000 });
  l.add('m2', { input: 10, output: 5 });
  const t = l.today();
  assert.equal(t.requests, 2); assert.equal(t.input, 1_000_010); assert.equal(t.output, 100_005);
  assert.equal(t.cost, 1.5); assert.equal(t.unpricedTokens, 15);
  assert.equal(t.budget, null); assert.equal(t.left, null);
  const unpriced = usageLedger(); unpriced.add('m', { input: 3, output: 4 });
  assert.equal(unpriced.today().cost, null, 'no price for anything used: unknown, not zero');
});

test('budget: requests are refused once today\'s tokens reach it; it resets the next day', () => {
  let t = new Date(2026, 9, 20, 23, 0).getTime();
  const l = usageLedger({ tokensPerDay: 100, now: () => t });
  l.check(); l.add('m', { input: 60, output: 30 });
  assert.equal(l.today().left, 10);
  l.check(); l.add('m', { input: 20, output: 0 });
  assert.throws(() => l.check(), { code: 'budget_exceeded', status: 429 });
  t = new Date(2026, 9, 21, 0, 1).getTime();
  l.check();
  assert.equal(l.today().day, '2026-10-21'); assert.equal(l.today().input, 0);
});
