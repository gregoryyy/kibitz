// Offline benchmark of production retrieval. No model/engine calls, app writes or .env access.
import { createHash } from 'node:crypto';
import { Chess } from 'chess.js';
import { compileLibraryGame, indexedLibraryPositions } from '../../src/library.js';
import { buildPositionIndex, similarPositions, epd } from '../../src/knowledge.js';
import { checkPosition } from '../../src/play.js';
import { retrievalCorpus } from './corpus.mjs';
import { RETRIEVAL_CASES, SUITE_VERSION } from './cases.mjs';
import { scoreRanking, summariseRankings } from './score.mjs';

/** @typedef {Awaited<ReturnType<typeof compileLibraryGame>>} Snapshot */
/** @typedef {{id: string, documentId: string, occurrenceId: string, gameId: string, collection: string, ply: number, fen: string, annotationIds: string[]}} Candidate */
/** @typedef {typeof RETRIEVAL_CASES[number] & {judgements: Array<{id: string, grade: number, reason: string}>}} Query */
/** @typedef {Awaited<ReturnType<typeof buildBenchmark>>} Benchmark */
/** @typedef {Omit<Benchmark, 'queries'>} RetrievalData */
/** @typedef {Pick<Query, 'text'|'language'|'fen'|'unit'|'excludeGameId'>} Request */
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/**
 * Replay the fixed corpus through the app's source-aware compiler. Resolve manual gold
 * selectors to revision-bound IDs, rejecting stale, excluded or ambiguous judgements.
 * Positive exact/transposition/occurrence labels must reach the query EPD.
 */
export async function buildBenchmark(corpus = retrievalCorpus(), cases = RETRIEVAL_CASES) {
  const snapshots = new Map(), candidates = new Map();
  const games = [];
  for (const { collection, game } of corpus) {
    const snapshot = await compileLibraryGame(Chess, game, collection);
    if (snapshots.has(snapshot.document.id)) throw new Error(`Duplicate corpus document: ${snapshot.document.id}`);
    snapshots.set(snapshot.document.id, snapshot);
    const positions = indexedLibraryPositions(snapshot);
    games.push({ ...game, collection, positions });
    for (const p of positions) candidates.set(p.id, { id: p.id, documentId: snapshot.document.id, occurrenceId: p.id,
      gameId: game.id, collection, ply: p.ply, fen: p.fen, annotationIds: p.annotationIds });
  }
  const ids = new Set();
  const queries = cases.map(q => {
    if (!q.id || ids.has(q.id) || !q.text || !q.group || !['en', 'de'].includes(q.language) || !['document', 'occurrence'].includes(q.unit)) throw new Error(`Invalid query: ${q.id}`);
    ids.add(q.id);
    if (checkPosition(Chess, q.fen).error) throw new Error(`Illegal query position: ${q.id}`);
    if (q.excludeGameId && !games.some(g => g.id === q.excludeGameId)) throw new Error(`Unknown excluded game: ${q.id}`);
    if ((q.group === 'no-answer') !== !q.expected.length) throw new Error(`No-answer label mismatch: ${q.id}`);
    const judgements = q.expected.map(label => {
      const matches = [...snapshots.values()].filter(s => s.document.localId === label.game && s.document.collection === label.collection);
      const s = matches[0];
      if (matches.length !== 1 || label.game === q.excludeGameId) throw new Error(`Unknown or excluded gold source: ${q.id}`);
      const o = s.occurrences.find(o => o.ply === label.ply);
      if (!label.reason || (q.unit === 'occurrence' ? !o || !candidates.has(o.id) : label.ply !== null)) throw new Error(`Invalid gold location: ${q.id}`);
      if (['exact', 'transposition', 'occurrence'].includes(q.group) && (!o || o.epd !== epd(q.fen))) throw new Error(`Gold position mismatch: ${q.id}`);
      return { id: q.unit === 'document' ? s.document.id : o.id, grade: label.grade, reason: label.reason };
    });
    scoreRanking([], judgements, 1); // also validate unique IDs and relevance grades
    return { ...q, judgements };
  });
  return { snapshots, candidates, queries, index: buildPositionIndex(games), corpusHash: digest(corpus), casesHash: digest(cases) };
}

