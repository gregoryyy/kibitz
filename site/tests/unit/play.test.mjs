import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import {
  gameEnd, cannotMate, timeoutEnd, newClock, pressClock, stopClock, timeLeft, fmtClock, moveBudget, timeControlOf, pgnTimeControl,
  weakParams, opponentSearch, pickWeak, acceptsDraw, MIN_UCI_ELO, checkStart, fixCastling,
} from '../../src/play.js';

const play = (fen, ...moves) => { const c = new Chess(fen); for (const m of moves) c.move(m); return c; };
const legal = (fen, m) => { try { new Chess(fen).move(m); return true; } catch { return false; } };

// ---------------------------------------------------------------- Rules (TODO 1.12)
test('checkmate: the side that delivers mate wins', () => {
  assert.deepEqual(gameEnd(play(undefined, 'f3', 'e5', 'g4', 'Qh4#')), { result: '0-1', reason: 'checkmate' });
  assert.deepEqual(gameEnd(play('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', 'Ra8#')), { result: '1-0', reason: 'checkmate' });
  assert.equal(gameEnd(new Chess()), null);
});

test('stalemate is a draw, not a win', () => {
  assert.deepEqual(gameEnd(play('7k/8/5QK1/8/8/8/8/8 w - - 0 1', 'Qf7')), { result: '1/2-1/2', reason: 'stalemate' });
});

test('threefold repetition counts positions, not moves, and needs the same castling rights', () => {
  const shuffle = ['Nf3', 'Nf6', 'Ng1', 'Ng8'];
  assert.equal(gameEnd(play(undefined, ...shuffle)), null, 'second occurrence');
  assert.deepEqual(gameEnd(play(undefined, ...shuffle, ...shuffle)), { result: '1/2-1/2', reason: 'threefold repetition' });
  // King steps lose castling rights: the start position after Ke2/Ke1 is a different position.
  const kings = ['e4', 'e5', 'Ke2', 'Ke7', 'Ke1', 'Ke8'];
  assert.equal(gameEnd(play(undefined, ...kings, 'Ke2', 'Ke7', 'Ke1', 'Ke8')), null, 'only twice without castling rights');
  assert.ok(gameEnd(play(undefined, ...kings, 'Ke2', 'Ke7', 'Ke1', 'Ke8', 'Ke2', 'Ke7', 'Ke1', 'Ke8')));
});

test('fifty-move rule: a draw at 100 quiet half-moves, not at 99; a pawn move resets it', () => {
  const fen = n => `4k3/8/8/8/8/8/4P3/R3K3 w - - ${n} 80`;
  assert.equal(gameEnd(play(fen(98), 'Ra2')), null);
  assert.deepEqual(gameEnd(play(fen(99), 'Ra2')), { result: '1/2-1/2', reason: 'fifty-move rule' });
  assert.equal(gameEnd(play(fen(99), 'e4')), null, 'pawn move resets the count');
});

test('insufficient material: K v K, K+minor v K, same-coloured bishops; not K+N+N or pawns', () => {
  const ends = fen => gameEnd(new Chess(fen))?.reason;
  assert.equal(ends('8/8/8/4k3/8/8/8/4K3 w - - 0 1'), 'insufficient material');
  assert.equal(ends('8/8/8/4k3/8/8/8/4KB2 w - - 0 1'), 'insufficient material');
  assert.equal(ends('8/8/8/4k3/8/8/8/4KN2 w - - 0 1'), 'insufficient material');
  assert.equal(ends('8/8/8/3bk3/8/8/8/4KB2 w - - 0 1'), 'insufficient material', 'both bishops on light squares (d5, f1)');
  assert.equal(ends('8/8/8/2b1k3/8/8/8/4KB2 w - - 0 1'), undefined, 'opposite-coloured bishops (c5, f1)');
  assert.equal(ends('8/8/8/4k3/8/8/8/3NKN2 w - - 0 1'), undefined);
  assert.equal(ends('8/8/8/4k3/8/8/4P3/4K3 w - - 0 1'), undefined);
});

test('en passant only right after the double step', () => {
  const fen = 'rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2';
  const c = play(fen, 'f5');
  assert.ok(legal(c.fen(), 'exf6'));
  assert.equal(play(c.fen(), 'exf6').get('f5'), undefined, 'the captured pawn is removed');
  assert.ok(!legal(play(fen, 'f5', 'Nf3', 'Nc6').fen(), 'exf6'), 'one move later it is gone');
});

