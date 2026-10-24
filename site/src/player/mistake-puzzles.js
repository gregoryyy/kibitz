// Generated positional exercises from own reviews (TODO 9.3). No model, DOM or persistence.
import { checkedReviewReport } from './reviews.js';
import { analysisPoint, terminalPoint } from '../chess/evidence.js';
import { practiceMove } from '../chess/practice.js';
import { playLine } from '../coach/annotations.js';

export const OWN_PUZZLE_POLICY = Object.freeze({ version: 1, depth: 14, margin: 50, sourceGap: 100, candidates: 50 });
const sign = side => side === 'w' ? 1 : -1;
function value(point, side) {
  const factor = sign(side);
  if (point.basis === 'rules') return point.score.cp === 0 ? 0 : Math.sign(point.score.cp) * factor * 1_000_000;
  if (point.score.mate !== undefined) return Math.sign(point.score.mate) * factor * 1_000_000;
  return point.score.cp * factor;
}
export const withinPuzzleTarget = (reference, answer, side) => value(answer, side) >= value(reference, side) - OWN_PUZZLE_POLICY.margin;
const cancelled = () => ({ kind: 'cancelled' });

/**
 * Candidates are source pointers, not solutions. Original errors must be checked again.
 * @param {any} Chess
 * @param {any[]} records
 * @param {{scope?:string,limit?:number}} [options]
 */
export function ownPuzzleCandidates(Chess, records, { scope, limit = OWN_PUZZLE_POLICY.candidates } = {}) {
  if (typeof scope !== 'string' || !scope || scope.length > 2048 || !Number.isSafeInteger(limit) || limit < 1 || limit > OWN_PUZZLE_POLICY.candidates) throw new Error('Invalid own-puzzle scope');
  const seen = new Set(), candidates = [];
  for (const { g, snapshot } of records) {
    if (g.kind !== 'played' || !g.reviewed || !['w', 'b'].includes(g.userColor) || snapshot?.document.collection !== 'library' || seen.has(snapshot.document.id)) continue;
    seen.add(snapshot.document.id);
    const rows = snapshot.occurrences, decisions = checkedReviewReport(Chess, g.analysisReview, rows[0].fen, rows.slice(1).map(o => o.uci), g.userColor);
    for (const decision of decisions || []) {
      if (!['mistake', 'blunder'].includes(decision.classification)) continue;
      const occurrence = rows[decision.ply - 1], key = JSON.stringify([scope, snapshot.document.id, decision.ply, decision.fen, decision.uci]);
      candidates.push({ key, g, snapshot, occurrence, decision, fen: decision.fen, side: g.userColor, playedLabel: rows[decision.ply].label });
    }
  }
  candidates.sort((a, b) => b.decision.drop - a.decision.drop || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return candidates.slice(0, limit);
}

async function readPoint(Chess, chess, engine, current) {
  if (!current()) return null;
  const terminal = terminalPoint(chess); if (terminal) return terminal;
  try {
    const data = await engine(chess.fen(), { depth: OWN_PUZZLE_POLICY.depth, lines: 1 });
    return current() ? analysisPoint(Chess, chess, data) : null;
  } catch { return null; }
}
const move = (chess, uci) => chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });

/**
 * Prepare a FEN exercise lazily. There are no pre-diagram repetition claims; counters/rights
 * remain in the full FEN. Root/reference/original-child searches qualify the current target.
 * @param {import('../coach/tutor.js').ChessConstructor} Chess
 * @param {ReturnType<typeof ownPuzzleCandidates>[number]} candidate
 * @param {{engine:(fen:string,options:{depth:number,lines:number})=>Promise<any>,current:()=>boolean}} options
 */
export async function prepareOwnPuzzle(Chess, candidate, { engine, current }) {
  if (!current()) return cancelled();
  const { snapshot, g, decision } = candidate, rows = snapshot.occurrences;
  if (g.kind !== 'played' || !g.reviewed || snapshot.document.collection !== 'library' || snapshot.document.localId !== g.id) return { kind: 'unavailable' };
  const source = checkedReviewReport(Chess, g.analysisReview, rows[0].fen, rows.slice(1).map(o => o.uci), g.userColor)?.find(d => d.ply === decision.ply);
  if (!source || !['mistake', 'blunder'].includes(source.classification) || source.fen !== candidate.fen || source.uci !== decision.uci || candidate.side !== g.userColor) return { kind: 'unavailable' };
  const root = new Chess(candidate.fen); if (root.isGameOver()) return { kind: 'unavailable' };
  const rootPoint = await readPoint(Chess, root, engine, current);
  if (!current()) return cancelled();
  if (!rootPoint || rootPoint.basis !== 'engine') return { kind: 'unverified' };
  const best = rootPoint.pv[0]; if (best === decision.uci) return { kind: 'outdated' };
  const bestBoard = new Chess(root.fen()), bestMove = move(bestBoard, best);
  const reference = await readPoint(Chess, bestBoard, engine, current);
  if (!current()) return cancelled();
  const originalBoard = new Chess(root.fen()); move(originalBoard, decision.uci);
  const original = await readPoint(Chess, originalBoard, engine, current);
  if (!current()) return cancelled();
  if (!reference || !original) return { kind: 'unverified' };
  if (value(reference, candidate.side) - value(original, candidate.side) < OWN_PUZZLE_POLICY.sourceGap) return { kind: 'outdated' };
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(candidate.key));
  if (!current()) return cancelled();
  const id = 'mistake-' + [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  const line = playLine(Chess, root.fen(), [best, ...reference.pv].slice(0, 6));
  return { kind: 'ready', puzzle: { version: OWN_PUZZLE_POLICY.version, id,
    revision: JSON.stringify(['engine-target-v1', root.fen(), decision.uci, best, OWN_PUZZLE_POLICY.margin, OWN_PUZZLE_POLICY.depth]),
    candidate, fen: root.fen(), side: candidate.side, rootPoint, reference, original, best, bestSan: bestMove.san,
    line: line || playLine(Chess, root.fen(), [best]) } };
}

/** Any legal alternative can qualify; missing evidence never becomes an incorrect grade. */
export async function checkOwnPuzzle(Chess, puzzle, input, { engine, current, language = 'en' }) {
  if (!current()) return cancelled();
  const intent = practiceMove(Chess, puzzle.fen, input, language);
  if (intent.kind !== 'move') return intent;
  const after = new Chess(puzzle.fen); move(after, intent.uci);
  if (after.isCheckmate()) return { kind: 'accepted', basis: 'rules-mate', uci: intent.uci, san: intent.move.san, fen: after.fen(), point: terminalPoint(after) };
  const point = intent.uci === puzzle.best ? puzzle.reference : intent.uci === puzzle.candidate.decision.uci ? puzzle.original : await readPoint(Chess, after, engine, current);
  if (!current()) return cancelled();
  if (!point) return { kind: 'unverified' };
  return { kind: withinPuzzleTarget(puzzle.reference, point, puzzle.side) ? 'accepted' : 'below-target', basis: 'engine-target',
    uci: intent.uci, san: intent.move.san, fen: after.fen(), point };
}
