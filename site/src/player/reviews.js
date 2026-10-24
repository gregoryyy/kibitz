// Historical review measurements for the current personal library (TODO 9.2).
// No prose inference, skill/rating model or provider calls. Scores remain White-relative.
import { classify, winPct, moveAccuracy, scoreToCp, positionFeatures, moveMotifs, lineMotifs, TAG_LABELS } from '../chess/knowledge.js';
import { playLine } from '../coach/annotations.js';
import { createMotifVerifier } from '../coach/tools.js';
import { checkPosition } from '../chess/play.js';

export const REVIEW_VERSION = 1;
export const REVIEW_LIMITS = Object.freeze({ plies: 4000, depth: 99, motifs: 6 });
const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const exactKeys = (o, list) => o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).length === list.length && list.every(k => Object.hasOwn(o, k));
const score = value => exactKeys(value, ['cp']) && Number.isSafeInteger(value.cp) && Math.abs(value.cp) <= 100_000
  || exactKeys(value, ['mate']) && Number.isSafeInteger(value.mate) && value.mate !== 0 && Math.abs(value.mate) <= 1000;
function rulesPoint(c) {
  if (!c.isGameOver()) return null;
  return { basis: 'rules', depth: 0, score: { cp: c.isCheckmate() ? c.turn() === 'w' ? -10_000 : 10_000 : 0 }, pv: [] };
}
function enginePoint(Chess, c, analysis) {
  const terminal = rulesPoint(c); if (terminal) return terminal;
  const first = analysis?.lines?.[0];
  if (!Number.isSafeInteger(analysis?.depth) || analysis.depth < 6 || analysis.depth > REVIEW_LIMITS.depth || first?.bound || !score(first?.score)
    || !Array.isArray(first.pv) || !first.pv.length || first.pv.slice(0, 6).some(u => typeof u !== 'string' || !UCI.test(u))) return null;
  const line = playLine(Chess, c.fen(), first.pv.slice(0, 6));
  if (!line || JSON.stringify(line.ucis) !== JSON.stringify(first.pv.slice(0, 6))) return null;
  return { basis: 'engine', depth: analysis.depth, score: { ...first.score }, pv: first.pv.slice(0, 6) };
}
function checkedPoint(Chess, c, point) {
  if (!exactKeys(point, ['basis', 'depth', 'score', 'pv'])) return false;
  const terminal = rulesPoint(c);
  if (terminal) return point.basis === 'rules' && point.depth === 0 && exactKeys(point.score, ['cp']) && point.score.cp === terminal.score.cp && Array.isArray(point.pv) && point.pv.length === 0;
  return point.basis === 'engine' && !!enginePoint(Chess, c, { depth: point.depth, lines: [{ score: point.score, pv: point.pv }] }) && point.pv.length <= 6;
}
const cp = point => point.basis === 'rules' ? point.score.cp : scoreToCp(point.score);
function phase(c, ply, standardStart) { return positionFeatures(c, { ply, standardStart }).find(f => ['opening', 'middlegame', 'endgame'].includes(f.tag)).tag; }
function metrics(before, after, uci, side) {
  const sign = side === 'w' ? 1 : -1, a = winPct(sign * cp(before)), b = winPct(sign * cp(after));
  return { classification: classify(a, b, { isBest: before.pv[0] === uci }), drop: Math.max(0, a - b), accuracy: moveAccuracy(a, b) };
}

/**
 * Capture actual review analysis, not restored depth-zero classes/evaluations. Missing/bounded/
 * illegal PV evidence stays unmeasured. One verifier shares its normal search/time budget.
 * @param {import('../coach/tutor.js').ChessConstructor} Chess
 * @param {{start:string, ucis:string[], side:string, analysis:(fen:string)=>any, engine:(fen:string,options:any)=>Promise<any>, current:()=>boolean}} input
 */
