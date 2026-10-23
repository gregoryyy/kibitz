import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { runRetrievalBenchmark } from './benchmark.mjs';
import { runTextBenchmark, renderTextReport } from './text-benchmark.mjs';

const number = n => n === null ? '—' : n.toFixed(3);
const cell = text => String(text).replaceAll('|', '\\|').replaceAll('\n', ' ');

/**
 * Human-readable summary plus per-query judgements and exact ranked occurrence locations.
 * @param {Awaited<ReturnType<typeof runRetrievalBenchmark>>} report Measured retrieval results.
 */
export function renderRetrievalReport(report) {
  const lines = ['# Position retrieval baseline', '', `TODO 8.8. Suite ${report.suiteVersion}; retriever \`${report.retriever}\`.`, '',
    `Corpus: ${report.counts.documents} documents, ${report.counts.occurrences} indexed occurrences, ${report.counts.annotations} annotations. Queries: ${report.counts.queries}.`, '',
    `Corpus SHA-256: \`${report.corpusHash}\`.`, `Case SHA-256: \`${report.casesHash}\`.`, '',
    'Reproduce from the repository root: `just retrieval-eval`. No provider, engine, network, credentials or saved user data is used.', '',
    'Precision divides by k, including short lists. Recall, MRR and graded nDCG are macro means over answerable queries; no-answer queries have their own false-positive rate. Duplicate IDs consume ranks and earn credit once. Grade 2 is directly relevant; grade 1 is a useful analogy.', '',
    'These are retrieval relevance judgements, not engine verification, citation entailment or teaching-quality scores. English/German pairs test the same positions; the current retriever ignores their text. This small authored development suite is not a held-out generalisation estimate.', '',
    '| Slice | k | Answerable | No answer | Precision@k | Recall@k | MRR@k | nDCG@k | No-answer false positives |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |'];
  const row = (label, s) => `| ${label} | ${s.k} | ${s.answerable} | ${s.unanswerable} | ${number(s.precision)} | ${number(s.recall)} | ${number(s.mrr)} | ${number(s.ndcg)} | ${number(s.falsePositiveRate)} |`;
  for (const s of report.summary.overall) lines.push(row('All', s));
  for (const [group, scores] of Object.entries(report.summary.byGroup)) for (const s of scores) lines.push(row(group, s));
  for (const [language, scores] of Object.entries(report.summary.byLanguage)) for (const s of scores) lines.push(row(language, s));
  for (const result of report.results) {
    lines.push('', `## ${result.id}`, '', `${result.language}; ${result.group}; relevance unit: ${result.unit}.`, '', result.text, '', `FEN: \`${result.fen}\`.`, '', 'Expected:');
    if (!result.judgements.length) lines.push('', 'No relevant result in this corpus.');
    else { lines.push(''); for (const j of result.judgements) lines.push(`- Grade ${j.grade}: \`${j.id}\` — ${j.reason}`); }
    lines.push('', '| Rank | Source occurrence | Match |', '| ---: | --- | --- |');
    result.ranked.forEach((hit, i) => lines.push(`| ${i + 1} | ${cell(hit.collection)}:${cell(hit.gameId)} / ply ${hit.ply} | ${cell(hit.kind || '')} |`));
    if (!result.ranked.length) lines.push('| — | Empty | — |');
  }
  return lines.join('\n') + '\n';
}

/**
 * Root utils command; writes reports only when an explicit output stem is supplied.
 * @param {string[]} args Command-line arguments after the executable path.
 */
export async function main(args) {
  const { values } = parseArgs({ args, options: { mode: { type: 'string', default: 'position' }, out: { type: 'string' }, json: { type: 'boolean' }, help: { type: 'boolean' } }, strict: true });
  if (values.help) { process.stdout.write('Usage: node utils/retrieval-eval.mjs [--mode position|text] [--json] [--out PATH_STEM]\n'); return; }
  if (!['position', 'text'].includes(values.mode)) throw new Error('Unknown benchmark mode');
  if (values.out === '') throw new Error('--out needs a non-empty path stem');
  const report = values.mode === 'text' ? await runTextBenchmark() : await runRetrievalBenchmark();
  const markdown = values.mode === 'text' ? renderTextReport(report) : renderRetrievalReport(/** @type {Awaited<ReturnType<typeof runRetrievalBenchmark>>} */ (report));
  const json = JSON.stringify(report, null, 2) + '\n';
  if (values.out) {
    await mkdir(path.dirname(values.out), { recursive: true });
    await writeFile(`${values.out}.json`, json);
    await writeFile(`${values.out}.md`, markdown);
  }
  process.stdout.write(values.json ? json : markdown);
}
