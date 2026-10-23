/** @file Independent metric arithmetic, legal gold labels and the offline retrieval CLI. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { Chess } from 'chess.js';
import { epd, pawnSignature } from '../../src/knowledge.js';
import { retrievalCorpus } from '../../eval/retrieval/corpus.mjs';
import { RETRIEVAL_CASES } from '../../eval/retrieval/cases.mjs';
import { buildBenchmark, positionBaseline, runRetrievalBenchmark } from '../../eval/retrieval/benchmark.mjs';
import { scoreRanking, summariseRankings } from '../../eval/retrieval/score.mjs';
import { renderRetrievalReport } from '../../eval/retrieval/report.mjs';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} ~= ${b}`);
const baseline = runRetrievalBenchmark();
const root = fileURLToPath(new URL('../../../', import.meta.url));

/** Ranks 2 and 3 are relevant; the duplicate at rank 4 earns no extra gain. */
test('precision, recall, MRR and graded nDCG agree with hand-computed ranks', () => {
  const labels = [{ id: 'a', grade: 2 }, { id: 'b', grade: 1 }];
  const s = scoreRanking(['wrong', 'b', 'a', 'a'], labels, 4);
  assert.deepEqual([s.precision, s.recall, s.reciprocalRank, s.relevant, s.returned], [0.5, 1, 0.5, 2, 4]);
  near(s.ndcg, (1 / Math.log2(3) + 3 / Math.log2(4)) / (3 + 1 / Math.log2(3)));
  const short = scoreRanking(['a'], labels, 3);
  assert.equal(short.precision, 1 / 3); assert.equal(short.recall, 0.5);
  assert.equal(scoreRanking(['wrong', 'b'], labels, 1).reciprocalRank, 0);
  assert.equal(scoreRanking(['a', 'b'], labels, 2).ndcg, 1);
  assert.equal(scoreRanking([], labels, 3).precision, 0);
});

test('no-answer queries use a separate denominator and cannot inflate relevance scores', () => {
  const good = scoreRanking(['a'], [{ id: 'a', grade: 2 }], 1);
  const empty = scoreRanking([], [], 1), wrong = scoreRanking(['unknown'], [], 1);
  assert.deepEqual([empty.precision, empty.recall, empty.ndcg, empty.falsePositive], [null, null, null, false]);
  const summary = summariseRankings([good, empty, wrong]);
  assert.deepEqual([summary.answerable, summary.unanswerable, summary.precision, summary.recall, summary.falsePositiveRate], [1, 2, 1, 1, 0.5]);
  assert.equal(summariseRankings([empty]).mrr, null);
  assert.equal(summariseRankings([good]).falsePositiveRate, null);
});

test('ambiguous grades and invalid cutoffs fail rather than silently changing the metric', async () => {
  for (const k of [0, -1, 1.5, NaN, Infinity]) assert.throws(() => scoreRanking([], [], k));
  for (const labels of [[{ id: 'x', grade: 0 }], [{ id: 'x', grade: 3 }], [{ id: '', grade: 1 }], [{ id: 'x', grade: 1 }, { id: 'x', grade: 2 }]]) assert.throws(() => scoreRanking([], labels, 1));
  for (const cutoffs of [[], [0], [1, 1]]) await assert.rejects(runRetrievalBenchmark({ cutoffs }));
});

/** Manual selectors resolve through source revisions; transpositions retain two occurrences. */
test('the corpus and bilingual labels retain legal positions, exact occurrences and source locators', async () => {
  const b = await buildBenchmark();
  assert.equal(b.snapshots.size, 21); assert.equal(b.queries.length, 24);
  for (const q of b.queries) {
    assert.doesNotThrow(() => new Chess(q.fen));
    assert.ok(q.judgements.every(j => j.reason && j.id));
    assert.equal(q.expected.length === 0, q.group === 'no-answer');
  }
  for (const s of b.snapshots.values()) {
    for (const a of s.annotations.filter(a => a.kind === 'comment')) {
      const raw = retrievalCorpus().find(e => e.collection === s.document.collection && e.game.id === s.document.localId);
      assert.equal(raw.game.pgn.slice(a.locator.start, a.locator.end), a.text);
    }
  }
  const transpose = b.queries.find(q => q.id === 'qgd-en');
  const [a, c] = transpose.judgements.map(j => b.candidates.get(j.id));
  assert.notEqual(a.documentId, c.documentId); assert.equal(epd(a.fen), epd(c.fen));
  const repeated = b.queries.find(q => q.id === 'repeat-both').judgements.map(j => b.candidates.get(j.id));
  assert.equal(epd(repeated[0].fen), epd(repeated[1].fen)); assert.notEqual(repeated[0].fen, repeated[1].fen);
  assert.ok(repeated.every(o => o.annotationIds.length === 1));
  const query = b.queries.find(q => q.id === 'iqp-plan-en');
  const decoy = [...b.candidates.values()].find(c => c.gameId === 'iqp-check' && c.ply === 12);
  assert.equal(pawnSignature(decoy.fen), pawnSignature(query.fen)); assert.ok(new Chess(decoy.fen).isCheck());
  assert.ok(!query.judgements.some(j => j.id === decoy.documentId));
});

