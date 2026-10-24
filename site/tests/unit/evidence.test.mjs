import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { analysisPoint, terminalPoint } from '../../src/chess/evidence.js';
const result = (extra = {}, first = {}) => ({ depth: 14, lines: [{ score: { cp: 25 }, pv: ['e2e4', 'e7e5'], ...first }], ...extra });

test('an exact line qualifies at its own depth, independently of deeper sibling PVs', () => {
  const c = new Chess();
  assert.equal(analysisPoint(Chess, c, result({}, { depth: 5 })), null);
  assert.equal(analysisPoint(Chess, c, result({}, { depth: 6 })).depth, 6);
  assert.equal(analysisPoint(Chess, c, result({}, { depth: 15 })), null);
  assert.equal(analysisPoint(Chess, c, result()).depth, 14);
});

test('bound, malformed, noncanonical, illegal or unscored PVs cannot become qualified evidence', () => {
  const c = new Chess();
  for (const first of [{ bound: 'lowerbound' }, { score: { cp: NaN } }, { score: { mate: 0 } }, { score: { cp: 100001 } }, { score: { cp: 0, mate: 1 } }, { pv: [] }, { pv: ['e2e5'] }, { pv: ['e4'] }]) assert.equal(analysisPoint(Chess, c, result({}, first)), null);
  const promotion = new Chess('7k/P7/8/8/8/8/8/7K w - - 0 1');
  assert.equal(analysisPoint(Chess, promotion, result({}, { pv: ['a7a8'] })), null);
  assert.ok(analysisPoint(Chess, promotion, result({}, { pv: ['a7a8q'] })));
});

test('rules facts use the supplied complete history, without inventing a terminal engine PV', () => {
  const c = new Chess('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1'); c.move('Ra8#');
  assert.deepEqual(analysisPoint(Chess, c, null), { basis: 'rules', depth: 0, score: { cp: 10000 }, pv: [] });
  const repeated = new Chess(); repeated.loadPgn('1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3 Nf6 4. Ng1 Ng8');
  assert.equal(terminalPoint(repeated).score.cp, 0); assert.equal(terminalPoint(new Chess(repeated.fen())), null);
});

test('qualified values are detached from the engine response', () => {
  const input = result(), point = analysisPoint(Chess, new Chess(), input); point.pv.push('fake'); point.score.cp = 400;
  assert.deepEqual(input.lines[0].pv, ['e2e4', 'e7e5']); assert.equal(input.lines[0].score.cp, 25);
});
