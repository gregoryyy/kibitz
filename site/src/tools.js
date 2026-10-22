// Engine tools for the coach (TODO 4.11): the model asks, Stockfish and the motif detectors answer.
// Pure: the definitions the gateway hands to the provider, the checks on every argument (they come
// from the model, so they are untrusted), and the code that runs a tool against an engine passed in
// as a function. The page runs the loop and the engine (TODO 4.11.4); tests pass a fake engine.
//
// engine(fen, {depth, lines}) -> Promise<{depth, lines: [{score: {cp} | {mate}, pv: [uci]}]}>, scores
// from White's point of view, as the page keeps them.

import { moveMotifs, scoreToCp } from './knowledge.js';
import { playLine } from './annotations.js';
import { flipSide } from './modes.js';
import { CHAT_TOOLS } from './chat.js';
import { checkPosition } from './play.js';

export const CAPS = { depth: 18, lines: 5, compare: 5, mate: 7, lineMoves: 12, rounds: 4, calls: 6 };
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
    description: 'The tactical motifs (forks, pins, sacrifices, mates, ...) of each move of a line, from the motif detectors.',
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
// Motifs along a line (TODO 4.11.2): the detectors run on every move. In the engine's own lines a
// motif is backed by the line's evaluation; elsewhere it's reported only for moves of a line that
// doesn't lose (for the side making it) by more than half a pawn against the best.
function motifsAlong(Chess, line, upTo = 6) {
  const out = [];
  for (let k = 0; k < Math.min(upTo, line.sans.length); k++) {
    for (const m of moveMotifs(Chess, line.fens[k], line.ucis[k])) out.push(`${m.why}`);
  }
  return [...new Set(out)].slice(0, 6);
}
const moverCp = (score, side) => { const cp = scoreToCp(score); return side === 'w' ? cp : -cp; };

// Runs a checked tool call: {result} (JSON for the model) plus `lines`: the SAN sequences it showed,
// so the answer check (tutor.js checkAnswer) can back the moves the coach quotes from it.
export async function runTool(Chess, engine, { name, args }) {
  const side = args.fen.split(' ')[1];
  if (name === 'analyse') {
    const a = await engine(args.fen, { depth: args.depth, lines: args.lines });
    const lines = (a?.lines || []).slice(0, args.lines).map(l => ({ l, n: numbered(Chess, args.fen, l.pv) }));
    const gap = lines.length > 1 ? moverCp(lines[0].l.score, side) - moverCp(lines[1].l.score, side) : 0;
    return {
      result: { fen: args.fen, depth: a?.depth ?? 0, sideToMove: side === 'w' ? 'White' : 'Black', onlyMove: gap >= 150,
        lines: lines.map(({ l, n }) => ({ eval: fmt(l.score), moves: n.text, motifs: motifsAlong(Chess, n) })) },
      lines: lines.map(({ n }) => n.sans),
    };
  }
  if (name === 'try_move') {
    const after = playLine(Chess, args.fen, [args.move]).fens[1];
    const [best, reply] = await Promise.all([engine(args.fen, { depth: DEFAULT_DEPTH, lines: 1 }), engine(after, { depth: DEFAULT_DEPTH, lines: 1 })]);
    const b = best?.lines[0], r = reply?.lines[0];
    const bestLine = b ? numbered(Chess, args.fen, b.pv, 6) : null, refute = r ? numbered(Chess, after, r.pv, 6) : null;
    const loss = b && r ? moverCp(b.score, side) - moverCp(r.score, side) : null;
    return {
      result: { move: args.move, evalAfter: r ? fmt(r.score) : '?', best: bestLine?.sans[0] ?? null, bestEval: b ? fmt(b.score) : '?', lossInPawns: loss === null ? null : Math.max(0, loss) / 100,
        verdict: loss === null ? 'unknown' : loss <= 30 ? 'about as good as the best move' : loss <= 100 ? 'playable but worse' : 'a mistake: it loses material or position',
        bestLine: bestLine?.text ?? '', reply: refute?.text ?? '', replyMotifs: refute ? motifsAlong(Chess, refute, 2) : [] },
      lines: [[args.move, ...(refute?.sans || [])], bestLine?.sans || []],
    };
  }
  if (name === 'threats') {
    const flipped = flipSide(Chess, args.fen);
    if (!flipped) return { result: { threat: null, why: 'no threat can be read from this position' }, lines: [] };
    const a = await engine(flipped, { depth: DEFAULT_DEPTH, lines: 1 });
    const l = a?.lines[0], n = l ? numbered(Chess, flipped, l.pv, 6) : null;
    return {
      result: { side: side === 'w' ? 'Black' : 'White', threat: n?.sans[0] ?? null, line: n?.text ?? '', evalIfAllowed: l ? fmt(l.score) : '?', motifs: n ? motifsAlong(Chess, n, 3) : [] },
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
    result: { line: line.sans.map((san, k) => ({ move: san, motifs: moveMotifs(Chess, line.fens[k], line.ucis[k]).map(m => m.why) })) },
    lines: [line.sans],
  };
}
