import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { repertoireLine, boardRepertoireLine, repertoireIndex, repertoireChoices, repertoirePgn, createRepertoireStore } from '../../src/repertoire.js';

const start = new Chess().fen();
const line = pgn => repertoireLine(Chess, pgn);
const saved = (id, pgn, extra = {}) => ({ id, name: id, note: '', moves: line(pgn).ucis, ...extra });
const rep = (lines = [saved('main', '1. e4 e5 2. Nf3')], extra = {}) => ({ id: 'r1', name: 'My White lines', color: 'w', lines, ...extra });
function memory() {
  const data = new Map(); let blocked = false;
  return { getItem: k => data.get(k) ?? null, setItem: (k, v) => { if (blocked) throw new Error('quota'); data.set(k, v); }, block: value => { blocked = value; }, data };
}

test('PGN mainlines become legal canonical UCI; corrupt lines and nonstandard starts are rejected', () => {
  const result = line('1. e4 {a note} (1. d4 d5) e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O');
  assert.equal(result.ucis.at(-1), 'e1g1'); assert.equal(result.sans.at(-1), 'O-O');
  assert.equal(result.fens.length, 10);
  assert.equal(line('1. e4 e5 2. Bh6'), null);
  assert.equal(line('[SetUp "1"]\n[FEN "8/8/8/8/8/2k5/8/K7 w - - 0 1"]\n\n1. Ka2'), null);
  assert.equal(repertoireLine(Chess, ['e2e5']), null);
  assert.equal(repertoireLine(Chess, ['e2e4', null]), null);
  assert.deepEqual(line('').ucis, []);
});

test('long lines are kept in full, overflow is rejected, and promotions keep their suffix', () => {
  const cycle = ['g1f3', 'g8f6', 'f3g1', 'f6g8'];
  assert.equal(repertoireLine(Chess, Array.from({ length: 50 }, () => cycle).flat()).ucis.length, 200);
  assert.equal(repertoireLine(Chess, [...Array.from({ length: 50 }, () => cycle).flat(), 'e2e4']), null);
  assert.equal(line('1. a4 h5 2. a5 h4 3. a6 h3 4. axb7 hxg2 5. bxa8=N').ucis.at(-1), 'b7a8n');
});

test('board capture combines the game prefix with only the displayed scratch moves', () => {
  const base = line('1. e4 e5 2. Nf3');
  const c = new Chess(base.fens.at(-1)); c.move('Nc6'); const next = c.move('Bb5');
  const scratch = { start: base.fens.at(-1), ucis: ['b8c6', next.from + next.to], i: 1 };
  assert.deepEqual(boardRepertoireLine(Chess, start, base.ucis, scratch).sans, ['e4', 'e5', 'Nf3', 'Nc6']);
  assert.deepEqual(boardRepertoireLine(Chess, start, base.ucis.slice(0, 1)).sans, ['e4']);
});

test('a scratch alternative rooted at an ancestor uses that prefix, not the current cursor', () => {
  const base = line('1. e4 e5 2. Nf3 Nc6');
  const scratch = { start: base.fens[1], ucis: ['c7c5', 'g1f3'], i: 2 };
  assert.deepEqual(boardRepertoireLine(Chess, start, base.ucis, scratch).sans, ['e4', 'c5', 'Nf3']);
  const repeated = line('1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3');
  const after = { start: repeated.fens[5], ucis: ['d7d5'], i: 1 };
  assert.deepEqual(boardRepertoireLine(Chess, start, repeated.ucis, after).sans, [...repeated.sans, 'd5']);
  const returned = repeated.ucis.slice(0, 4);
  assert.deepEqual(boardRepertoireLine(Chess, start, returned, { start: repeated.fens[4], ucis: ['e2e4'], i: 1 }).sans, ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'e4']);
});

test('disconnected/custom positions cannot invent a game prefix; a standalone saved opening still works', () => {
  const base = line('1. e4 e5'), other = line('1. d4 d5');
  assert.equal(boardRepertoireLine(Chess, start, base.ucis, { start: other.fens.at(-1), ucis: ['c2c4'], i: 1 }), null);
  assert.equal(boardRepertoireLine(Chess, other.fens.at(-1), ['c2c4']), null);
  assert.deepEqual(boardRepertoireLine(Chess, other.fens.at(-1), [], { start, ucis: base.ucis, i: 1 }).sans, ['e4']);
  for (const i of [-1, 9, 0.5]) assert.equal(boardRepertoireLine(Chess, start, [], { start, ucis: ['e2e4'], i }), null);
  assert.equal(boardRepertoireLine(Chess, start, base.ucis, { start: base.fens[1].replace(' KQkq ', ' Qkq '), ucis: [], i: 0 }), null);
});

