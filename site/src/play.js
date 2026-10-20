// Playing against Stockfish: game-end rules, clocks, the opponent's search settings, the
// weakened mode below Stockfish's lowest Elo, and draw offers. Pure functions (chess.js is
// passed in, randomness can be injected) so they run in the page, in Node tests and in the
// calibration script.

// The game's result if it has ended by the rules, else null. Threefold repetition and the
// fifty-move rule end the game automatically (no claim needed).
export function gameEnd(chess) {
  if (chess.isCheckmate()) return { result: chess.turn() === 'w' ? '0-1' : '1-0', reason: 'checkmate' };
  if (chess.isStalemate()) return { result: '1/2-1/2', reason: 'stalemate' };
  if (chess.isThreefoldRepetition()) return { result: '1/2-1/2', reason: 'threefold repetition' };
  if (chess.isInsufficientMaterial()) return { result: '1/2-1/2', reason: 'insufficient material' };
  if (chess.isDrawByFiftyMoves()) return { result: '1/2-1/2', reason: 'fifty-move rule' };
  return null;
}

// Whether `color` can't mate with its material whatever the other side does. A simplification
// of the FIDE rule (which asks whether any legal sequence mates): a lone king, or king and one
// minor piece against a lone king.
export function cannotMate(chess, color) {
  const pieces = chess.board().flat().filter(Boolean);
  const mine = pieces.filter(p => p.color === color && p.type !== 'k');
  const theirs = pieces.filter(p => p.color !== color && p.type !== 'k');
  if (!mine.length) return true;
  return mine.length === 1 && 'nb'.includes(mine[0].type) && !theirs.length;
}

// Result when `flagged` runs out of time: a loss, or a draw if the opponent couldn't mate anyway.
export function timeoutEnd(chess, flagged) {
  const other = flagged === 'w' ? 'b' : 'w';
  if (cannotMate(chess, other)) return { result: '1/2-1/2', reason: 'timeout vs insufficient material' };
  return { result: flagged === 'w' ? '0-1' : '1-0', reason: 'timeout' };
}

// ---------------------------------------------------------------- Clocks
// Base time and Fischer increment, in milliseconds.
export const TIME_CONTROLS = [
  { id: 'none', label: 'No clock' },
  { id: '3+2', label: '3+2', base: 180_000, inc: 2_000 },
  { id: '5+3', label: '5+3', base: 300_000, inc: 3_000 },
  { id: '10+5', label: '10+5', base: 600_000, inc: 5_000 },
  { id: '15+10', label: '15+10', base: 900_000, inc: 10_000 },
  { id: '30+20', label: '30+20', base: 1_800_000, inc: 20_000 },
];
export const timeControlOf = id => TIME_CONTROLS.find(t => t.id === id) || TIME_CONTROLS[0];
// PGN TimeControl tag: seconds, plus increment ("300+3"); "-" when untimed.
export const pgnTimeControl = tc => tc?.base ? `${tc.base / 1000}+${tc.inc / 1000}` : '-';

