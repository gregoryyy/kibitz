// Offline Syzygy evidence for fixed teaching positions. Never sends a player's FEN anywhere.
import { checkPosition } from '../chess/play.js';

/** @typedef {'white-win'|'black-win'|'draw'} TablebaseOutcome */
/** @typedef {{uci: string, category: string, dtz: number|null, dtm: number|null, checkmate: boolean, stalemate: boolean}} TablebaseMove */
/** @typedef {{category: string, dtz: number|null, dtm: number|null, checkmate: boolean, stalemate: boolean, moves: TablebaseMove[]}} TablebaseResult */
/** @typedef {{fen: string, url: string, retrievedAt: string, sha256: string, result: TablebaseResult}} TablebaseSnapshot */
/** @typedef {{outcome: TablebaseOutcome, checkedAt?: string, url?: string, plies?: number}} TablebaseEvidence */
const CATEGORIES = new Set(['win', 'loss', 'draw', 'cursed-win', 'blessed-loss', 'unknown', 'syzygy-win', 'syzygy-loss', 'maybe-win', 'maybe-loss']);
const require = (ok, reason) => { if (!ok) throw new Error(`Invalid tablebase evidence: ${reason}`); };
const distance = n => n === null || (Number.isInteger(n) && Math.abs(n) <= 1_000_000);

/** Full FEN is intentional: the halfmove clock can change the fifty-move result. */
export function tablebaseKey(/** @type {import('../coach/tutor.js').ChessConstructor} */ Chess, /** @type {string} */ fen) {
  require(typeof fen === 'string' && fen.length < 150 && fen.split(' ').length === 6 && fen.split(' ')[2] === '-', 'full FEN without castling rights required');
  const pos = checkPosition(Chess, fen);
  require(!pos.error && pos.fen === fen, 'canonical legal position required');
  require(new Chess(fen).board().flat().filter(Boolean).length <= 7, 'at most seven pieces');
  return fen;
}

/**
 * Ordinary WDL only, expressed from White's perspective. Cursed/blessed and uncertain
 * categories stay unverified here rather than being silently promoted to a normal win/loss.
 * @returns {TablebaseOutcome|null}
 */
export function tablebaseOutcome(/** @type {string} */ category, /** @type {string} */ turn) {
  if (!['w', 'b'].includes(turn)) return null;
  if (category === 'draw') return 'draw';
  if (!['win', 'loss'].includes(category)) return null;
  return (category === 'win') === (turn === 'w') ? 'white-win' : 'black-win';
}

/**
 * Validate API facts against rules, deriving SAN locally instead of trusting response text.
 * All legal moves must be represented exactly once. Distances retain their API meaning:
 * DTZ measures a zeroing distance and is never presented as a distance to mate.
 * @param {import('../coach/tutor.js').ChessConstructor} Chess
 * @param {TablebaseSnapshot} record
 * @returns {TablebaseSnapshot}
 */
export function validateTablebaseSnapshot(Chess, record) {
  const fen = tablebaseKey(Chess, record?.fen), url = new URL('https://tablebase.lichess.ovh/standard');
  url.searchParams.set('fen', fen);
  require(record.url === url.href && /^\d{4}-\d\d-\d\dT/.test(record.retrievedAt) && Number.isFinite(Date.parse(record.retrievedAt)), 'source URL/date');
  require(/^[0-9a-f]{64}$/.test(record.sha256), 'snapshot digest');
  const c = new Chess(fen), r = record.result;
  const facts = result => result && CATEGORIES.has(result.category) && distance(result.dtz) && distance(result.dtm)
    && typeof result.checkmate === 'boolean' && typeof result.stalemate === 'boolean';
  require(facts(r) && r.checkmate === c.isCheckmate() && r.stalemate === c.isStalemate(), 'root facts');
  const legal = new Map(c.moves({ verbose: true }).map(m => [m.from + m.to + (m.promotion || ''), m]));
  require(Array.isArray(r.moves) && r.moves.length === legal.size, 'complete legal moves');
  const seen = new Set();
  for (const m of r.moves) {
    require(m && typeof m.uci === 'string' && legal.has(m.uci) && !seen.has(m.uci) && facts(m), 'legal move facts');
    seen.add(m.uci);
    c.move(legal.get(m.uci));
    require(m.checkmate === c.isCheckmate() && m.stalemate === c.isStalemate(), 'terminal move facts');
    c.undo();
  }
  return structuredClone(record);
}

/**
 * Index by exact FEN and lazily rules-check records once per compilation. A missing record is
 * an error for an authored claim; tests/builds remain offline and fail closed if data drifts.
 * @param {import('../coach/tutor.js').ChessConstructor} Chess
 * @param {TablebaseSnapshot[]} records
 */
export function tablebaseIndex(Chess, records) {
  require(Array.isArray(records) && records.length <= 2000, 'snapshot limit');
  const index = new Map(), checked = new Map();
  for (const record of records) {
    require(record && typeof record.fen === 'string' && !index.has(record.fen), 'duplicate snapshot');
    index.set(record.fen, record);
  }
  return (/** @type {string} */ fen) => {
    require(index.has(fen), 'missing exact-position snapshot');
    if (!checked.has(fen)) checked.set(fen, validateTablebaseSnapshot(Chess, index.get(fen)));
    return checked.get(fen);
  };
}

/**
 * Check the declared result and every recorded move, including the opponent's moves. API
 * move categories describe the CHILD side to move, so invert turn before interpretation.
 * This proves result preservation along this branch; it does not prove a unique solution.
 * @param {import('../coach/tutor.js').ChessConstructor} Chess
 * @param {{fen: string, line: string[], tablebase: TablebaseEvidence}} exercise
 * @param {(fen: string) => TablebaseSnapshot} lookup
 * @returns {TablebaseEvidence}
 */
export function verifyTablebaseLine(Chess, exercise, lookup) {
  const expected = exercise.tablebase?.outcome;
  require(['white-win', 'black-win', 'draw'].includes(expected), 'declared outcome');
  const c = new Chess(tablebaseKey(Chess, exercise.fen)), root = lookup(c.fen());
  let checkedAt = root.retrievedAt;
  for (const uci of exercise.line) {
    const snapshot = lookup(c.fen()), move = snapshot.result.moves.find(m => m.uci === uci);
    require(tablebaseOutcome(snapshot.result.category, c.turn()) === expected, 'root/branch outcome');
    require(move, 'recorded move absent');
    c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    require(tablebaseOutcome(move.category, c.turn()) === expected, 'recorded move changes the outcome');
    if (snapshot.retrievedAt < checkedAt) checkedAt = snapshot.retrievedAt;
  }
  return { outcome: expected, checkedAt, url: root.url, plies: exercise.line.length };
}
