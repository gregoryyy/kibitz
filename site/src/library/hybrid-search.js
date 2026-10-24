// Hybrid passage retrieval (TODO 8.4). Source text stays data; no provider, DOM or engine work.
import { epd, pawnSignature, positionFeatures, TAG_LABELS } from '../chess/knowledge.js';
import { checkPosition } from '../chess/play.js';
import { buildTextIndex, searchText, textTerms, textExcerpt, TEXT_LIMITS } from './text-search.js';
import { selectPassages } from './dense-search.js';
import { pawnSquares, comparePawns, PAWN_DISTANCE_POLICY } from './pawn-distance.js';

/** @typedef {import('./text-search.js').Passage} Passage */
/** @typedef {{epd: string, pawns: string, squares: string[], hasPawns: boolean, turn: string, check: boolean, phase: string, tags: string[]}} BoardProfile */
/** @typedef {{passage: Passage, score: number}} Candidate */
export const HYBRID_POLICY = Object.freeze({ version: 'rrf-board-terms-v2', constant: 60, candidates: 20, pawnMetric: PAWN_DISTANCE_POLICY.version });
const GENERAL = new Set(['opening', 'middlegame', 'endgame', 'king-activity']);

/** Checked board features are retrieval hints, never a tactical verification of source prose. */
export function boardProfile(/** @type {import('../coach/tutor.js').ChessConstructor} */ Chess, /** @type {string} */ fen) {
  if (checkPosition(Chess, fen).error) throw new Error('Invalid retrieval position');
  const c = new Chess(fen), features = positionFeatures(c, { ply: (c.moveNumber() - 1) * 2 + +(c.turn() === 'b') });
  const pawns = pawnSignature(c.fen());
  return { epd: epd(c.fen()), pawns, squares: pawnSquares(pawns), hasPawns: /[pP]/.test(c.fen().split(' ')[0]), turn: c.turn(), check: c.isCheck(),
    phase: features.find(f => GENERAL.has(f.tag)).tag, tags: features.map(f => f.tag).filter(tag => !GENERAL.has(tag)) };
}

/**
 * Cache detached source profiles with the lexical index. Imported prose/header tags cannot
 * create chess facts. Authored guides carry their catalogue concept; annotations use legal FENs.
 * @param {import('../coach/tutor.js').ChessConstructor} Chess Injected rules implementation.
 * @param {Passage[]} passages Current account's compiled passages.
 */
export function buildHybridIndex(Chess, passages) {
  const text = buildTextIndex(passages), boards = new Map(), profiles = new Map();
  for (const { passage: p } of text.documents) {
    if (p.fen) {
      if (!boards.has(p.fen)) boards.set(p.fen, boardProfile(Chess, p.fen));
      profiles.set(p.id, boards.get(p.fen));
    }
  }
  return { text, profiles, Chess };
}

/** Deterministic rank fusion; raw BM25, cosine and chess scores never share a numeric scale. */
export function reciprocalRanks(/** @type {string[][]} */ lists) {
  const scores = new Map();
  for (const list of lists) {
    if (new Set(list).size !== list.length || list.length > HYBRID_POLICY.candidates) throw new Error('Invalid candidate list');
    list.forEach((id, i) => scores.set(id, (scores.get(id) || 0) + 1 / (HYBRID_POLICY.constant + i + 1)));
  }
  return scores;
}

/** Nonempty pawn analogies require compatible turn/check/phase; exact EPDs retain rights. */
function relation(/** @type {BoardProfile} */ query, /** @type {BoardProfile} */ source, distance, maximum) {
  if (!source) return '';
  if (query.epd === source.epd) return 'exact';
  if (!query.hasPawns || !source.hasPawns || query.turn !== source.turn || query.check !== source.check || query.phase !== source.phase) return '';
  return distance === 0 ? 'pawns' : distance <= maximum ? 'near-pawns' : '';
}

/**
 * Fuse eligible lexical/dense/board/tag lists, then rerank full term matches and exact boards.
 * The optional all-terms constraint is literal coverage, not semantic entailment/confidence.
 * Dense references resolve against this index; unknown, stale or out-of-scope IDs are refused.
 * @param {ReturnType<typeof buildHybridIndex>} index Detached current source index.
 * @param {string} query Literal user query.
 * @param {{dense?: Candidate[], fen?: string, allTerms?: boolean, maxPawnDistance?: number, language?: string, kind?: string, collection?: string, limit?: number}} [options]
 */
