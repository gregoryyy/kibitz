import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { compileLibraryGame } from '../../src/library/library.js';
import { positionFeatures, TAG_LABELS } from '../../src/chess/knowledge.js';
import { PATTERN_VERSION, buildPatternIndex, patternMatches } from '../../src/library/patterns.js';
const compile = (fen, moves = '', extra = {}, collection = 'library') => compileLibraryGame(Chess, { id: 'source', kind: 'study', pgn: (fen ? `[SetUp "1"]\n[FEN "${fen}"]\n\n` : '') + moves + ' *', ...extra }, collection);
const all = snapshot => snapshot.occurrences.flatMap(o => o.patterns);
const indexOf = (...snapshots) => buildPatternIndex(snapshots.map(s => ({ id: s.document.localId, collection: s.document.collection, positions: s.occurrences })));
const query = (snapshot, tag, options = {}) => patternMatches(indexOf(snapshot), { tag, ...options });

test('source positions carry versioned detector themes, not declared tags, comments, NAGs or opening names', async () => {
  const snapshot = await compile('1K6/1P1k4/8/8/8/8/r7/5R2 w - - 0 1', '{Fork! Forced mate!} 1. Rc1 $1', { tags: ['fork', 'mate'], patterns: [{ tag: 'mate', status: 'rules' }] });
  for (const tag of ['endgame', 'rook-endgame', 'rook-pawn-vs-rook', 'passed-pawn']) assert.ok(query(snapshot, tag).length, tag);
  assert.equal(query(snapshot, 'fork').length, 0); assert.equal(query(snapshot, 'mate').length, 0);
  assert.ok(all(snapshot).every(p => p.version === PATTERN_VERSION && TAG_LABELS[p.tag] && p.why && p.weight > 0));
  assert.ok(snapshot.annotations.every(a => a.verification === 'unverified'));
  const imported = await compile(null, '1. e4 e5', { pgn: '[Opening "Sicilian Defense"]\n\n1. e4 e5 *' });
  assert.equal(query(imported, 'sicilian').length, 0);
});

test('the initial board and early standard-start source plies are opening heuristics; custom clocks do not establish an opening', async () => {
  assert.equal(positionFeatures(new Chess(), { standardStart: true, ply: 0 })[0].tag, 'opening');
  const source = await compile(null, '1. e4 e5');
  assert.ok(source.occurrences.every(o => o.patterns.some(p => p.tag === 'opening' && p.status === 'heuristic')));
  const custom = await compile('r2qk2r/ppp2ppp/2n1bn2/3pp3/3PP3/2N1BN2/PPP2PPP/R2QK2R w KQkq - 0 1');
  assert.equal(query(custom, 'opening').length, 0); assert.ok(query(custom, 'middlegame').length);
  assert.equal(query(await compile(new Chess().fen().replace('0 1', '40 42')), 'opening').length, 0);
});

test('an unsound recorded fork remains a candidate even when the next legal move captures the forking piece', async () => {
  const s = await compile('rb2k3/8/8/1N6/8/8/8/4K3 w - - 0 1', '1. Nc7+ Bxc7');
  const [hit] = query(s, 'fork'); assert.equal(hit.pattern.role, 'move'); assert.equal(hit.pattern.status, 'candidate');
  assert.deepEqual(hit.pattern.ucis, ['b5c7']); assert.deepEqual(hit.pattern.fens, s.occurrences.slice(0, 2).map(o => o.fen));
  assert.equal(hit.pattern.startOccurrenceId, s.occurrences[0].id); assert.equal(hit.pattern.endOccurrenceId, s.occurrences[1].id);
  assert.equal(s.problem.verification, 'legal-replay-only'); assert.equal(query(s, 'fork', { status: 'rules' }).length, 0);
});

test('named pawn structures come from the replayed source board and retain their own occurrence identity', async () => {
  const cases = [
    ['1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Nf3 c5 5. cxd5 Nxd5 6. e3 cxd4 7. exd4 Be7 8. Bd3 O-O 9. O-O Nc6 10. Re1 Nf6 11. a3 b6 12. Bc2', 'iqp'],
    ['1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. cxd5 exd5 5. Bg5 c6 6. e3 Be7 7. Bd3 O-O 8. Qc2 Nbd7 9. Nf3 Re8 10. O-O Nf8 11. Rab1', 'carlsbad'],
  ];
  for (const [line, tag] of cases) {
    const snapshot = await compile(null, line), last = snapshot.occurrences.at(-1);
    assert.ok(last.patterns.some(p => p.tag === tag && p.role === 'position' && p.status === 'heuristic'));
    for (const { p, pattern } of query(snapshot, tag)) { assert.equal(pattern.occurrenceId, p.id); assert.deepEqual(pattern.fens, [p.fen]); assert.deepEqual(pattern.ucis, []); }
  }
});

