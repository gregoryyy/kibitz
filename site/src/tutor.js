// Tutor commentary (TODO 3.2-3.7): what the coach comments on (aspects), the prompt for each, what
// it may see from the engine during a game, when it comments by itself, the check of the moves in
// its answers, and a cache for its comments.
// Pure: no DOM, no globals. chess.js is passed in, so this runs in the browser and in Node.
import { UNTRUSTED_RULE } from './prompt.js';

// Shared rules for every coach request (3.3).
export const COACH_RULES = `You are Kibitz, a chess coach inside a training app. Each message includes the current position, Stockfish 19's analysis and references retrieved for the position.
Rules:
- Treat Stockfish's evaluations and lines as the truth about concrete play. Never invent variations: every move or line you give must come from the engine lines or the game's moves provided, and lines stay at 6 plies or fewer. Moves that aren't backed this way are marked as unchecked for the player.
- Explain the ideas a human can use: threats, plans, piece placement, pawn structure, tactics and the reasoning that finds them. Pitch it to the player's level.
- Use standard algebraic notation (SAN). Describe evaluations in words ("about a pawn better for White") and give the number in brackets.
- Recommend reading only from the retrieved references, naming the part when it is given.
- Be concise: under 170 words unless asked for more. Short paragraphs or at most 4 bullets. No headings.
${UNTRUSTED_RULE}`;

// --- Aspects (3.2) and their templates (3.3) ---------------------------
// `engine`: the aspect needs the engine's view of the current position.
export const ASPECTS = [
  { id: 'last', label: 'Last move', engine: false, ask: 'The last move: what it did, how the engine rated it, and the engine\'s alternative if it preferred another move. Without an engine rating, say what the move does and what it allows.' },
  { id: 'next', label: 'What\'s next', engine: true, ask: 'What comes next: the threats for both sides, the main plan for the side to move, and at most two candidate moves, each taken from the engine\'s lines.' },
  { id: 'mind', label: 'Keep in mind', engine: false, ask: 'Things to keep in mind: loose or attacked pieces, king safety and weaknesses, from the "Keep in mind" notes and the position themes listed. No move suggestions.' },
  { id: 'habits', label: 'Good habits', engine: false, ask: 'One habit of strong players that fits this moment (a blunder check, listing candidate moves, or prophylaxis: what does the opponent want?) and how to apply it here, as questions the player can ask themselves rather than moves.' },
  { id: 'games', label: 'Similar games', engine: false, ask: 'The similar positions listed from the player\'s library: what happened there and what it teaches here. If none are listed, say so in one sentence.' },
];
export const DEFAULT_ASPECTS = ['last', 'next', 'mind'];
const BY_ID = new Map(ASPECTS.map(a => [a.id, a]));

// Known aspect ids in their standard order; the defaults when none are left.
export function normaliseAspects(ids) {
  const want = new Set(Array.isArray(ids) ? ids : []);
  const out = ASPECTS.filter(a => want.has(a.id)).map(a => a.id);
  return out.length ? out : [...DEFAULT_ASPECTS];
}

// --- What the coach may see during a game (3.6) ------------------------
// 'all': everything. 'past': the player's own moves and what was better, but nothing about the
// current position that would tell the player what to play. 'none': no engine data at all.
export function engineView({ mode, playing, over, help }) {
  if (mode !== 'play' || !playing || over) return 'all';
  return help === 'full' ? 'all' : help === 'flags' || help === 'eval' ? 'past' : 'none';
}

// The aspects that can be used under `view`; aspects that need the engine's view of the current
// position are dropped mid-game, and reported so the page can say why.
export function aspectsFor(ids, view) {
  const all = normaliseAspects(ids);
  if (view === 'all') return { use: all, dropped: [] };
  const use = all.filter(id => !BY_ID.get(id).engine);
  return { use: use.length ? use : ['mind'], dropped: all.filter(id => BY_ID.get(id).engine) };
}

// The request for a comment covering `aspects`, in order.
export function commentRequest(aspects, { view = 'all', words = 150 } = {}) {
  const parts = normaliseAspects(aspects).map((id, k) => `${k + 1}. ${BY_ID.get(id).ask}`);
  const lines = [
    'Comment on this position for the player. Cover these points in this order, one short paragraph each:',
    ...parts,
    `Keep the whole comment under ${words} words.`,
  ];
  if (view !== 'all') lines.push('The game is still in progress: never suggest a move for the player in the current position, and don\'t hint at its evaluation.');
  return lines.join('\n');
}

