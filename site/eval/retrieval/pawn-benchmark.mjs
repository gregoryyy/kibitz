import { Chess } from 'chess.js';
import { buildHybridIndex, searchHybrid } from '../../src/library/hybrid-search.js';
import { PAWN_DISTANCE_POLICY } from '../../src/library/pawn-distance.js';
import { runTextBenchmark, renderTextReport } from './text-benchmark.mjs';
import { pawnCorpus, PAWN_CASES, PAWN_SUITE_VERSION } from './pawn-corpus.mjs';

/**
 * Offline isolation of the production position channel: the query has no source-text matches,
 * no dense candidates are supplied, and only results with an actual board relation are scored.
 * Source/case families are authored development fixtures, not a held-out chess-quality claim.
 */
export async function runPawnBenchmark() {
  let index;
  const run = maximum => runTextBenchmark({ sourceCorpus: pawnCorpus(), guides: [], cases: PAWN_CASES, suite: 'kibitz-pawn-distance', suiteVersion: PAWN_SUITE_VERSION,
    retriever: maximum ? 'pawn-jaccard-v1' : 'pawn-exact-only-v1', retrieve: (passages, query, options) => {
      index ||= buildHybridIndex(Chess, passages);
      return searchHybrid(index, query, { ...options, maxPawnDistance: maximum, limit: 20 }).filter(h => h.evidence.board).slice(0, options.limit);
    } });
  const broad = await run(PAWN_DISTANCE_POLICY.nearby), baseline = await run(0);
  return { ...broad, metric: { ...PAWN_DISTANCE_POLICY }, baseline };
}

/** Record the cutoff, matching task and intentional sparse miss alongside both ablations. */
export function renderPawnReport(report) {
  const n = x => x === null ? '—' : x.toFixed(3);
  const lines = ['# Fuzzy pawn-structure distance comparison', '', 'TODO 8.5. Reproduce: `just retrieval-eval --mode pawns`. Offline; no model, network, engine search or saved library.', '',
    `Metric: ${report.metric.version}; maximum distance ${report.metric.nearby}. Colours and squares are literal; no mirroring, geometric move cost or advice-transfer probability.`, '',
    'Ten original source diagrams and eight manually labelled spatial queries. This isolates production board-relation candidates, not full hybrid text relevance. Turn/check/phase compatibility and nonempty pawns apply in both variants. The fixed cutoff is an inspectable heuristic, not a tuned relevance threshold.', '',
    '| Method | P@1 | Recall@3 | MRR@3 | No-answer false positives |', '| --- | ---: | ---: | ---: | ---: |'];
  for (const [name, r] of [['Exact pawn placement', report.baseline], ['Jaccard ≤ 0.25', report]]) {
    const a = r.summary.overall.find(s => s.k === 1), b = r.summary.overall.find(s => s.k === 3);
    lines.push(`| ${name} | ${n(a.precision)} | ${n(b.recall)} | ${n(b.mrr)} | ${n(b.falsePositiveRate)} |`);
  }
  lines.push('', 'The one-pawn advance is a labelled useful spatial neighbour that this metric misses: its pawn squares are disjoint, giving distance one. The suite is small and deliberately constructed; broader retrieval gains, tactical suitability and teaching value remain unestablished.', '',
    '## Fuzzy results', '', renderTextReport(report), '## Exact-only results', '', renderTextReport(report.baseline));
  return lines.join('\n').trimEnd() + '\n';
}
