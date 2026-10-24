import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIBRARY_LIMITS, libraryRecordId, validateLibrarySnapshot } from '../../src/library/storage.js';
const scope = 'a'.repeat(64);
const snapshot = () => ({ version: 1, scope, revision: 0, games: [{ id: 'g', pgn: '1. e4 *', provenance: { version: 99, retain: 'original' } }], books: [{ id: 'g', title: '<img src=x>', note: 'literal', tags: ['pin'] }] });

test('wire snapshots preserve opaque record/provenance fields and scoped collection identities without granting proof', () => {
  const original = snapshot(), before = JSON.stringify(original); assert.equal(validateLibrarySnapshot(original), original); assert.equal(JSON.stringify(original), before);
  for (const id of ['plain', 'Réti', '♟-😀', "x'); --"]) assert.equal(libraryRecordId(id), true);
  for (const id of ['', 'x'.repeat(101), 'line\nbreak', '\ud800', '\udfff', null, {}]) assert.equal(libraryRecordId(id), false);
  const duplicate = snapshot(); duplicate.games.push({ ...duplicate.games[0] }); assert.throws(() => validateLibrarySnapshot(duplicate));
});

test('future/invalid envelopes, owners, revisions and records cannot become a current snapshot', () => {
  for (const change of [s => { s.version = 99; }, s => { s.scope = 'other-account'; }, s => { s.revision = -1; }, s => { s.revision = Number.MAX_SAFE_INTEGER + 1; }, s => { s.games = {}; }, s => { s.books = null; }, s => { s.games[0] = null; }]) {
    const value = snapshot(); change(value); assert.throws(() => validateLibrarySnapshot(value));
  }
  assert.throws(() => validateLibrarySnapshot(null));
  const cycle = snapshot(); cycle.games[0].self = cycle; assert.throws(() => validateLibrarySnapshot(cycle));
});

test('record, aggregate and UTF-8 byte limits apply independently of array counts or UTF-16 character counts', () => {
  const tooMany = snapshot(); tooMany.books = []; tooMany.games = Array.from({ length: LIBRARY_LIMITS.records + 1 }, (_, i) => ({ id: 'g' + i })); assert.throws(() => validateLibrarySnapshot(tooMany));
  const tooLarge = snapshot(); tooLarge.games[0].note = 'x'.repeat(LIBRARY_LIMITS.recordBytes); assert.throws(() => validateLibrarySnapshot(tooLarge));
  const unicode = snapshot(); unicode.games[0].note = 'é'.repeat(600_000); assert.throws(() => validateLibrarySnapshot(unicode));
  const total = snapshot(); total.books = []; total.games = Array.from({ length: 21 }, (_, i) => ({ id: 'g' + i, note: 'x'.repeat(999_000) })); assert.throws(() => validateLibrarySnapshot(total));
});
