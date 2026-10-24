import { createHash } from 'node:crypto';
import { authoredGuideTexts } from '../../src/openings/opening-guides.js';
import { annotationPassages, guidePassages, buildTextIndex, searchText, textExcerpt } from '../../src/library/text-search.js';
import { buildBenchmark } from './benchmark.mjs';
import { scoreRanking, summariseRankings } from './score.mjs';
import { TEXT_CASES, TEXT_SUITE_VERSION } from './text-cases.mjs';
import { selectPassages } from '../../src/library/dense-search.js';
import { Chess } from 'chess.js';
import { checkPosition } from '../../src/chess/play.js';
import { retrievalCorpus } from './corpus.mjs';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/**
 * Run the lexical baseline over the existing position corpus's comments plus authored lessons.
 * Gold selectors resolve independently of ranking; source/kind/language filters are the same
 * production search options. Every positive must exist inside its query's permitted scope.
 */
export async function runTextBenchmark({ retrieve = null, retriever = 'local-bm25-v1', cases = TEXT_CASES, suiteVersion = TEXT_SUITE_VERSION, suite = 'kibitz-text-retrieval', sourceCorpus = retrievalCorpus(), guides = authoredGuideTexts() } = {}) {
  const { snapshots } = await buildBenchmark(sourceCorpus, []);
  const passages = [...[...snapshots.values()].flatMap(annotationPassages), ...await guidePassages(guides)];
  const index = buildTextIndex(passages), ids = new Set(), cutoffs = [1, 3, 6];
  const corpus = new Map(passages.map(p => [p.id, p])), results = [];
  for (const q of cases) {
    if (ids.has(q.id) || !q.reason) throw new Error('Invalid text benchmark query');
    ids.add(q.id);
    if (q.fen && checkPosition(Chess, q.fen).error) throw new Error('Invalid query board');
    const judgements = q.expected.flatMap(label => {
      const found = passages.filter(p => p.kind === label.kind && (p.kind === 'annotation'
        ? p.gameId === label.game && p.ply === label.ply && p.collection === label.collection
        : p.guideId === label.guide && p.language === label.language && p.locator.section === label.section));
      if (!found.length || found.some(p => q.language !== 'all' && p.language !== 'und' && p.language !== q.language || q.kind !== 'all' && p.kind !== q.kind || q.collection && p.collection !== q.collection)) throw new Error(`Invalid text gold: ${q.id}`);
      return found.map(p => ({ id: p.id, grade: 2, reason: q.reason }));
    });
    const options = { language: q.language, kind: q.kind, collection: q.collection || 'all', limit: 6, ...(q.fen ? { fen: q.fen } : {}), ...(q.allTerms !== undefined ? { allTerms: q.allTerms } : {}) };
    // Alternate rankers receive only corpus text and the production query/filter contract;
    // never gold judgements, evaluation groups or case IDs.
    const hits = retrieve ? await retrieve(structuredClone(passages), q.text, { ...options }) : searchText(index, q.text, options);
    const eligible = new Set(selectPassages(passages, options).map(p => p.id));
    if (!Array.isArray(hits) || hits.length > options.limit || hits.some(h => !corpus.has(h?.passage?.id) || !eligible.has(h.passage.id) || !Number.isFinite(h.score))) throw new Error('Invalid passage ranking');
    const ranked = hits.map(({ passage, score, matched }) => { const p = corpus.get(passage.id); return { id: p.id, sourceId: p.sourceId, documentId: p.documentId,
      kind: p.kind, language: p.language, occurrenceId: p.occurrenceId, gameId: p.gameId, collection: p.collection, ply: p.ply,
      fen: p.fen, guideId: p.guideId, locator: p.locator, score, matched, excerpt: textExcerpt(p.text, q.text) }; });
    results.push({ id: q.id, language: q.language, group: judgements.length ? q.group || q.kind : 'no-answer', text: q.text, options, judgements, ranked,
      scores: cutoffs.map(k => scoreRanking(ranked.map(r => r.id), judgements, k)) });
  }
  const summary = rows => cutoffs.map(k => ({ k, ...summariseRankings(rows.map(r => r.scores.find(s => s.k === k))) }));
  const by = field => Object.fromEntries([...new Set(results.map(r => r[field]))].map(value => [value, summary(results.filter(r => r[field] === value))]));
  return { schemaVersion: 1, suite, suiteVersion, retriever,
    corpusHash: digest(passages), casesHash: digest(cases), cutoffs,
    counts: { queries: results.length, passages: passages.length, annotations: passages.filter(p => p.kind === 'annotation').length, guides: passages.filter(p => p.kind === 'guide').length },
    summary: { overall: summary(results), byGroup: by('group'), byLanguage: by('language') }, results };
}

