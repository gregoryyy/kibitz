import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import {
  ASPECTS, DEFAULT_ASPECTS, normaliseAspects, engineView, aspectsFor, commentRequest, shouldComment,
  safetyNotes, pvSans, checkAnswer, commentKey, lruCache, COACH_RULES,
} from '../../src/tutor.js';

// Italian Game after 1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6, White to move.
const ITALIAN = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
const LINES = [['d2d3', 'f8c5', 'c2c3'], ['f3g5', 'd7d5', 'e4d5']];
const GAME = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'];
const check = text => checkAnswer(Chess, text, { fen: ITALIAN, lines: LINES, game: GAME });
const statuses = r => r.moves.map(m => `${m.san}:${m.status}`);

test('aspects: known ids in standard order, defaults when none are left', () => {
  assert.deepEqual(ASPECTS.map(a => a.id), ['last', 'next', 'mind', 'habits', 'games']);
  assert.deepEqual(normaliseAspects(['games', 'last', 'nope']), ['last', 'games']);
  assert.deepEqual(normaliseAspects([]), DEFAULT_ASPECTS);
  assert.deepEqual(normaliseAspects('last'), DEFAULT_ASPECTS);
});

test('engine view: everything outside a running game; mid-game it follows the help setting', () => {
  assert.equal(engineView({ mode: 'analysis', playing: false, over: null, help: 'off' }), 'all');
  assert.equal(engineView({ mode: 'play', playing: true, over: { result: '1-0' }, help: 'off' }), 'all');
  assert.equal(engineView({ mode: 'play', playing: true, over: null, help: 'full' }), 'all');
  assert.equal(engineView({ mode: 'play', playing: true, over: null, help: 'flags' }), 'past');
  assert.equal(engineView({ mode: 'play', playing: true, over: null, help: 'off' }), 'none');
});

test('mid-game, aspects that need the engine\'s view of the position are dropped and reported', () => {
  assert.deepEqual(aspectsFor(['last', 'next', 'mind'], 'all'), { use: ['last', 'next', 'mind'], dropped: [] });
  assert.deepEqual(aspectsFor(['last', 'next', 'mind'], 'past'), { use: ['last', 'mind'], dropped: ['next'] });
  assert.deepEqual(aspectsFor(['next'], 'none'), { use: ['mind'], dropped: ['next'] });
});

test('the comment request lists the aspects in order, and mid-game forbids move suggestions', () => {
  const all = commentRequest(['mind', 'last'], { view: 'all' });
  assert.match(all, /1\. The last move/);
  assert.match(all, /2\. Things to keep in mind/);
  assert.doesNotMatch(all, /still in progress/);
  assert.match(commentRequest(['last'], { view: 'past' }), /never suggest a move for the player/);
  assert.match(COACH_RULES, /Never invent variations/);
  assert.match(COACH_RULES, /guillemets/); // the untrusted-text rule is part of every request
});

test('when to comment by itself: the player\'s moves only, never with help off', () => {
  const at = (when, cls, extra = {}) => shouldComment({ when, view: 'all', cls, byPlayer: true, ...extra });
  assert.equal(at('request', 'blunder'), false);
  assert.equal(at('mistakes', 'blunder'), true);
  assert.equal(at('mistakes', 'inaccuracy'), true);
  assert.equal(at('mistakes', 'good'), false);
  assert.equal(at('every', 'good'), true);
  assert.equal(at('every', undefined), false, 'not before the move is classified');
  assert.equal(at('every', 'good', { byPlayer: false }), false, 'not the engine\'s moves');
  assert.equal(at('mistakes', 'blunder', { view: 'none' }), false, 'engine help off');
  assert.equal(at('mistakes', 'blunder', { view: 'past' }), true);
});

test('safety notes: hanging, cheaply attacked and loose pieces, thin king shelter', () => {
  assert.ok(safetyNotes(Chess, ITALIAN).includes('White\'s bishop on c4 is loose (no defender)'));
  assert.deepEqual(safetyNotes(Chess, '4k3/8/8/3n4/8/8/8/3RK3 w - - 0 1'), ['Black\'s knight on d5 is attacked and not defended']);
  assert.ok(safetyNotes(Chess, '4k3/8/8/2p5/3q4/4P3/8/4K3 w - - 0 1').includes('Black\'s queen on d4 is attacked by a cheaper piece'));
  const shelter = safetyNotes(Chess, '6k1/5ppp/8/8/8/8/5P2/6K1 w - - 0 1');
  assert.ok(shelter.includes('White\'s king on g1 has only one pawn in front of it'));
  assert.ok(!shelter.some(n => n.startsWith('Black\'s king')));
});

