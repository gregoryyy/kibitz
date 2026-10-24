import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { makeProvenance } from '../../src/library/library.js';
import { pgnImportIdentity, deduplicatePgnImport, splitPgnImport } from '../../src/library/import.js';

const record = (pgn = '[Event "Notebook"]\n[White "A"]\n[Black "B"]\n\n1. e4 {My note} e5 2. Nf3 $1 *', fields = {}) => ({ id: 'new', pgn, provenance: makeProvenance('imported'), ...fields });
const key = game => pgnImportIdentity(Chess, game);

test('PGN identity ignores outside whitespace, mainline number spacing and header order, retaining the first original record', () => {
  const a = record(), b = record('[Black "B"]\r\n[White "A"]\r\n[Event "Notebook"]\r\n\r\n1.e4 {My note}\r\ne5 2.Nf3$1 *', { id: 'other' });
  assert.equal(key(a), key(b));
  assert.deepEqual(deduplicatePgnImport(Chess, [a, b], []), { records: [a], duplicates: 1 });
  const saved = { ...a, id: 'saved', updatedAt: 1 }, before = structuredClone(saved);
  assert.deepEqual(deduplicatePgnImport(Chess, [b], [saved]), { records: [], duplicates: 1 });
  assert.deepEqual(saved, before);
});

test('different comments, glyphs, variations, headers, results and rights remain distinct source documents', () => {
  const a = record(), original = key(a);
  const variants = [
    record(a.pgn.replace('My note', 'Another note')), record(a.pgn.replace('My note', 'My  note')),
    record(a.pgn.replace('$1', '$2')), record(a.pgn.replace('e5 2.', 'e5 (2. Bc4) 2.')),
    record(a.pgn.replace('Notebook', 'Another event')), record(a.pgn.replace('[White "A"]', '[White "C"]')),
    record(a.pgn.replaceAll('*', '1-0')),
    record(a.pgn, { provenance: makeProvenance('imported', { title: 'Another source' }) }),
    record(a.pgn, { provenance: makeProvenance('imported', { score: 'CC0-1.0' }) }),
    record(a.pgn, { provenance: makeProvenance('imported', { annotations: 'Personal notes' }) }),
  ];
  for (const game of variants) { assert.ok(key(game)); assert.notEqual(key(game), original); }
  assert.equal(deduplicatePgnImport(Chess, variants, [a]).records.length, variants.length);
  // Distinct escapes/duplicate-header semantics must never disappear through normalization.
  assert.notEqual(key(record(a.pgn.replace('1. e4', '% original note\n1. e4'))), original);
  const one = record('[Event "A"]\n[Event "B"]\n\n1. e4 *'), two = record('[Event "B"]\n[Event "A"]\n\n1. e4 *');
  assert.notEqual(key(one), key(two));
});

test('full FEN counters, side, castling/en passant and position-only studies participate in identity', () => {
  const fen = '4k3/8/8/8/8/8/R7/4K3 w - - 0 17';
  const game = record(`[SetUp "1"]\n[FEN "${fen}"]\n\n{A study} *`);
  assert.ok(key(game));
  for (const changed of [fen.replace('0 17', '4 17'), fen.replace('0 17', '0 18')]) assert.notEqual(key(record(game.pgn.replace(fen, changed))), key(game));
  const standard = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const rooted = s => record(`[SetUp "1"]\n[FEN "${s}"]\n\n*`);
  assert.notEqual(key(rooted(standard)), key(rooted(standard.replace('KQkq', '-'))));
  assert.notEqual(key(rooted(standard)), key(rooted(standard.replace(' w ', ' b '))));
});

test('legacy records can match without migration; malformed or future metadata and PGN cannot suppress a new import', () => {
  const incoming = record(), old = { ...incoming }; delete old.provenance;
  assert.equal(key(old), key(incoming));
  for (const changed of [{ provenance: { version: 42, keep: true } }, { provenance: null }, { pgn: 'nonsense' }, { pgn: '*' }, { pgn: '1. e5 *' }, { pgn: 'x'.repeat(200_001) }]) {
    const saved = { ...old, ...changed }, before = structuredClone(saved);
    assert.equal(key(saved), null);
    assert.deepEqual(deduplicatePgnImport(Chess, [incoming], [saved]).records, [incoming]);
    assert.deepEqual(saved, before);
  }
});

test('bounded batch splitting handles adjacent/headerless games and does not split tag-like source text', () => {
  const a = '[Event "A"]\n\n1. e4 {A source\n\n[Event "not another game"]\n} e5 *';
  const b = '[Event "B"]\n\n1. d4 d5 *';
  assert.deepEqual(splitPgnImport(a + '\n' + b).games, [a, b]);
  assert.deepEqual(splitPgnImport('1. e4 e5 *\n1. d4 d5 *').games, ['1. e4 e5 *', '1. d4 d5 *']);
  assert.equal(splitPgnImport('1. e4 (1. d4 {\n[Event "RAV"]} d5) e5 *').games.length, 1);
  assert.equal(splitPgnImport('1. e4 ; [Event "comment"]\ne5 *').games.length, 1);
  assert.deepEqual(splitPgnImport(' \n').games, []);
  assert.ok(splitPgnImport('x'.repeat(5_000_001)).error);
  assert.ok(splitPgnImport(Array(501).fill('1. e4 *').join('\n')).error);
});
