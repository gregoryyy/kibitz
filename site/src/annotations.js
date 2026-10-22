// Board annotations (TODO 4.2, 4.4): what the coach points at, as data that is checked against the
// position before anything is drawn. Pure, like knowledge.js: the page turns checked annotations
// into chessground shapes (index.html), and tests run it in Node.
//
// An annotation is one of:
//   {kind: 'arrow',  from, to, brush}   a move for the side to move, or a threat (brush 'threat'):
//                                       a move for the other side
//   {kind: 'square', sq, brush}         a square to look at
//   {kind: 'ghost',  sq, piece}         where a piece would stand: piece 'wN', 'bQ', ...
//   {kind: 'label',  sq, text}          up to two characters on a square ("!", "1", "?")
//   {kind: 'line',   start, sans, ucis} moves played one after the other from the FEN `start`
// Sources: lines and claims derived from an answer's checked text (fromAnswer), and an optional
// ```board block at the end of an answer, one instruction per line (parseBoardBlock).

import { flipSide } from './modes.js';

export const KINDS = ['arrow', 'square', 'ghost', 'label', 'line'];
export const MAX_MARKS = 8; // a block with more is cut: an answer points at a few things, not at everything
const SQ = /^[a-h][1-8]$/;
const PIECE = /^[wb][KQRBNP]$/;
const LABEL = /^[A-Za-z0-9!?+#=]{1,2}$/;

const movesOf = (Chess, fen) => { try { return new Chess(fen).moves({ verbose: true }); } catch { return []; } };

// One annotation checked against the position `fen`: {ok: true, a} with the annotation as it will be
// drawn, or {ok: false, why}. Nothing about it is trusted: kinds, squares, pieces and moves are checked.
export function checkAnnotation(Chess, fen, a) {
  if (!a || typeof a !== 'object' || !KINDS.includes(a.kind)) return { ok: false, why: 'unknown kind' };
  if (a.kind === 'arrow') {
    if (!SQ.test(a.from) || !SQ.test(a.to)) return { ok: false, why: 'not a square' };
    const threat = a.brush === 'threat';
    // A threat is a move the other side would make if it were their turn (not while in check).
    let pos = fen; if (threat) { try { pos = flipSide(Chess, fen); } catch { pos = null; } }
    const mv = pos && movesOf(Chess, pos).find(m => m.from === a.from && m.to === a.to);
    if (!mv) return { ok: false, why: threat ? 'not a move the other side could make' : 'not a legal move here' };
    return { ok: true, a: { kind: 'arrow', from: a.from, to: a.to, brush: threat ? 'threat' : 'san', san: mv.san } };
  }
  if (a.kind === 'square') {
    if (!SQ.test(a.sq)) return { ok: false, why: 'not a square' };
    return { ok: true, a: { kind: 'square', sq: a.sq, brush: a.brush === 'threat' ? 'threat' : 'san' } };
  }
  if (a.kind === 'ghost') {
    if (!SQ.test(a.sq) || !PIECE.test(a.piece)) return { ok: false, why: 'not a square or a piece' };
    let c; try { c = new Chess(fen); } catch { return { ok: false, why: 'bad position' }; }
    const color = a.piece[0], type = a.piece[1].toLowerCase();
    // The side must have such a piece, and the square must not hold one of its own pieces.
    if (!c.board().flat().some(p => p && p.color === color && p.type === type)) return { ok: false, why: 'no such piece on the board' };
    if (c.get(a.sq)?.color === color) return { ok: false, why: 'the square is taken by the same side' };
    return { ok: true, a: { kind: 'ghost', sq: a.sq, piece: a.piece } };
  }
  if (a.kind === 'label') {
    if (!SQ.test(a.sq) || !LABEL.test(String(a.text ?? ''))) return { ok: false, why: 'not a square or a short label' };
    return { ok: true, a: { kind: 'label', sq: a.sq, text: a.text } };
  }
  // line: every move legal in turn from `start`
  const line = playLine(Chess, a.start || fen, a.sans || a.ucis || []);
  if (!line || !line.ucis.length) return { ok: false, why: 'not a legal line here' };
  return { ok: true, a: { kind: 'line', ...line } };
}

// Moves (SAN, or UCI like e2e4 / e7e8q) played in turn from `start`: {start, sans, ucis, fens}, or
// null if one of them isn't legal. fens[k] is the position after k moves.
export function playLine(Chess, start, moves) {
  let c; try { c = new Chess(start); } catch { return null; }
  const out = { start: c.fen(), sans: [], ucis: [], fens: [c.fen()] };
  for (const m of moves.slice(0, 40)) {
    let mv;
    const u = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(String(m));
    try { mv = u ? c.move({ from: u[1], to: u[2], promotion: u[3] }) : c.move(String(m)); } catch { mv = null; }
    if (!mv) return null;
    out.sans.push(mv.san); out.ucis.push(mv.from + mv.to + (mv.promotion || '')); out.fens.push(c.fen());
  }
  return out;
}

// The ```board block at the end of an answer, if any: the answer's text without it, the instructions
// read from it (one per line), and how many lines were left out. Only these forms are read:
//   arrow e2 e4 · threat d8 h4 · square f7 · ghost wN d5 · label d5 !
// While an answer streams, an unfinished block is hidden too.
export function parseBoardBlock(text) {
  const s = String(text ?? '');
  const at = s.search(/```board\b/i);
  if (at < 0) return { text: s, marks: [], skipped: 0 };
  const rest = s.slice(at).replace(/^```board[^\n]*\n?/i, '');
  const end = rest.indexOf('```');
  const body = end < 0 ? rest : rest.slice(0, end);
  const after = end < 0 ? '' : rest.slice(end + 3);
  const marks = []; let skipped = 0;
  for (const raw of body.split('\n')) {
    const l = raw.trim().replace(/^[-*]\s*/, '');
    if (!l) continue;
    const w = l.split(/\s+/);
    const k = w[0].toLowerCase();
    let a = null;
    if (k === 'arrow' && w.length === 3) a = { kind: 'arrow', from: w[1], to: w[2] };
    else if (k === 'threat' && w.length === 3) a = { kind: 'arrow', from: w[1], to: w[2], brush: 'threat' };
    else if (k === 'square' && w.length === 2) a = { kind: 'square', sq: w[1] };
    else if (k === 'ghost' && w.length === 3) a = { kind: 'ghost', piece: w[1], sq: w[2] };
    else if (k === 'label' && w.length === 3) a = { kind: 'label', sq: w[1], text: w[2] };
    if (a && marks.length < MAX_MARKS) marks.push(a); else skipped++;
  }
  return { text: (s.slice(0, at) + after).replace(/\s+$/, ''), marks, skipped };
}

// The checked marks of a block for the position: {shown, dropped}, each dropped one with why.
export function checkMarks(Chess, fen, marks) {
  const shown = [], dropped = [];
  for (const m of marks) { const r = checkAnnotation(Chess, fen, m); if (r.ok) shown.push(r.a); else dropped.push({ mark: m, why: r.why }); }
  return { shown, dropped };
}

// The lines in an answer, from checkAnswer's moves (tutor.js): a run of moves separated only by spaces
// and move numbers, up to the first wrong one, that plays legally from where the answer's previous line
// ended, or else from the position or the one before.
// Returns the moves with {line, ply} added where they belong to a line (ply: moves played after this
// one, from the line's start), and the lines themselves ({start, sans, ucis, fens}). A single move
// is a line of one, so hovering it can show it from the right position.
export function linesInAnswer(Chess, text, moves, { fen, prevFen = null }) {
  const t = String(text ?? '');
  const out = moves.map(m => ({ ...m }));
  const real = out.map((m, k) => k).filter(k => out[k].status !== 'square');
  const GAP = /^\s+(?:\d+\s*(?:\.{1,3}|…)\s*)?$/;
  const lines = [];
  for (let s = 0; s < real.length;) {
    let e = s;
    while (e + 1 < real.length && GAP.test(t.slice(out[real[e]].index + out[real[e]].san.length, out[real[e + 1]].index))) e++;
    // The checked moves of a run up to the first wrong one ("10. Nxb5 cxb5 11. Bxb5+ Nbd7??" keeps three).
    const run = real.slice(s, e + 1), bad = run.findIndex(k => out[k].status === 'invalid');
    const group = bad < 0 ? run : run.slice(0, bad);
    if (group.length) {
      const sans = group.map(k => out[k].san);
      // Prose continues lines ("3... g6, and if 4. Qf3 then Nf6"): try the end of the line before first.
      const from = [lines.at(-1)?.fens.at(-1), fen, prevFen].filter(Boolean);
      const line = from.map(f => playLine(Chess, f, sans)).find(Boolean);
      if (line) {
        const id = lines.push(line) - 1;
        group.forEach((k, ply) => { out[k].line = id; out[k].ply = ply; });
      }
    }
    s = e + 1;
  }
  return { moves: out, lines };
}
