// Explanation modes (TODO 3.9): interesting moves and challenges, on fixed engine lines.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { describeMove, interestingMoves, interestingLines, flipSide, makeChallenge, checkChallenge, recordResult } from '../../src/chess/modes.js';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
// The Opera Game after 9... b5, White to move (scores from White's point of view, as the page keeps them).
const OPERA = 'rn2kb1r/p3qppp/2p2n2/1p2p1B1/2B1P3/1QN5/PPP2PPP/R3K2R w KQkq - 0 10';
const OPERA_LINES = [
  { pv: ['c3b5', 'e7b4', 'b3b4', 'f8b4', 'c2c3'], score: { cp: 420 } },
  { pv: ['g5f6', 'e7f6', 'c3b5'], score: { cp: 156 } },
  { pv: ['c4d3', 'b8d7'], score: { cp: 34 } },
];
const line = (uci, cp, rest = []) => ({ pv: [uci, ...rest], score: { cp } });

test('describeMove: a piece left to be taken that the engine doesn\'t take is a trap', () => {
  const d = describeMove(Chess, OPERA, OPERA_LINES[0]);
  assert.equal(d.san, 'Nxb5');
  assert.ok(d.tags.includes('forcing') && d.tags.includes('trap'), d.tags.join());
  assert.match(d.why, /knight on b5 to be taken \(cxb5\), but that isn't the engine's choice for Black/);
});

test('describeMove: material given up in the engine\'s own line is a sacrifice', () => {
  // Légal's mate: 5. Nxe5 lets Black take the queen, and the engine's line goes on to mate.
  const fen = new Chess(); 'e4 e5 Bc4 d6 Nf3 Bg4 Nc3 g6'.split(' ').forEach(m => fen.move(m));
  const d = describeMove(Chess, fen.fen(), { pv: ['f3e5', 'g4d1', 'c4f7', 'e8e7', 'c3d5'], score: { mate: 2 } });
  assert.ok(d.tags.includes('sacrifice'), d.tags.join());
  assert.match(d.why, /gives up material/);
});

