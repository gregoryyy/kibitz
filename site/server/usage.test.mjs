import { test } from 'node:test';
import assert from 'node:assert/strict';
import { costOf, parsePrices, usageLedger, userLedger } from './usage.mjs';

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

test('costOf: dollars per million tokens, null without a price', () => {
  const p = parsePrices('m1=1/5');
  assert.equal(costOf(p, 'm1', { input: 1_000_000, output: 200_000 }), 2);
  assert.equal(costOf(p, 'other', { input: 10, output: 10 }), null);
});

test('userLedger: each user has their own totals; paid usage counts against their budgets', () => {
  const l = userLedger({ tokensPerDay: 100, costPerDay: 1, prices: parsePrices('m1=1000/1000') });
  assert.equal(l.add('a', 'm1', { input: 40, output: 10 }), 0.05);
  assert.equal(l.add('a', 'local', { input: 500, output: 500 }, { paid: false }), null);
  const a = l.today('a');
  assert.deepEqual([a.requests, a.input, a.output, a.cost, a.unpricedTokens], [2, 540, 510, 0.05, 1000]);
  assert.deepEqual([a.paid, a.left], [{ tokens: 50, cost: 0.05 }, { tokens: 50, cost: 0.95 }]);
  assert.deepEqual(l.today('b').paid, { tokens: 0, cost: 0 });
  l.check('a'); l.check('nobody');
  l.add('a', 'm1', { input: 50, output: 0 });
  assert.throws(() => l.check('a'), { code: 'budget_exceeded' });
  l.check('b');
});

test('userLedger: the cost budget; unpriced paid models count only towards tokens', () => {
  const l = userLedger({ costPerDay: 0.01, prices: parsePrices('m1=1000/1000') });
  l.add('a', 'unpriced', { input: 1e6, output: 0 });
  l.check('a');
  assert.equal(l.today('a').cost, null);
  l.add('a', 'm1', { input: 10, output: 0 }); // $0.01
  assert.throws(() => l.check('a'), /\$0\.01 on paid models/);
});

test('userLedger: a new day starts every user at zero; past maxUsers, the oldest goes', () => {
  let t = new Date(2026, 9, 21, 23, 59).getTime();
  const l = userLedger({ tokensPerDay: 10, now: () => t, maxUsers: 2 });
  l.add('a', 'm', { input: 10, output: 0 });
  assert.throws(() => l.check('a'));
  t += 2 * 60_000;
  l.check('a');
  assert.equal(l.today('a').requests, 0);
  l.add('a', 'm', { input: 1 }); l.add('b', 'm', { input: 1 }); l.add('c', 'm', { input: 1 });
  assert.deepEqual(['a', 'b', 'c'].map(u => l.today(u).requests), [0, 1, 1]);
});
