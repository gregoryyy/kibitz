import { createHash } from 'node:crypto';
import { authoredGuideTexts } from '../../src/opening-guides.js';
import { annotationPassages, guidePassages, buildTextIndex, searchText } from '../../src/text-search.js';
import { buildBenchmark } from './benchmark.mjs';
import { scoreRanking, summariseRankings } from './score.mjs';
import { TEXT_CASES, TEXT_SUITE_VERSION } from './text-cases.mjs';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/**
 * Run the lexical baseline over the existing position corpus's comments plus authored lessons.
 * Gold selectors resolve independently of ranking; source/kind/language filters are the same
 * production search options. Every positive must exist inside its query's permitted scope.
 */
export async function runTextBenchmark() {
  const { snapshots } = await buildBenchmark();
  const passages = [...[...snapshots.values()].flatMap(annotationPassages), ...await guidePassages(authoredGuideTexts())];
  const index = buildTextIndex(passages), ids = new Set(), cutoffs = [1, 3, 6];
  const results = TEXT_CASES.map(q => {
    if (ids.has(q.id) || !q.reason) throw new Error('Invalid text benchmark query');
    ids.add(q.id);
    const judgements = q.expected.flatMap(label => {
      const found = passages.filter(p => p.kind === label.kind && (p.kind === 'annotation'
        ? p.gameId === label.game && p.ply === label.ply && p.collection === label.collection
        : p.guideId === label.guide && p.language === label.language && p.locator.section === label.section));
      if (!found.length || found.some(p => q.language !== 'all' && p.language !== 'und' && p.language !== q.language || q.kind !== 'all' && p.kind !== q.kind || q.collection && p.collection !== q.collection)) throw new Error(`Invalid text gold: ${q.id}`);
      return found.map(p => ({ id: p.id, grade: 2, reason: q.reason }));
    });
    const options = { language: q.language, kind: q.kind, collection: q.collection || 'all', limit: 6 };
    const hits = searchText(index, q.text, options);
    const ranked = hits.map(({ passage: p, score, matched, excerpt }) => ({ id: p.id, sourceId: p.sourceId, documentId: p.documentId,
      kind: p.kind, language: p.language, occurrenceId: p.occurrenceId, gameId: p.gameId, collection: p.collection, ply: p.ply,
      fen: p.fen, guideId: p.guideId, locator: p.locator, score, matched, excerpt }));
    return { id: q.id, language: q.language, group: judgements.length ? q.group || q.kind : 'no-answer', text: q.text, options, judgements, ranked,
      scores: cutoffs.map(k => scoreRanking(ranked.map(r => r.id), judgements, k)) };
  });
  const summary = rows => cutoffs.map(k => ({ k, ...summariseRankings(rows.map(r => r.scores.find(s => s.k === k))) }));
  const by = field => Object.fromEntries([...new Set(results.map(r => r[field]))].map(value => [value, summary(results.filter(r => r[field] === value))]));
  return { schemaVersion: 1, suite: 'kibitz-text-retrieval', suiteVersion: TEXT_SUITE_VERSION, retriever: 'local-bm25-v1',
    corpusHash: digest(passages), casesHash: digest(TEXT_CASES), cutoffs,
    counts: { queries: results.length, passages: passages.length, annotations: passages.filter(p => p.kind === 'annotation').length, guides: passages.filter(p => p.kind === 'guide').length },
    summary: { overall: summary(results), byGroup: by('group'), byLanguage: by('language') }, results };
}

/** Deterministic development report; metrics are reference relevance, not answer correctness. */
export function renderTextReport(report) {
  const number = n => n === null ? '—' : n.toFixed(3);
  const lines = ['# Lexical passage retrieval baseline', '', `TODO 8.3.1. Suite ${report.suiteVersion}; retriever \`${report.retriever}\`.`, '',
    `${report.counts.passages} passages: ${report.counts.annotations} original PGN comments and ${report.counts.guides} authored guide sections. ${report.counts.queries} manually labelled queries.`, '',
    `Corpus SHA-256: \`${report.corpusHash}\`.`, `Case SHA-256: \`${report.casesHash}\`.`, '',
    'Reproduce: `just retrieval-eval --mode text`. No provider, engine search, saved user data or network is used.', '',
    'Precision uses k even for short lists. Relevance metrics average answerable queries only; no-answer false positives use a separate denominator. Gold is passage-level. This authored development suite does not measure semantic understanding, chess accuracy, answer faithfulness or generalisation.', '',
    '| Slice | k | Answerable | No answer | Precision@k | Recall@k | MRR@k | nDCG@k | No-answer false positives |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |'];
  const row = (label, s) => `| ${label} | ${s.k} | ${s.answerable} | ${s.unanswerable} | ${number(s.precision)} | ${number(s.recall)} | ${number(s.mrr)} | ${number(s.ndcg)} | ${number(s.falsePositiveRate)} |`;
  for (const s of report.summary.overall) lines.push(row('All', s));
  for (const [group, scores] of Object.entries(report.summary.byGroup)) for (const s of scores) lines.push(row(group, s));
  for (const [language, scores] of Object.entries(report.summary.byLanguage)) for (const s of scores) lines.push(row(language, s));
  for (const q of report.results) {
    lines.push('', `## ${q.id}`, '', `${q.language}; ${q.group}. Keywords: ${q.text}.`, '', 'Expected:', '');
    if (!q.judgements.length) lines.push('No relevant passage in the permitted scope.');
    for (const j of q.judgements) lines.push(`- \`${j.id}\` — ${j.reason}`);
    lines.push('', '| Rank | Passage location |', '| ---: | --- |');
    q.ranked.forEach((p, i) => lines.push(`| ${i + 1} | ${p.kind === 'guide' ? `${p.guideId} / ${p.language} / ${p.locator.section}` : `${p.collection}:${p.gameId} / ply ${p.ply}`} |`));
    if (!q.ranked.length) lines.push('| — | Empty |');
  }
  return lines.join('\n') + '\n';
}