test('interestingMoves: within the window, picked for a reason, with rank and evaluation', () => {
  const r = interestingMoves(Chess, OPERA, OPERA_LINES, { windowCp: 300 });
  assert.equal(r.best.san, 'Nxb5');
  assert.deepEqual(r.picks.map(p => [p.san, p.rank, p.eval, p.gap]), [['Bxf6', 2, '+1.56', 264]]);
  assert.ok(r.picks[0].tags.includes('different-plan'));
  assert.equal(interestingMoves(Chess, OPERA, OPERA_LINES, { windowCp: 100 }).picks.length, 0, 'outside the window');
  const lines = interestingLines(r);
  assert.match(lines[0], /alternatives to the best move Nxb5 \(\+4\.20/);
  assert.match(lines[1], /Bxf6: rank 2, \+1\.56, 2\.64 below the best\. different plan/);
});

test('interestingMoves: a quiet move only counts when the best move is forcing; Black\'s scores are turned', () => {
  const r = interestingMoves(Chess, START, [line('e2e4', 30), line('d2d4', 25), line('g1f3', 20)]);
  assert.deepEqual(r.picks.map(p => p.san), ['Nf3'], 'd4 is another quiet pawn move in the centre, like e4');
  const black = interestingMoves(Chess, 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', [line('c7c5', 30), line('g8f6', 40)]);
  assert.equal(black.best.eval, '−0.30', 'for the side to move');
  assert.deepEqual(black.picks.map(p => [p.san, p.gap]), [['Nf6', 10]]);
  assert.deepEqual(interestingMoves(Chess, START, []), { best: null, picks: [] });
});

test('challenge "best": any move within 30 cp counts; answers are parsed like typed moves', () => {
  const ch = makeChallenge(Chess, { fen: START, lines: [line('e2e4', 30), line('d2d4', 25), line('g1f3', 0), line('a2a4', -40)], kind: 'best' });
  assert.match(ch.prompt, /best move for White/);
  assert.equal(checkChallenge(Chess, ch, 'e4').correct, true);
  assert.equal(checkChallenge(Chess, ch, 'nf3').correct, true, 'lowercase piece, within 30 cp');
  const wrong = checkChallenge(Chess, ch, 'a4');
  assert.deepEqual([wrong.valid, wrong.correct], [true, false]);
  assert.match(wrong.verdict, /Not quite: a4 isn't it\. Stockfish plays e4 \(\+0\.30 for White\)/);
  assert.equal(checkChallenge(Chess, ch, 'Ke2').valid, false);
});

test('challenge "choose": only with a clearly worse second move; the better one is right', () => {
  assert.equal(makeChallenge(Chess, { fen: START, lines: [line('e2e4', 30), line('a2a4', -40)], kind: 'choose' }), null);
  const ch = makeChallenge(Chess, { fen: START, lines: [line('e2e4', 30), line('h2h4', -80)], kind: 'choose', seed: 1 });
  assert.deepEqual(ch.options, ['h4', 'e4']);
  assert.match(ch.prompt, /^h4 or e4\? Which is better for White\?$/);
  assert.equal(checkChallenge(Chess, ch, 'e4').correct, true);
  assert.equal(checkChallenge(Chess, ch, 'h4').correct, false);
});

test('challenge "threat": the opponent\'s move if they could move now; only a real threat', () => {
  // 1. e4 e5 2. Qh5 Nc6 3. Bc4: White threatens Qxf7#.
  const c = new Chess(); 'e4 e5 Qh5 Nc6 Bc4'.split(' ').forEach(m => c.move(m));
  const fen = c.fen();
  const flipped = flipSide(Chess, fen);
  assert.equal(flipped.split(' ')[1], 'w');
  const ch = makeChallenge(Chess, { fen, lines: [line('g7g6', 30)], threatLines: [{ pv: ['h5f7'], score: { mate: 1 } }], kind: 'threat' });
  assert.match(ch.prompt, /What does White threaten/);
  assert.equal(ch.answerSan, 'Qxf7#');
  assert.equal(ch.theme, 'mate');
  assert.equal(ch.eval, 'it would give White mate');
  assert.equal(checkChallenge(Chess, ch, 'Qxf7').correct, true);
  assert.equal(checkChallenge(Chess, ch, 'Bxf7+').correct, false);
  assert.equal(makeChallenge(Chess, { fen, lines: [line('g7g6', 30)], threatLines: [line('d2d3', 40)], kind: 'threat' }), null, 'no real threat');
  assert.equal(flipSide(Chess, '4k3/8/8/8/8/8/4q3/4K3 w - - 0 1'), null, 'side to move in check');
  // White mates in one; Black, to move in the flipped position, has nothing: a big score for White isn't Black's threat.
  const mateIn1 = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1';
  assert.equal(makeChallenge(Chess, { fen: mateIn1, lines: [{ pv: ['a1a8'], score: { mate: 1 } }], threatLines: [line('g8f8', 500, ['g1f1'])], kind: 'threat' }), null);
  // Winning material along the line is a threat: in the Opera Game after 9... b5, Black would take the bishop.
  const t = makeChallenge(Chess, { fen: OPERA, lines: OPERA_LINES, threatLines: [{ pv: ['b5c4', 'b3c4', 'e7b4'], score: { cp: -470 } }], kind: 'threat' });
  assert.equal(t.answerSan, 'bxc4');
  assert.equal(t.eval, 'it would give Black +4.70');
});

test('recordResult counts right answers and tries per theme', () => {
  let p = recordResult({}, 'fork', true);
  p = recordResult(p, 'fork', false);
  p = recordResult(p, 'mate', true);
  assert.deepEqual(p, { fork: { right: 1, tries: 2 }, mate: { right: 1, tries: 1 } });
});