test('castling: not out of, through or into check, and not after the king or rook has moved', () => {
  const base = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
  assert.ok(legal(base, 'O-O') && legal(base, 'O-O-O'));
  assert.ok(!legal('r3k2r/8/8/8/8/8/4r3/R3K2R w KQkq - 0 1', 'O-O'), 'out of check');
  assert.ok(!legal('r3k2r/8/8/8/8/8/5r2/R3K2R w KQkq - 0 1', 'O-O'), 'through f1');
  assert.ok(!legal('r3k2r/8/8/8/8/8/6r1/R3K2R w KQkq - 0 1', 'O-O'), 'into g1');
  assert.ok(legal('r3k2r/8/8/8/8/8/1r6/R3K2R w KQkq - 0 1', 'O-O-O'), 'b1 attacked does not matter');
  assert.ok(!legal(play(base, 'Rh2', 'Rb8', 'Rh1', 'Ra8').fen(), 'O-O'), 'rook has moved');
});

test('promotion to any piece, including under-promotion with check', () => {
  const fen = '8/4P1k1/8/8/8/8/8/4K3 w - - 0 1';
  for (const p of ['q', 'r', 'b', 'n']) assert.equal(play(fen, { from: 'e7', to: 'e8', promotion: p }).get('e8').type, p);
  assert.ok(play('8/4P3/6k1/8/8/8/8/4K3 w - - 0 1', 'e8=N').get('e8').type === 'n');
  assert.ok(play('5k2/4P3/8/8/8/8/8/4K3 w - - 0 1', { from: 'e7', to: 'e8', promotion: 'r' }).inCheck());
});

test('timeout: a loss, unless the opponent has no mating material', () => {
  const c = new Chess();
  assert.deepEqual(timeoutEnd(c, 'w'), { result: '0-1', reason: 'timeout' });
  assert.deepEqual(timeoutEnd(c, 'b'), { result: '1-0', reason: 'timeout' });
  assert.equal(timeoutEnd(new Chess('8/8/8/4k3/8/8/4P3/4K3 b - - 0 1'), 'w').result, '1/2-1/2', 'Black has a lone king');
  assert.equal(timeoutEnd(new Chess('8/8/8/4k3/8/8/8/4KN2 b - - 0 1'), 'b').result, '1/2-1/2', 'K+N v lone K');
  assert.equal(timeoutEnd(new Chess('8/8/8/4k3/8/8/p7/4KN2 b - - 0 1'), 'b').result, '1-0', 'K+N v K+P can mate');
  assert.ok(cannotMate(new Chess('8/8/8/4k3/8/8/8/4K3 w - - 0 1'), 'w'));
  assert.ok(!cannotMate(new Chess('8/8/8/4k3/8/8/8/3NKN2 w - - 0 1'), 'w'));
});

// ---------------------------------------------------------------- Clocks (TODO 1.6)
test('clock: increments, running time and stopping', () => {
  const tc = timeControlOf('5+3');
  let c = newClock(tc);
  assert.equal(timeLeft(c, 'w', 1000), 300_000, 'nothing runs before the first press');
  c = pressClock(c, 0, 'b'); // White's first move starts Black's clock, without an increment
  assert.equal(c.w, 300_000);
  assert.equal(timeLeft(c, 'b', 10_000), 290_000);
  c = pressClock(c, 10_000, 'w'); // Black moved after 10 s, gets 3 s back
  assert.equal(c.b, 293_000);
  assert.equal(timeLeft(c, 'w', 70_000), 240_000);
  c = stopClock(c, 70_000);
  assert.equal(c.w, 240_000); assert.equal(c.turn, null);
  assert.equal(timeLeft(c, 'w', 999_999), 240_000, 'a stopped clock stays put');
  assert.equal(timeControlOf('nonsense').id, 'none');
  assert.equal(pgnTimeControl(tc), '300+3'); assert.equal(pgnTimeControl(null), '-');
});

test('clock display and Stockfish\'s time budget', () => {
  assert.equal(fmtClock(305_000), '5:05');
  assert.equal(fmtClock(3_723_000), '1:02:03');
  assert.equal(fmtClock(9_960), '9.9');
  assert.equal(fmtClock(-5), '0.0');
  assert.equal(moveBudget(700, 600_000, 5_000), 700, 'plenty of time: the untimed think time');
  assert.equal(moveBudget(700, 6_000, 0), 200, 'short of time: a thirtieth');
  assert.equal(moveBudget(700, 100, 0), 50, 'never below 50 ms');
});

