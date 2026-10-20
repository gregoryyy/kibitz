import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { sanToSpeech, parseMoveInput } from '../../src/notation.js';

test('moves are spoken in words', () => {
  assert.equal(sanToSpeech('e4'), 'e4');
  assert.equal(sanToSpeech('Nf3'), 'knight f3');
  assert.equal(sanToSpeech('Nxe5+'), 'knight takes e5, check');
  assert.equal(sanToSpeech('exd5'), 'e takes d5');
  assert.equal(sanToSpeech('Nbd7'), 'knight b d7');
  assert.equal(sanToSpeech('R1e2'), 'rook 1 e2');
  assert.equal(sanToSpeech('O-O'), 'castles kingside');
  assert.equal(sanToSpeech('O-O-O+'), 'castles queenside, check');
  assert.equal(sanToSpeech('e8=Q#'), 'e8 promotes to queen, checkmate');
  assert.equal(sanToSpeech('bxa1=N'), 'b takes a1 promotes to knight');
});

const START = new Chess().fen();
const pick = (fen, t) => { const r = parseMoveInput(Chess, fen, t); return r.error ? r.error : r.san; };

test('typed moves: SAN, loose SAN and coordinates', () => {
  assert.equal(pick(START, 'e4'), 'e4');
  assert.equal(pick(START, 'Nf3'), 'Nf3');
  assert.equal(pick(START, 'nf3'), 'Nf3', 'lower-case piece letter');
  assert.equal(pick(START, ' e2e4 '), 'e4');
  assert.equal(pick(START, 'g1-f3'), 'Nf3');
  const italian = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 3';
  assert.equal(pick(italian, '0-0'), 'O-O');
  assert.equal(pick(italian, 'o-o'), 'O-O');
  assert.equal(pick(italian, 'Bxf7+'), 'Bxf7+');
  assert.equal(pick(italian, 'Bf7'), 'Bxf7+', 'capture sign left out');
  assert.equal(pick(italian, 'Nxe5'), 'Nxe5');
});

test('promotions: piece letter optional (queen), any form', () => {
  const fen = '8/4P1k1/8/8/8/8/8/4K3 w - - 0 1';
  assert.equal(pick(fen, 'e8=Q'), 'e8=Q');
  assert.equal(pick(fen, 'e8n'), 'e8=N+', 'the knight gives check');
  assert.equal(pick(fen, 'e8'), 'e8=Q');
  assert.equal(pick(fen, 'e7e8r'), 'e8=R');
  assert.equal(pick(fen, 'e7e8'), 'e8=Q');
});

test('pawn b-file vs bishop: lower-case b is the pawn when both exist', () => {
  const fen = 'rnbqkbnr/pppp1ppp/8/4p3/8/1P1P4/P1P1PPPP/RNBQKBNR w KQkq - 0 3';
  assert.equal(pick(fen, 'b4'), 'b4');
  assert.equal(pick(fen, 'Bb2'), 'Bb2');
  assert.equal(pick(fen, 'bb2'), 'Bb2', 'no pawn can go to b2, so the bishop');
});

test('ambiguous or illegal input is explained, not guessed', () => {
  const twoKnights = '4k3/8/8/8/8/8/8/1N2KN2 w - - 0 1';
  assert.match(pick(twoKnights, 'Nd2'), /could mean Nbd2 or Nfd2/);
  assert.equal(pick(twoKnights, 'Nbd2'), 'Nbd2');
  assert.match(pick(START, 'e5'), /isn't a legal move/);
  assert.match(pick(START, 'e2e5'), /isn't a legal move/);
  assert.match(pick(START, ''), /Type a move/);
  assert.match(pick(START, '<img src=x>'), /isn't a legal move/);
});
