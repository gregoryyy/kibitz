// Derived source patterns (TODO 8.2). No engine, text inference, storage or provider work.
import { TAG_LABELS, positionFeatures, moveMotifs, lineMotifs } from '../chess/knowledge.js';

export const PATTERN_VERSION = 'detectors-v1';
/** @typedef {{id:string, version:string, tag:string, role:string, status:string, why:string, weight:number, occurrenceId:string, startOccurrenceId:string, endOccurrenceId:string, fens:string[], ucis:string[], labels:string[]}} PatternTag */

/**
 * Attach detector output only after the entire mainline has passed rules replay. Phase is a
 * contextual heuristic: a source's early standard-start plies are not named opening evidence.
 * Move candidates describe the recorded line, not the engine's best defence or a forced payoff.
 * @param {import('../coach/tutor.js').ChessConstructor} Chess
 * @param {import('./library.js').Occurrence[]} occurrences
 */
export function sourcePatterns(Chess, occurrences) {
  if (!occurrences.length) return;
  const standardStart = occurrences[0].fen === new Chess().fen();
  const combinations = lineMotifs(Chess, occurrences[0].fen, occurrences.slice(1).map(o => o.uci));
  for (const [i, occurrence] of occurrences.entries()) {
    const facts = [], seen = new Set();
    const add = (feature, role, status, span = 0) => {
      const key = role + ':' + feature.tag;
      if (!Object.hasOwn(TAG_LABELS, feature.tag) || seen.has(key)) return;
      seen.add(key);
      const start = role === 'move' ? i - 1 : i, end = role === 'move' ? i + span - 1 : i;
      const branch = occurrences.slice(start, end + 1);
      facts.push({ id: `${occurrence.id}/pattern/${PATTERN_VERSION}/${role}/${feature.tag}`, version: PATTERN_VERSION,
        tag: feature.tag, role, status, why: feature.why, weight: feature.weight, occurrenceId: occurrence.id,
        startOccurrenceId: occurrences[start].id, endOccurrenceId: occurrences[end].id,
        fens: branch.map(o => o.fen), ucis: branch.slice(1).map(o => o.uci), labels: branch.slice(1).map(o => o.label) });
    };
    const c = new Chess(occurrence.fen);
    for (const f of positionFeatures(c, { ply: standardStart ? i : (c.moveNumber() - 1) * 2 + +(c.turn() === 'b'), standardStart })) add(f, 'position', 'heuristic');
    if (i) {
      for (const f of moveMotifs(Chess, occurrences[i - 1].fen, occurrence.uci)) add(f, 'move', ['mate', 'promotion'].includes(f.tag) ? 'rules' : 'candidate', 1);
      for (const f of combinations[i - 1] || []) add(f, 'move', 'candidate', f.span);
    }
    occurrence.patterns = facts;
  }
}

/** Index compiled occurrences, never flat catalogue tags, annotations, NAGs or imported fields. */
export function buildPatternIndex(games) {
  const byTag = new Map();
  for (const g of games) for (const p of g.positions || []) for (const pattern of p.patterns || []) {
    if (pattern.version !== PATTERN_VERSION || pattern.occurrenceId !== p.id || !Object.hasOwn(TAG_LABELS, pattern.tag)) continue;
    if (!byTag.has(pattern.tag)) byTag.set(pattern.tag, []);
    byTag.get(pattern.tag).push({ g, p, pattern });
  }
  return { byTag };
}

/**
 * Exact detector-tag predicates, with source occurrences and explicit evidence classes.
 * @param {ReturnType<typeof buildPatternIndex>} index
 * @param {{tag?:string, role?:string, status?:string, collection?:string, documentId?:string, limit?:number}} [options]
 */
export function patternMatches(index, { tag, role, status, collection, documentId, limit = 20 } = {}) {
  if (!Object.hasOwn(TAG_LABELS, tag) || !Number.isSafeInteger(limit) || limit < 1 || limit > 20
    || role !== undefined && !['position', 'move'].includes(role) || status !== undefined && !['heuristic', 'candidate', 'rules'].includes(status)
    || collection !== undefined && !['library', 'classic'].includes(collection) || documentId !== undefined && (typeof documentId !== 'string' || documentId.length > 2048)) throw new Error('Invalid pattern query');
  const hits = [];
  for (const hit of index.byTag.get(tag) || []) {
    const { g, p, pattern } = hit;
    if (role !== undefined && pattern.role !== role || status !== undefined && pattern.status !== status
      || collection !== undefined && g.collection !== collection || documentId !== undefined && p.documentId !== documentId) continue;
    hits.push(hit); if (hits.length === limit) break;
  }
  return hits;
}
