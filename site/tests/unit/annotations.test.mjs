// Board annotations (TODO 4.2, 4.4, 4.7): the schema, the ```board block, lines in an answer, and
// model output that is malformed or hostile.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { checkAnnotation, checkMarks, parseBoardBlock, playLine, linesInAnswer, MAX_MARKS } from '../../src/annotations.js';
import { checkAnswer } from '../../src/tutor.js';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
// 1. e4 e5 2. Qh5 Nc6 3. Bc4, Black to move: White threatens Qxf7#.
const QH5 = 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3';

test('arrows: a legal move for the side to move, or a threat for the other side', () => {
  assert.deepEqual(checkAnnotation(Chess, START, { kind: 'arrow', from: 'e2', to: 'e4' }), { ok: true, a: { kind: 'arrow', from: 'e2', to: 'e4', brush: 'san', san: 'e4' } });
  assert.equal(checkAnnotation(Chess, START, { kind: 'arrow', from: 'e2', to: 'e5' }).ok, false);
  assert.equal(checkAnnotation(Chess, START, { kind: 'arrow', from: 'e7', to: 'e5' }).ok, false, 'not the side to move');
  const t = checkAnnotation(Chess, QH5, { kind: 'arrow', from: 'h5', to: 'f7', brush: 'threat' });
  assert.equal(t.ok, true); assert.equal(t.a.san, 'Qxf7#'); assert.equal(t.a.brush, 'threat');
  assert.equal(checkAnnotation(Chess, QH5, { kind: 'arrow', from: 'h5', to: 'f7' }).ok, false, 'White isn\'t to move');
});

test('squares, ghosts and labels are checked too', () => {
  assert.equal(checkAnnotation(Chess, START, { kind: 'square', sq: 'f7' }).ok, true);
  assert.equal(checkAnnotation(Chess, START, { kind: 'square', sq: 'z9' }).ok, false);
  assert.equal(checkAnnotation(Chess, START, { kind: 'ghost', sq: 'd5', piece: 'wN' }).ok, true);
  assert.equal(checkAnnotation(Chess, START, { kind: 'ghost', sq: 'd2', piece: 'wN' }).ok, false, 'its own piece stands there');
  assert.equal(checkAnnotation(Chess, '4k3/8/8/8/8/8/8/4K3 w - - 0 1', { kind: 'ghost', sq: 'd5', piece: 'wN' }).ok, false, 'White has no knight');
  assert.equal(checkAnnotation(Chess, START, { kind: 'ghost', sq: 'd5', piece: 'xY' }).ok, false);
  assert.equal(checkAnnotation(Chess, START, { kind: 'label', sq: 'd5', text: '!' }).ok, true);
  assert.equal(checkAnnotation(Chess, START, { kind: 'label', sq: 'd5', text: '<b>' }).ok, false);
  assert.equal(checkAnnotation(Chess, START, { kind: 'label', sq: 'd5', text: 'long' }).ok, false);
  assert.equal(checkAnnotation(Chess, START, { kind: 'circle', sq: 'd5' }).ok, false, 'unknown kind');
  assert.equal(checkAnnotation(Chess, START, null).ok, false);
});

test('lines: every move legal in turn, in SAN or UCI', () => {
  const l = playLine(Chess, START, ['e4', 'e5', 'g1f3']);
  assert.deepEqual(l.sans, ['e4', 'e5', 'Nf3']);
  assert.deepEqual(l.ucis, ['e2e4', 'e7e5', 'g1f3']);
  assert.equal(l.fens.length, 4);
  assert.equal(playLine(Chess, START, ['e4', 'e4']), null);
  assert.equal(playLine(Chess, 'not a fen', ['e4']), null);
  assert.equal(checkAnnotation(Chess, START, { kind: 'line', sans: ['e4', 'Ke7??'] }).ok, false);
});