/** Deterministic development report; metrics are reference relevance, not answer correctness. */
export function renderTextReport(report) {
  const number = n => n === null ? '—' : n.toFixed(3);
  const hybrid = report.retriever.startsWith('hybrid-');
  const pawns = report.retriever.startsWith('pawn-');
  const lines = [pawns ? '# Pawn-structure retrieval' : hybrid ? '# Hybrid passage retrieval' : report.embedding ? '# Dense passage retrieval comparison' : '# Lexical passage retrieval baseline', '', `TODO ${pawns ? '8.5' : hybrid ? '8.4' : report.embedding ? '8.3.2' : '8.3.1'}. Suite ${report.suiteVersion}; retriever \`${report.retriever}\`.`, '',
    `${report.counts.passages} passages: ${report.counts.annotations} original PGN comments and ${report.counts.guides} authored guide sections. ${report.counts.queries} manually labelled queries.`, '',
    `Corpus SHA-256: \`${report.corpusHash}\`.`, `Case SHA-256: \`${report.casesHash}\`.`, '',
    pawns ? 'Offline pawn-structure comparison; no provider, saved library, engine search or network.' : hybrid ? 'The parent hybrid report records the explicitly configured embedding run used for these details.' : report.embedding ? `Provider: \`${report.embedding.provider}\`; model: \`${report.embedding.model}\`; reported model: \`${report.embedding.providerModel || 'not reported'}\`; revision: \`${report.embedding.revision || 'not supplied'}\`; dimensions: ${report.embedding.dimensions}; input: \`${report.embedding.inputVersion}\`.` : 'Reproduce: `just retrieval-eval --mode text`. No provider, engine search, saved user data or network is used.', '',
    'Precision uses k even for short lists. Relevance metrics average answerable queries only; no-answer false positives use a separate denominator. Gold is passage-level. This authored development suite does not measure semantic understanding, chess accuracy, answer faithfulness or generalisation.', '',
    '| Slice | k | Answerable | No answer | Precision@k | Recall@k | MRR@k | nDCG@k | No-answer false positives |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |'];
  const row = (label, s) => `| ${label} | ${s.k} | ${s.answerable} | ${s.unanswerable} | ${number(s.precision)} | ${number(s.recall)} | ${number(s.mrr)} | ${number(s.ndcg)} | ${number(s.falsePositiveRate)} |`;
  for (const s of report.summary.overall) lines.push(row('All', s));
  for (const [group, scores] of Object.entries(report.summary.byGroup)) for (const s of scores) lines.push(row(group, s));
  for (const [language, scores] of Object.entries(report.summary.byLanguage)) for (const s of scores) lines.push(row(language, s));
  if (report.baseline) {
    lines.push('', '## Lexical comparison', '', 'Same corpus, queries, scope filters and gold judgements. Cosine similarity above zero is a ranking rule, not a calibrated relevance threshold.', '',
      'The shared gold has a lexical-intent limitation: wrong-language treats the German term Isolani as unanswerable in English guides, although an English isolated-pawn passage can be a useful semantic match. Keep this case for baseline comparability; review intent and label semantic relevance separately before calibrating abstention. Off-topic quantum and unsupported-proof cases still have no supporting passage.', '',
      '| k | Retriever | Precision | Recall | MRR | nDCG | No-answer false positives |', '| ---: | --- | ---: | ---: | ---: | ---: | ---: |');
    for (const s of report.summary.overall) for (const [name, scores] of [['Dense', report.summary.overall], ['BM25', report.baseline.summary.overall]]) {
      const r = scores.find(r => r.k === s.k);
      lines.push(`| ${s.k} | ${name} | ${number(r.precision)} | ${number(r.recall)} | ${number(r.mrr)} | ${number(r.ndcg)} | ${number(r.falsePositiveRate)} |`);
    }
  }
  for (const q of report.results) {
    lines.push('', `## ${q.id}`, '', `${q.language}; ${q.group}. Keywords: ${q.text}.`, '', 'Expected:', '');
    if (q.options.fen) lines.push(`Query FEN: \`${q.options.fen}\`. All terms required: ${!!q.options.allTerms}.`, '');
    if (!q.judgements.length) lines.push('No relevant passage in the permitted scope.');
    for (const j of q.judgements) lines.push(`- \`${j.id}\` — ${j.reason}`);
    lines.push('', '| Rank | Passage location |', '| ---: | --- |');
    q.ranked.forEach((p, i) => lines.push(`| ${i + 1} | ${p.kind === 'guide' ? `${p.guideId} / ${p.language} / ${p.locator.section}` : `${p.collection}:${p.gameId} / ply ${p.ply}`} |`));
    if (!q.ranked.length) lines.push('| — | Empty |');
  }
  return lines.join('\n') + '\n';
}
