import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { mainlineNags, nagText, NAG_GLYPHS } from '../../src/chess/pgn.js';

test('suffixes and $-NAGs are read per mainline ply', () => {
  const n = mainlineNags('1. e4! e5 2. Nf3 $1 Nc6?! 3. Bb5 $14 a6 $6 $32 1-0');
  assert.deepEqual(n.slice(1), [[1], [], [1], [6], [14], [6, 32]]);
});

test('variations, comments, escapes and headers are skipped', () => {
  const pgn = `[Event "Test $1"]\n[White "A?"]\n\n% escaped line with e4!!\n1. d4 {a comment with $2 and Nf3?} d5 (1... Nf6!? 2. c4 (2. Nf3 $1) e6) 2. c4!! ; rest of line ?? $4\n dxc4?? *`;
  assert.deepEqual(mainlineNags(pgn).slice(1), [[], [], [3], [4]]);
});

test('glued move numbers, black-first games and every suffix', () => {
  assert.deepEqual(mainlineNags('12.e4!? 12...e5?? 13.Nf3!! Nc6? 14.Bc4?!').slice(1), [[5], [4], [3], [2], [6]]);
  assert.deepEqual(mainlineNags('[FEN "x"]\n\n5... Nf6 $10 6. Nc3').slice(1), [[10], []]);
  assert.deepEqual(mainlineNags('1. e4$1 e5').slice(1), [[1], []], 'NAG glued to the move');
});

test('NAG plies line up with chess.js history', () => {
  const pgn = '1. e4 e5 2. Nf3 (2. f4 exf4!) 2... Nc6 $2 3. Bc4 {Italian} Bc5 $10 *';
  const c = new Chess(); c.loadPgn(pgn);
  const nags = mainlineNags(pgn);
  assert.equal(nags.length - 1, c.history().length);
  assert.deepEqual(nags[4], [2]); assert.deepEqual(nags[6], [10]);
});

test('bad input: out-of-range NAGs and NAGs before any move are dropped; never throws', () => {
  assert.deepEqual(mainlineNags('$1 1. e4 $999 $0 $256 e5').slice(1), [[], []]);
  assert.deepEqual(mainlineNags(''), [[]]);
  assert.deepEqual(mainlineNags(null), [[]]);
  assert.deepEqual(mainlineNags('1. e4 {unclosed comment e5!').slice(1), [[]]);
});

test('glyphs for display; unknown NAGs as $n', () => {
  assert.equal(nagText([1, 14]), '! ⩲');
  assert.equal(nagText([200]), '$200');
  assert.equal(nagText(undefined), '');
  assert.equal(NAG_GLYPHS[4], '??');
});