export async function buildReviewReport(Chess, { start, ucis, side, analysis, engine, current }) {
  if (!['w', 'b'].includes(side) || !Array.isArray(ucis) || ucis.length > REVIEW_LIMITS.plies || ucis.some(u => !UCI.test(u)) || checkPosition(Chess, start).error) throw new Error('Invalid review game');
  const line = playLine(Chess, start, ucis); if (!line || JSON.stringify(line.ucis) !== JSON.stringify(ucis)) throw new Error('Invalid review line');
  const c = new Chess(start), standardStart = c.fen() === new Chess().fen(), decisions = [];
  for (let i = 0; i < ucis.length; i++) {
    if (i && i % 64 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    if (!current()) return null;
    if (c.isGameOver()) break;
    const mine = c.turn() === side, before = enginePoint(Chess, c, analysis(c.fen())), sourcePhase = phase(c, i, standardStart);
    c.move({ from: ucis[i].slice(0, 2), to: ucis[i].slice(2, 4), promotion: ucis[i][4] });
    if (!mine) continue;
    const after = enginePoint(Chess, c, analysis(c.fen()));
    if (!before || !after) continue;
    decisions.push({ ply: i + 1, before, after, phase: sourcePhase, motif: { status: 'not-checked', proof: null } });
  }
  const errors = decisions.filter(d => ['mistake', 'blunder'].includes(metrics(d.before, d.after, ucis[d.ply - 1], side).classification))
    .sort((a, b) => metrics(b.before, b.after, ucis[b.ply - 1], side).drop - metrics(a.before, a.after, ucis[a.ply - 1], side).drop).slice(0, REVIEW_LIMITS.motifs);
  const report = { version: REVIEW_VERSION, engine: 'Stockfish', start: line.start, ucis: ucis.slice(), side, decisions };
  if (!errors.length) return current() ? report : null;
  const verifier = createMotifVerifier(Chess, async (fen, options) => current() ? engine(fen, options) : null);
  for (const fen of line.fens) { const a = analysis(fen); if (a) verifier.seed(fen, a); }
  for (const decision of errors) {
    if (!current()) return null;
    const fen = line.fens[decision.ply - 1], best = decision.before.pv.slice(0, 3), variation = playLine(Chess, fen, best);
    const checks = await verifier.check(variation);
    if (!current()) return null;
    decision.motif = { status: checks[0]?.status === 'confirmed' ? 'confirmed' : checks[0]?.status === 'refuted' ? 'refuted' : checks[0]?.status === 'no pattern' ? 'no-pattern' : 'unverified', proof: verifier.proof(fen, best[0]) };
  }
  return current() ? report : null;
}

/** Validate historical recorded analysis against a complete current legal source mainline. */
export function checkedReviewReport(Chess, report, start, ucis, side) {
  if (!exactKeys(report, ['version', 'engine', 'start', 'ucis', 'side', 'decisions']) || report.version !== REVIEW_VERSION || report.engine !== 'Stockfish'
    || report.start !== start || report.side !== side || !['w', 'b'].includes(side) || !Array.isArray(ucis) || ucis.length > REVIEW_LIMITS.plies
    || !Array.isArray(report.ucis) || JSON.stringify(report.ucis) !== JSON.stringify(ucis) || !Array.isArray(report.decisions) || report.decisions.length > Math.ceil(ucis.length / 2)) return null;
  try {
    const c = new Chess(start), standardStart = start === new Chess().fen(), byPly = new Map();
    if (checkPosition(Chess, start).error) return null;
    for (const d of report.decisions) {
      if (!exactKeys(d, ['ply', 'before', 'after', 'phase', 'motif']) || !Number.isSafeInteger(d.ply) || d.ply < 1 || d.ply > ucis.length || byPly.has(d.ply)) return null;
      byPly.set(d.ply, d);
    }
    const result = [];
    for (let i = 0; i < ucis.length; i++) {
      const d = byPly.get(i + 1), fen = c.fen();
      if (d && c.isGameOver()) return null;
      if (typeof ucis[i] !== 'string' || !UCI.test(ucis[i])) return null;
      if (d && (c.turn() !== side || !checkedPoint(Chess, c, d.before) || d.phase !== phase(c, i, standardStart))) return null;
      c.move({ from: ucis[i].slice(0, 2), to: ucis[i].slice(2, 4), promotion: ucis[i][4] });
      if (!d) continue;
      if (!checkedPoint(Chess, c, d.after) || !exactKeys(d.motif, ['status', 'proof']) || !['confirmed', 'unverified', 'refuted', 'no-pattern', 'not-checked'].includes(d.motif.status)) return null;
      const proof = d.motif.proof;
      if (d.motif.status === 'confirmed') {
        if (!exactKeys(proof, ['tags', 'start', 'ucis', 'lossInPawns', 'payoff']) || proof.start !== fen || !Array.isArray(proof.tags) || !proof.tags.length || proof.tags.length > 24
          || new Set(proof.tags).size !== proof.tags.length || proof.tags.some(tag => !Object.hasOwn(TAG_LABELS, tag)) || !Array.isArray(proof.ucis) || proof.ucis.length < 1 || proof.ucis.length > 6
          || proof.ucis.some(u => typeof u !== 'string' || !UCI.test(u)) || proof.ucis[0] !== d.before.pv[0] || !playLine(Chess, fen, proof.ucis) || !Number.isFinite(proof.lossInPawns) || proof.lossInPawns < 0 || proof.lossInPawns > 0.5
          || !['checkmate', 'material gain within the continuation', 'engine confirms compensation for the material', 'engine confirms a positional advantage'].includes(proof.payoff)) return null;
        const candidates = [...moveMotifs(Chess, fen, proof.ucis[0]), ...(lineMotifs(Chess, fen, proof.ucis)[0] || [])];
        if (JSON.stringify(playLine(Chess, fen, proof.ucis).ucis) !== JSON.stringify(proof.ucis)) return null;
        if (proof.tags.some(tag => !candidates.some(candidate => candidate.tag === tag))) return null;
      } else if (proof !== null) return null;
      const measured = metrics(d.before, d.after, ucis[i], side);
      if (d.motif.status !== 'not-checked' && !['mistake', 'blunder'].includes(measured.classification)) return null;
      result.push({ ...structuredClone(d), ...measured, fen, afterFen: c.fen(), uci: ucis[i] });
    }
    return result;
  } catch { return null; }
}

/** Current-library aggregation: reruns replace a game's report; deletion/owner changes remove it. */
export function summarizeReviews(Chess, records) {
  const phases = Object.fromEntries(['opening', 'middlegame', 'endgame'].map(key => [key, { measured: 0, errors: 0, inaccuracies: 0, accuracy: 0 }]));
  const themes = new Map(), seen = new Set(), result = { games: 0, ignored: 0, unsupported: 0, measured: 0, ownMoves: 0, checkedThemes: 0, confirmed: 0, phases, themes, samples: [] };
  for (const { g, snapshot } of records) {
    if (g.kind !== 'played' || !['w', 'b'].includes(g.userColor) || !g.reviewed) continue;
    if (!snapshot || snapshot.document.collection !== 'library') continue;
    if (seen.has(snapshot.document.id)) continue; seen.add(snapshot.document.id);
    const occurrences = snapshot.occurrences, start = occurrences[0].fen, ucis = occurrences.slice(1).map(o => o.uci);
    result.ownMoves += occurrences.slice(1).filter((_, i) => occurrences[i].fen.split(' ')[1] === g.userColor).length;
    const decisions = checkedReviewReport(Chess, g.analysisReview, start, ucis, g.userColor);
    if (!decisions) { result.ignored++; if (g.analysisReview !== undefined && g.analysisReview?.version !== REVIEW_VERSION) result.unsupported++; continue; }
    result.games++;
    for (const d of decisions) {
      const p = phases[d.phase]; result.measured++; p.measured++; p.accuracy += d.accuracy;
      if (['mistake', 'blunder'].includes(d.classification)) p.errors++;
      if (d.classification === 'inaccuracy') p.inaccuracies++;
      if (d.motif.status !== 'not-checked') result.checkedThemes++;
      if (d.motif.status !== 'confirmed') continue;
      result.confirmed++; const occurrence = occurrences[d.ply - 1];
      for (const tag of d.motif.proof.tags) themes.set(tag, (themes.get(tag) || 0) + 1);
      result.samples.push({ g, snapshot, occurrence, decision: d, playedLabel: occurrences[d.ply].label,
        line: playLine(Chess, d.motif.proof.start, d.motif.proof.ucis).sans });
    }
  }
  for (const p of Object.values(phases)) p.accuracy = p.measured ? p.accuracy / p.measured : null;
  return result;
}
