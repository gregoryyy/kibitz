// Engine tools for the coach (TODO 4.11): the model asks, Stockfish and the motif detectors answer.
// Pure: the definitions the gateway hands to the provider, the checks on every argument (they come
// from the model, so they are untrusted), and the code that runs a tool against an engine passed in
// as a function. The page runs the loop and the engine (TODO 4.11.4); tests pass a fake engine.
//
// engine(fen, {depth, lines}) -> Promise<{depth, lines: [{score: {cp} | {mate}, pv: [uci]}]}>, scores
// from White's point of view, as the page keeps them.

import { moveMotifs, lineMotifs, material, epd, scoreToCp } from './knowledge.js';
import { playLine } from './annotations.js';
import { flipSide } from './modes.js';
import { CHAT_TOOLS } from './chat.js';
import { checkPosition } from './play.js';

export const CAPS = { depth: 18, lines: 5, compare: 5, mate: 7, lineMoves: 12, rounds: 4, calls: 6, motifSearches: 12, motifPlies: 6, motifMs: 15_000 };
const DEFAULT_DEPTH = 14;

const fenProp = { type: 'string', description: 'The position as a FEN. Use the current position\'s FEN from the context unless you mean another position.' };
export const TOOLS = {
  analyse: {
    description: 'Stockfish\'s top lines for a position, in SAN, with evaluations from White\'s point of view, the motifs found along each line, and whether only one move holds.',
    schema: { type: 'object', additionalProperties: false, required: ['fen'], properties: {
      fen: fenProp,
      depth: { type: 'integer', minimum: 6, maximum: CAPS.depth, description: `Search depth, ${DEFAULT_DEPTH} if left out.` },
      lines: { type: 'integer', minimum: 1, maximum: CAPS.lines, description: 'How many lines, 3 if left out.' },
    } },
  },
  try_move: {
    description: 'Whether a move works: Stockfish\'s evaluation after it compared with the best move, and the reply that refutes it if it doesn\'t.',
    schema: { type: 'object', additionalProperties: false, required: ['fen', 'move'], properties: { fen: fenProp, move: { type: 'string', description: 'The move in SAN (Nf3) or UCI (g1f3).' } } },
  },
  threats: {
    description: 'What the other side would play if it were their move: their best move and line. Not available when the side to move is in check.',
    schema: { type: 'object', additionalProperties: false, required: ['fen'], properties: { fen: fenProp } },
  },
  compare: {
    description: 'Stockfish\'s evaluation after each of a few candidate moves, best first.',
    schema: { type: 'object', additionalProperties: false, required: ['fen', 'moves'], properties: {
      fen: fenProp, moves: { type: 'array', minItems: 2, maxItems: CAPS.compare, items: { type: 'string' }, description: 'Candidate moves in SAN or UCI.' },
    } },
  },
  find_mate: {
    description: 'Whether the side to move has a forced mate in at most n moves, and the line.',
    schema: { type: 'object', additionalProperties: false, required: ['fen', 'n'], properties: { fen: fenProp, n: { type: 'integer', minimum: 1, maximum: CAPS.mate } } },
  },
  find_motifs: {
    description: 'Tactical motifs of a line, checked against Stockfish before and after each candidate move. Only sound motifs with a payoff in a short best-reply line are returned. Unchecked or refuted patterns are withheld; a legal supplied line alone is not engine evidence.',
    schema: { type: 'object', additionalProperties: false, required: ['fen', 'line'], properties: {
      fen: fenProp, line: { type: 'array', minItems: 1, maxItems: CAPS.lineMoves, items: { type: 'string' }, description: 'Moves in SAN or UCI, played in turn from the position.' },
    } },
  },
};
export const ENGINE_TOOL_NAMES = Object.keys(TOOLS);
Object.assign(TOOLS, CHAT_TOOLS);
export const TOOL_NAMES = Object.keys(TOOLS);

const int = (v, lo, hi, d) => (v === undefined ? d : Number.isInteger(v) && v >= lo && v <= hi ? v : null);
const chessOf = (Chess, fen) => { try { const p = typeof fen === 'string' && fen.length < 100 ? checkPosition(Chess, fen) : null; return p?.fen ? new Chess(p.fen) : null; } catch { return null; } };

