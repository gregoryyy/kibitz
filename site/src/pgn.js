// PGN annotation glyphs (NAGs). chess.js parses NAGs but doesn't expose them, so mainlineNags()
// reads them from the movetext itself.

// Display glyphs for the common NAGs (PGN standard, section 10).
export const NAG_GLYPHS = {
  1: '!', 2: '?', 3: '!!', 4: '??', 5: '!?', 6: '?!', 7: '□', 10: '=', 13: '∞', 14: '⩲', 15: '⩱', 16: '±', 17: '∓',
  18: '+−', 19: '−+', 22: '⨀', 23: '⨀', 32: '⟳', 33: '⟳', 36: '→', 37: '→', 40: '↑', 41: '↑', 132: '⇆', 133: '⇆', 138: '⊕', 139: '⊕', 146: 'N',
};
// Move suffixes in import format ("e4!?") and the NAGs they stand for.
const SUFFIX_NAG = { '!': 1, '?': 2, '!!': 3, '??': 4, '!?': 5, '?!': 6 };
// The engine's move classes as NAGs, for export.
export const CLASS_NAG = { inaccuracy: 6, mistake: 2, blunder: 4 };
// NAGs 1-6 judge the move itself; a move gets at most one of them.
export const isMoveNag = n => n >= 1 && n <= 6;
// The move class a move-judging NAG corresponds to, for colouring.
export const NAG_CLASS = { 1: 'good', 2: 'mistake', 3: 'best', 4: 'blunder', 5: 'good', 6: 'inaccuracy' };

const RESULTS = new Set(['1-0', '0-1', '1/2-1/2', '*']);

// NAGs per mainline ply: out[k] lists the NAG numbers after the k-th half-move (out[0] is unused).
// Variations, comments, escaped lines and headers are skipped; only numbers 1-255 are kept.
export function mainlineNags(pgn) {
  const text = String(pgn ?? '').replace(/\r/g, '').split('\n').filter(l => !l.startsWith('%') && !/^\s*\[.*\]\s*$/.test(l)).join('\n');
  const out = [[]];
  let depth = 0, tok = '';
  const flush = () => {
    let t = tok; tok = '';
    if (!t || depth > 0) return;
    t = t.replace(/^\d+\.+/, ''); // move number, possibly glued to the move ("12.e4")
    if (!t || /^\d+$/.test(t)) return;
    if (RESULTS.has(t)) return;
    const nag = /^\$(\d{1,3})$/.exec(t);
    if (nag) { const n = +nag[1]; if (n >= 1 && n <= 255 && out.length > 1) out[out.length - 1].push(n); return; }
    const m = /^(.*?)(!!|\?\?|!\?|\?!|!|\?)?$/.exec(t);
    out.push(m[2] ? [SUFFIX_NAG[m[2]]] : []);
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') { flush(); const end = text.indexOf('}', i); i = end < 0 ? text.length : end; continue; }
    if (ch === ';') { flush(); const end = text.indexOf('\n', i); i = end < 0 ? text.length : end; continue; }
    if (ch === '(') { flush(); depth++; continue; }
    if (ch === ')') { flush(); depth = Math.max(0, depth - 1); continue; }
    if (ch === '$' && tok) flush(); // "e4$1"
    if (/\s/.test(ch)) flush(); else tok += ch;
  }
  flush();
  return out;
}

// NAGs as one display string ("!?", "?? ±").
export const nagText = nags => (nags || []).map(n => NAG_GLYPHS[n] || `$${n}`).join(' ');

/**
 * Locate mainline comments in the ORIGINAL PGN, including comments before the first move.
 * Offsets are UTF-16 string indices, with an exclusive end; braces/semicolon are excluded.
 * Unlike chess.js's position-keyed comments, repeated positions keep distinct annotations.
 * Headers, escaped lines and RAV comments never become mainline passages. The caller must
 * first validate the complete PGN and check plies against its legal mainline.
 * @param {string} pgn Original, unnormalised source text.
 * @returns {{ply: number, text: string, start: number, end: number}[]} Source passages.
 */
export function mainlineComments(pgn) {
  const out = []; let ply = 0, depth = 0, i = 0;
  const comment = (start, end) => { const text = pgn.slice(start, end); if (!depth && text.trim()) out.push({ ply, text, start, end }); };
  while (i < pgn.length) {
    const ch = pgn[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '%' && (i === 0 || pgn[i - 1] === '\n' || pgn[i - 1] === '\r')) { const end = pgn.indexOf('\n', i); i = end < 0 ? pgn.length : end + 1; continue; }
    if (ch === '[') {
      let quoted = false; i++;
      while (i < pgn.length) {
        const c = pgn[i++];
        if (c === '\\' && quoted) { i++; continue; }
        if (c === '"') quoted = !quoted;
        if (c === ']' && !quoted) break;
      }
      continue;
    }
    if (ch === '{') { const end = pgn.indexOf('}', i + 1); if (end < 0) break; comment(i + 1, end); i = end + 1; continue; }
    if (ch === ';') { let end = pgn.indexOf('\n', i + 1); if (end < 0) end = pgn.length; comment(i + 1, end); i = end; continue; }
    if (ch === '(') { depth++; i++; continue; }
    if (ch === ')') { depth--; i++; continue; }
    if (ch === '$') { i++; while (/\d/.test(pgn[i] || 'x')) i++; continue; }
    const start = i;
    while (i < pgn.length && !/[\s{};()$[\]]/.test(pgn[i])) i++;
    if (i === start) { i++; continue; }
    const token = pgn.slice(start, i).replace(/^\d+\.+/, '');
    if (!depth && token && !RESULTS.has(token) && !/^(?:\.+|\d+|[!?]+)$/.test(token)) ply++;
  }
  return out;
}