test('stale, duplicate, excluded and wrong-position gold labels fail during suite validation', async () => {
  const first = structuredClone(RETRIEVAL_CASES[0]), corpus = retrievalCorpus();
  for (const expected of [
    [{ ...first.expected[0], game: 'missing' }],
    [{ ...first.expected[0], ply: 999 }],
    [{ ...first.expected[0], ply: 18 }],
    [first.expected[0], first.expected[0]],
  ]) await assert.rejects(buildBenchmark(corpus, [{ ...first, expected }]));
  await assert.rejects(buildBenchmark(corpus, [{ ...first, excludeGameId: 'ex-opera' }]));
  await assert.rejects(buildBenchmark(corpus, [{ ...first, fen: 'invalid' }]));
  await assert.rejects(buildBenchmark(corpus, [first, first]));
  await assert.rejects(buildBenchmark([...corpus, corpus[0]], [first]));
});

test('adapters receive no gold, and unknown or mismatched occurrence references cannot be scored', async () => {
  let calls = 0;
  const report = await runRetrievalBenchmark({ name: 'adapter-check', retrieve: (b, q, limit) => {
    assert.ok(!('queries' in b)); assert.ok(!('judgements' in q)); assert.ok(!('expected' in q)); assert.ok(!('group' in q)); assert.ok(!('id' in q));
    assert.equal(limit, 6); calls++;
    return positionBaseline(b, q, limit);
  } });
  assert.equal(calls, 24); assert.deepEqual(report.results, (await baseline).results);
  for (const change of [{ id: 'unknown' }, { fen: new Chess().fen() }, { documentId: 'wrong-source' }, { ply: 777 }]) {
    await assert.rejects(runRetrievalBenchmark({ retrieve: (b, q, limit) => [{ ...positionBaseline(b, q, limit)[0], ...change }] }), /Invalid retrieved reference/);
  }
});

/** Keep failures visible: this benchmark records existing weaknesses without fixing retrieval. */
test('the recorded baseline is reproducible and reports missed intents and false positives', async () => {
  const report = await baseline;
  assert.deepEqual(await runRetrievalBenchmark(), report);
  const recorded = JSON.parse(await readFile(new URL('../../../docs/eval/retrieval/baseline.json', import.meta.url), 'utf8'));
  assert.deepEqual(report, recorded);
  assert.equal(report.summary.byGroup.exact[0].mrr, 1);
  assert.ok(report.summary.byGroup.occurrence[0].mrr < 1);
  assert.ok(report.summary.overall[0].falsePositiveRate > 0);
  const en = report.results.find(q => q.id === 'opera-en'), de = report.results.find(q => q.id === 'opera-de');
  assert.deepEqual(en.ranked, de.ranked);
  const markdown = renderRetrievalReport(report);
  assert.match(markdown, /small authored development suite/); assert.match(markdown, /No-answer false positives/);
  assert.ok(markdown.includes(report.corpusHash));
});

test('the root utility runs outside the checkout, writes explicit reports and rejects unknown options', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'kibitz-retrieval-'));
  const command = path.join(root, 'utils/retrieval-eval.mjs');
  try {
    const stem = path.join(temp, 'reports', 'run');
    const result = spawnSync(process.execPath, [command, '--json', '--out', stem], { cwd: temp, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.deepEqual(report, await baseline);
    assert.equal(await readFile(`${stem}.json`, 'utf8'), result.stdout);
    assert.equal(await readFile(`${stem}.md`, 'utf8'), renderRetrievalReport(report));
    const bad = spawnSync(process.execPath, [command, '--unknown'], { cwd: temp, encoding: 'utf8' });
    assert.notEqual(bad.status, 0); assert.equal(bad.stdout, '');
  } finally { await rm(temp, { recursive: true, force: true }); }
});
