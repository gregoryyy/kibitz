import { Chess } from 'chess.js';
import { denseBenchmarkSession } from './dense-benchmark.mjs';
import { runTextBenchmark, renderTextReport } from './text-benchmark.mjs';
import { buildHybridIndex, searchHybrid, HYBRID_POLICY } from '../../src/hybrid-search.js';
import { HYBRID_CASES, HYBRID_SUITE_VERSION } from './hybrid-cases.mjs';
import { buildTextIndex, searchText, textTerms } from '../../src/text-search.js';

/** Fair lexical ablation: explicit literal constraints apply to either ranking method. */
export function runContextLexical() {
  return runTextBenchmark({ cases: HYBRID_CASES, suiteVersion: HYBRID_SUITE_VERSION, suite: 'kibitz-hybrid-context', retrieve: (passages, query, scope) => {
    const terms = new Set(textTerms(query));
    return searchText(buildTextIndex(passages), query, { ...scope, limit: HYBRID_POLICY.candidates }).filter(h => !scope.allTerms || h.matched.length === terms.size).slice(0, scope.limit);
  } });
}

/**
 * Production hybrid/ablation comparison over authored text only. One ingestion and one query
 * embedding per distinct scoped request; no gold, case IDs or evaluation groups reach retrieval.
 * Cloud calls require the same explicit opt-in as dense evaluation. Tests use fake/mock only.
 */
export async function runHybridBenchmark(options = {}) {
  const { session, identity } = denseBenchmarkSession(options), cache = new Map();
  let index;
  const candidates = async (passages, query, scope) => {
    if (!session.index) { index = buildHybridIndex(Chess, passages); await session.build(passages, identity); }
    const key = JSON.stringify([query, scope.language, scope.kind, scope.collection]);
    if (!cache.has(key)) cache.set(key, await session.search(query, identity, { ...scope, limit: HYBRID_POLICY.candidates }));
    return cache.get(key);
  };
  const retrieve = async (passages, query, scope) => { const dense = await candidates(passages, query, scope); return searchHybrid(index, query, { ...scope, dense }); };
  const report = await runTextBenchmark({ retrieve, retriever: 'hybrid-rrf-rerank-v1' });
  const lexical = await runTextBenchmark();
  const dense = await runTextBenchmark({ retrieve: async (p, q, s) => (await candidates(p, q, s)).slice(0, s.limit), retriever: 'passage-cosine-v1' });
  const strict = await runTextBenchmark({ retrieve: async (p, q, s) => retrieve(p, q, { ...s, allTerms: true }), retriever: 'hybrid-all-terms-v1' });
  const contextual = await runTextBenchmark({ retrieve, cases: HYBRID_CASES, suiteVersion: HYBRID_SUITE_VERSION, suite: 'kibitz-hybrid-context', retriever: 'hybrid-rrf-rerank-v1' });
  const contextLexical = await runContextLexical();
  return { ...report, embedding: { ...session.index.metadata }, policy: { ...HYBRID_POLICY }, comparison: { lexical, dense, strict }, contextual: { ...contextual, baseline: contextLexical } };
}

/** Separate text/board suites and a literal-filter ablation prevent conflating their metrics. */
export function renderHybridReport(report) {
  const n = value => value === null ? '—' : value.toFixed(3);
  const lines = ['# Hybrid passage retrieval comparison', '', 'TODO 8.4. Authored development evaluation; no held-out quality or calibrated abstention claim.', '',
    `Provider: ${report.embedding.provider}; configured/reported model: ${report.embedding.model} / ${report.embedding.providerModel}; dimensions: ${report.embedding.dimensions}; supplied revision: ${report.embedding.revision || 'unknown'}.`, '',
    'Four eligible candidate channels use reciprocal ranks with constant 60 and twenty candidates per channel. Full term matches and exact board matches then rerank the fused candidates. Raw cosine/BM25 scores are not added. No chess advice or semantic support is verified.', '',
    'The optional all-terms filter is literal title/body coverage. It can reject paraphrases and is not a calibrated semantic abstention rule. Shared lexical gold still has the documented Isolani/language ambiguity; labels were not changed to favour a method.', '',
    '| Suite | Method | P@1 | Recall@3 | MRR@3 | No-answer false positives |', '| --- | --- | ---: | ---: | ---: | ---: |'];
  const row = (suite, name, r) => { const one = r.summary.overall.find(s => s.k === 1), three = r.summary.overall.find(s => s.k === 3); return `| ${suite} | ${name} | ${n(one.precision)} | ${n(three.recall)} | ${n(three.mrr)} | ${n(three.falsePositiveRate)} |`; };
  for (const [name, r] of [['BM25', report.comparison.lexical], ['Dense', report.comparison.dense], ['Hybrid', report], ['Hybrid, every term', report.comparison.strict]]) lines.push(row('28 text queries', name, r));
  lines.push(row('10 board/intent queries', 'BM25, same term constraints', report.contextual.baseline), row('10 board/intent queries', 'Hybrid', report.contextual), '',
    'The ten board/intent cases use separate labels and an explicit FEN; do not compare their aggregates as if they were the same queries as the text suite. Source filters, exact occurrences and dynamic compatibility are also checked independently in unit/browser tests.', '',
    '## Broad hybrid: unchanged text cases', '', renderTextReport({ ...report, embedding: undefined }),
    '## Every-term ablation: unchanged text cases', '', renderTextReport(report.comparison.strict),
    '## Board and intent cases', '', renderTextReport({ ...report.contextual, baseline: undefined }));
  return lines.join('\n').trimEnd() + '\n';
}
