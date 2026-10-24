import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { prepareLessonGame } from '../../src/curriculum/playout.js';
import { PUZZLES } from '../../src/curriculum/puzzle-data.js';

test('lesson start keeps the full displayed FEN and chosen side without replaying the source setup/solution', () => {
  const p = PUZZLES[0], result = prepareLessonGame(Chess, { fen: p.fen, color: 'b', title: 'Lesson practice: ' + p.id });
  assert.equal(result.error, undefined); assert.equal(result.start.fen, p.fen); assert.equal(result.color, 'b');
  assert.deepEqual(result.start.sans, []); assert.match(result.start.fen, / w - - 0 25$/); assert.notEqual(result.start.fen, p.sourceFen);
});

test('move counters, side, legal en passant and available castling rights survive validation', () => {
  const ep = '7k/8/8/3pP3/8/8/8/7K w - d6 0 25';
  assert.equal(prepareLessonGame(Chess, { fen: ep, color: 'w' }).start.fen, ep);
  const castle = '4k3/8/8/8/8/8/8/4K2R w K - 17 42';
  assert.equal(prepareLessonGame(Chess, { fen: castle, color: 'b' }).start.fen, castle);
  const stale = prepareLessonGame(Chess, { fen: castle.replace(' K ', ' KQ '), color: 'w' });
  assert.equal(stale.start.fen.split(' ')[2], 'K'); assert.equal(new Chess(stale.start.fen).moves().includes('O-O-O'), false);
});

test('checkmate, stalemate, fifty-move and insufficient-material positions cannot start a game', () => {
  for (const fen of ['7k/6Q1/5K2/8/8/8/8/8 b - - 1 1', '7k/5Q2/5K2/8/8/8/8/8 b - - 1 1',
    '7k/8/5KQ1/8/8/8/8/8 w - - 100 51', '7k/8/8/8/8/8/8/K7 w - - 0 1']) {
    const result = prepareLessonGame(Chess, { fen, color: 'w' }); assert.ok(result.error); assert.equal(result.start, undefined);
  }
  // A theoretical tablebase draw is still a playable diagram, not a rules-ended game.
  assert.ok(prepareLessonGame(Chess, { fen: 'k7/P7/K7/8/8/8/8/8 w - - 0 1', color: 'w' }).start);
});

test('malformed/illegal positions, sides and unusable titles return errors with no normal-start fallback', () => {
  const fen = PUZZLES[0].fen;
  for (const request of [{ fen: 'bad FEN', color: 'w' }, { fen: fen.split(' ').slice(0, 4).join(' '), color: 'w' },
    { fen: '8/8/8/8/8/8/4k3/4K3 w - - 0 1', color: 'w' }, { fen, color: 'random' },
    { fen, color: 'w', title: 'Bad\n[Event "Injected"]' }, { fen, color: 'b', title: 'x'.repeat(241) }]) {
    const result = prepareLessonGame(Chess, request); assert.ok(result.error); assert.equal(result.start, undefined);
  }
});