// A tool call's input checked: {ok: true, name, args} or {ok: false, why}. Unknown tools, extra
// fields, illegal positions or moves, and values over the caps are refused, never clamped silently.
export function checkToolCall(Chess, name, input) {
  if (!Object.hasOwn(TOOLS, name)) return { ok: false, why: `unknown tool ${String(name).slice(0, 40)}` };
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, why: 'the input must be an object' };
  const allowed = Object.keys(TOOLS[name].schema.properties);
  const extra = Object.keys(input).find(k => !allowed.includes(k));
  if (extra) return { ok: false, why: `unknown argument ${extra.slice(0, 40)}` };
  const c = chessOf(Chess, input.fen);
  if (!c) return { ok: false, why: 'not a legal position (FEN)' };
  const fen = c.fen();
  if (name === 'analyse') {
    const depth = int(input.depth, 6, CAPS.depth, DEFAULT_DEPTH), lines = int(input.lines, 1, CAPS.lines, 3);
    if (depth === null || lines === null) return { ok: false, why: `depth must be 6-${CAPS.depth} and lines 1-${CAPS.lines}` };
    return { ok: true, name, args: { fen, depth, lines } };
  }
  if (name === 'try_move') {
    const line = typeof input.move === 'string' && playLine(Chess, fen, [input.move.trim()]);
    if (!line) return { ok: false, why: 'not a legal move in that position' };
    return { ok: true, name, args: { fen, move: line.sans[0] } };
  }
  if (name === 'threats') {
    if (c.inCheck()) return { ok: false, why: 'the side to move is in check, so there is no "their move" to look at' };
    return { ok: true, name, args: { fen } };
  }
  if (name === 'compare') {
    const ms = Array.isArray(input.moves) ? input.moves : [];
    if (ms.length < 2 || ms.length > CAPS.compare) return { ok: false, why: `compare takes 2-${CAPS.compare} moves` };
    const sans = ms.map(m => typeof m === 'string' && playLine(Chess, fen, [m.trim()])?.sans[0]);
    if (sans.some(s => !s)) return { ok: false, why: 'a move isn\'t legal in that position' };
    return { ok: true, name, args: { fen, moves: [...new Set(sans)] } };
  }
  if (name === 'find_mate') {
    const n = int(input.n, 1, CAPS.mate, null);
    if (n === null) return { ok: false, why: `n must be 1-${CAPS.mate}` };
    return { ok: true, name, args: { fen, n } };
  }
  // find_motifs
  const ms = Array.isArray(input.line) ? input.line : [];
  if (!ms.length || ms.length > CAPS.lineMoves || ms.some(m => typeof m !== 'string')) return { ok: false, why: `a line of 1-${CAPS.lineMoves} moves` };
  const line = playLine(Chess, fen, ms.map(m => m.trim()));
  if (!line) return { ok: false, why: 'the line isn\'t legal from that position' };
  return { ok: true, name, args: { fen, line: line.sans } };
}

// --- Running a tool -----------------------------------------------------------
const fmt = s => (!s ? '?' : s.mate !== undefined ? (s.mate > 0 ? '#' : '#-') + Math.abs(s.mate) : (s.cp > 0 ? '+' : s.cp < 0 ? '-' : '') + (Math.abs(s.cp) / 100).toFixed(2));
// SAN with move numbers from a position: "10. Nxb5 cxb5 11. Bxb5+".
function numbered(Chess, fen, ucis, max = 10) {
  const line = playLine(Chess, fen, ucis.slice(0, max));
  if (!line) return { text: '', sans: [] };
  const text = line.sans.map((san, k) => { const [, side, , , , num] = line.fens[k].split(' '); return side === 'w' ? `${num}. ${san}` : k === 0 ? `${num}... ${san}` : san; }).join(' ');
  return { text, sans: line.sans, fens: line.fens, ucis: line.ucis };
}
const moverCp = (score, side) => { const cp = scoreToCp(score); return side === 'w' ? cp : -cp; };

