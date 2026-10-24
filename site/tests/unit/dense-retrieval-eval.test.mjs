import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runDenseBenchmark } from '../../eval/retrieval/dense-benchmark.mjs';
import { runTextBenchmark, renderTextReport } from '../../eval/retrieval/text-benchmark.mjs';
import { buildTextIndex, searchText } from '../../src/library/text-search.js';
import { selectPassages } from '../../src/library/dense-search.js';
import { loadEmbeddingConfig } from '../../server/ai.mjs';

test('dense comparison uses the identical authored corpus and production batching, filters and source locators', async () => {
  const calls = [], config = loadEmbeddingConfig({ EMBEDDING_PROVIDER: 'mock', EMBEDDING_REVISION: 'fake-v1' });
  const embedder = { async embedBatch(texts) { calls.push(texts); return { vectors: texts.map(t => [t.length, 1]), providerModel: 'fake-v1' }; } };
  const report = await runDenseBenchmark({ config, embedder }), lexical = await runTextBenchmark();
  assert.equal(report.corpusHash, lexical.corpusHash); assert.equal(report.casesHash, lexical.casesHash);
  assert.deepEqual(report.baseline.summary, lexical.summary); assert.deepEqual(report.counts, lexical.counts);
  assert.equal(report.embedding.dimensions, 2); assert.equal(report.embedding.revision, 'fake-v1');
  assert.equal(calls.length, Math.ceil(report.counts.passages / 16) + report.counts.queries);
  assert.ok(calls.every(texts => texts.length <= 16));
  assert.deepEqual(calls.slice(-report.counts.queries).flat(), report.results.map(r => r.text));
  for (const q of report.results) for (const p of q.ranked) { assert.ok(p.sourceId && p.locator); assert.ok(q.options.kind === 'all' || q.options.kind === p.kind); }
  assert.match(renderTextReport(report), /Lexical comparison/); assert.match(renderTextReport(report), /not a calibrated relevance threshold/);
});

test('alternate rankers never receive gold and cannot invent a source or escape query scope', async () => {
  const expected = await runTextBenchmark();
  const report = await runTextBenchmark({ retrieve: (passages, query, options) => {
    assert.deepEqual(Object.keys(options).sort(), ['collection', 'kind', 'language', 'limit']);
    assert.equal(typeof query, 'string'); assert.ok(passages.every(p => !('judgements' in p) && !('grade' in p)));
    return searchText(buildTextIndex(passages), query, options).map(h => ({ ...h, passage: { ...h.passage, sourceId: 'invented', fen: 'invented' } }));
  } });
  assert.deepEqual(report, expected, 'Locations and text must resolve against the trusted corpus');
  await assert.rejects(runTextBenchmark({ retrieve: () => [{ passage: { id: 'unknown' }, score: 1 }] }), /Invalid passage ranking/);
  await assert.rejects(runTextBenchmark({ retrieve: (passages, query, options) => {
    const allowed = new Set(selectPassages(passages, options).map(p => p.id));
    return [{ passage: passages.find(p => !allowed.has(p.id)), score: 1 }];
  } }), /Invalid passage ranking/);
});

test('dense CLI is explicit about provider calls; tests use only mock and cloud opt-in precedes transport', async () => {
  const config = loadEmbeddingConfig({ EMBEDDING_PROVIDER: 'openai', OPENAI_API_KEY: 'fake' });
  await assert.rejects(runDenseBenchmark({ config, embedder: { embedBatch() { assert.fail('Must not call cloud'); } } }), /allow-cloud/);
  const command = fileURLToPath(new URL('../../../utils/retrieval-eval.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [command, '--mode', 'dense', '--json'], { encoding: 'utf8', env: { ...process.env, EMBEDDING_PROVIDER: 'mock', EMBEDDING_REVISION: 'test' } });
  assert.equal(result.status, 0, result.stderr);
  const data = JSON.parse(result.stdout); assert.equal(data.embedding.provider, 'mock'); assert.equal(data.embedding.dimensions, 8); assert.equal(data.retriever, 'passage-cosine-v1');
});
