// Explanation modes (TODO 3.9): interesting moves beyond the engine's first line, and challenges
// that ask instead of explain. Pure functions, like knowledge.js: no DOM, no globals, so they run in
// the browser and in Node. Engine lines come in as [{pv: [uci, ...], score: {cp} | {mate}}] with
// scores from White's point of view, as the page stores them.
import { scoreToCp, moveMotifs, TAG_LABELS } from './knowledge.js';
import { parseMoveInput } from './notation.js';

const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const NAME = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const SIDE = { w: 'White', b: 'Black' };
const turn = fen => fen.split(' ')[1];
const toMove = uci => ({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q' });
const wing = sq => 'abc'.includes(sq[0]) ? 'queenside' : 'de'.includes(sq[0]) ? 'centre' : 'kingside';
const fmt = cp => Math.abs(cp) >= 9000 ? (cp > 0 ? 'mate' : 'mated') : `${cp >= 0 ? '+' : '−'}${(Math.abs(cp) / 100).toFixed(2)}`;

// A line's score in centipawns for the side to move in `fen` (mates as ±10000-ish).
function moverCp(fen, line) {
  const cp = scoreToCp(line.score);
  return turn(fen) === 'w' ? cp : -cp;
}
function materialFor(c, color) {
  let m = 0;
  for (const row of c.board()) for (const p of row) if (p) m += (p.color === color ? 1 : -1) * VALUE[p.type];
  return m;
}

// The opponent's captures right after a move that look like they win material: counting what the
// move itself took, the capture, and a recapture where there is one, the mover ends up at least a
// pawn down. What "looks free" to a human, not what the engine says.
function baitCaptures(c, me, before) {
  const out = [];
  for (const m of c.moves({ verbose: true })) {
    if (!m.captured) continue;
    c.move(m);
    const recapture = c.moves({ verbose: true }).some(r => r.to === m.to && r.captured);
    const net = materialFor(c, me) + (recapture ? VALUE[m.piece] : 0) - before;
    c.undo();
    if (net <= -1) out.push(m);
  }
  return out;
}

// What a line's first move is, for picking and explaining: tags, a short reason, and the SAN.
export function describeMove(Chess, fen, line, best = null) {
  const c = new Chess(fen), me = turn(fen);
  let mv;
  try { mv = c.move(toMove(line.pv[0])); } catch { return null; }
  const tags = [], why = [];
  const check = c.inCheck();
  if (mv.captured || check || mv.promotion) tags.push('forcing');
  else tags.push('quiet');
  const before = materialFor(new Chess(fen), me);
  const bait = baitCaptures(c, me, before);
  const reply = line.pv[1];
  // Material after a few plies of the engine's own line: gave something up and stays within the window.
  const d = new Chess(fen);
  for (const u of line.pv.slice(0, 4)) { try { d.move(toMove(u)); } catch { break; } }
  const down = before - materialFor(d, me);
  if (down >= 2 || bait.some(b => b.from + b.to === reply?.slice(0, 4))) {
    tags.push('sacrifice');
    why.push(down >= 2 ? `gives up material (about ${down} pawn${down === 1 ? '' : 's'} in the engine's line)` : `offers the ${NAME[bait[0].captured]} on ${bait[0].to}, and the engine's line takes it`);
  } else if (bait.length) {
    tags.push('trap');
    const b = bait[0];
    why.push(`leaves the ${NAME[b.captured]} on ${b.to} to be taken (${b.san}), but that isn't the engine's choice for ${SIDE[me === 'w' ? 'b' : 'w']}`);
  }
  if (best && best.pv[0] !== line.pv[0]) {
    const b = new Chess(fen).move(toMove(best.pv[0]));
    if (b && b.piece !== mv.piece && wing(b.to) !== wing(mv.to)) {
      tags.push('different-plan');
      why.push(`a different idea: a ${NAME[mv.piece]} move on the ${wing(mv.to)}, where the best move is a ${NAME[b.piece]} move on the ${wing(b.to)}`);
    }
  }
  if (tags.includes('quiet') && best && !why.length) why.push('a quiet move: no check, no capture');
  return { uci: line.pv[0], san: mv.san, tags, why: why.join('; ') };
}

const INTEREST = { sacrifice: 3, trap: 3, 'different-plan': 2, quiet: 1 };

// The engine's lines worth showing besides the best one (3.9.4): within `windowCp` of the best,
// and interesting for a reason (a sacrifice, a trap for the opponent, a different plan, a quiet
// move when the best one is forcing). Each with its engine rank and evaluation.
export function interestingMoves(Chess, fen, lines, { windowCp = 100, limit = 3 } = {}) {
  if (!lines?.length || !lines[0].pv?.length) return { best: null, picks: [] };
  const best = lines[0], bestCp = moverCp(fen, best);
  const top = describeMove(Chess, fen, best);
  const picks = [];
  lines.forEach((line, k) => {
    if (k === 0 || !line.pv?.length) return;
    const cp = moverCp(fen, line), gap = bestCp - cp;
    if (gap > windowCp) return;
    const d = describeMove(Chess, fen, line, best);
    if (!d) return;
    const interest = d.tags.reduce((a, t) => a + (t === 'quiet' && top?.tags.includes('quiet') ? 0 : INTEREST[t] || 0), 0);
    if (!interest) return;
    picks.push({ ...d, rank: k + 1, cp, gap, eval: fmt(cp), interest });
  });
  picks.sort((a, b) => b.interest - a.interest || a.rank - b.rank);
  return { best: top && { ...top, rank: 1, cp: bestCp, gap: 0, eval: fmt(bestCp) }, picks: picks.slice(0, limit) };
}

// For the prompt: the picks as lines the coach can explain, scores from the mover's side.
export function interestingLines(r) {
  if (!r?.picks.length) return [];
  return [
    `Interesting alternatives to the best move ${r.best.san} (${r.best.eval} for the side to move), from Stockfish's lines:`,
    ...r.picks.map(p => `  - ${p.san}: rank ${p.rank}, ${p.eval}, ${(p.gap / 100).toFixed(2)} below the best. ${p.tags.filter(t => t !== 'forcing' && t !== 'quiet').map(t => t.replace('-', ' ')).join(', ') || p.tags[0]}${p.why ? ': ' + p.why : ''}.`),
  ];
}

// --- Challenges (3.9.3) ---------------------------------------------------

// The same position with the other side to move, for "what does the opponent threaten?". Null
// when the side to move is in check (the flipped position would be illegal).
export function flipSide(Chess, fen) {
  const c = new Chess(fen);
  if (c.inCheck()) return null;
  const f = fen.split(' ');
  f[1] = f[1] === 'w' ? 'b' : 'w'; f[3] = '-';
  const flipped = f.join(' ');
  try { new Chess(flipped); } catch { return null; }
  return flipped;
}

// Material the side to move in `fen` wins along the first plies of a line.
function gainIn(Chess, fen, pv, plies = 4) {
  const me = turn(fen), c = new Chess(fen), before = materialFor(c, me);
  for (const u of (pv || []).slice(0, plies)) { try { c.move(toMove(u)); } catch { break; } }
  return materialFor(c, me) - before;
}
const themeOf = (Chess, fen, uci) => moveMotifs(Chess, fen, uci)[0]?.tag || 'calculation';
const sanOf = (Chess, fen, uci) => { try { return new Chess(fen).move(toMove(uci)).san; } catch { return null; } };

// A challenge for the position, or null if the engine data doesn't support one. kinds:
//   'best'   find the best move (any move within 30 cp of it counts, unless the best mates);
//   'choose' which of two moves is better: the best and one clearly worse (80 cp or more);
//   'threat' what the opponent threatens: needs threatLines, the analysis of flipSide(fen), and a
//            concrete threat: the opponent's line mates, or wins two pawns' worth of material or more.
export function makeChallenge(Chess, { fen, lines, threatLines = null, kind = 'best', seed = 0 }) {
  if (!lines?.length || !lines[0].pv?.length) return null;
  const me = turn(fen), side = SIDE[me], opp = SIDE[me === 'w' ? 'b' : 'w'];
  const bestCp = moverCp(fen, lines[0]);
  if (kind === 'best') {
    const mates = bestCp >= 9000;
    const ok = lines.filter(l => l.pv?.length && (mates ? moverCp(fen, l) >= 9000 : bestCp - moverCp(fen, l) <= 30)).map(l => l.pv[0]);
    return { kind, fen, prompt: `Your turn to find it: what is the best move for ${side} here?`, accept: ok, answer: lines[0].pv[0], answerSan: sanOf(Chess, fen, lines[0].pv[0]), theme: themeOf(Chess, fen, lines[0].pv[0]), eval: `${fmt(bestCp)} for ${side}` };
  }
  if (kind === 'choose') {
    const worse = lines.find((l, k) => k > 0 && l.pv?.length && bestCp - moverCp(fen, l) >= 80);
    if (!worse) return null;
    const a = sanOf(Chess, fen, lines[0].pv[0]), b = sanOf(Chess, fen, worse.pv[0]);
    const options = seed % 2 ? [b, a] : [a, b];
    return { kind, fen, prompt: `${options[0]} or ${options[1]}? Which is better for ${side}?`, options, accept: [lines[0].pv[0]], answer: lines[0].pv[0], answerSan: a, other: { uci: worse.pv[0], san: b, eval: `${fmt(moverCp(fen, worse))} for ${side}` }, theme: themeOf(Chess, fen, lines[0].pv[0]), eval: `${fmt(bestCp)} for ${side}` };
  }
  if (kind === 'threat') {
    const flipped = flipSide(Chess, fen);
    if (!flipped || !threatLines?.length || !threatLines[0].pv?.length) return null;
    const threatCp = moverCp(flipped, threatLines[0]); // for the opponent, if they could move now
    const m = threatLines[0].score.mate; // scores are from White's point of view
    const mates = m !== undefined && (m > 0) === (turn(flipped) === 'w');
    if (!mates && gainIn(Chess, flipped, threatLines[0].pv) < 2) return null; // nothing concrete
    const ok = threatLines.filter(l => l.pv?.length && threatCp - moverCp(flipped, l) <= 50).map(l => l.pv[0]);
    return { kind, fen: flipped, prompt: `What does ${opp} threaten here? Name the move ${opp} would like to play.`, accept: ok, answer: threatLines[0].pv[0], answerSan: sanOf(Chess, flipped, threatLines[0].pv[0]), theme: themeOf(Chess, flipped, threatLines[0].pv[0]), eval: `it would give ${opp} ${fmt(threatCp)}` };
  }
  return null;
}

// Checks the player's answer (a move in SAN or UCI, or one of the options). The verdict is plain
// text from the engine data; the coach can explain it afterwards.
export function checkChallenge(Chess, ch, input) {
  const mv = parseMoveInput(Chess, ch.fen, input);
  if (mv.error) return { valid: false, correct: false, verdict: `${mv.error} Try again, in notation like Nf3 or exd5.` };
  const uci = mv.from + mv.to + (mv.promotion || '');
  const correct = ch.accept.some(a => a.slice(0, 4) === uci.slice(0, 4) && (a.length < 5 || a[4] === (mv.promotion || 'q')));
  const name = { best: 'the best move', choose: 'the better move', threat: 'the threat' }[ch.kind];
  const verdict = correct
    ? `Right: ${mv.san} is ${ch.answerSan === mv.san ? name : `as good as ${ch.answerSan}, ${name}`} (${ch.eval}).`
    : `Not quite: ${mv.san} isn't it. ${ch.kind === 'threat' ? 'The threat is' : 'Stockfish plays'} ${ch.answerSan} (${ch.eval}).`;
  return { valid: true, correct, san: mv.san, verdict };
}

// Results per theme, for progress (6.7, 9.2): {theme: {right, tries}}. Returns a new object.
export function recordResult(progress, theme, correct) {
  const p = { ...(progress || {}) };
  const t = p[theme] || { right: 0, tries: 0 };
  p[theme] = { right: t.right + (correct ? 1 : 0), tries: t.tries + 1 };
  return p;
}
export const themeLabel = tag => TAG_LABELS[tag] || tag;
