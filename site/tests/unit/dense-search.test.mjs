import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DenseSession, buildDenseIndex, searchDense, selectPassages, normaliseVector, passageEmbeddingText, EMBEDDING_INPUT_VERSION } from '../../src/library/dense-search.js';

const identity = { provider: 'mock', model: 'vectors', revision: 'r1', fingerprint: 'endpoint-model-r1', scope: 'account-a', inputVersion: EMBEDDING_INPUT_VERSION };
const metadata = { ...identity, providerModel: 'vectors-r1', dimensions: 2 };
const passage = (id, text = 'Protect the king', extra = {}) => ({ id, sourceId: 'source:' + id, documentId: id, revision: 'text-r1', kind: 'annotation', language: 'und', title: 'Study', sourceTitle: 'Original', author: '', licence: '', text, locator: { format: 'pgn', unit: 'utf-16', start: 5, end: 5 + text.length }, occurrenceId: id + ':ply:3', annotationId: id + ':note', fen: 'source-fen', ply: 3, gameId: id, collection: 'library', guideId: null, ...extra });
const batch = (vectors, overrides = {}) => ({ vectors, metadata: { ...metadata, ...overrides } });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

test('scope filters precede ingestion; literal inputs exclude unrelated text and preserve source records', async () => {
  const corpus = [passage('mine'), passage('classic', 'A fork', { collection: 'classic' }), passage('en', 'Plan', { kind: 'guide', language: 'en', collection: null }), passage('de', 'Plan', { kind: 'guide', language: 'de', collection: null })];
  assert.deepEqual(selectPassages(corpus, { collection: 'library', language: 'de' }).map(p => p.id), ['mine']);
  assert.deepEqual(selectPassages(corpus, { kind: 'guide', language: 'de' }).map(p => p.id), ['de']);
  assert.throws(() => selectPassages(corpus, { language: 'xx' }));
  const calls = [], session = new DenseSession(async texts => { calls.push(texts); return batch(texts.map(() => [1, 0])); });
  const selected = selectPassages(corpus, { collection: 'library' });
  await session.build(selected, identity);
  assert.deepEqual(calls, [['Study\nProtect the king']]);
  assert.equal(passageEmbeddingText(selected[0]), calls[0][0]);
  selected[0].text = 'edited';
  assert.equal(session.index.passages[0].text, 'Protect the king');
  assert.equal(session.index.passages[0].locator.start, 5);
});

test('cosine ranking agrees with independent geometry, ties use IDs, and returned data is detached', () => {
  const index = buildDenseIndex([passage('b'), passage('a'), passage('diagonal'), passage('opposite')], [[1, 0], [3, 0], [3, 4], [-1, 0]], metadata);
  const hits = searchDense(index, [2, 0]);
  assert.deepEqual(hits.map(h => h.passage.id), ['a', 'b', 'diagonal']);
  assert.equal(hits[0].score, 1); assert.ok(Math.abs(hits[2].score - 3 / 5) < 1e-14);
  hits[0].passage.locator.start = 100; hits[0].passage.text = 'changed';
  assert.equal(index.passages[1].locator.start, 5); assert.equal(index.passages[1].text, 'Protect the king');
  assert.deepEqual(searchDense(index, [0, -1]), []);
  assert.deepEqual(searchDense(index, [1, 0], { collection: 'classic' }), []);
  assert.throws(() => searchDense(index, [1, 0], { limit: 0 }));
});

test('invalid dimensions, nonfinite and zero vectors fail closed, while large finite vectors are safe', () => {
  for (const v of [[], [0, 0], [NaN, 1], [Infinity, 1], ['1', 1], [1]]) assert.throws(() => normaliseVector(v, 2));
  assert.ok(Math.abs(normaliseVector([1e300, 1e300])[0] - Math.SQRT1_2) < 1e-14);
  assert.throws(() => buildDenseIndex([passage('a')], [[1, 0]], { ...metadata, dimensions: 3 }));
  assert.throws(() => buildDenseIndex([passage('a'), passage('a')], [[1, 0], [1, 0]], metadata));
  assert.throws(() => buildDenseIndex([passage('a')], [[1, 0]], { ...metadata, inputVersion: 'old' }));
});

test('bounded ingestion is atomic and rejects dimension/model drift between batches', async () => {
  const items = Array.from({ length: 17 }, (_, i) => passage('note-' + i));
  const sizes = [], progress = [], session = new DenseSession(async texts => { sizes.push(texts.length); assert.equal(session.index, null); return batch(texts.map(() => [1, 0])); });
  await session.build(items, identity, (n, total) => progress.push([n, total]));
  assert.deepEqual(sizes, [16, 1]); assert.deepEqual(progress, [[16, 17], [17, 17]]);
  let called = 0;
  const changed = new DenseSession(async texts => batch(texts.map(() => [1, 0]), ++called === 2 ? { providerModel: 'new-model' } : {}));
  await assert.rejects(changed.build(items, identity), /changed/); assert.equal(changed.index, null);
  const none = new DenseSession(async () => { assert.fail('Must reject before transport'); });
  await assert.rejects(none.build([], identity));
  await assert.rejects(none.build(Array.from({ length: 513 }, (_, i) => passage(String(i))), identity));
});

test('deletion/account changes abort pending ingestion and late vectors cannot resurrect it', async () => {
  const pending = deferred(); let signal;
  const session = new DenseSession(async (texts, i, s) => { signal = s; return pending.promise; });
  const work = session.build([passage('private')], identity);
  session.cancel(); assert.equal(signal.aborted, true);
  pending.resolve(batch([[1, 0]])); await assert.rejects(work, { name: 'AbortError' }); assert.equal(session.index, null);
});

test('queries require the same owner/model/version and dimensions, and cancelled queries leave vectors usable', async () => {
  const pending = deferred(); let calls = 0;
  const session = new DenseSession(async () => ++calls === 1 ? batch([[1, 0]]) : pending.promise);
  await session.build([passage('private')], identity);
  const query = session.search('royal shelter', identity); session.cancel(false);
  pending.resolve(batch([[1, 0]])); await assert.rejects(query, { name: 'AbortError' }); assert.ok(session.index);
  const n = calls;
  await assert.rejects(session.search('query', { ...identity, scope: 'account-b' }), /Build/);
  assert.equal(calls, n); assert.equal(session.index, null);
  const drift = new DenseSession(async () => batch([[1, 0]], calls++ > n ? { dimensions: 3 } : {}));
  await drift.build([passage('a')], identity);
  await assert.rejects(drift.search('query', identity), /changed/); assert.equal(drift.index, null);
});
