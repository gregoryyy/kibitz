import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { keyboardNextSquare, keyboardPosition } from '../../src/chess/keyboard-board.js';
import { BOARD_MARK_STYLES, describeBoardMarks } from '../../src/chess/board-marks.js';

test('keyboard square navigation follows the displayed orientation, stays on the board and lets unrelated keys pass', () => {
  assert.equal(keyboardNextSquare('e2', 'ArrowUp'), 'e3'); assert.equal(keyboardNextSquare('e2', 'ArrowLeft'), 'd2');
  assert.equal(keyboardNextSquare('e7', 'ArrowUp', 'black'), 'e6'); assert.equal(keyboardNextSquare('e7', 'ArrowLeft', 'black'), 'f7');
  assert.equal(keyboardNextSquare('a8', 'ArrowUp'), 'a8'); assert.equal(keyboardNextSquare('h1', 'ArrowDown'), 'h1');
  assert.equal(keyboardNextSquare('a8', 'ArrowRight', 'black'), 'a8'); assert.equal(keyboardNextSquare('h8', 'ArrowDown', 'black'), 'h8');
  assert.equal(keyboardNextSquare('e2', 'Tab'), null); assert.equal(keyboardNextSquare('e2', 'f'), null);
  assert.throws(() => keyboardNextSquare('evil', 'ArrowUp')); assert.throws(() => keyboardNextSquare('e2', 'ArrowUp', 'other'));
});

test('Home/End use visual row ends; Control reaches visual corners in either orientation', () => {
  assert.equal(keyboardNextSquare('e4', 'Home'), 'a4'); assert.equal(keyboardNextSquare('e4', 'End'), 'h4');
  assert.equal(keyboardNextSquare('e4', 'Home', 'black'), 'h4'); assert.equal(keyboardNextSquare('e4', 'End', 'black'), 'a4');
  assert.equal(keyboardNextSquare('e4', 'Home', 'white', true), 'a8'); assert.equal(keyboardNextSquare('e4', 'End', 'white', true), 'h1');
  assert.equal(keyboardNextSquare('e4', 'Home', 'black', true), 'h1'); assert.equal(keyboardNextSquare('e4', 'End', 'black', true), 'a8');
});

test('keyboard cells retain every actual square/piece while legal destinations follow side and king safety', () => {
  const white = keyboardPosition(Chess, new Chess().fen()), black = keyboardPosition(Chess, new Chess().fen(), 'black');
  assert.equal(white.rows.flat().length, 64); assert.equal(new Set(white.rows.flat().map(c => c.square)).size, 64);
  assert.equal(white.rows[0][0].square, 'a8'); assert.equal(black.rows[0][0].square, 'h1');
  assert.equal(white.rows.flat().find(c => c.square === 'e2').piece, 'White pawn'); assert.equal(black.rows.flat().find(c => c.square === 'a8').piece, 'Black rook');
  assert.deepEqual([...white.legal.get('e2')], ['e3', 'e4']); assert.equal(white.legal.has('e7'), false);
  const pinned = keyboardPosition(Chess, '4r1k1/8/8/8/8/8/4N3/4K3 w - - 0 1'); assert.equal(pinned.legal.has('e2'), false);
  assert.throws(() => keyboardPosition(Chess, 'invalid fen'));
});

test('castling, en passant and promotion destinations use chess rules without silently choosing a promotion', () => {
  const castle = keyboardPosition(Chess, 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  assert.ok(castle.legal.get('e1').has('g1')); assert.ok(castle.legal.get('e1').has('c1')); assert.ok(!castle.legal.get('e1').has('h1'));
  const ep = keyboardPosition(Chess, '7k/8/8/3pP3/8/8/8/7K w - d6 0 1'); assert.ok(ep.legal.get('e5').has('d6'));
  const promo = keyboardPosition(Chess, '7k/P7/8/8/8/8/8/7K w - - 0 1'); assert.deepEqual([...promo.legal.get('a7')], ['a8']);
});

test('every app arrow meaning has a distinct non-colour pattern, with literal positional descriptions', () => {
  const meanings = ['best', 'played', 'alt', 'hint', 'san', 'threat']; assert.equal(new Set(meanings.map(k => BOARD_MARK_STYLES[k].dash)).size, meanings.length);
  const rows = describeBoardMarks([{ orig: 'e2', dest: 'e4', brush: 'best' }, { orig: 'e2', dest: 'e4', brush: 'best' }, { orig: 'f7', brush: 'san', label: { text: '!' } }, { orig: 'd5', brush: 'san', piece: { role: 'knight' } }]);
  assert.deepEqual(rows.map(r => r.name), ['Engine move', 'Board label', 'Example piece']); assert.equal(rows[1].label, '!'); assert.equal(rows[0].to, 'e4');
});

test('mark descriptions reject hostile coordinates/unknown brushes and never copy raw label HTML', () => {
  const rows = describeBoardMarks([{ orig: '<img>', dest: 'e4', brush: 'best' }, { orig: 'e2', dest: 'z9', brush: 'best' }, { orig: 'e2', brush: '__proto__' }, { orig: 'd5', brush: 'san', label: { text: '<script>secret</script>' } }]);
  assert.equal(rows.length, 1); assert.equal(rows[0].label, ''); assert.ok(!JSON.stringify(rows).includes('<script>')); assert.deepEqual(describeBoardMarks(null), []);
});