test('pvSans: SAN for a line, stopping at an illegal move', () => {
  assert.deepEqual(pvSans(Chess, ITALIAN, LINES[1]), ['Ng5', 'd5', 'exd5']);
  assert.deepEqual(pvSans(Chess, ITALIAN, ['d2d3', 'e1e8', 'c2c3']), ['d3']);
});

test('checked answer: moves from the engine lines and the game pass', () => {
  const r = check('Play d3, then c3. The sharp try is Ng5 d5 exd5. After 3. Bc4 Nf6 the game is open.');
  assert.deepEqual(statuses(r), ['d3:line', 'c3:line', 'Ng5:line', 'd5:line', 'exd5:line', 'Bc4:game', 'Nf6:game']);
  assert.equal(r.problems, 0);
});

test('checked answer: an illegal move and an invented line are flagged', () => {
  const r = check('Qh5 wins at once. Or d3 Bc5 Nc3, developing.');
  assert.deepEqual(statuses(r), ['Qh5:invalid', 'd3:line', 'Bc5:line', 'Nc3:invalid']);
  assert.match(r.moves[3].why, /isn't one of Stockfish's lines/);
  assert.equal(r.problems, 2);
});

test('checked answer: moves in separate sentences are not read as one line', () => {
  const r = check('Play d3. Nc3 is also possible, and after 4. Ng5 d5 5. exd5 it gets sharp.');
  assert.deepEqual(statuses(r), ['d3:line', 'Nc3:legal', 'Ng5:line', 'd5:line', 'exd5:line']);
  assert.equal(r.problems, 0);
});

test('checked answer: legal moves outside the engine lines are unchecked, not wrong', () => {
  const r = check('Castling with O-O is also fine.');
  assert.deepEqual(statuses(r), ['O-O:legal']);
  assert.equal(r.problems, 0);
});

test('checked answer: squares are not moves; piece-on-square claims are checked', () => {
  const r = check('The knight on f3 eyes the e5 square, but the bishop on b5 is a dream.');
  assert.deepEqual(statuses(r), ['f3:square', 'e5:square', 'b5:square']);
  assert.deepEqual(r.pieces.map(p => [p.text, p.ok]), [['knight on f3', true], ['bishop on b5', false]]);
  assert.equal(r.problems, 1);
});

test('checked answer: the position before counts too (the last move\'s alternatives)', () => {
  const before = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
  const after = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R b KQkq - 0 4';
  const r = checkAnswer(Chess, 'Ng5 was sharper than d3.', { fen: after, prevFen: before, prevLines: [LINES[1]], game: [...GAME, 'd3'] });
  assert.deepEqual(statuses(r), ['Ng5:line', 'd3:game']);
});

test('checked answer: lines from other positions the coach was given (the review\'s turning points) count as backed', () => {
  const text = 'Better was 2... Nc6 3. Bb5 Bc5, not 2... Qh4.';
  assert.deepEqual(statuses(check(text)), ['Nc6:game', 'Bb5:invalid', 'Bc5:invalid', 'Qh4:invalid']);
  const r = checkAnswer(Chess, text, { fen: ITALIAN, lines: LINES, game: GAME, extra: [['Nc6', 'Bb5', 'Bc5+']] });
  assert.deepEqual(statuses(r), ['Nc6:line', 'Bb5:line', 'Bc5:line', 'Qh4:invalid']);
});

test('comment cache key covers position, move, aspects, view, level and model', () => {
  const base = { epd: 'x', uci: 'e2e4', aspects: ['mind', 'last'], view: 'all', level: 2, model: 'm' };
  assert.equal(commentKey(base), commentKey({ ...base, aspects: ['last', 'mind'] }));
  for (const change of [{ epd: 'y' }, { uci: 'd2d4' }, { aspects: ['last'] }, { view: 'past' }, { level: 3 }, { model: 'n' }]) {
    assert.notEqual(commentKey(base), commentKey({ ...base, ...change }), JSON.stringify(change));
  }
});

test('lru cache: most recent wins, oldest goes first, bad saved entries are dropped', () => {
  const c = lruCache(2);
  c.set('a', '1'); c.set('b', '2');
  assert.equal(c.get('a'), '1'); // a is now the most recent
  c.set('c', '3');
  assert.equal(c.get('b'), undefined);
  assert.deepEqual(c.entries(), [['a', '1'], ['c', '3']]);
  const restored = lruCache(2, [['x', '1'], ['bad'], ['y', 2], ['z', '3'], ['w', '4']]);
  assert.deepEqual(restored.entries(), [['z', '3'], ['w', '4']]);
  assert.equal(lruCache(2, 'junk').size, 0);
});
