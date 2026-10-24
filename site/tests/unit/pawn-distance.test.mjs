import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { pawnSignature } from '../../src/chess/knowledge.js';
import { pawnSquares, comparePawns, PAWN_DISTANCE_POLICY } from '../../src/library/pawn-distance.js';
import { buildHybridIndex, searchHybrid } from '../../src/library/hybrid-search.js';

/** Move pawn placements in a checked source diagram, without claiming a legal connecting line. */
function diagram(changes = [], fen) {
  const c = new Chess(fen);
  for (const [from, to] of changes) { const p = c.remove(from); if (to) c.put(p, to); }
  return c.fen();
}
const entry = (id, fen, extra = {}) => ({ id, kind: 'annotation', language: 'und', title: 'Source', text: 'Source diagram.', sourceId: id, documentId: id, revision: 'r1', sourceTitle: '', author: '', licence: '', locator: { format: 'pgn', start: 0, end: 15, unit: 'utf-16' }, occurrenceId: id, annotationId: id, fen, ply: 0, gameId: id, collection: 'library', guideId: null, ...extra });
const positional = (index, fen, maximum = 0.25, extra = {}) => searchHybrid(index, 'analogy', { fen, maxPawnDistance: maximum, limit: 20, ...extra }).filter(h => h.evidence.board);

test('pawn signatures decode exact coloured squares, including doubled pawns, with bounded geometry validation', () => {
  assert.deepEqual(pawnSquares('8/2p5/8/3P4/3P4/8/8/8'), ['b:c7', 'w:d4', 'w:d5']);
  assert.equal(pawnSquares(pawnSignature(new Chess().fen())).length, 16);
  for (const bad of ['', '8/8', '9/8/8/8/8/8/8/8', '8/8/8/8/8/8/8/P8', '8/8/8/8/8/8/8/N7', '8/'.repeat(100)]) assert.throws(() => pawnSquares(bad));
});

test('independent overlap arithmetic preserves colours, empty sets and directional difference explanations', () => {
  const a = ['w:a2', 'w:b2', 'b:a7'], b = ['w:a3', 'w:b2', 'b:a7'];
  assert.deepEqual(comparePawns(a, b), { distance: 0.5, shared: 2, total: 4, onlyQuery: ['w:a2'], onlySource: ['w:a3'] });
  assert.equal(comparePawns(['w:a2'], ['b:a2']).distance, 1);
  assert.equal(comparePawns(['w:a2'], ['w:h2']).distance, 1);
  assert.equal(comparePawns([], []).distance, 0); assert.equal(comparePawns([], a).distance, 1);
  assert.deepEqual(comparePawns(b, a).onlySource, ['w:a2']); assert.deepEqual(a, ['w:a2', 'w:b2', 'b:a7']);
});

test('invalid or duplicate tokens are refused, and outputs cannot mutate the input features', () => {
  for (const bad of [['w:a2', 'w:a2'], ['a2'], ['w:i2'], ['w:a9'], [null], Array(65).fill('w:a2')]) assert.throws(() => comparePawns(bad, []));
  const input = ['w:a2'], out = comparePawns(input, ['w:a3']); out.onlyQuery[0] = 'b:h7'; assert.deepEqual(input, ['w:a2']);
});

test('distance satisfies identity, symmetry and triangle bounds over an independently enumerated feature universe', () => {
  const universe = ['w:a2', 'w:b2', 'b:a7'], sets = Array.from({ length: 8 }, (_, mask) => universe.filter((_, i) => mask & 1 << i));
  const popcount = n => n.toString(2).replaceAll('0', '').length;
  for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) {
    const d = comparePawns(sets[a], sets[b]).distance, union = popcount(a | b);
    assert.equal(d, union ? popcount(a ^ b) / union : 0);
    assert.equal(d, comparePawns(sets[b], sets[a]).distance); assert.equal(d === 0, a === b);
    for (let c = 0; c < 8; c++) assert.ok(d <= comparePawns(sets[a], sets[c]).distance + comparePawns(sets[c], sets[b]).distance + 1e-12);
  }
});

