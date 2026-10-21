// Stockfish's playing style. Stockfish 19 has no aggressiveness setting (its old Contempt option
// is gone; only Skill Level, UCI_LimitStrength and UCI_Elo remain), so style is applied by
// choosing among the engine's candidate moves: only moves within `maxLoss` centipawns of the
// move Stockfish would play are allowed, and among those the style's `weight` decides.
import { moveMotifs, scoreToCp } from './knowledge.js';

export const STYLES = [
  { id: 'solid', label: 'Solid', weight: -1, maxLoss: 20, hint: 'Prefers quiet, safe moves and avoids complications.' },
  { id: 'balanced', label: 'Balanced', weight: 0, maxLoss: 0, hint: 'Plays the move Stockfish thinks is best.' },
  { id: 'active', label: 'Active', weight: 1, maxLoss: 25, hint: 'Picks the more active move when it costs almost nothing.' },
  { id: 'aggressive', label: 'Aggressive', weight: 1, maxLoss: 50, hint: 'Goes for checks, attacks and sacrifices if they cost up to half a pawn.' },
  { id: 'reckless', label: 'Reckless', weight: 1, maxLoss: 120, hint: 'Attacks whenever it can, even at the cost of more than a pawn.' },
];
export const styleOf = id => STYLES.find(s => s.id === id) || STYLES[1];

const FILES = 'abcdefgh';
const dist = (a, b) => Math.max(Math.abs(FILES.indexOf(a[0]) - FILES.indexOf(b[0])), Math.abs(+a[1] - +b[1]));
const MOTIF_POINTS = { mate: 10, sacrifice: 3, 'greek-gift': 3, 'king-attack': 2, fork: 1, pin: 1, 'discovered-attack': 1 };

// How aggressive a move is for the side playing it. Checks, captures, sacrifices, tactics and
// moves towards the enemy king score up; retreats score down. Illegal moves score -Infinity.
export function aggressionScore(Chess, fen, uci) {
  const c = new Chess(fen);
  let mv;
  try { mv = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q' }); } catch { return -Infinity; }
  const them = mv.color === 'w' ? 'b' : 'w';
  const king = c.board().flat().find(p => p && p.type === 'k' && p.color === them)?.square;
  let s = 0;
  if (c.inCheck()) s += 3;
  if (mv.captured) s += 1;
  for (const m of moveMotifs(Chess, fen, uci)) s += MOTIF_POINTS[m.tag] || 0;
  if (king && mv.piece !== 'p') s += Math.max(-1, Math.min(2, dist(mv.from, king) - dist(mv.to, king))); // piece heads for the enemy king
  const enemyHalf = mv.color === 'w' ? +mv.to[1] >= 5 : +mv.to[1] <= 4;
  if (king && mv.piece === 'p' && enemyHalf && Math.abs(FILES.indexOf(mv.to[0]) - FILES.indexOf(king[0])) <= 1) s += 1; // pawn storm
  if ((+mv.to[1] - +mv.from[1]) * (mv.color === 'w' ? 1 : -1) < 0) s -= 1; // retreat
  return s;
}

// Chooses a move from Stockfish's candidate lines (side-to-move's point of view, best first).
// `anchor` is the move Stockfish would play (default: the best line). With an Elo limit that is a
// deliberately weaker move, and the window is measured from it, so style changes how Stockfish
// plays but not how strong it is. Balanced, or an anchor without a line, returns the anchor.
export function pickStyled(Chess, fen, lines, style, /** @type {{ anchor?: string }} */ { anchor } = {}) {
  const cands = (lines || []).filter(l => l?.pv?.length && l.score);
  const base = anchor ? cands.find(l => l.pv[0] === anchor) : cands[0];
  if (!base) return anchor ?? null;
  if (!style?.weight) return base.pv[0];
  const baseCp = scoreToCp(base.score);
  let pick = base.pv[0], best = -Infinity;
  for (const l of cands) {
    const diff = baseCp - scoreToCp(l.score); // > 0: weaker than the anchor
    if (Math.abs(diff) > style.maxLoss) continue;
    // Small pull towards the stronger move, so equal-style candidates resolve by evaluation.
    const v = style.weight * aggressionScore(Chess, fen, l.pv[0]) - diff / 25;
    if (v > best) { best = v; pick = l.pv[0]; }
  }
  return pick;
}
