import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { classicGames } from '../../src/library/classics.js';
import { openingGame, buildOpeningIndex, openingContinuations } from '../../src/openings/openings.js';

const start = new Chess().fen();
const game = (id, moves, result = '*', source = 'library') => openingGame(Chess, {
  id, pgn: `[Result "${result}"]\n\n${moves} ${result}`,
}, source);
const at = pgn => { const c = new Chess(); c.loadPgn(pgn); return c.fen(); };
const query = (records, fen = start, source = 'all') => openingContinuations(Chess, buildOpeningIndex(records), fen, source);

test('opening counts and White/draw/Black/unknown results come from the chosen records', () => {
  const records = [game('a', '1. e4 e5', '1-0', 'classic'), game('b', '1. e4 c5', '0-1'), game('c', '1. e4 e6', '1/2-1/2'), game('d', '1. e4', '*'), game('e', '1. d4 d5', '1-0')];
  const all = query(records);
  assert.equal(all.records, 5); assert.equal(all.games, 5);
  assert.deepEqual(all.moves.map(m => [m.san, m.games, m.white, m.draw, m.black, m.unknown]), [
    ['e4', 4, 1, 1, 1, 1], ['d4', 1, 1, 0, 0, 0],
  ]);
  assert.equal(query(records, start, 'classic').moves[0].games, 1);
  assert.equal(query(records, start, 'library').moves[0].games, 3);
  assert.equal(query(records, start, 'nonsense').records, 0);
});

test('transpositions merge by position and query counters do not split the graph', () => {
  const records = [game('a', '1. Nf3 d5 2. g3 Nf6 3. Bg2'), game('b', '1. g3 d5 2. Nf3 Nf6 3. c4')];
  const fen = at('1. Nf3 d5 2. g3 Nf6').split(' ').slice(0, 4).join(' ') + ' 42 27';
  const result = query(records, fen);
  assert.equal(result.games, 2);
  assert.deepEqual(result.moves.map(m => m.san).sort(), ['Bg2', 'c4']);
  assert.deepEqual(result.moves.map(m => m.examples[0].ply), [5, 5]);
});

test('a repeated position gets one vote per game, for its first continuation', () => {
  const result = query([game('cycle', '1. Nf3 Nf6 2. Ng1 Ng8 3. e4 e5')]);
  assert.equal(result.games, 1); assert.equal(result.ended, 0);
  assert.deepEqual(result.moves.map(m => [m.san, m.games]), [['Nf3', 1]]);
  assert.equal(query([game('cycle', '1. Nf3 Nf6 2. Ng1 Ng8')]).ended, 0);
});

test('records ending at a position do not inflate continuation frequencies or results', () => {
  const result = query([game('end', '1. e4', '0-1'), game('next', '1. e4 e5', '1-0')], at('1. e4'));
  assert.equal(result.games, 2); assert.equal(result.ended, 1);
  assert.deepEqual(result.moves.map(m => [m.san, m.games, m.white, m.black]), [['e5', 1, 1, 0]]);
});

test('side to move, castling rights and a legal en-passant opportunity remain distinct', () => {
  const records = [game('a', '1. e4 e5'), game('ep', '1. e4 a6 2. e5 d5 3. exd6')];
  assert.equal(query(records, start.replace(' w ', ' b ')).games, 0);
  assert.equal(query(records, start.replace(' KQkq ', ' Qkq ')).games, 0);
  const fen = at('1. e4 a6 2. e5 d5');
  assert.ok(fen.includes(' d6 '));
  assert.equal(query(records, fen).moves[0].uci, 'e5d6');
  assert.equal(query(records, fen.replace(' d6 ', ' - ')).games, 0);
});

test('whole corrupt games, empty games and custom-start studies are excluded', () => {
  assert.equal(game('bad', '1. e4 e5 2. Bh6'), null);
  assert.equal(game('empty', ''), null);
  assert.equal(openingGame(Chess, { id: 'missing' }, 'library'), null);
  assert.equal(openingGame(Chess, { pgn: '1. e4' }, 'invalid'), null);
  const records = classicGames().map(g => openingGame(Chess, g, 'classic'));
  assert.equal(query(records).records, 9);
  assert.equal(records.filter(r => r === null).length, 4);
  assert.equal(query(records).games, 9);
});

test('results use PGN headers; unknown or hostile result names stay unknown', () => {
  const conflicting = openingGame(Chess, { id: 'a', result: '0-1', pgn: '[Result "1-0"]\n\n1. e4 1-0' }, 'library');
  assert.equal(query([conflicting]).moves[0].white, 1);
  for (const value of ['constructor', '__proto__', 'unrated']) {
    const record = openingGame(Chess, { id: value, pgn: `[Result "${value}"]\n\n1. e4` }, 'library');
    assert.equal(query([record]).moves[0].unknown, 1);
  }
});

test('duplicate source/id records count once; the two corpora keep their own identities', () => {
  const a = game('same', '1. e4');
  const result = query([a, a, game('same', '1. d4', '*', 'classic')]);
  assert.equal(result.records, 2); assert.equal(result.games, 2);
});

test('annotated side lines are not counted as played continuations or extra results', () => {
  const record = openingGame(Chess, { id: 'annotated', pgn: '[Result "1-0"]\n\n1. e4 {A note saying 0-1} (1. d4 d5) e5 1-0' }, 'library');
  assert.deepEqual(query([record]).moves.map(m => [m.san, m.games, m.white]), [['e4', 1, 1]]);
});

test('promotions retain their UCI suffix and SAN is checked in the query position', () => {
  const opening = '1. a4 h5 2. a5 h4 3. a6 h3 4. axb7 hxg2';
  const result = query([game('promotion', `${opening} 5. bxa8=N`)], at(opening));
  assert.equal(result.moves[0].uci, 'b7a8n'); assert.equal(result.moves[0].san, 'bxa8=N');
  assert.deepEqual(query([], 'not a FEN').moves, []);
});