test('actual checkmate and each promotion are rules facts; related tactical labels stay candidates', async () => {
  const mate = await compile('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', '1. Ra8#');
  assert.equal(query(mate, 'mate')[0].pattern.status, 'rules'); assert.equal(query(mate, 'back-rank')[0].pattern.status, 'candidate');
  for (const piece of ['Q', 'R', 'B', 'N']) {
    const s = await compile('7k/P7/8/8/8/8/8/7K w - - 0 1', `1. a8=${piece}`);
    assert.equal(query(s, 'promotion')[0].pattern.status, 'rules'); assert.equal(query(s, 'mate').length, 0);
    assert.equal(query(s, 'promotion')[0].pattern.ucis[0], 'a7a8' + piece.toLowerCase());
  }
});

test('three-ply combinations retain their complete source branch and do not arise from a truncated score', async () => {
  const fen = '3r3k/8/8/8/3q4/8/8/2RR3K w - - 0 1', full = await compile(fen, '1. Rc8 Rxc8 2. Rxd4');
  for (const tag of ['deflection', 'overloading']) {
    const [hit] = query(full, tag); assert.equal(hit.p.ply, 1); assert.equal(hit.pattern.status, 'candidate');
    assert.deepEqual(hit.pattern.ucis, ['c1c8', 'd8c8', 'd1d4']); assert.equal(hit.pattern.fens.length, 4);
    assert.equal(hit.pattern.endOccurrenceId, full.occurrences[3].id); assert.deepEqual(hit.pattern.labels, ['1. Rc8', '1… Rxc8', '2. Rxd4']);
    assert.equal(query(await compile(fen, '1. Rc8 Rxc8'), tag).length, 0);
  }
});

test('the move and line detector vocabulary is preserved with conservative candidate status', async () => {
  const cases = [
    ['4k3/8/2n5/8/8/8/8/4KB2 w - - 0 1', '1. Bb5', ['pin']],
    ['4r3/8/4k3/8/8/8/8/R6K w - - 0 1', '1. Re1+', ['skewer']],
    ['4k3/8/q7/8/8/8/4B3/4R2K w - - 0 1', '1. Bb5+', ['double-check', 'discovered-attack']],
    ['7k/8/2n5/8/3q4/5B2/8/3R3K w - - 0 1', '1. Bxc6', ['removing-defender']],
    ['4r2k/8/8/8/8/5B2/4n3/4R2K w - - 0 1', '1. Be4', ['interference']],
    ['r6k/6pp/8/4Q3/8/8/7K/1R6 w - - 0 1', '1. Qb8+ Raxb8 2. Rxb8#', ['decoy']],
    ['q3k3/8/8/8/8/8/7K/R4B2 w - - 0 1', '1. Bb5+ Kd8 2. Rxa8+', ['zwischenzug']],
    ['r1bq1rk1/pppn1ppp/4p3/3pP3/1b1P4/2NB1N2/PPP2PPP/R2QK2R w KQ - 0 8', '8. Bxh7+', ['greek-gift']],
  ];
  for (const [fen, moves, tags] of cases) for (const tag of tags) assert.ok(query(await compile(fen, moves), tag).some(h => h.pattern.status === 'candidate'), tag);
});

test('pattern records retain occurrence context across repeats, source revisions and equal collection-local IDs', async () => {
  const moves = Array.from({ length: 7 }, (_, n) => `${n * 2 + 1}. Nf3 Nf6 ${n * 2 + 2}. Ng1 Ng8`).join(' ');
  const s = await compile(null, moves), changed = await compile(null, moves + ' {Changed note.}'), classic = await compile(null, moves, {}, 'classic');
  assert.equal(s.occurrences[0].epd, s.occurrences[24].epd);
  assert.ok(s.occurrences[0].patterns.some(p => p.tag === 'opening')); assert.ok(s.occurrences[24].patterns.some(p => p.tag === 'middlegame'));
  assert.notEqual(s.occurrences[0].patterns[0].id, changed.occurrences[0].patterns[0].id);
  const index = indexOf(s, classic), hits = patternMatches(index, { tag: 'middlegame', collection: 'classic', documentId: classic.document.id });
  assert.ok(hits.length); assert.ok(hits.every(h => h.g.collection === 'classic' && h.p.documentId === classic.document.id));
  assert.equal(patternMatches(indexOf(changed), { tag: 'opening' }).some(h => h.pattern.id === s.occurrences[0].patterns[0].id), false);
});

test('bounded typed pattern queries reject bad filters, leave undetected known tags empty and do not index raw game claims', async () => {
  const s = await compile(null, '1. e4 e5'), index = indexOf(s);
  assert.equal(patternMatches(index, { tag: 'opening', limit: 1 }).length, 1);
  assert.equal(patternMatches(index, { tag: 'opening', role: 'move' }).length, 0);
  assert.equal(patternMatches(index, { tag: 'fork' }).length, 0);
  assert.equal(buildPatternIndex([{ tags: ['mate'], patterns: [{ tag: 'mate' }] }]).byTag.size, 0);
  for (const input of [{}, { tag: '__proto__' }, { tag: 'opening', status: 'confirmed' }, { tag: 'mate', limit: 21 }, { tag: 'mate', role: 'text' }, { tag: 'mate', collection: 'someone' }, { tag: 'mate', documentId: {} }]) assert.throws(() => patternMatches(index, input));
  await assert.rejects(() => compile(null, '1. e4 e5 2. Qxe8'));
});
