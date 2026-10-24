import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { compileLibraryGame } from '../../src/library/library.js';
import { ownPuzzleCandidates, prepareOwnPuzzle, checkOwnPuzzle } from '../../src/player/mistake-puzzles.js';
const START = 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1';
const after = (fen, uci) => { const c = new Chess(fen); c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }); return c.fen(); };
const point = (cp, pv) => ({ basis: 'engine', depth: 14, score: { cp }, pv });
const analysis = (cp, pv, extra = {}) => ({ depth: 14, lines: [{ score: { cp }, pv }], ...extra });
async function candidate({ start = START, side = 'w', actual = 'e1e2', best = 'b5c7', reply = ['e8d7', 'c7a8'], actualReply = ['a8a1'], scope = 'owner-a' } = {}) {
  const c = new Chess(start); const played = c.move({ from: actual.slice(0, 2), to: actual.slice(2, 4), promotion: actual[4] });
  const report = { version: 1, engine: 'Stockfish', start, ucis: [actual], side, decisions: [{ ply: 1,
    before: point(side === 'w' ? 500 : -500, [best, ...reply]), after: point(0, actualReply), phase: 'endgame', motif: { status: 'not-checked', proof: null } }] };
  const g = { id: 'own', kind: 'played', played: true, reviewed: true, userColor: side, pgn: c.pgn(), analysisReview: report, title: played.san };
  const snapshot = await compileLibraryGame(Chess, g, 'library'), record = { g, snapshot };
  return { item: ownPuzzleCandidates(Chess, [record], { scope })[0], record };
}
function engineFor(item, { best = item.decision.before.pv[0], reference = 0, original = -500, referencePv = ['e8d7', 'c7a8'], originalPv = ['a8a1'], overrides = new Map() } = {}) {
  const data = new Map([[item.fen, analysis(reference, [best, ...referencePv])], [after(item.fen, best), analysis(reference, referencePv)], [after(item.fen, item.decision.uci), analysis(original, originalPv)], ...overrides]), calls = [];
  return { calls, data, engine: async fen => { calls.push(fen); return data.get(fen) || null; }, current: () => true };
}

test('only compatible measured own mistakes produce scoped candidates; source prose and unsupported reports do not', async () => {
  const { item, record } = await candidate(), b = ownPuzzleCandidates(Chess, [record], { scope: 'owner-b' });
  assert.ok(item); assert.notEqual(item.key, b[0].key); assert.equal(item.occurrence.ply, 0);
  for (const g of [{ ...record.g, kind: 'study' }, { ...record.g, analysisReview: undefined, cls: ['blunder'], summary: 'Missed mate' }, { ...record.g, analysisReview: { version: 99 } }]) assert.deepEqual(ownPuzzleCandidates(Chess, [{ g, snapshot: record.snapshot }], { scope: 'owner-a' }), []);
  assert.throws(() => ownPuzzleCandidates(Chess, [record])); assert.throws(() => ownPuzzleCandidates(Chess, [record], { scope: 'owner-a', limit: 51 }));
});

test('fresh reference and original-child checks prepare a stable positional exercise without changing its source', async () => {
  const { item } = await candidate(), options = engineFor(item), source = JSON.stringify([item.g, item.snapshot]), prepared = await prepareOwnPuzzle(Chess, item, options);
  assert.equal(prepared.kind, 'ready'); assert.equal(prepared.puzzle.best, 'b5c7'); assert.equal(options.calls.length, 3); assert.match(prepared.puzzle.id, /^mistake-[0-9a-f]{64}$/);
  assert.equal(JSON.stringify([item.g, item.snapshot]), source); assert.equal((await prepareOwnPuzzle(Chess, item, engineFor(item))).puzzle.id, prepared.puzzle.id);
});