/**
 * Adapter for the unchanged app retriever. It intentionally ignores the question text;
 * the benchmark exposes cases that need occurrence/intent understanding or better ranking.
 * @param {RetrievalData} benchmark Compiled legal corpus.
 * @param {Request} query Captured query, including its optional current-game exclusion.
 * @param {number} limit Requested candidate count.
 * @returns {Array<Candidate & {kind: string}>}
 */
export function positionBaseline(benchmark, query, limit) {
  return similarPositions(benchmark.index, query.fen, { limit, excludeGameId: query.excludeGameId }).map(hit => ({
    ...benchmark.candidates.get(hit.p.id), kind: hit.kind,
  }));
}

/**
 * Score one candidate ranking at several cutoffs. A future retriever supplies an adapter
 * over the same IDs and receives no relevance judgements. Resolve/validate every returned
 * occurrence against this corpus before scoring; unknown or mismatched citations are errors.
 * @param {{cutoffs?: number[], name?: string, retrieve?: (benchmark: RetrievalData, query: Request, limit: number) => Candidate[]|Promise<Candidate[]>}} [options]
 */
export async function runRetrievalBenchmark({ cutoffs = [1, 3, 6], name = 'exact-epd+pawns-v1', retrieve = positionBaseline } = {}) {
  if (!cutoffs.length || new Set(cutoffs).size !== cutoffs.length || cutoffs.some(k => !Number.isSafeInteger(k) || k < 1)) throw new Error('Cutoffs must be distinct positive integers');
  const benchmark = await buildBenchmark();
  const results = [];
  for (const query of benchmark.queries) {
    const { judgements } = query;
    const request = { language: query.language, text: query.text, fen: query.fen, unit: query.unit, ...(query.excludeGameId ? { excludeGameId: query.excludeGameId } : {}) };
    // Keep gold outside the adapter's input, including the corpus object it receives.
    const retrievalData = { snapshots: benchmark.snapshots, candidates: benchmark.candidates, index: benchmark.index, corpusHash: benchmark.corpusHash, casesHash: benchmark.casesHash };
    const ranked = await retrieve(retrievalData, request, Math.max(...cutoffs));
    for (const hit of ranked) {
      const stored = benchmark.candidates.get(hit.id);
      if (!stored || hit.documentId !== stored.documentId || hit.occurrenceId !== stored.occurrenceId || hit.fen !== stored.fen || hit.ply !== stored.ply || hit.gameId !== stored.gameId || hit.collection !== stored.collection || hit.gameId === query.excludeGameId) throw new Error(`Invalid retrieved reference: ${query.id}`);
    }
    const rankedIds = ranked.map(hit => query.unit === 'document' ? hit.documentId : hit.occurrenceId);
    results.push({ id: query.id, group: query.group, ...request, judgements, ranked: ranked.map(hit => ({ ...hit })),
      scores: cutoffs.map(k => scoreRanking(rankedIds, judgements, k)) });
  }
  const summary = rows => cutoffs.map(k => ({ k, ...summariseRankings(rows.map(r => r.scores.find(s => s.k === k))) }));
  const by = field => Object.fromEntries([...new Set(results.map(r => r[field]))].map(value => [value, summary(results.filter(r => r[field] === value))]));
  return { schemaVersion: 1, suite: 'kibitz-position-retrieval', suiteVersion: SUITE_VERSION, retriever: name,
    corpusHash: benchmark.corpusHash, casesHash: benchmark.casesHash, cutoffs,
    counts: { documents: benchmark.snapshots.size, occurrences: benchmark.candidates.size,
      annotations: [...benchmark.snapshots.values()].reduce((n, s) => n + s.annotations.length, 0), queries: results.length },
    summary: { overall: summary(results), byGroup: by('group'), byLanguage: by('language') }, results };
}