// ---------------------------------------------------------------- Strength
test('weakened mode: knobs rise with Elo; depth steps at the table rows', () => {
  assert.deepEqual([600, 899, 900, 1099, 1100, 1319].map(e => weakParams(e).depth), [1, 1, 3, 3, 5, 5]);
  const ds = [500, 600, 700, 900, 1000, 1100, 1200, 1319].map(e => weakParams(e).depth);
  assert.ok(ds.every((d, i) => i === 0 || d >= ds[i - 1]), 'depth never drops as Elo rises');
  const ks = [600, 800], ks3 = [900, 1000, 1100, 1200, 1319].map(e => weakParams(e).keep); ks.splice(0, 2, ...ks.map(e => weakParams(e).keep));
  assert.ok([ks, ks3].every(k => k.every((x, i) => i === 0 || x > k[i - 1])), 'at the same depth, keeps the best move more often as Elo rises');
  assert.ok(weakParams(500).keep === weakParams(600).keep, 'clamped below the table');
});

test('opponent search: UCI_Elo from 1320, weakened mode below, MultiPV for styles, clock budget', () => {
  const s = opponentSearch(1500, { weight: 0 });
  assert.equal(s.multipv, 1); assert.ok(s.setup.includes('setoption name UCI_Elo value 1500')); assert.equal(s.movetime, 800);
  assert.equal(opponentSearch(1500, { weight: 1 }).multipv, 4);
  assert.equal(opponentSearch(1500, null, { left: 3_000, inc: 0 }).movetime, 100);
  const w = opponentSearch(MIN_UCI_ELO - 1, null);
  assert.equal(w.depth, 5); assert.equal(w.multipv, 4); assert.ok(w.setup.includes('setoption name Skill Level value 0'));
});

test('pickWeak: best line, another candidate, or a random legal move', () => {
  const fen = new Chess().fen();
  const res = { best: 'e2e4', lines: [{ pv: ['e2e4'] }, { pv: ['d2d4'] }, { pv: ['g1f3'] }] };
  const seq = (...xs) => () => xs.shift();
  assert.equal(pickWeak(Chess, fen, res, 1000, seq(0)), 'e2e4');
  assert.equal(pickWeak(Chess, fen, res, 1000, seq(0.99, 0.99, 0)), 'd2d4');
  const random = pickWeak(Chess, fen, res, 600, seq(0.99, 0, 0.999));
  assert.ok(new Chess().moves({ verbose: true }).some(m => m.from + m.to === random));
  assert.equal(pickWeak(Chess, fen, { best: 'e2e4', lines: [] }, 600), 'e2e4');
});

// ---------------------------------------------------------------- Draw offers (TODO 1.7)
test('draw offers: accepted when Stockfish is worse, or dead equal late in the game', () => {
  assert.equal(acceptsDraw(-150, 10), true);
  assert.equal(acceptsDraw(0, 20), false, 'early and equal: play on');
  assert.equal(acceptsDraw(10, 80), true);
  assert.equal(acceptsDraw(60, 80), false, 'Stockfish is better');
  assert.equal(acceptsDraw(null, 80), false);
});

// ---------------------------------------------------------------- Start positions (TODO 1.8)
test('start positions: valid FENs pass (normalised), broken or finished ones are explained', () => {
  assert.deepEqual(checkStart(Chess, ' 4k3/8/8/8/8/8/8/4K2R w K - 0 1 '), { fen: '4k3/8/8/8/8/8/8/4K2R w K - 0 1' });
  assert.match(checkStart(Chess, 'nonsense').error, /valid FEN/);
  assert.match(checkStart(Chess, 'k7/1Q6/8/8/8/8/8/K7 w - - 0 1').error, /isn't to move is in check/);
  assert.match(checkStart(Chess, 'k7/1Q6/1K6/8/8/8/8/8 b - - 0 1').error, /already over/);
  assert.match(checkStart(Chess, 'k7/8/8/8/8/8/8/7K w - - 0 1').error, /already over/, 'bare kings');
});

test('castling rights without the king or rook on its square are dropped', () => {
  assert.equal(fixCastling('4k3/8/8/8/8/8/8/4K2R w KQkq - 0 1'), '4k3/8/8/8/8/8/8/4K2R w K - 0 1');
  assert.equal(fixCastling('r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1'), 'r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1');
  assert.equal(fixCastling('r3k2r/8/8/8/8/8/8/R2K3R w KQkq - 0 1'), 'r3k2r/8/8/8/8/8/8/R2K3R w kq - 0 1', 'white king moved');
  assert.ok(!new Chess(checkStart(Chess, '4k3/8/8/8/8/8/8/4K2R w KQkq - 0 1').fen).moves().includes('O-O-O'), 'no castling without a rook');
});
