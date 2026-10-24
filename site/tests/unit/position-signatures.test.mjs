import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { boardSignatures, checkedPieceTerms, POSITION_SIGNATURE_VERSION } from '../../src/chess/signatures.js';
import { material, epd, pawnSignature, buildPositionIndex, positionFeatureMatches } from '../../src/chess/knowledge.js';
import { compileLibraryGame, indexedLibraryPositions } from '../../src/library/library.js';
const fen = pgn => { const c = new Chess(); c.loadPgn(pgn); return c.fen(); };
const sig = pgn => boardSignatures(fen(pgn));
const position = (fen, ply = 12) => ({ id: 'occ-' + ply, documentId: 'game:library:a', fen, epd: epd(fen), pawns: pawnSignature(fen), ply });

test('colour-specific piece classes differ even at equal scalar material values; every square term has an actual occupant', () => {
  const start = new Chess(), features = boardSignatures(start.fen());
  assert.equal(features.version, POSITION_SIGNATURE_VERSION); assert.deepEqual(features.counts.w, { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 }); assert.deepEqual(features.counts.b, features.counts.w);
  assert.equal(features.pieces.length, 32); assert.ok(features.pieces.includes('wKe1')); assert.ok(features.pieces.includes('bNb8'));
  for (const term of features.pieces) assert.deepEqual([start.get(term.slice(2)).color, start.get(term.slice(2)).type], [term[0], term[1].toLowerCase()]);
  const queen = new Chess('7k/8/8/8/8/8/8/KQ6 w - - 0 1'), rookPawns = new Chess('7k/8/8/8/8/8/PPPP4/KR6 w - - 0 1');
  assert.equal(material(queen).w, material(rookPawns).w); assert.notEqual(boardSignatures(queen.fen()).material, boardSignatures(rookPawns.fen()).material);
  assert.notEqual(boardSignatures('7k/8/8/8/8/8/P7/K7 w - - 0 1').material, boardSignatures('7k/8/p7/8/8/8/8/K7 w - - 0 1').material);
});

test('transpositions and counters share geometry; turn/rights remain distinct EPD state', () => {
  const a = fen('1. Nf3 d5 2. g3 Nf6'), b = fen('1. g3 d5 2. Nf3 Nf6');
  assert.deepEqual(boardSignatures(a), boardSignatures(b)); assert.deepEqual(boardSignatures(a), boardSignatures(a.replace(/ \d+ \d+$/, ' 42 99')));
  for (const other of [a.replace(' w ', ' b '), a.replace(' KQkq ', ' - ')]) { assert.notEqual(epd(a), epd(other)); assert.deepEqual(boardSignatures(a), boardSignatures(other)); }
  assert.deepEqual(boardSignatures(epd(a)), boardSignatures(a));
  assert.equal(sig('1. Nf3').material, sig('1. Nc3').material); assert.notEqual(sig('1. Nf3').placement, sig('1. Nc3').placement);
});

test('captures, en passant, castling and each promotion update their real piece classes and squares', () => {
  const c = new Chess('4k3/8/8/8/8/8/1q6/KR6 w - - 0 1'); c.move('Rxb2');
  assert.equal(boardSignatures(c.fen()).counts.b.q, 0); assert.ok(boardSignatures(c.fen()).pieces.includes('wRb2'));
  const ep = new Chess(); ep.loadPgn('1. e4 a6 2. e5 d5 3. exd6'); const after = boardSignatures(ep.fen());
  assert.equal(after.counts.w.p, 8); assert.equal(after.counts.b.p, 7); assert.ok(after.pieces.includes('wPd6')); assert.ok(!after.pieces.includes('bPd5'));
  const castle = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'), before = boardSignatures(castle.fen()); castle.move('O-O');
  const moved = boardSignatures(castle.fen()); assert.equal(moved.material, before.material); assert.ok(moved.pieces.includes('wKg1') && moved.pieces.includes('wRf1')); assert.ok(!moved.pieces.includes('wKe1') && !moved.pieces.includes('wRh1'));
  const keys = new Set();
  for (const promotion of ['q', 'r', 'b', 'n']) {
    const game = new Chess('7k/P7/8/8/8/8/8/7K w - - 0 1'); game.move({ from: 'a7', to: 'a8', promotion }); const result = boardSignatures(game.fen());
    assert.equal(result.counts.w.p, 0); assert.equal(result.counts.w[promotion], 1); assert.ok(result.pieces.includes('w' + promotion.toUpperCase() + 'a8')); keys.add(result.material);
  }
  assert.equal(keys.size, 4);
});