test('a move outside the suggested PV can qualify at the target boundary; the recorded mistake remains below target', async () => {
  const { item } = await candidate(), options = engineFor(item), { puzzle } = await prepareOwnPuzzle(Chess, item, options);
  options.data.set(after(item.fen, 'e1d2'), analysis(-50, ['a8a1']));
  assert.equal((await checkOwnPuzzle(Chess, puzzle, 'Kd2', options)).kind, 'accepted');
  assert.equal((await checkOwnPuzzle(Chess, puzzle, 'Ke2', options)).kind, 'below-target');
  options.data.set(after(item.fen, 'e1d2'), analysis(-51, ['a8a1'])); assert.equal((await checkOwnPuzzle(Chess, puzzle, 'Kd2', options)).kind, 'below-target');
  const calls = options.calls.length; assert.equal((await checkOwnPuzzle(Chess, puzzle, 'e1e5', options)).kind, 'invalid'); assert.equal(options.calls.length, calls);
});

test('missing or shallow grading evidence is unverified, and a changed position/search cannot publish an old result', async () => {
  const { item } = await candidate(), options = engineFor(item), { puzzle } = await prepareOwnPuzzle(Chess, item, options);
  assert.equal((await checkOwnPuzzle(Chess, puzzle, 'Kd2', options)).kind, 'unverified');
  options.data.set(after(item.fen, 'e1d2'), analysis(0, ['a8a1'], { depth: 5 })); assert.equal((await checkOwnPuzzle(Chess, puzzle, 'Kd2', options)).kind, 'unverified');
  let active = true; const stale = { current: () => active, engine: async fen => { active = false; return options.data.get(fen); } };
  assert.equal((await prepareOwnPuzzle(Chess, item, stale)).kind, 'cancelled');
});

test('current searches that no longer support the old error do not create a puzzle', async () => {
  const { item } = await candidate();
  assert.equal((await prepareOwnPuzzle(Chess, item, engineFor(item, { original: -99 }))).kind, 'outdated');
  assert.equal((await prepareOwnPuzzle(Chess, item, engineFor(item, { best: 'e1e2', referencePv: ['a8a1'] }))).kind, 'outdated');
});

test('Black promotions ask for an explicit piece and accept another qualified underpromotion', async () => {
  const start = '7k/8/8/8/8/8/p7/7K b - - 0 1', { item } = await candidate({ start, side: 'b', actual: 'h8g8', best: 'a2a1q', reply: ['h1h2'], actualReply: ['h1h2'] });
  const options = engineFor(item, { best: 'a2a1q', reference: -700, original: 0, referencePv: ['h1h2'], originalPv: ['h1h2'] });
  const { puzzle } = await prepareOwnPuzzle(Chess, item, options); assert.ok(puzzle);
  assert.equal((await checkOwnPuzzle(Chess, puzzle, 'a2a1', options)).kind, 'promotion');
  options.data.set(after(start, 'a2a1r'), analysis(-650, ['h1h2'])); assert.equal((await checkOwnPuzzle(Chess, puzzle, 'a2a1r', options)).kind, 'accepted');
  assert.equal((await checkOwnPuzzle(Chess, puzzle, 'a2a1n', options)).kind, 'below-target');
});

test('an actual mate succeeds by rules; a winning-mate target does not accept an ordinary centipawn score', async () => {
  const start = '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', { item } = await candidate({ start, actual: 'a1a7', best: 'a1a8', reply: [], actualReply: ['g8f8'] });
  const options = engineFor(item, { best: 'a1a8', reference: 1000, original: 0, referencePv: [], originalPv: ['g8f8'] });
  const { puzzle } = await prepareOwnPuzzle(Chess, item, options); assert.ok(puzzle); assert.equal(puzzle.reference.basis, 'rules');
  const mate = await checkOwnPuzzle(Chess, puzzle, 'Ra8#', options); assert.equal(mate.kind, 'accepted'); assert.equal(mate.basis, 'rules-mate');
  options.data.set(after(start, 'a1b1'), analysis(2000, ['g8f8'])); assert.equal((await checkOwnPuzzle(Chess, puzzle, 'Rb1', options)).kind, 'below-target');
});
