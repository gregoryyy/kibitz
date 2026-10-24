// Repertoire recall and spaced review (TODO 5.4). No DOM, clock, engine or provider calls.
import { epd } from '../chess/knowledge.js';
import { repertoireLine } from './repertoire.js';
import { createStore } from '../platform/store.js';

const DAY = 86_400_000, RETRY = 600_000, MAX_DATE = 8_640_000_000_000_000;
const count = n => Number.isSafeInteger(n) && n >= 0;
const time = n => count(n) && n <= MAX_DATE;

/**
 * @typedef {object} DrillRecord
 * @property {number} reviews Completed recalls, including revealed answers.
 * @property {number} clean Recalls without mistakes or help.
 * @property {number} mistakes Legal choices outside the saved repertoire.
 * @property {number} hints Origin-square hints requested.
 * @property {number} lapses Failed/revealed recalls.
 * @property {'again'|'hard'|'good'} grade Most recent recall grade.
 * @property {number} intervalDays Scheduled interval; zero means the ten-minute learning step.
 * @property {number} lastAt Review timestamp in epoch milliseconds.
 * @property {number} due Next review timestamp in epoch milliseconds.
 */
/**
 * @typedef {object} DrillCard
 * @property {string} key Identity: repertoire id, side, EPD and sorted accepted moves.
 * @property {string} fen Representative full FEN, preserving the route's move number.
 * @property {string} color Repertoire side (`w` or `b`).
 * @property {string} name Representative saved line's name; display as text only.
 * @property {{uci: string, san: string, reply: string|null}[]} choices All saved choices here.
 */

/**
 * Deduplicate the chosen side's positions across shared prefixes, repetitions and transpositions.
 * Retain a legal opponent reply from a stored route for each choice. A changed set of choices
 * gets a new review key; renaming a line or editing notes does not erase learned positions.
 * @param {import('../coach/tutor.js').ChessConstructor} Chess Injected chess.js constructor.
 * @param {{id: string, color: string, lines: {name: string, moves: string[]}[]}} repertoire Validated repertoire.
 * @returns {DrillCard[]} Detached cards; does not change saved lines.
 */
export function buildDrillCards(Chess, repertoire) {
  if (!repertoire || !['w', 'b'].includes(repertoire.color)) return [];
  const positions = new Map();
  for (const saved of repertoire.lines) {
    const line = repertoireLine(Chess, saved.moves); if (!line) continue;
    line.ucis.forEach((uci, i) => {
      const fen = line.fens[i]; if (fen.split(' ')[1] !== repertoire.color) return;
      const position = epd(fen);
      if (!positions.has(position)) positions.set(position, { fen, name: saved.name, choices: new Map() });
      const card = positions.get(position);
      if (!card.choices.has(uci)) card.choices.set(uci, { uci, san: line.sans[i], reply: line.ucis[i + 1] || null });
    });
  }
  return [...positions.entries()].map(([position, card]) => {
    const choices = [...card.choices.values()].sort((a, b) => a.uci.localeCompare(b.uci));
    return { key: JSON.stringify([repertoire.id, repertoire.color, position, choices.map(c => c.uci)]),
      fen: card.fen, color: repertoire.color, name: card.name, choices };
  });
}

/**
 * Due reviews first (oldest due first), then new positions in repertoire order.
 * Completed future cards stay out of the queue. Inject time for repeatable tests.
 * @param {DrillCard[]} cards Current repertoire cards.
 * @param {Map<string, DrillRecord>} records Saved completed reviews.
 * @param {number} now Epoch milliseconds.
 * @param {number} [limit=20] Maximum positions in this session.
 * @returns {DrillCard[]}
 */
export function drillQueue(cards, records, now, limit = 20) {
  return cards.filter(c => !records.has(c.key) || records.get(c.key).due <= now)
    .sort((a, b) => (records.get(a.key)?.due ?? Infinity) - (records.get(b.key)?.due ?? Infinity))
    .slice(0, Math.max(0, limit));
}

/**
 * Check recall, not chess strength: a legal move outside saved choices is `outside`, not bad chess.
 * On success replay the chosen move and one saved opponent reply from this card's FEN.
 * Invalid/illegal input never changes the board; callers decide whether to count an attempt.
 * @param {import('../coach/tutor.js').ChessConstructor} Chess Injected chess.js constructor.
 * @param {DrillCard} card Captured question.
 * @param {string} input SAN or UCI; promotions must include the chosen piece in UCI.
 * @returns {{kind: 'invalid'|'outside'|'correct', san?: string, fen?: string, sans?: string[], ucis?: string[]}}
 */