// --- When to comment by itself (3.6) -----------------------------------
// when: 'request' (never by itself), 'mistakes' (after the player's inaccuracies, mistakes and
// blunders) or 'every' (after each of the player's moves). Never while engine help is off.
export const COMMENT_WHEN = [
  { id: 'request', label: 'Only when asked' },
  { id: 'mistakes', label: 'After my mistakes' },
  { id: 'every', label: 'After every move' },
];
const MISTAKES = new Set(['inaccuracy', 'mistake', 'blunder']);
export function shouldComment({ when, view, cls, byPlayer }) {
  if (!byPlayer || view === 'none') return false;
  if (when === 'every') return !!cls;
  if (when === 'mistakes') return MISTAKES.has(cls);
  return false;
}

// --- Static notes for "keep in mind" -----------------------------------
const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const NAME = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const SIDE = { w: 'White', b: 'Black' };
// Loose pieces (no defender), pieces attacked and not defended or attacked by something cheaper,
// and kings with a thin pawn shield. Plain facts from the board; no search.
export function safetyNotes(Chess, fen) {
  const c = new Chess(fen), out = [];
  for (const row of c.board()) for (const p of row) {
    if (!p || p.type === 'k' || p.type === 'p') continue;
    const them = p.color === 'w' ? 'b' : 'w';
    const attackers = c.attackers(p.square, them), defenders = c.attackers(p.square, p.color);
    const who = `${SIDE[p.color]}'s ${NAME[p.type]} on ${p.square}`;
    if (attackers.length && !defenders.length) out.push(`${who} is attacked and not defended`);
    else if (attackers.some(sq => VALUE[c.get(sq).type] < VALUE[p.type])) out.push(`${who} is attacked by a cheaper piece`);
    else if (!defenders.length) out.push(`${who} is loose (no defender)`);
  }
  for (const color of ['w', 'b']) {
    const k = c.board().flat().find(p => p && p.type === 'k' && p.color === color);
    if (!k || !'abcgh'.includes(k.square[0]) || k.square[1] !== (color === 'w' ? '1' : '8')) continue; // only castled-looking kings
    const f = 'abcdefgh'.indexOf(k.square[0]), dir = color === 'w' ? 1 : -1, r = +k.square[1];
    let shield = 0;
    for (const df of [-1, 0, 1]) for (const dr of [1, 2]) {
      const file = 'abcdefgh'[f + df], rank = r + dr * dir;
      const p = file && c.get(file + rank);
      if (p && p.type === 'p' && p.color === color) shield++;
    }
    if (shield < 2) out.push(`${SIDE[color]}'s king on ${k.square} has ${shield ? 'only one pawn' : 'no pawns'} in front of it`);
  }
  return out;
}