export function searchHybrid(index, query, { dense = [], fen = '', allTerms = false, maxPawnDistance = 0, limit = 8, ...filters } = {}) {
  if (typeof query !== 'string' || query.length > TEXT_LIMITS.query || typeof fen !== 'string' || typeof allTerms !== 'boolean' || !Number.isSafeInteger(limit) || limit < 1 || limit > TEXT_LIMITS.results) throw new Error('Invalid hybrid search');
  if (!Number.isFinite(maxPawnDistance) || maxPawnDistance < 0 || maxPawnDistance > 1) throw new Error('Invalid pawn distance limit');
  const selected = selectPassages(index.text.documents.map(d => d.passage), filters), corpus = new Map(selected.map(p => [p.id, p]));
  const terms = [...new Set(textTerms(query))];
  if (!terms.length || terms.length > TEXT_LIMITS.terms) return [];
  if (!Array.isArray(dense) || dense.length > HYBRID_POLICY.candidates || new Set(dense.map(h => h?.passage?.id)).size !== dense.length
    || dense.some(h => !corpus.has(h?.passage?.id) || !Number.isFinite(h.score))) throw new Error('Invalid dense candidates');
  const lexical = searchText(index.text, query, { ...filters, limit: HYBRID_POLICY.candidates });
  const board = fen ? boardProfile(index.Chess, fen) : null, signals = new Map();
  for (const p of selected) {
    const profile = index.profiles.get(p.id), tags = profile?.tags || (p.kind === 'guide' && Object.hasOwn(TAG_LABELS, p.guideId) ? [p.guideId] : []);
    const compatible = board && (!profile || board.turn === profile.turn && board.check === profile.check && board.phase === profile.phase);
    const shared = compatible ? tags.filter(tag => board.tags.includes(tag)) : [];
    const union = new Set([...(board?.tags || []), ...tags]);
    const tokens = new Set(textTerms(`${p.title} ${p.text}`)), matched = terms.filter(t => tokens.has(t));
    const pawn = board && profile ? comparePawns(board.squares, profile.squares) : null;
    signals.set(p.id, { board: board ? relation(board, profile, pawn?.distance, maxPawnDistance) : '', pawn, tags: shared, overlap: union.size ? shared.length / union.size : 0,
      matched, complete: matched.length === terms.length });
  }
  const stable = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  const positions = selected.filter(p => signals.get(p.id).board).sort((a, b) => +(signals.get(b.id).board === 'exact') - +(signals.get(a.id).board === 'exact') || signals.get(a.id).pawn.distance - signals.get(b.id).pawn.distance || stable(a.id, b.id)).slice(0, HYBRID_POLICY.candidates).map(p => p.id);
  const tags = selected.filter(p => signals.get(p.id).overlap > 0).sort((a, b) => signals.get(b.id).overlap - signals.get(a.id).overlap || stable(a.id, b.id)).slice(0, HYBRID_POLICY.candidates).map(p => p.id);
  const lists = [lexical.map(h => h.passage.id), dense.map(h => h.passage.id), positions, tags], fused = reciprocalRanks(lists);
  return [...fused].filter(([id]) => !allTerms || signals.get(id).complete)
    .sort(([a, sa], [b, sb]) => +signals.get(b).complete - +signals.get(a).complete || +(signals.get(b).board === 'exact') - +(signals.get(a).board === 'exact') || sb - sa || stable(a, b))
    .slice(0, limit).map(([id, score]) => {
      const p = corpus.get(id), signal = signals.get(id);
      return { passage: structuredClone(p), score, matched: signal.matched.slice(), excerpt: textExcerpt(p.text, query),
        evidence: { complete: signal.complete, board: signal.board, ...(signal.board === 'near-pawns' ? { pawn: structuredClone(signal.pawn) } : {}), tags: signal.tags.slice(), channels: ['keywords', 'meaning', 'position', 'tags'].filter((_, i) => lists[i].includes(id)) } };
    });
}
