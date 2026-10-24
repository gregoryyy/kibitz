import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { boardProfile, buildHybridIndex, reciprocalRanks, searchHybrid } from '../../src/library/hybrid-search.js';

const IQP = 'r2q1rk1/ppp2ppp/2n2n2/8/3P4/2N2N2/PP3PPP/R2Q1RK1 w - - 0 20';
/** Detached source fixtures: the oracle supplies boards and literal text, not production scores. */
const passage = (id, text, extra = {}) => ({ id, sourceId: 'source:' + id, documentId: id, revision: 'r1', kind: 'annotation', language: 'und', title: 'Study', sourceTitle: 'Original', author: '', licence: '', text, locator: { format: 'pgn', unit: 'utf-16', start: 5, end: 5 + text.length }, occurrenceId: id + ':ply:3', annotationId: id + ':note', fen: null, ply: 3, gameId: id, collection: 'library', guideId: null, ...extra });
const guide = (id, text, language = 'en') => passage(id, text, { kind: 'guide', guideId: id, language, collection: null });

test('rank fusion agrees with independent fractions and rejects duplicate or unbounded channel lists', () => {
  const scores = reciprocalRanks([['a', 'b'], ['b', 'c']]);
  assert.equal(scores.get('a'), 1 / 61); assert.equal(scores.get('b'), 1 / 62 + 1 / 61); assert.equal(scores.get('c'), 1 / 62);
  assert.throws(() => reciprocalRanks([['a', 'a']]));
  assert.throws(() => reciprocalRanks([Array.from({ length: 21 }, (_, i) => String(i))]));
});

test('only legal boards supply features; metadata prose cannot create a detected motif', () => {
  const p = boardProfile(Chess, IQP); assert.ok(p.tags.includes('iqp')); assert.equal(p.check, false); assert.equal(p.phase, 'middlegame');
  assert.throws(() => boardProfile(Chess, 'broken'));
  assert.throws(() => boardProfile(Chess, '4k3/8/8/8/8/8/4R3/4K3 w - - 0 1'));
  const fake = passage('invented', 'Checkmate fork pin', { title: 'IQP', tags: ['iqp'] });
  const index = buildHybridIndex(Chess, [fake]);
  assert.deepEqual(searchHybrid(index, 'missing', { fen: IQP }), []);
});

test('fusion uses canonical sources and reranking favours complete literal coverage before an unrelated exact board', () => {
  const a = passage('a', '<script>king shelter</script>'), b = passage('b', 'unrelated', { fen: IQP });
  const index = buildHybridIndex(Chess, [b, a]);
  const hits = searchHybrid(index, 'king shelter', { fen: IQP, dense: [{ passage: { ...b, text: 'forged' }, score: 1e30 }, { passage: { ...a, sourceId: 'forged' }, score: -1e30 }] });
  assert.deepEqual(hits.map(h => h.passage.id), ['a', 'b']); assert.equal(hits[0].evidence.complete, true);
  assert.equal(hits[0].passage.sourceId, 'source:a'); assert.match(hits[0].excerpt.text, /<script>/);
  assert.equal(hits[1].evidence.board, 'exact'); assert.deepEqual(hits[0].evidence.channels, ['keywords', 'meaning']);
  hits[0].passage.locator.start = 100; assert.equal(index.text.documents[1].passage.locator.start, 5);
});

test('board and tag channels distinguish quiet analogies, checks, side to move and pawnless positions', () => {
  const quiet = passage('quiet', 'Plan', { fen: IQP.replace('R2Q1RK1', 'R2QR1K1') });
  const checked = passage('checked', 'Plan', { fen: IQP.replace('r2q1rk1', 'r2qr1k1').replace('R2Q1RK1', 'R2QK2R') });
  const other = passage('other', 'Plan', { fen: IQP.replace(' w ', ' b ') });
  const index = buildHybridIndex(Chess, [quiet, checked, other, guide('iqp', 'Plan'), guide('french-chain', 'Plan')]);
  const hits = searchHybrid(index, 'Plan', { fen: IQP }), byId = new Map(hits.map(h => [h.passage.id, h]));
  assert.equal(byId.get('quiet').evidence.board, 'pawns'); assert.ok(byId.get('quiet').evidence.tags.includes('iqp'));
  assert.equal(byId.get('checked').evidence.board, ''); assert.deepEqual(byId.get('checked').evidence.tags, []);
  assert.equal(byId.get('other').evidence.board, ''); assert.deepEqual(byId.get('other').evidence.tags, []);
  assert.ok(byId.get('iqp').evidence.tags.includes('iqp')); assert.deepEqual(byId.get('french-chain').evidence.tags, []);
  const pawnless = '4k3/8/8/8/8/8/8/R3K2r w - - 0 20';
  const empty = buildHybridIndex(Chess, [passage('rook', 'Plan', { fen: pawnless })]);
  assert.equal(searchHybrid(empty, 'Plan', { fen: pawnless.replace('R3K2r', 'R2K3r') })[0].evidence.board, '');
});

test('all-term filtering can abstain without pretending to verify support, and preserves German move aliases', () => {
  const index = buildHybridIndex(Chess, [passage('mate', 'Qxf7 wins'), passage('rook', 'The rook can draw')]);
  const dense = index.text.documents.map(d => ({ passage: d.passage, score: 1 }));
  assert.equal(searchHybrid(index, 'quantum knight teleportation', { dense }).length, 2);
  assert.deepEqual(searchHybrid(index, 'quantum knight teleportation', { dense, allTerms: true }), []);
  assert.deepEqual(searchHybrid(index, 'Syzygy proof rook draw', { dense, allTerms: true }), []);
  assert.deepEqual(searchHybrid(index, 'the und für', { dense }), []);
  assert.deepEqual(searchHybrid(index, 'Dxf7', { allTerms: true }).map(h => h.passage.id), ['mate']);
  assert.deepEqual(searchHybrid(index, 'rook draw', { allTerms: true }).map(h => h.passage.id), ['rook']);
});

test('filters precede all four channels; invalid, stale and cross-scope dense references fail closed', () => {
  const mine = passage('mine', 'king'), classic = passage('classic', 'king', { collection: 'classic' });
  const index = buildHybridIndex(Chess, [mine, classic, guide('iqp', 'king', 'de')]);
  assert.deepEqual(searchHybrid(index, 'king', { collection: 'library' }).map(h => h.passage.id), ['mine']);
  for (const dense of [[{ passage: classic, score: 1 }], [{ passage: { ...mine, id: 'old-revision' }, score: 1 }], [{ passage: mine, score: NaN }], [{ passage: mine, score: 1 }, { passage: mine, score: 1 }]]) assert.throws(() => searchHybrid(index, 'king', { dense, collection: 'library' }));
  assert.throws(() => searchHybrid(index, 'king', { limit: 0 }));
  assert.throws(() => searchHybrid(index, 'king', { language: 'unknown' }));
});