// One bounded verifier per tool, shared by its lines. No search is needed for a terminal board;
// other results need an exact score, a legal PV and at least depth 6. Cache by EPD, including misses.
function motifVerifier(Chess, engine) {
  const cache = new Map(), evidence = [], starts = [], started = Date.now();
  let searches = 0;
  const seed = (fen, a) => { cache.set(epd(fen), a); };
  const read = async fen => {
    const c = new Chess(fen);
    if (c.isCheckmate()) return { cp: c.turn() === 'w' ? -10_000 : 10_000, line: playLine(Chess, fen, []), terminal: true };
    if (c.isDraw()) return { cp: 0, line: playLine(Chess, fen, []), terminal: true };
    const key = epd(fen);
    if (!cache.has(key)) {
      if (searches >= CAPS.motifSearches || Date.now() - started >= CAPS.motifMs) return null;
      searches++;
      cache.set(key, await engine(fen, { depth: DEFAULT_DEPTH, lines: 1 }));
    }
    const a = cache.get(key), l = a?.lines?.[0], score = l?.score;
    if (!l || !Number.isFinite(a.depth) || a.depth < 6 || l.bound || !(Number.isFinite(score?.cp) || (Number.isInteger(score?.mate) && score.mate !== 0))) return null;
    const line = playLine(Chess, fen, (l.pv || []).slice(0, CAPS.motifPlies));
    if (!line?.sans.length) return null;
    return { cp: Number.isFinite(score.cp) ? score.cp : scoreToCp(score), line, terminal: false };
  };
  const check = async line => {
    const combinations = lineMotifs(Chess, line.start, line.ucis);
    const rows = [];
    for (let k = 0; k < line.sans.length; k++) {
      const candidates = [...moveMotifs(Chess, line.fens[k], line.ucis[k]), ...(combinations[k] || [])];
      const row = { move: line.sans[k], motifs: [], status: 'no pattern', reason: '', continuation: '', lossInPawns: null, payoff: '' };
      rows.push(row);
      if (!candidates.length) continue;
      const sign = line.fens[k].split(' ')[1] === 'w' ? 1 : -1;
      const after = await read(line.fens[k + 1]);
      // A legal mate on the board is conclusive even when the worker returns no terminal PV.
      const before = after?.terminal && sign * after.cp === 10_000 ? after : await read(line.fens[k]);
      if (!before || !after) { row.status = 'unverified'; row.reason = 'Engine evidence unavailable within the search budget.'; continue; }
      const loss = sign * (before.cp - after.cp);
      row.lossInPawns = Math.max(0, loss) / 100;
      row.status = 'refuted';
      if (loss > 50) { row.reason = 'The move loses more than half a pawn against the best move.'; continue; }
      const bestReply = playLine(Chess, line.fens[k], [line.ucis[k], ...after.line.ucis.slice(0, CAPS.motifPlies - 1)]);
      const end = new Chess(bestReply.fens.at(-1));
      const balance = fen => { const m = material(new Chess(fen)); return sign * (m.w - m.b); };
      const gain = balance(end.fen()) - balance(line.fens[k]);
      if (end.isCheckmate() && end.turn() !== line.fens[k].split(' ')[1]) row.payoff = 'checkmate';
      else if (gain > 0) row.payoff = 'material gain within the continuation';
      else if (sign * after.cp >= 100) {
        const horizon = await read(end.fen());
        if (horizon && sign * horizon.cp >= 100 && sign * (after.cp - horizon.cp) <= 50) row.payoff = gain < 0 ? 'engine confirms compensation for the material' : 'engine confirms a positional advantage';
      }
      if (!row.payoff) { row.status = 'unverified'; row.reason = 'No payoff established within the short continuation.'; continue; }
      // Multi-move labels require the supplied reply and follow-up to match the engine's PV.
      row.motifs = [...new Set(candidates.filter(m => !m.span || line.ucis.slice(k + 1, k + m.span).every((u, j) => u === after.line.ucis[j])).map(m => m.why))];
      if (!row.motifs.length) { row.status = 'unverified'; row.reason = 'The supplied combination is not the engine continuation.'; continue; }
      row.status = 'confirmed';
      row.continuation = numbered(Chess, line.fens[k], bestReply.ucis, CAPS.motifPlies).text;
      evidence.push(bestReply.sans);
      starts.push(bestReply.start);
    }
    return rows;
  };
  return { seed, check, evidence, starts };
}
const motifSummary = checks => [...new Set(checks.flatMap(r => r.motifs))].slice(0, 12);