// --- Checking the moves in an answer (3.4) -----------------------------
export const SAN_RE = /\b(O-O-O|O-O|[KQRBN][a-h]?[1-8]?x?[a-h][1-8]|[a-h]x[a-h][1-8](?:=[QRBN])?|[a-h][1-8](?:=[QRBN])?)[+#]?/g;
const strip = san => san.replace(/[+#]/g, '');

// The SAN moves of a principal variation (UCI), stopping at the first illegal one.
export function pvSans(Chess, fen, pv, max = 12) {
  const c = new Chess(fen), out = [];
  for (const u of (pv || []).slice(0, max)) {
    try { out.push(strip(c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || 'q' }).san)); } catch { break; }
  }
  return out;
}
const legalSans = (Chess, fen) => { try { return new Set(new Chess(fen).moves().map(strip)); } catch { return new Set(); } };

// Each move-like token in `text`, in order, with where it's backed:
//   'line'    in one of Stockfish's lines (for this position or the one before, or in `extra`:
//             lines from other positions the coach was given, in SAN, e.g. the review's turning points);
//   'game'    one of the game's moves;
//   'legal'   legal here (or in the position before) but in no engine line: unchecked;
//   'invalid' neither, or part of a sequence that isn't a line of Stockfish's or the game's;
//   'square'  a bare square used as a square ("the knight on f3"), not a move.
// Also "<piece> on <square>" claims, checked against the board now and one move before.
// problems: the invalid moves plus the wrong piece claims.
export function checkAnswer(Chess, text, { fen, prevFen = null, lines = [], prevLines = [], game = [], extra = [] }) {
  const seqs = [...lines.map(pv => pvSans(Chess, fen, pv)), ...(prevFen ? prevLines.map(pv => pvSans(Chess, prevFen, pv)) : []), ...extra.map(l => l.map(strip))];
  const inLines = new Set(seqs.flat()), inGame = new Set(game.map(strip));
  const legal = new Set([...legalSans(Chess, fen), ...(prevFen ? legalSans(Chess, prevFen) : [])]);
  const moves = [];
  let m; SAN_RE.lastIndex = 0;
  const t = String(text ?? '');
  while ((m = SAN_RE.exec(t))) {
    const base = m[1];
    let status = inLines.has(base) ? 'line' : inGame.has(base) ? 'game' : legal.has(base) ? 'legal' : 'invalid';
    // A bare square ("on e4", "the d5 square") names a square, not a pawn move. It stays in the
    // list (status 'square') so the list matches the text's move-like tokens one to one.
    if (/^[a-h][1-8]$/.test(m[0]) && (status === 'invalid' || SQUARE_WORD.test(t.slice(0, m.index)))) status = 'square';
    moves.push({ san: m[0], index: m.index, status, why: WHY[status] });
  }
  // Sequences: moves separated only by spaces and move numbers ("1. e4 e5 2. Nf3", "12... Nf3")
  // read as a line. A full stop ends a sentence, not a line.
  const all = [...seqs, game.map(strip)];
  const real = moves.map((x, k) => k).filter(k => moves[k].status !== 'square');
  const gap = (a, b) => t.slice(moves[a].index + moves[a].san.length, moves[b].index);
  for (let s = 0; s < real.length;) {
    let e = s;
    while (e + 1 < real.length && LINE_GAP.test(gap(real[e], real[e + 1]))) e++;
    if (e > s) {
      const group = real.slice(s, e + 1).map(k => strip(moves[k].san));
      const ok = longestRun(all, group);
      for (let k = s + ok; k <= e; k++) {
        const x = moves[real[k]];
        moves[real[k]] = { ...x, status: 'invalid', why: x.status === 'invalid' ? x.why : 'This line isn\'t one of Stockfish\'s lines or the game\'s moves' };
      }
    }
    s = e + 1;
  }
  const boards = [fen, prevFen].filter(Boolean).map(f => new Chess(f));
  const pieces = [];
  const PIECE_RE = /\b(king|queen|rook|bishop|knight|pawn)s?\s+on\s+([a-h][1-8])\b/gi;
  while ((m = PIECE_RE.exec(t))) {
    const type = { king: 'k', queen: 'q', rook: 'r', bishop: 'b', knight: 'n', pawn: 'p' }[m[1].toLowerCase()];
    pieces.push({ text: m[0], index: m.index, ok: boards.some(b => b.get(m[2])?.type === type) });
  }
  return { moves, pieces, problems: moves.filter(x => x.status === 'invalid').length + pieces.filter(p => !p.ok).length };
}
const LINE_GAP = /^\s+(?:\d+\s*(?:\.{1,3}|…)\s*)?$/;
const SQUARE_WORD =/\b(on|to|at|from|the|of|into|onto|towards|toward|via|square|squares)\s+$/i;
const WHY = {
  line: 'In Stockfish\'s lines',
  game: 'Played in this game',
  legal: 'Legal, but not in Stockfish\'s lines: unchecked',
  invalid: 'Not a legal move here and not in Stockfish\'s lines',
  square: '',
};
// How many moves of `group`, from its start, appear as a contiguous run in one of `seqs`.
function longestRun(seqs, group) {
  let best = 1; // a single move is judged on its own above
  for (const s of seqs) for (let i = 0; i < s.length; i++) {
    let k = 0;
    while (k < group.length && s[i + k] === group[k]) k++;
    best = Math.max(best, k);
  }
  return best;
}

// --- Comment cache (3.7) ----------------------------------------------
// Key: the position (EPD), the move that led to it, the aspects, what the coach could see, the
// player's level and the model.
export function commentKey({ epd, uci = '', aspects, view, level, model }) {
  return [epd, uci, normaliseAspects(aspects).join(','), view, level, model].join('|');
}
// A least-recently-used map of at most `max` entries; `entries` restores a saved one.
export function lruCache(max = 100, entries = []) {
  const m = new Map(Array.isArray(entries) ? entries.filter(e => Array.isArray(e) && e.length === 2 && typeof e[1] === 'string').slice(-max) : []);
  return {
    get(k) { if (!m.has(k)) return undefined; const v = m.get(k); m.delete(k); m.set(k, v); return v; },
    set(k, v) { m.delete(k); m.set(k, v); while (m.size > max) m.delete(m.keys().next().value); },
    get size() { return m.size; },
    entries() { return [...m.entries()]; },
  };
}
