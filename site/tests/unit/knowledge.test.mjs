import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import * as K from '../../src/chess/knowledge.js';

const fromPgn = pgn => { const c = new Chess(); c.loadPgn(pgn); return c; };
const tags = list => list.map(x => x.tag);
const features = (c, name) => K.positionFeatures(c, { ply: c.history().length, opening: name ? { name } : null });

const NAJDORF = '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6';
const IQP = '1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Nf3 c5 5. cxd5 Nxd5 6. e3 cxd4 7. exd4 Be7 8. Bd3 O-O 9. O-O Nc6 10. Re1 Nf6 11. a3 b6 12. Bc2';
const CARLSBAD = '1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. cxd5 exd5 5. Bg5 c6 6. e3 Be7 7. Bd3 O-O 8. Qc2 Nbd7 9. Nf3 Re8 10. O-O Nf8 11. Rab1';
const LUCENA = '1K6/1P1k4/8/8/8/8/r7/5R2 w - - 0 1';
const OCB = '8/5k2/4b3/3p4/3B4/4K3/8/8 w - - 0 1';

test('epd drops the move counters; pawnSignature keeps only the pawns', () => {
  const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
  assert.equal(K.epd(fen), 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3');
  assert.equal(K.pawnSignature(fen), '8/pppppppp/8/8/4P3/8/PPPP1PPP/8');
  assert.equal(K.pawnSignature(fromPgn(NAJDORF).fen()), '8/1p2pppp/p2p4/8/4P3/8/PPP2PPP/8');
});

test('material counts both sides', () => {
  assert.deepEqual(K.material(new Chess()), { w: 39, b: 39 });
  assert.deepEqual(K.material(new Chess(LUCENA)), { w: 6, b: 5 });
});

test('openingFamily maps names to families', () => {
  assert.equal(K.openingFamily('Sicilian Defense: Najdorf Variation'), 'sicilian');
  assert.equal(K.openingFamily("Queen's Gambit Declined: Exchange Variation"), 'queens-gambit');
  assert.equal(K.openingFamily(''), null);
  assert.equal(K.openingFamily('No Such Opening'), null);
});

test('position features: opening, phase and pawn structure', () => {
  const najdorf = tags(features(fromPgn(NAJDORF), 'Sicilian Defense: Najdorf Variation'));
  assert.ok(najdorf.includes('opening') && najdorf.includes('sicilian'), najdorf.join());

  const iqp = tags(features(fromPgn(IQP), "Queen's Gambit Declined: Semi-Tarrasch Defense"));
  assert.ok(iqp.includes('middlegame') && iqp.includes('iqp'), iqp.join());
  assert.ok(!iqp.includes('carlsbad'));

  const carlsbad = tags(features(fromPgn(CARLSBAD), "Queen's Gambit Declined: Exchange Variation"));
  assert.ok(carlsbad.includes('carlsbad'), carlsbad.join());
  assert.ok(!carlsbad.includes('iqp'));
});

test('position features: endgames', () => {
  const lucena = tags(features(new Chess(LUCENA)));
  for (const t of ['endgame', 'rook-endgame', 'rook-pawn-vs-rook', 'passed-pawn']) assert.ok(lucena.includes(t), `${t} in ${lucena}`);
  const ocb = tags(features(new Chess(OCB)));
  assert.ok(ocb.includes('ocb') && !ocb.includes('rook-endgame'), ocb.join());
});

test('every feature has a weight, a reason and a label', () => {
  for (const f of [...features(fromPgn(IQP), "Queen's Gambit Declined"), ...features(new Chess(LUCENA))]) {
    assert.ok(f.weight > 0 && f.why && K.TAG_LABELS[f.tag], JSON.stringify(f));
  }
});

test('retrieveLiterature ranks books by matching tags and points to the right chapter', () => {
  const hits = K.retrieveLiterature(features(fromPgn(IQP), "Queen's Gambit Declined"), { level: 2 });
  assert.ok(hits.length > 0 && hits.length <= 5);
  assert.ok(hits.every((h, i) => i === 0 || hits[i - 1].score >= h.score), 'sorted by score');
  const structures = hits.find(h => h.book.title === 'Chess Structures: A Grandmaster Guide');
  assert.equal(structures?.where, 'the Isolated Queen Pawn chapter');
  assert.deepEqual(K.retrieveLiterature([]), []);
  assert.equal(K.retrieveLiterature(features(new Chess(LUCENA)), { limit: 2 }).length, 2);
});

test('retrieveLiterature includes the user\'s own books', () => {
  const mine = { id: 'mine', title: 'My Rook Notes', level: 2, tags: ['rook-endgame'], user: true };
  const hits = K.retrieveLiterature(features(new Chess(LUCENA)), { userBooks: [mine], limit: 10 });
  assert.ok(hits.some(h => h.book === mine));
});

test('moveMotifs finds mates, back-rank mates and greek gifts', () => {
  assert.deepEqual(tags(K.moveMotifs(Chess, 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 2 3', 'f3f7')), ['mate', 'king-attack']);
  assert.ok(tags(K.moveMotifs(Chess, '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', 'a1a8')).includes('back-rank'));
  assert.ok(tags(K.moveMotifs(Chess, 'r1bq1rk1/pppn1ppp/4p3/3pP3/1b1P4/2NB1N2/PPP2PPP/R2QK2R w KQ - 0 8', 'd3h7')).includes('greek-gift'));
});

test('moveMotifs finds forks, pins and sacrifices', () => {
  assert.ok(tags(K.moveMotifs(Chess, 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', 'b5c7')).includes('fork'));
  assert.ok(tags(K.moveMotifs(Chess, '4k3/8/2n5/8/8/8/8/4KB2 w - - 0 1', 'f1b5')).includes('pin'));
  assert.ok(tags(K.moveMotifs(Chess, '4k3/8/8/8/8/2n5/8/R3K2Q b - - 0 1', 'c3d1')).includes('sacrifice'));
});

test('moveMotifs stays quiet on ordinary moves and ignores bad input', () => {
  assert.deepEqual(K.moveMotifs(Chess, new Chess().fen(), 'e2e4'), []);
  assert.deepEqual(K.moveMotifs(Chess, new Chess().fen(), 'e2e5'), []);
  assert.deepEqual(K.moveMotifs(Chess, new Chess().fen(), ''), []);
});

test('motif candidates cover skewers, double checks, material discoveries, interference and removing defenders', () => {
  const cases = [
    ['4r3/8/4k3/8/8/8/8/R6K w - - 0 1', 'e1', 'skewer'],
    ['4k3/8/q7/8/8/8/4B3/4R2K w - - 0 1', 'b5', 'double-check'],
    ['q6k/8/8/8/8/8/B6K/R7 w - - 0 1', 'b3', 'discovered-attack'],
    ['7k/8/2n5/8/3q4/5B2/8/3R3K w - - 0 1', 'c6', 'removing-defender'],
    ['4r2k/8/8/8/8/5B2/4n3/4R2K w - - 0 1', 'e4', 'interference'],
  ];
  for (const [fen, to, tag] of cases) {
    const c = new Chess(fen), m = c.moves({ verbose: true }).find(m => m.to === to);
    assert.ok(m, `${tag}: legal move`);
    const motifs = K.moveMotifs(Chess, fen, m.from + m.to);
    assert.ok(tags(motifs).includes(tag), `${tag}: ${JSON.stringify(motifs)}`);
    assert.ok(K.TAG_LABELS[tag]);
  }
  assert.deepEqual(K.moveMotifs(Chess, 'bad FEN', 'e2e4'), []);
});

test('line motifs identify concrete deflection, overloading, decoy and zwischenzug sequences', () => {
  const cases = [
    ['3r3k/8/8/8/3q4/8/8/2RR3K w - - 0 1', ['Rc8', 'Rxc8', 'Rxd4'], ['deflection', 'overloading']],
    ['r6k/6pp/8/4Q3/8/8/7K/1R6 w - - 0 1', ['Qb8+', 'Raxb8', 'Rxb8#'], ['decoy']],
    ['q3k3/8/8/8/8/8/7K/R4B2 w - - 0 1', ['Bb5+', 'Kd8', 'Rxa8+'], ['zwischenzug']],
  ];
  for (const [fen, sans, expected] of cases) {
    const c = new Chess(fen), ucis = sans.map(s => { const m = c.move(s); return m.from + m.to; });
    const motifs = K.lineMotifs(Chess, fen, ucis);
    for (const tag of expected) assert.ok(tags(motifs[0]).includes(tag), `${tag}: ${JSON.stringify(motifs)}`);
    assert.deepEqual(K.lineMotifs(Chess, fen, ucis.slice(0, 1)), [[]], 'a move alone does not establish a combination');
  }
  assert.deepEqual(K.lineMotifs(Chess, new Chess().fen(), ['e2e5']), []);
});

test('similarPositions finds the same position first, then the same pawn structure', () => {
  const positionsOf = pgn => {
    const c = new Chess(), out = [];
    for (const san of fromPgn(pgn).history()) { c.move(san); out.push({ epd: K.epd(c.fen()), pawns: K.pawnSignature(c.fen()), ply: c.history().length, san }); }
    return out;
  };
  const games = [{ id: 'a', positions: positionsOf(CARLSBAD) }, { id: 'b', positions: positionsOf(CARLSBAD) }, { id: 'c', positions: positionsOf(IQP) }];
  const index = K.buildPositionIndex(games);
  const fen = fromPgn(CARLSBAD).fen();
  const hits = K.similarPositions(index, fen, { excludeGameId: 'a' });
  assert.deepEqual(hits.map(h => [h.g.id, h.kind]), [['b', 'same position']]);
  // Same pawns, different pieces: only the structure matches, once per game.
  const moved = fromPgn(CARLSBAD); moved.remove('f8'); moved.put({ type: 'n', color: 'b' }, 'g6');
  assert.deepEqual(K.similarPositions(index, moved.fen()).map(h => [h.g.id, h.kind]), [['a', 'same pawn structure'], ['b', 'same pawn structure']]);
  assert.deepEqual(K.similarPositions(index, new Chess().fen()), []);
});

test('engine maths: win%, scores, move classes and accuracy', () => {
  assert.equal(K.winPct(0), 50);
  assert.ok(K.winPct(300) > 75 && K.winPct(-300) < 25);
  assert.equal(K.scoreToCp({ cp: 5000 }), 2000);
  assert.equal(K.scoreToCp({ mate: 2 }), 9980);
  assert.equal(K.scoreToCp({ mate: -2 }), -9980);
  assert.ok(K.scoreToCp({ mate: 1 }) > K.scoreToCp({ mate: 5 }), 'a quicker mate is better');
  assert.equal(K.scoreToCp(null), 0);
  assert.equal(K.classify(60, 59), 'good');
  assert.equal(K.classify(60, 52), 'inaccuracy');
  assert.equal(K.classify(60, 45), 'mistake');
  assert.equal(K.classify(60, 20), 'blunder');
  assert.equal(K.classify(60, 20, { isBest: true }), 'best');
  assert.equal(K.classify(60, 20, { isBook: true }), 'book');
  assert.ok(K.moveAccuracy(50, 50) > 99.9);
  assert.equal(K.moveAccuracy(90, 0), 0);
  assert.ok(K.moveAccuracy(50, 60) > 99.9, 'gaining win% is not penalised');
});

test('parseInfo reads depth, multipv, score, bound and pv', () => {
  assert.deepEqual(K.parseInfo('info depth 12 seldepth 17 multipv 2 score cp -34 nodes 1000 pv e7e5 g1f3'),
    { depth: 12, multipv: 2, score: { cp: -34 }, pv: ['e7e5', 'g1f3'] });
  assert.deepEqual(K.parseInfo('info depth 20 score mate -3 lowerbound pv h7h6'),
    { depth: 20, score: { mate: -3 }, bound: 'lowerbound', pv: ['h7h6'] });
});