test('the board block: read line by line, cut at the limit, removed from the text, even unfinished', () => {
  const r = parseBoardBlock('Develop first.\n\n```board\narrow g1 f3\nthreat d8 h4\nsquare f7\nghost wN d5\nlabel d5 !\n```');
  assert.equal(r.text, 'Develop first.');
  assert.deepEqual(r.marks.map(m => m.kind), ['arrow', 'arrow', 'square', 'ghost', 'label']);
  assert.equal(r.marks[1].brush, 'threat');
  assert.equal(r.skipped, 0);
  assert.deepEqual(parseBoardBlock('Plain answer.'), { text: 'Plain answer.', marks: [], skipped: 0 });
  assert.equal(parseBoardBlock('Streaming…\n```board\narrow e2').text, 'Streaming…', 'an unfinished block is hidden while it streams');
  const many = parseBoardBlock('x\n```board\n' + Array.from({ length: 20 }, () => 'square e4').join('\n') + '\n```');
  assert.equal(many.marks.length, MAX_MARKS); assert.equal(many.skipped, 20 - MAX_MARKS);
});

test('hostile or malformed blocks draw nothing wrong', () => {
  const r = parseBoardBlock('Hi\n```board\n<img src=x onerror=alert(1)>\narrow e2 e4 e6\njavascript:alert(1)\narrow e2 e9\nghost wN d5; rm -rf /\nlabel e4 <script>\nsquare\nARROW E2 E4\n```');
  const { shown, dropped } = checkMarks(Chess, START, r.marks);
  assert.deepEqual(shown, []);
  assert.equal(r.marks.length + r.skipped, 8);
  assert.ok(dropped.every(d => typeof d.why === 'string'));
  // Real marks against the wrong position are dropped with a reason
  const ok = checkMarks(Chess, START, parseBoardBlock('x\n```board\narrow e2 e4\narrow h5 f7\n```').marks);
  assert.deepEqual(ok.shown.map(a => a.san), ['e4']);
  assert.equal(ok.dropped[0].why, 'not a legal move here');
});

test('lines in an answer: a run of checked moves becomes a line from the right position', () => {
  const fen = QH5;
  const text = 'Defend with 3... g6, and if 4. Qf3 then Nf6. The other try 3... Nf6?? loses to 4. Qxf7#.';
  const check = checkAnswer(Chess, text, { fen, lines: [['g7g6', 'h5f3', 'g8f6']], game: [] });
  const { moves, lines } = linesInAnswer(Chess, text, check.moves, { fen });
  // g6 from the position; "4. Qf3" continues after it, and "then Nf6" after that; "3... Nf6??" starts again.
  assert.deepEqual(lines.map(l => l.sans), [['g6'], ['Qf3'], ['Nf6'], ['Nf6'], ['Qxf7#']]);
  assert.equal(lines[0].start, new Chess(fen).fen());
  assert.equal(lines[1].start, lines[0].fens[1]);
  assert.equal(lines[2].start, lines[1].fens[1]);
  assert.equal(lines[3].start, new Chess(fen).fen());
  const qf3 = moves.find(m => m.san === 'Qf3');
  assert.deepEqual([qf3.line, qf3.ply], [1, 0]);
  assert.equal(moves.find(m => m.san === 'Qxf7#').status, 'invalid', 'legal navigation does not endorse an unsupported line');
  assert.ok(moves.find(m => m.san === 'Qxf7#').line !== undefined, 'a legal but flagged variation can still be inspected');
  // A wrong move ends a line; the checked moves before it stay one
  const t2 = 'Then 3... Nf6 4. Qxf7# ends it.';
  const c2 = checkAnswer(Chess, t2, { fen, lines: [['g8f6', 'h5f7']], game: [] });
  assert.deepEqual(linesInAnswer(Chess, t2, c2.moves, { fen }).lines.map(l => l.sans), [['Nf6', 'Qxf7#']]);
  const t3 = 'Try 3... Nf6 4. Qxf7# Ke7 Qd5 now.';
  const c3 = checkAnswer(Chess, t3, { fen, lines: [['g8f6', 'h5f7']], game: [] });
  assert.deepEqual(linesInAnswer(Chess, t3, c3.moves, { fen }).lines.map(l => l.sans), [['Nf6', 'Qxf7#']], 'Ke7 (illegal after mate) and what follows are left out');
  // A line from a position a tool looked at (TODO 4.11.5): a start of its own
  const after = playLine(Chess, fen, ['Nf6']).fens[1];
  const t4 = 'Black can\'t allow 4. Qxf7#.';
  const c4 = checkAnswer(Chess, t4, { fen, lines: [], game: [], extra: [['Qxf7#']] });
  assert.deepEqual(linesInAnswer(Chess, t4, c4.moves, { fen }).lines, [], 'not legal from the board');
  assert.equal(linesInAnswer(Chess, t4, c4.moves, { fen, starts: [after] }).lines[0].start, after);
  // A wrong move breaks no line into something drawn
  const bad = checkAnswer(Chess, 'Play 3... Qxh5 now.', { fen, lines: [], game: [] });
  assert.equal(linesInAnswer(Chess, 'Play 3... Qxh5 now.', bad.moves, { fen }).lines.length, 0);
});

