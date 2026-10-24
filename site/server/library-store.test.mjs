import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createLibraryStore, LIBRARY_LIMITS } from './library-store.mjs';
const a = 'a'.repeat(64), b = 'b'.repeat(64);
const put = (id, pgn = '1. e4 *', collection = 'games') => ({ collection, id, record: { id, pgn } });
const del = (id, collection = 'games') => ({ collection, id, record: null });
const code = expected => error => error.code === expected;
const temporary = run => {
  const dir = mkdtempSync(path.join(tmpdir(), 'kibitz-library-'));
  try { return run(path.join(dir, 'library.sqlite')); } finally { rmSync(dir, { recursive: true, force: true }); }
};

test('atomic owner erasure preserves other owners and a revision tombstone rejects older writes after restart', () => temporary(filename => {
  let store = createLibraryStore(filename);
  store.change(a, 0, [put('game'), put('note', 'private note', 'books')]); store.change(b, 0, [put('other')]);
  assert.throws(() => store.erase(a, 0), code('conflict')); assert.equal(store.read(a).games.length, 1);
  assert.deepEqual(store.erase(a, 1), { version: 1, scope: a, revision: 2, games: [], books: [] });
  assert.deepEqual(store.read(b).games.map(g => g.id), ['other']);
  assert.throws(() => store.change(a, 1, [put('resurrect')]), code('conflict'));
  store.close(); store = createLibraryStore(filename);
  try { assert.equal(store.read(a).revision, 2); assert.deepEqual(store.read(a).games, []); assert.throws(() => store.change(a, 1, [put('late')]), code('conflict')); }
  finally { store.close(); }
}));

test('erasing an empty owner advances its revision and malformed erase requests leave records unchanged', () => {
  const store = createLibraryStore();
  try {
    assert.equal(store.erase(a, 0).revision, 1);
    for (const revision of [-1, 0.5, '1', Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => store.erase(a, revision), code('invalid_changes'));
    assert.throws(() => store.erase('invalid', 1), code('invalid_owner')); assert.equal(store.read(a).revision, 1);
  } finally { store.close(); }
});

test('SQLite records persist across restart without rewriting unknown metadata or original PGN bytes', () => temporary(filename => {
  const original = { id: 'stable', pgn: '[White "Réti"]\r\n\r\n1. e4 {note} *', provenance: { version: 99, future: 'retain' }, extra: ['original'] };
  let store = createLibraryStore(filename);
  assert.deepEqual(store.read(a), { version: 1, scope: a, revision: 0, games: [], books: [] });
  store.change(a, 0, [{ collection: 'games', id: original.id, record: original }, { collection: 'books', id: 'book', record: { id: 'book', title: '<img src=x>', note: 'literal' } }]);
  store.close(); store = createLibraryStore(filename);
  try { assert.deepEqual(store.read(a).games, [original]); assert.equal(store.read(a).books[0].title, '<img src=x>'); assert.equal(store.read(a).revision, 1); }
  finally { store.close(); }
}));

test('owners and collections isolate equal IDs, and SQL-looking names remain bound literal data', () => {
  const store = createLibraryStore(), hostile = "x'); DROP TABLE records;--";
  try {
    store.change(a, 0, [put('same'), put(hostile), put('same', 'book data', 'books')]);
    store.change(b, 0, [put('same', '1. d4 *')]);
    assert.equal(store.read(a).games.length, 2); assert.equal(store.read(a).books.length, 1); assert.equal(store.read(b).games[0].pgn, '1. d4 *');
    store.change(a, 1, [del('same'), del(hostile)]);
    assert.deepEqual(store.read(a).games, []); assert.equal(store.read(a).books.length, 1); assert.equal(store.read(b).games.length, 1);
    assert.throws(() => store.read('not a server-derived hash'), code('invalid_owner'));
  } finally { store.close(); }
});

test('optimistic revisions reject stale clients across independent connections and preserve their previous records', () => temporary(filename => {
  const first = createLibraryStore(filename), second = createLibraryStore(filename);
  try {
    first.change(a, 0, [put('old')]);
    assert.throws(() => second.change(a, 0, [del('old'), put('replacement')]), code('conflict'));
    assert.equal(second.read(a).revision, 1); assert.deepEqual(second.read(a).games.map(g => g.id), ['old']);
    assert.equal(second.change(a, 1, [put('next')]).revision, 2);
    assert.deepEqual(first.read(a).games.map(g => g.id), ['next', 'old']);
    assert.equal(first.change(a, 2, []).revision, 2);
  } finally { first.close(); second.close(); }
}));

test('a quota failure rolls back the complete SQL batch including an earlier deletion and revision increment', () => {
  const store = createLibraryStore(':memory:', { ...LIBRARY_LIMITS, totalBytes: 160 });
  try {
    const before = store.change(a, 0, [put('keep')]);
    assert.throws(() => store.change(a, 1, [del('keep'), put('too-big', 'x'.repeat(200))]), code('quota'));
    assert.deepEqual(store.read(a), before);
    assert.equal(store.change(a, 1, [put('small')]).revision, 2);
  } finally { store.close(); }
});

test('record/count/batch bounds and duplicate change IDs fail without partial writes', () => {
  const store = createLibraryStore(':memory:', { ...LIBRARY_LIMITS, records: 1, recordBytes: 120, batchBytes: 130, changes: 2 });
  try {
    const before = store.change(a, 0, [put('one')]);
    for (const changes of [[put('two')], [put('two', 'x'.repeat(150))], [put('two'), put('two')], [put('two'), put('three'), put('four')], [put('two', 'x'.repeat(80)), put('three', 'x'.repeat(80))]]) assert.throws(() => store.change(a, 1, changes));
    for (const changes of [[{ ...put('bad'), owner: b }], [{ ...put('bad'), collection: 'users' }], [{ ...put('bad'), id: 'different' }], [put('')], [put('x'.repeat(101))], [put('\ud800')], [put('line\nbreak')]]) assert.throws(() => store.change(a, 1, changes));
    assert.deepEqual(store.read(a), before);
    assert.throws(() => store.change(a, -1, []), code('invalid_changes'));
  } finally { store.close(); }
});

test('future, unknown and incomplete schemas are rejected without deleting their existing data', () => temporary(filename => {
  let db = new DatabaseSync(filename); db.exec('CREATE TABLE future(secret TEXT); INSERT INTO future VALUES(\'keep\'); PRAGMA user_version=2;'); db.close();
  assert.throws(() => createLibraryStore(filename), code('unsupported_schema'));
  db = new DatabaseSync(filename); assert.equal(db.prepare('SELECT secret FROM future').get().secret, 'keep'); db.exec('PRAGMA user_version=0;'); db.close();
  assert.throws(() => createLibraryStore(filename), code('unknown_schema'));
  db = new DatabaseSync(filename); assert.equal(db.prepare('SELECT secret FROM future').get().secret, 'keep'); db.exec('PRAGMA user_version=1;'); db.close();
  assert.throws(() => createLibraryStore(filename));
  db = new DatabaseSync(filename); assert.equal(db.prepare('SELECT secret FROM future').get().secret, 'keep'); db.close();
}));