test('repertoire choices join transpositions, deduplicate moves and appear only for the chosen side', () => {
  const r = rep([saved('a', '1. Nf3 d5 2. g3 Nf6 3. Bg2'), saved('b', '1. g3 d5 2. Nf3 Nf6 3. c4'), saved('c', '1. g3 d5 2. Nf3 Nf6 3. Bg2')]);
  const fen = line('1. Nf3 d5 2. g3 Nf6').fens.at(-1).replace(' 0 3', ' 72 99');
  const index = repertoireIndex(Chess, r);
  assert.deepEqual(repertoireChoices(Chess, index, 'w', fen).map(m => m.san), ['c4', 'Bg2']);
  assert.deepEqual(repertoireChoices(Chess, index, 'b', fen), []);
  assert.deepEqual(repertoireChoices(Chess, index, 'w', 'bad FEN'), []);
  assert.deepEqual(repertoireChoices(Chess, index, 'w', fen.replace(' KQkq ', ' Qkq ')), []);
  assert.equal(repertoireChoices(Chess, index, 'b', line('1. g3').fens.at(-1))[0].san, 'd5');
});

test('repertoires persist separately from games with stable ids, side, trimmed names and literal notes', () => {
  const storage = memory(), store = createRepertoireStore(Chess, storage);
  storage.setItem('kibitz.games', 'unrelated game data');
  const r = rep([saved('main', '1. e4 c5', { note: '<img src=x>\nKeep this note.' })], { name: '  Black replies  ', color: 'b' });
  assert.equal(store.save([r]), null);
  assert.equal(store.revision, 1);
  assert.equal(createRepertoireStore(Chess, storage).items[0].name, 'Black replies');
  assert.equal(createRepertoireStore(Chess, storage).items[0].lines[0].note, '<img src=x>\nKeep this note.');
  assert.equal(storage.getItem('kibitz.games'), 'unrelated game data');
  assert.equal(store.save([]), null);
  assert.deepEqual(createRepertoireStore(Chess, storage).items, []);
});

test('failed writes never publish edited or deleted data; a later successful save can recover', () => {
  const storage = memory(), store = createRepertoireStore(Chess, storage), initial = rep();
  assert.equal(store.save([initial]), null); const raw = storage.getItem('kibitz.repertoires');
  storage.block(true);
  assert.equal(store.save([rep([], { name: 'Changed' })]), 'storage');
  assert.equal(store.save([]), 'storage');
  assert.deepEqual(store.items, [initial]); assert.equal(store.revision, 1);
  assert.equal(storage.getItem('kibitz.repertoires'), raw);
  storage.block(false); assert.equal(store.save([]), null); assert.deepEqual(store.items, []);
  assert.equal(createRepertoireStore(Chess, null).save([initial]), 'storage');
});

test('corrupt JSON, invalid stored moves and unknown versions are kept untouched and read-only', () => {
  for (const raw of ['{broken', JSON.stringify({ version: 2, items: [] }), JSON.stringify({ version: 1, items: [rep([{ ...saved('bad', '1. e4'), moves: ['e2e5'] }])] })]) {
    const storage = memory(); storage.setItem('kibitz.repertoires', raw);
    const store = createRepertoireStore(Chess, storage);
    assert.equal(store.unreadable, true); assert.deepEqual(store.items, []);
    assert.equal(store.save([]), 'unreadable'); assert.equal(storage.getItem('kibitz.repertoires'), raw);
  }
});

test('duplicate paths/identities, empty lines and invalid metadata cannot overwrite valid data', () => {
  const storage = memory(), store = createRepertoireStore(Chess, storage), r = rep(); store.save([r]);
  for (const invalid of [
    [r, r], [rep([saved('same', '1. e4'), saved('same', '1. d4')])],
    [rep([saved('a', '1. e4'), saved('b', '1. e4')])], [rep([{ id: 'empty', name: 'Empty', note: '', moves: [] }])],
    [rep([], { name: ' ' })], [rep([], { color: 'x' })], [rep([saved('note', '1. e4', { note: {} })])],
    [rep([saved('large', '1. e4', { note: 'x'.repeat(2001) })])],
  ]) { assert.equal(store.save(invalid), 'invalid'); assert.deepEqual(store.items, [r]); }
});

test('callers cannot mutate stored snapshots or saved input objects behind the store', () => {
  const store = createRepertoireStore(Chess, memory()), r = rep(); store.save([r]);
  r.lines[0].moves[0] = 'a2a4'; store.items[0].lines[0].name = 'Modified';
  assert.equal(store.items[0].lines[0].moves[0], 'e2e4'); assert.equal(store.items[0].lines[0].name, 'main');
});

test('PGN export retains legal moves/notes and contains user text inside headers and comments', () => {
  const r = rep([saved('a', '1. e4 c5', { name: 'Line "name"', note: 'First {nested} note } { then [Result "1-0"]' }), saved('b', '1. d4 d5')], { name: 'Name"\n[Result "1-0"]\\', color: 'b' });
  const pgn = repertoirePgn(Chess, r), records = pgn.split(/\n\n(?=\[Event)/);
  assert.equal(records.length, 2);
  for (const text of records) {
    const c = new Chess(); c.loadPgn(text);
    assert.equal(c.getHeaders().Result, '*'); assert.equal(c.getHeaders().KibitzRepertoireSide, 'b');
    assert.equal(c.history().length, 2);
  }
  assert.ok(records[0].includes('First  nested  note'));
});