// Runs a checked tool call: {result} (JSON for the model) plus `lines`: the SAN sequences it showed,
// so the answer check (tutor.js checkAnswer) can back the moves the coach quotes from it.
export async function runTool(Chess, engine, { name, args }) {
  const side = args.fen.split(' ')[1];
  const verifier = motifVerifier(Chess, engine);
  if (name === 'analyse') {
    const a = await engine(args.fen, { depth: args.depth, lines: args.lines });
    const lines = (a?.lines || []).slice(0, args.lines).map(l => ({ l, n: numbered(Chess, args.fen, l.pv) }));
    verifier.seed(args.fen, a);
    const checked = [];
    for (const { l, n } of lines) {
      const motifChecks = await verifier.check(playLine(Chess, args.fen, n.sans));
      checked.push({ eval: fmt(l.score), moves: n.text, motifs: motifSummary(motifChecks), motifChecks });
    }
    const gap = lines.length > 1 ? moverCp(lines[0].l.score, side) - moverCp(lines[1].l.score, side) : 0;
    return {
      result: { fen: args.fen, depth: a?.depth ?? 0, sideToMove: side === 'w' ? 'White' : 'Black', onlyMove: gap >= 150 && moverCp(lines[0].l.score, side) >= -50,
        lines: checked },
      lines: lines.map(({ n }) => n.sans),
    };
  }
  if (name === 'try_move') {
    const after = playLine(Chess, args.fen, [args.move]).fens[1];
    const [best, reply] = await Promise.all([engine(args.fen, { depth: DEFAULT_DEPTH, lines: 1 }), engine(after, { depth: DEFAULT_DEPTH, lines: 1 })]);
    const b = best?.lines[0], r = reply?.lines[0];
    const bestLine = b ? numbered(Chess, args.fen, b.pv, 6) : null, refute = r ? numbered(Chess, after, r.pv, 6) : null;
    verifier.seed(after, reply);
    const replyChecks = refute ? await verifier.check(playLine(Chess, after, refute.sans)) : [];
    const loss = b && r ? moverCp(b.score, side) - moverCp(r.score, side) : null;
    return {
      result: { move: args.move, evalAfter: r ? fmt(r.score) : '?', best: bestLine?.sans[0] ?? null, bestEval: b ? fmt(b.score) : '?', lossInPawns: loss === null ? null : Math.max(0, loss) / 100,
        verdict: loss === null ? 'unknown' : loss <= 30 ? 'about as good as the best move' : loss <= 100 ? 'playable but worse' : 'a mistake: it loses material or position',
        bestLine: bestLine?.text ?? '', reply: refute?.text ?? '', replyMotifs: motifSummary(replyChecks), motifChecks: replyChecks },
      lines: [[args.move, ...(refute?.sans || [])], bestLine?.sans || []],
    };
  }
  if (name === 'threats') {
    const flipped = flipSide(Chess, args.fen);
    if (!flipped) return { result: { threat: null, why: 'no threat can be read from this position' }, lines: [] };
    const a = await engine(flipped, { depth: DEFAULT_DEPTH, lines: 1 });
    const l = a?.lines[0], n = l ? numbered(Chess, flipped, l.pv, 6) : null;
    verifier.seed(flipped, a);
    const checks = n ? await verifier.check(playLine(Chess, flipped, n.sans)) : [];
    return {
      result: { side: side === 'w' ? 'Black' : 'White', threat: n?.sans[0] ?? null, line: n?.text ?? '', evalIfAllowed: l ? fmt(l.score) : '?', motifs: motifSummary(checks), motifChecks: checks },
      lines: n ? [n.sans] : [],
    };
  }
  if (name === 'compare') {
    const rows = await Promise.all(args.moves.map(async san => {
      const after = playLine(Chess, args.fen, [san]).fens[1];
      const a = await engine(after, { depth: DEFAULT_DEPTH - 2, lines: 1 });
      const l = a?.lines[0], n = l ? numbered(Chess, after, l.pv, 5) : null;
      return { san, score: l?.score, eval: l ? fmt(l.score) : '?', line: n?.sans || [], reply: n?.text ?? '' };
    }));
    rows.sort((x, y) => (y.score ? moverCp(y.score, side) : -1e9) - (x.score ? moverCp(x.score, side) : -1e9));
    return { result: { moves: rows.map(({ san, eval: e, reply }) => ({ move: san, eval: e, reply })) }, lines: rows.map(r => [r.san, ...r.line]) };
  }
  if (name === 'find_mate') {
    const a = await engine(args.fen, { depth: Math.min(CAPS.depth, 2 * args.n + 6), lines: 1 });
    const l = a?.lines[0], mate = l?.score?.mate, mine = mate !== undefined && (mate > 0) === (side === 'w');
    const found = mine && Math.abs(mate) <= args.n;
    const n = found ? numbered(Chess, args.fen, l.pv, 2 * args.n) : null;
    return { result: { mate: found ? Math.abs(mate) : null, line: n?.text ?? '', note: found ? '' : `no forced mate in ${args.n} found at this depth` }, lines: n ? [n.sans] : [] };
  }
  // find_motifs
  const line = playLine(Chess, args.fen, args.line);
  return {
    result: { line: await verifier.check(line), note: 'Only confirmed motifs are returned. Refuted or unverified moves are not evidence; continuations come from Stockfish.' },
    lines: verifier.evidence,
    starts: verifier.starts,
  };
}