export function checkDrillMove(Chess, card, input) {
  try {
    const c = new Chess(card.fen), text = String(input).trim();
    const u = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(text);
    const m = u ? c.move({ from: u[1], to: u[2], promotion: u[3] }) : c.move(text);
    const uci = m.from + m.to + (m.promotion || ''), choice = card.choices.find(x => x.uci === uci);
    if (!choice) return { kind: 'outside', san: m.san };
    const sans = [m.san], ucis = [uci];
    if (choice.reply) {
      const r = choice.reply, reply = c.move({ from: r.slice(0, 2), to: r.slice(2, 4), promotion: r[4] });
      sans.push(reply.san); ucis.push(r);
    }
    return { kind: 'correct', san: m.san, fen: c.fen(), sans, ucis };
  } catch { return { kind: 'invalid' }; }
}

/**
 * Simple deterministic intervals, not a fitted memory model: miss/reveal → 10 minutes;
 * hint → at least one day; clean recall → 1 day, 3 days, then double up to 180 days.
 * Count one completed recall per card. Illegal input is excluded from `mistakes`.
 * @param {DrillRecord|null} previous Last completed recall, or null for a new card.
 * @param {{mistakes: number, hints: number, revealed: boolean}} result Completed attempt.
 * @param {number} now Epoch milliseconds, injected by the caller.
 * @returns {DrillRecord|null} Null for malformed input or an unrepresentable due date.
 */
export function scheduleDrillReview(previous, result, now) {
  if (!time(now) || !result || !count(result.mistakes) || !count(result.hints) || typeof result.revealed !== 'boolean') return null;
  if (previous && !validRecord(previous)) return null;
  const grade = result.mistakes || result.revealed ? 'again' : result.hints ? 'hard' : 'good';
  const old = previous?.intervalDays || 0;
  const intervalDays = grade === 'again' ? 0 : grade === 'hard' ? Math.min(180, Math.max(1, old))
    : old === 0 ? 1 : old === 1 ? 3 : Math.min(180, old * 2);
  /** @type {DrillRecord} */
  const next = { reviews: (previous?.reviews || 0) + 1, clean: (previous?.clean || 0) + +(grade === 'good'),
    mistakes: (previous?.mistakes || 0) + result.mistakes, hints: (previous?.hints || 0) + result.hints,
    lapses: (previous?.lapses || 0) + +(grade === 'again'), grade, intervalDays, lastAt: now,
    due: now + (intervalDays ? intervalDays * DAY : RETRY) };
  return validRecord(next) ? next : null;
}

function validRecord(r) {
  return r && ['reviews', 'clean', 'mistakes', 'hints', 'lapses'].every(k => count(r[k]))
    && r.reviews > 0 && r.clean + r.lapses <= r.reviews && ['again', 'hard', 'good'].includes(r.grade)
    && count(r.intervalDays) && r.intervalDays <= 180 && (r.grade === 'again' ? r.intervalDays === 0 : r.intervalDays > 0)
    && time(r.lastAt) && time(r.due) && r.due > r.lastAt;
}

function readRecords(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.entries) || data.entries.length > 50_000) return null;
  const records = new Map();
  for (const entry of data.entries) {
    if (!Array.isArray(entry) || entry.length !== 2) return null;
    const [key, record] = entry;
    if (typeof key !== 'string' || !key.length || key.length > 4096 || records.has(key) || !validRecord(record)) return null;
    records.set(key, { reviews: record.reviews, clean: record.clean, mistakes: record.mistakes, hints: record.hints,
      lapses: record.lapses, grade: record.grade, intervalDays: record.intervalDays, lastAt: record.lastAt, due: record.due });
  }
  return records;
}

/**
 * Versioned browser-local review progress, independent of games and repertoire editing.
 * Validate before writing and publish only after success. Corrupt/future data remains
 * untouched and read-only; a failed write can be retried without counting the review twice.
 * @param {Storage|null} storage Injected storage (a fake in tests).
 */
export function createDrillStore(storage) {
  const store = createStore(storage);
  let records = new Map(), unreadable = false;
  try {
    const raw = storage?.getItem('kibitz.repertoireReviews');
    if (raw != null) { const read = readRecords(JSON.parse(raw)); if (read) records = read; else unreadable = true; }
  } catch { unreadable = true; }
  return {
    get records() { return structuredClone(records); },
    get unreadable() { return unreadable; },
    record(key, result, now) {
      if (unreadable) return 'unreadable';
      const next = new Map(records), reviewed = scheduleDrillReview(records.get(key) || null, result, now);
      next.set(key, reviewed);
      const data = { version: 1, entries: [...next.entries()] }, checked = readRecords(data);
      if (!reviewed || !checked) return 'invalid';
      if (!store.set('repertoireReviews', data)) return 'storage';
      records = checked; return null;
    },
  };
}
