import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runHybridBenchmark, renderHybridReport } from '../../eval/retrieval/hybrid-benchmark.mjs';
import { runTextBenchmark } from '../../eval/retrieval/text-benchmark.mjs';
import { loadEmbeddingConfig } from '../../server/ai.mjs';

/** Fake vectors exercise production fusion; relevance assertions come from separate geometry tests. */
test('hybrid ablations share source text/gold, reuse embedding work, and keep board-query labels separate', async () => {
  const calls = [], config = loadEmbeddingConfig({ EMBEDDING_PROVIDER: 'mock' });
  const embedder = { async embedBatch(texts) { calls.push(texts); return { vectors: texts.map(t => [t.length, 1]), providerModel: 'fake-v1' }; } };
  const r = await runHybridBenchmark({ config, embedder }), lexical = await runTextBenchmark();
  for (const x of [r, r.comparison.lexical, r.comparison.dense, r.comparison.strict]) {
    assert.equal(x.corpusHash, lexical.corpusHash); assert.equal(x.casesHash, lexical.casesHash); assert.equal(x.counts.queries, 28);
  }
  assert.deepEqual(r.comparison.lexical, lexical); assert.equal(r.contextual.counts.queries, 10);
  assert.notEqual(r.contextual.casesHash, r.casesHash); assert.equal(r.contextual.corpusHash, r.corpusHash);
  const keys = new Set([...r.results, ...r.contextual.results].map(q => JSON.stringify([q.text, q.options.language, q.options.kind, q.options.collection])));
  assert.equal(calls.length, Math.ceil(r.counts.passages / 16) + keys.size);
  assert.ok(calls.every(texts => texts.length <= 16));
  for (const q of r.comparison.strict.results) for (const p of q.ranked) assert.ok(p.matched.length > 0);
  const report = renderHybridReport(r); assert.match(report, /not a calibrated semantic abstention/); assert.match(report, /Isolani/);
  assert.doesNotMatch(report, /No provider, engine search, saved user data or network is used/);
});

test('context adapters receive the explicit board/term constraint, never gold, and illegal boards fail validation', async () => {
  const fen = '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 22';
  const q = { id: 'private-gold', group: 'exact', text: 'en passant', kind: 'annotation', collection: 'library', language: 'en', fen, allTerms: true, expected: [{ kind: 'annotation', collection: 'library', game: 'en-passant', ply: 0 }], reason: 'Root note.' };
  let received;
  await runTextBenchmark({ cases: [q], retrieve: (passages, text, options) => { received = options; assert.equal(text, q.text); assert.ok(passages.every(p => !('expected' in p))); return []; } });
  assert.deepEqual(received, { language: 'en', kind: 'annotation', collection: 'library', limit: 6, fen, allTerms: true });
  await assert.rejects(runTextBenchmark({ cases: [{ ...q, fen: 'invalid' }] }), /Invalid query board/);
});

test('root hybrid utility uses mock in tests and cloud opt-in is checked before any transport', async () => {
  const config = loadEmbeddingConfig({ EMBEDDING_PROVIDER: 'openai', OPENAI_API_KEY: 'fake' });
  await assert.rejects(runHybridBenchmark({ config, embedder: { embedBatch() { assert.fail('Cloud transport must not run'); } } }), /allow-cloud/);
  const command = fileURLToPath(new URL('../../../utils/retrieval-eval.mjs', import.meta.url));
  const r = spawnSync(process.execPath, [command, '--mode', 'hybrid', '--json'], { encoding: 'utf8', env: { ...process.env, EMBEDDING_PROVIDER: 'mock' } });
  assert.equal(r.status, 0, r.stderr); const report = JSON.parse(r.stdout);
  assert.equal(report.embedding.provider, 'mock'); assert.equal(report.policy.constant, 60); assert.equal(report.contextual.counts.queries, 10);
});
