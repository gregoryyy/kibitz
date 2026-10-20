import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { aggressionScore, pickStyled, styleOf, STYLES } from '../../src/style.js';

// Italian Game after 1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6, White to move.
const ITALIAN = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
const line = (cp, uci) => ({ score: { cp }, pv: [uci, 'e7e6'] });
const pick = (lines, id, opts) => pickStyled(Chess, ITALIAN, lines, styleOf(id), opts);

test('aggression score: sacrificial check > attacking knight move > quiet move > retreat', () => {
  const s = uci => aggressionScore(Chess, ITALIAN, uci);
  assert.ok(s('c4f7') > s('f3g5'), 'Bxf7+ over Ng5');
  assert.ok(s('f3g5') > s('d2d3'), 'Ng5 over d3');
  assert.ok(s('d2d3') > s('c4b3'), 'd3 over the retreat Bb3');
  assert.equal(s('e1e5'), -Infinity, 'illegal move');
});

const LINES = [line(40, 'd2d3'), line(30, 'f3g5'), line(25, 'e1g1'), line(-70, 'c4f7')];

test('balanced plays the engine\'s best move', () => {
  assert.equal(pick(LINES, 'balanced'), 'd2d3');
});

test('active and aggressive prefer the attacking move within their window', () => {
  assert.equal(pick(LINES, 'active'), 'f3g5');
  assert.equal(pick(LINES, 'aggressive'), 'f3g5'); // Bxf7+ loses 1.1 pawns: outside the 0.5 window
});

test('reckless accepts a bigger loss for a sacrificial attack', () => {
  assert.equal(pick(LINES, 'reckless'), 'c4f7');
});

test('solid prefers the quiet move when the best move is sharper', () => {
  const lines = [line(40, 'f3g5'), line(35, 'd2d3'), line(-70, 'c4f7')];
  assert.equal(pick(lines, 'balanced'), 'f3g5');
  assert.equal(pick(lines, 'solid'), 'd2d3');
});

test('a forced mate is never given up for style', () => {
  const lines = [{ score: { mate: 3 }, pv: ['d2d3'] }, line(900, 'c4f7')];
  assert.equal(pick(lines, 'reckless'), 'd2d3');
});

test('with an Elo-limited anchor the window is measured from the anchor', () => {
  // Stockfish (strength-limited) chose O-O; aggressive may pick within 0.5 pawns of it, either way.
  assert.equal(pick(LINES, 'aggressive', { anchor: 'e1g1' }), 'f3g5');
  assert.equal(pick(LINES, 'balanced', { anchor: 'e1g1' }), 'e1g1');
  assert.equal(pick(LINES, 'aggressive', { anchor: 'h2h3' }), 'h2h3', 'anchor without a line is kept');
});

test('styleOf falls back to balanced; styles are ordered from solid to reckless', () => {
  assert.equal(styleOf('nonsense').id, 'balanced');
  assert.deepEqual(STYLES.map(s => s.id), ['solid', 'balanced', 'active', 'aggressive', 'reckless']);
  assert.ok(STYLES.every((s, k) => k < 2 || s.maxLoss > STYLES[k - 1].maxLoss));
});
