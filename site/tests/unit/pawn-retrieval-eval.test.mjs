import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runPawnBenchmark, renderPawnReport } from '../../eval/retrieval/pawn-benchmark.mjs';
import { pawnCorpus, PAWN_CASES } from '../../eval/retrieval/pawn-corpus.mjs';
import { runTextBenchmark } from '../../eval/retrieval/text-benchmark.mjs';

/** The recorded fixture judgements are independent of retrieved IDs and include a known miss. */
test('offline pawn comparison reproduces source-bound reports and retains the sparse false negative', async () => {
  const r = await runPawnBenchmark();
  const recorded = JSON.parse(await readFile(new URL('../../../docs/eval/retrieval/pawn-distance.json', import.meta.url), 'utf8'));
  assert.deepEqual(r, recorded);
  assert.equal(renderPawnReport(r), await readFile(new URL('../../../docs/eval/retrieval/pawn-distance.md', import.meta.url), 'utf8'));
  assert.deepEqual(r.counts, { queries: 8, passages: 10, annotations: 10, guides: 0 });
  assert.equal(r.corpusHash, r.baseline.corpusHash); assert.equal(r.casesHash, r.baseline.casesHash);
  const sparse = r.results.find(q => q.id === 'single-pawn-shift'); assert.equal(sparse.judgements.length, 1); assert.deepEqual(sparse.ranked, []);
  assert.equal(r.summary.overall[1].recall, 0.75); assert.equal(r.baseline.summary.overall[1].recall, 0.25);
  for (const q of r.results) for (const p of q.ranked) assert.ok(p.sourceId && p.occurrenceId && p.locator);
  assert.match(renderPawnReport(r), /not a tuned relevance threshold/); assert.match(renderPawnReport(r), /one-pawn advance/);
});

test('custom source fixtures use the same legal compiler and oracle-free adapter boundary', async () => {
  let calls = 0;
  await runTextBenchmark({ sourceCorpus: pawnCorpus(), guides: [], cases: PAWN_CASES, retrieve: (passages, query, scope) => {
    calls++; assert.equal(query, 'analogy'); assert.ok(scope.fen); assert.equal(scope.collection, 'library');
    assert.equal(passages.length, 10); assert.ok(passages.every(p => !('expected' in p) && p.kind === 'annotation' && p.licence === 'GPL-3.0-or-later'));
    return [];
  } });
  assert.equal(calls, 8);
  await assert.rejects(runTextBenchmark({ sourceCorpus: pawnCorpus(), guides: [], cases: [{ ...PAWN_CASES[0], expected: [{ kind: 'annotation', game: 'missing', collection: 'library', ply: 0 }] }] }), /Invalid text gold/);
});

test('root pawn utility is provider-free and emits the same deterministic JSON', async () => {
  const command = fileURLToPath(new URL('../../../utils/retrieval-eval.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [command, '--mode', 'pawns', '--json'], { encoding: 'utf8', env: { ...process.env, EMBEDDING_PROVIDER: 'unconfigured' } });
  assert.equal(result.status, 0, result.stderr); assert.deepEqual(JSON.parse(result.stdout), await runPawnBenchmark());
});
