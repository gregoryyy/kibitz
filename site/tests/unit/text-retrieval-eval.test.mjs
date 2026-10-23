/** @file Passage-level gold and CLI reports measure the real production lexical index. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runTextBenchmark, renderTextReport } from '../../eval/retrieval/text-benchmark.mjs';

const run = runTextBenchmark();

/** Exact passage IDs and locators distinguish notes even when the game boards repeat. */
test('the recorded text baseline is reproducible, source-scoped and retains real lexical limitations', async () => {
  const report = await run, recorded = JSON.parse(await readFile(new URL('../../../docs/eval/retrieval/text-baseline.json', import.meta.url), 'utf8'));
  // Math.log can differ in its last bits across V8/platform builds. Permit roundoff only
  // for raw BM25 scores; keep every rank, source locator and evaluation metric exact.
  const comparable = structuredClone(report);
  for (const [i, result] of comparable.results.entries()) for (const [j, hit] of result.ranked.entries()) {
    const expected = recorded.results[i]?.ranked[j]?.score;
    assert.ok(Math.abs(hit.score - expected) <= 8 * Number.EPSILON * Math.max(1, Math.abs(expected)), `BM25 score: ${result.id}, rank ${j + 1}`);
    hit.score = expected;
  }
  assert.deepEqual(comparable, recorded); assert.deepEqual(await runTextBenchmark(), report);
  assert.deepEqual(report.counts, { queries: 28, passages: 159, annotations: 45, guides: 114 });
  for (const q of report.results) for (const p of q.ranked) {
    assert.ok(p.sourceId && p.documentId); assert.equal(p.locator.unit, 'utf-16'); assert.ok(p.locator.end > p.locator.start);
    if (q.options.collection !== 'all') assert.equal(p.collection, q.options.collection);
    if (q.options.kind !== 'all') assert.equal(p.kind, q.options.kind);
    assert.ok(p.language === 'und' || p.language === q.language);
  }
  const find = id => report.results.find(r => r.id === id);
  assert.equal(find('second-note').ranked[0].ply, 5);
  assert.notEqual(find('second-note').ranked[0].occurrenceId, find('first-note').ranked[0].occurrenceId);
  assert.deepEqual(find('mate-san-de').ranked, find('mate-san-en').ranked);
  assert.equal(find('wrong-collection').ranked.length, 0);
  assert.ok(report.summary.byGroup.paraphrase[0].recall < 1);
  assert.ok(report.summary.overall[0].falsePositiveRate > 0);
  assert.match(renderTextReport(report), /does not measure semantic understanding/);
});

test('the root utility selects the text benchmark and leaves the position benchmark unchanged', async () => {
  const command = fileURLToPath(new URL('../../../utils/retrieval-eval.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [command, '--mode', 'text', '--json'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr); assert.deepEqual(JSON.parse(result.stdout), await run);
  const bad = spawnSync(process.execPath, [command, '--mode', 'unknown'], { encoding: 'utf8' });
  assert.notEqual(bad.status, 0); assert.equal(bad.stdout, '');
});