test('numbered historical references resolve to their own occurrence, including a repeated move', () => {
  const game = playLine(Chess, START, ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3']);
  const text = 'After **1. Nf3** the knight develops; **3. Nf3** returns to that square.';
  const fen = game.fens.at(-1), prevFen = game.fens.at(-2);
  const checked = checkAnswer(Chess, text, { fen, prevFen, game: game.sans });
  const result = linesInAnswer(Chess, text, checked.moves, { fen, prevFen, game });
  assert.deepEqual(result.lines.map(l => l.start), [game.fens[0], game.fens[4]]);
  const ambiguous = 'Nf3 developed the knight.', marks = checkAnswer(Chess, ambiguous, { fen, prevFen, game: game.sans });
  assert.equal(linesInAnswer(Chess, ambiguous, marks.moves, { fen, prevFen, game }).lines.length, 0);
});

test('move numbers reset alternatives instead of continuing the preceding sentence', () => {
  const text = 'Try 1. e4 e5. Another option is 1. d4 d5.';
  const checked = checkAnswer(Chess, text, { fen: START, lines: [['e2e4', 'e7e5'], ['d2d4', 'd7d5']] });
  const result = linesInAnswer(Chess, text, checked.moves, { fen: START });
  assert.deepEqual(result.lines.map(l => l.start), [START, START]);
  const bad = 'Try 9. Nf3.';
  const mark = checkAnswer(Chess, bad, { fen: START, lines: [['g1f3']] });
  assert.equal(linesInAnswer(Chess, bad, mark.moves, { fen: START }).lines.length, 0);
  const variation = 'Try 1. e4 c5; 2. Nf3 develops.';
  const game = playLine(Chess, START, ['e4', 'e5', 'Nf3']);
  const check = checkAnswer(Chess, variation, { fen: START, game: game.sans, extra: [['e4', 'c5', 'Nf3']] });
  const linked = linesInAnswer(Chess, variation, check.moves, { fen: START, game });
  assert.equal(linked.lines[1].start, playLine(Chess, START, ['e4', 'c5']).fens[2]);
});

test('historical black moves use the custom start move number and unicode ellipsis', () => {
  const start = START.replace(' w ', ' b ').replace(' 0 1', ' 0 12');
  const game = playLine(Chess, start, ['e5', 'Nf3', 'Nc6']);
  const text = 'The line was 12… e5 13. Nf3.';
  const fen = game.fens.at(-1), checked = checkAnswer(Chess, text, { fen, game: game.sans });
  const result = linesInAnswer(Chess, text, checked.moves, { fen, game });
  assert.equal(result.lines[0]?.start, start);
  assert.deepEqual(result.lines[0]?.sans, ['e5', 'Nf3']);
});
