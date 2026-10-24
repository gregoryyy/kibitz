// Exact, bounded engine/rules facts. Callers supply a legal Chess state with relevant history.
import { playLine } from '../coach/annotations.js';

export const ENGINE_EVIDENCE = Object.freeze({ minDepth: 6, maxDepth: 99, pvPlies: 6, cp: 100_000, mate: 1000 });
const keys = (o, list) => o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).length === list.length && list.every(k => Object.hasOwn(o, k));
const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const score = value => keys(value, ['cp']) && Number.isSafeInteger(value.cp) && Math.abs(value.cp) <= ENGINE_EVIDENCE.cp
  || keys(value, ['mate']) && Number.isSafeInteger(value.mate) && value.mate !== 0 && Math.abs(value.mate) <= ENGINE_EVIDENCE.mate;

export function terminalPoint(chess) {
  if (!chess.isGameOver()) return null;
  return { basis: 'rules', depth: 0, score: { cp: chess.isCheckmate() ? chess.turn() === 'w' ? -10_000 : 10_000 : 0 }, pv: [] };
}

/** First-line depth qualifies that line; a deeper sibling MultiPV line cannot qualify it. */
export function analysisPoint(Chess, chess, analysis) {
  const terminal = terminalPoint(chess); if (terminal) return terminal;
  const first = analysis?.lines?.[0], depth = first?.depth ?? analysis?.depth;
  if (!Number.isSafeInteger(analysis?.depth) || analysis.depth < ENGINE_EVIDENCE.minDepth || analysis.depth > ENGINE_EVIDENCE.maxDepth
    || !Number.isSafeInteger(depth) || depth < ENGINE_EVIDENCE.minDepth || depth > analysis.depth || first?.bound || !score(first?.score)
    || !Array.isArray(first.pv) || !first.pv.length) return null;
  const pv = first.pv.slice(0, ENGINE_EVIDENCE.pvPlies);
  if (pv.some(u => typeof u !== 'string' || !UCI.test(u))) return null;
  const line = playLine(Chess, chess.fen(), pv);
  if (!line || JSON.stringify(line.ucis) !== JSON.stringify(pv)) return null;
  return { basis: 'engine', depth, score: { ...first.score }, pv };
}