// A clock is a plain object: remaining time per side, whose clock runs (`turn`, or null when
// stopped) and since when. Every function returns a new clock.
export function newClock(tc) { return { base: tc.base, inc: tc.inc, w: tc.base, b: tc.base, turn: null, since: null }; }
export function timeLeft(clock, color, now) {
  return clock[color] - (clock.turn === color && clock.since !== null ? now - clock.since : 0);
}
// Starts `color`'s clock (the first timed move), or switches it from the side that just moved,
// which gets its increment.
export function pressClock(clock, now, next) {
  const c = { ...clock };
  if (c.turn) { c[c.turn] = timeLeft(clock, c.turn, now) + c.inc; }
  c.turn = next; c.since = now;
  return c;
}
export function stopClock(clock, now) {
  if (!clock.turn) return clock;
  return { ...clock, [clock.turn]: timeLeft(clock, clock.turn, now), turn: null, since: null };
}
// "4:05", "1:02:03", and tenths under ten seconds ("7.3").
export function fmtClock(ms) {
  ms = Math.max(0, ms);
  if (ms < 10_000) return (Math.floor(ms / 100) / 10).toFixed(1);
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
// Thinking time for Stockfish's move with `left` ms and `inc` ms increment: a slice of the
// remaining time, never more than the untimed setting.
export function moveBudget(untimedMs, left, inc) {
  return Math.round(Math.max(50, Math.min(untimedMs, left / 30 + inc * 0.75)));
}

// ---------------------------------------------------------------- Opponent strength
// Stockfish's UCI_Elo starts at 1320; below that the app weakens it itself.
export const MIN_UCI_ELO = 1320;

// The weakened mode's knobs for an Elo below 1320: search depth, the chance of playing the
// engine's best move, and the chance of a random legal move instead of another candidate.
// Depth steps at each row; the chances are interpolated. scripts/calibrate.mjs measures the result.
export const WEAK_TABLE = [
  { elo: 600, depth: 1, keep: 0.30, random: 0.28 },
  { elo: 900, depth: 3, keep: 0.53, random: 0.16 },
  { elo: 1100, depth: 5, keep: 0.68, random: 0.08 },
  { elo: 1320, depth: 5, keep: 0.85, random: 0 },
];
export function weakParams(elo) {
  const t = WEAK_TABLE;
  if (elo <= t[0].elo) return { ...t[0] };
  for (let k = 1; k < t.length; k++) {
    if (elo < t[k].elo) {
      const a = t[k - 1], b = t[k], f = (elo - a.elo) / (b.elo - a.elo);
      return { elo, depth: a.depth, keep: a.keep + f * (b.keep - a.keep), random: a.random + f * (b.random - a.random) };
    }
  }
  return { ...t[t.length - 1] };
}

// The opponent's search for one move: UCI options and limits. `style` needs candidate lines
// (MultiPV 4); `clock` = {left, inc} shortens the think time in a timed game.
export function opponentSearch(elo, style, clock = null) {
  if (elo >= MIN_UCI_ELO) {
    const untimed = 300 + Math.min(900, elo / 3);
    return {
      movetime: clock ? moveBudget(untimed, clock.left, clock.inc) : untimed,
      multipv: style?.weight ? 4 : 1,
      setup: ['setoption name Skill Level value 20', 'setoption name UCI_LimitStrength value true', `setoption name UCI_Elo value ${elo}`],
    };
  }
  return { depth: weakParams(elo).depth, multipv: 4, setup: ['setoption name UCI_LimitStrength value false', 'setoption name Skill Level value 0'] };
}

// The weakened mode's move (below 1320): usually the best line, sometimes another candidate,
// sometimes any legal move. `res` is the engine's result ({best, lines}).
export function pickWeak(Chess, fen, res, elo, rand = Math.random) {
  const lines = (res.lines || []).filter(l => l?.pv?.length);
  if (!lines.length) return res.best;
  const p = weakParams(elo);
  if (rand() < p.keep) return lines[0].pv[0];
  if (rand() < p.random) {
    const all = new Chess(fen).moves({ verbose: true });
    const m = all[Math.floor(rand() * all.length)];
    return m.from + m.to + (m.promotion || '');
  }
  const pool = lines.slice(1);
  return (pool[Math.floor(rand() * pool.length)] || lines[0]).pv[0];
}

// ---------------------------------------------------------------- Draw offers
// Whether Stockfish accepts the player's draw offer. `cp` is the evaluation from Stockfish's
// side (centipawns, + = good for Stockfish), `ply` the number of moves played so far.
// It accepts when it is clearly worse, or when a long game has reached a dead-equal position.
export const DRAW_RULES = { worseCp: -100, equalCp: 30, equalAfterPly: 60, offerEvery: 10 };
export function acceptsDraw(cp, ply) {
  if (cp === null || cp === undefined) return false;
  if (cp <= DRAW_RULES.worseCp) return true;
  return ply >= DRAW_RULES.equalAfterPly && Math.abs(cp) <= DRAW_RULES.equalCp;
}

// ---------------------------------------------------------------- Start positions
// Drops castling rights whose king or rook isn't on its home square. chess.js keeps them and
// would then allow castling without a rook (e.g. "4k3/8/8/8/8/8/8/4K2R w KQkq - 0 1": O-O-O).
export function fixCastling(fen) {
  const f = String(fen).trim().split(/\s+/);
  if (f.length < 2) return fen;
  const rows = f[0].split('/').map(r => r.replace(/\d/g, d => '.'.repeat(+d)));
  const at = sq => rows[8 - +sq[1]]?.['abcdefgh'.indexOf(sq[0])];
  const need = { K: ['e1', 'K', 'h1', 'R'], Q: ['e1', 'K', 'a1', 'R'], k: ['e8', 'k', 'h8', 'r'], q: ['e8', 'k', 'a8', 'r'] };
  const rights = [...(f[2] || '-')].filter(r => need[r] && at(need[r][0]) === need[r][1] && at(need[r][2]) === need[r][3]).join('');
  f[2] = rights || '-';
  return f.join(' ');
}

// Checks a FEN to start a game from: valid for chess.js, the side not to move not in check, and
// the game not already over. Returns {fen} (normalised) or {error}.
export function checkStart(Chess, fen) {
  let c;
  try { c = new Chess(fixCastling(String(fen ?? '').trim())); } catch { return { error: 'That isn\'t a valid FEN.' }; }
  const f = c.fen().split(' ');
  if (c.board().flat().filter(p => p?.type === 'k').length !== 2) return { error: 'Each side needs exactly one king.' };
  if (c.board().flat().some((p, i) => p?.type === 'p' && (i < 8 || i >= 56))) return { error: 'Pawns can\'t stand on the first or last rank.' };
  try {
    if (new Chess([f[0], f[1] === 'w' ? 'b' : 'w', '-', '-', '0', '1'].join(' ')).inCheck()) return { error: 'The side that isn\'t to move is in check.' };
  } catch { return { error: 'That isn\'t a valid FEN.' }; }
  if (gameEnd(c)) return { error: 'The game is already over in that position.' };
  return { fen: c.fen() };
}