test('opt-in distance adds graded pawn candidates after exact matches, ordered by overlap rather than insertion', () => {
  const fen = new Chess().fen();
  const entries = [entry('a-two', diagram([['a2', 'a3'], ['b2', 'b3']])), entry('b-one', diagram([['a2', 'a3']])),
    entry('c-missing', diagram([['a2', null]])), entry('far', diagram([['a2', 'a3'], ['b2', 'b3'], ['c2', 'c3']])), entry('z-exact', fen)];
  const index = buildHybridIndex(Chess, entries);
  assert.deepEqual(positional(index, fen, 0).map(h => h.passage.id), ['z-exact']);
  const hits = positional(index, fen);
  assert.deepEqual(hits.map(h => h.passage.id), ['z-exact', 'c-missing', 'b-one', 'a-two']);
  const one = hits.find(h => h.passage.id === 'b-one');
  assert.deepEqual(one.evidence.pawn, { distance: 2 / 17, shared: 15, total: 17, onlyQuery: ['w:a2'], onlySource: ['w:a3'] });
  assert.equal(one.evidence.board, 'near-pawns'); assert.equal(PAWN_DISTANCE_POLICY.nearby, 0.25);
});

test('turn/check/phase compatibility and nonempty pawns remain separate eligibility checks', () => {
  const fen = new Chess().fen(), checked = new Chess(); checked.remove('b8'); checked.put({ color: 'b', type: 'n' }, 'd3');
  const bare = new Chess(); for (const row of bare.board()) for (const p of row) if (p && !['p', 'k'].includes(p.type)) bare.remove(p.square);
  const index = buildHybridIndex(Chess, [entry('black', diagram([['a2', 'a3']]).replace(' w ', ' b ')), entry('checked', checked.fen()), entry('endgame', bare.fen())]);
  assert.deepEqual(positional(index, fen), []);
  const empty = buildHybridIndex(Chess, [entry('empty', '4k3/8/8/8/8/8/8/4K3 w - - 0 1')]);
  assert.deepEqual(positional(empty, '7k/8/8/8/8/8/8/K7 w - - 0 1'), []);
  assert.equal(positional(empty, '4k3/8/8/8/8/8/8/4K3 w - - 2 9')[0].evidence.board, 'exact');
});

test('cutoff includes its exact boundary, sparse one-square advances expose the metric limitation, and rights retain exact identity', () => {
  const three = '4k3/8/8/8/8/8/PPP5/4K3 w - - 0 1', four = three.replace('PPP5', 'PPPP4');
  const index = buildHybridIndex(Chess, [entry('three', three)]);
  assert.equal(positional(index, four, 0.25)[0].evidence.pawn.distance, 0.25); assert.deepEqual(positional(index, four, 0.249), []);
  const sparse = buildHybridIndex(Chess, [entry('single', '4k3/8/8/8/8/8/5P2/4K3 w - - 0 1')]);
  assert.deepEqual(positional(sparse, '4k3/8/8/8/8/5P2/8/4K3 w - - 0 1'), []);
  const rights = buildHybridIndex(Chess, [entry('rights', new Chess().fen().replace('KQkq', '-'))]);
  assert.equal(positional(rights, new Chess().fen(), 0)[0].evidence.board, 'pawns');
});

test('scope restrictions precede fuzzy matching, limits are validated, and result explanations remain detached', () => {
  const fen = new Chess().fen(), close = diagram([['a2', 'a3']]);
  const index = buildHybridIndex(Chess, [entry('mine', close), entry('classic', close, { collection: 'classic' })]);
  assert.deepEqual(positional(index, fen, 0.25, { collection: 'library' }).map(h => h.passage.id), ['mine']);
  for (const maximum of [-1, NaN, Infinity, 1.1]) assert.throws(() => positional(index, fen, maximum));
  positional(index, fen)[0].evidence.pawn.onlySource[0] = 'w:h7';
  assert.deepEqual(positional(index, fen)[0].evidence.pawn.onlySource, ['w:a3']);
});