test('encoding validation rejects malformed queries and piece terms, without treating geometry as a legal-history check', () => {
  const query = sig('1. Nf3 d5');
  assert.deepEqual(checkedPieceTerms(query, ['wNf3', 'bPd5']), ['bPd5', 'wNf3']);
  for (const terms of [[], ['wNf3', 'wNf3'], ['wNg1'], ['__proto__'], ['bQz9'], 'wNf3']) assert.throws(() => checkedPieceTerms(query, terms));
  for (const value of [null, '', 'invalid', new Chess().fen().replace('rnbqkbnr', '9'), new Chess().fen().replace('RNBQKBNR', 'RNBQKZNR'), new Chess().fen().replace('KQkq', 'KK'), new Chess().fen().replace(' w ', ' x '), new Chess().fen().replace('0 1', '-1 0')]) assert.throws(() => boardSignatures(value));
});

test('feature indexes derive board facts independently of supplied assertions and preserve scoped/repeated occurrences', () => {
  const a = fen('1. Nf3 d5'), b = fen('1. Nc3 d5'), wrong = fen('1. Nf3 e5');
  const rows = [position(a, 1), { ...position(a, 5), id: 'repeat-5' }, position(b, 6), position(wrong, 7)];
  rows[0].signatures = { material: 'forged', pieces: ['bQa1'], placement: 'fake' };
  const games = [{ id: 'same', collection: 'library', positions: rows }, { id: 'same', collection: 'classic', positions: [{ ...position(a, 2), documentId: 'game:classic:same' }] }];
  const index = buildPositionIndex(games), query = boardSignatures(a);
  assert.equal(index.byMaterial.get(query.material).length, 5); assert.equal(index.byPlacement.get(query.placement).length, 3); assert.equal(index.byPieceSquare.get('wNf3').length, 4); assert.equal(index.byMaterial.has('forged'), false);
  assert.deepEqual(positionFeatureMatches(index, a, { by: 'pieces', pieces: ['wNf3', 'bPd5'] }).map(r => [r.g.collection, r.p.ply]), [['library', 1], ['library', 5], ['classic', 2]]);
  const scoped = positionFeatureMatches(index, a, { by: 'placement', collection: 'classic', documentId: 'game:classic:same' });
  assert.equal(scoped.length, 1); assert.equal(scoped[0].kind, 'same piece placement'); assert.equal(scoped[0].matched.material, true);
  const hit = positionFeatureMatches(index, a, { by: 'pieces', pieces: ['wNf3'] })[0]; hit.matched.pieces.push('fake');
  assert.deepEqual(positionFeatureMatches(index, a, { by: 'pieces', pieces: ['wNf3'], limit: 1 })[0].matched.pieces, ['wNf3']);
});

test('feature lookups are bounded and reject invalid filters without broadening source scope', () => {
  const f = new Chess().fen(), index = buildPositionIndex([{ id: 'a', collection: 'library', positions: Array.from({ length: 30 }, (_, ply) => position(f, ply)) }]);
  assert.equal(positionFeatureMatches(index, f, { limit: 20 }).length, 20); assert.equal(positionFeatureMatches(index, f, { collection: 'classic' }).length, 0);
  for (const options of [{ limit: 0 }, { limit: 21 }, { limit: NaN }, { by: 'score' }, { collection: '__proto__' }, { documentId: {} }, { by: 'material', pieces: ['wKe1'] }]) assert.throws(() => positionFeatureMatches(index, f, options));
  assert.throws(() => positionFeatureMatches(index, 'invalid'));
});

test('compiled positions and occurrences retain geometry alongside full-FEN/source identities through revision changes', async () => {
  const game = { id: 'source', kind: 'study', pgn: '1. Nf3 {First note.} Nf6 2. Ng1 Ng8 3. Nf3 *', signatures: { material: 'do not trust' } };
  const original = await compileLibraryGame(Chess, game, 'library'), changed = await compileLibraryGame(Chess, { ...game, pgn: game.pgn.replace('First note.', 'Changed source note.') }, 'library');
  for (const occurrence of original.occurrences) {
    assert.deepEqual(occurrence.signatures, boardSignatures(occurrence.fen));
    assert.deepEqual(original.positions.find(p => p.id === occurrence.positionId).signatures, occurrence.signatures);
  }
  assert.equal(original.document.id, changed.document.id); assert.notEqual(original.document.revision, changed.document.revision);
  assert.deepEqual(original.occurrences[1].signatures, changed.occurrences[1].signatures); assert.notEqual(original.occurrences[1].id, changed.occurrences[1].id);
  assert.deepEqual(original.occurrences[1].signatures, original.occurrences[5].signatures); assert.notEqual(original.occurrences[1].fen, original.occurrences[5].fen);
  const index = buildPositionIndex([{ ...game, collection: 'library', positions: indexedLibraryPositions(original) }]);
  const hits = positionFeatureMatches(index, original.occurrences[1].fen, { by: 'placement' });
  assert.deepEqual(hits.map(h => h.p.id), [original.occurrences[1].id, original.occurrences[5].id]);
});
