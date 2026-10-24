// TODO 5.3: chosen opening lines, independent of the games library and of engine scores.
// Persist UCI moves; replay with chess.js whenever loading or editing. No DOM or provider calls.
import { epd } from '../chess/knowledge.js';
import { createStore } from '../platform/store.js';

export const MAX_REPERTOIRE_PLIES = 200;
const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;

function replay(Chess, start, moves) {
  if (!Array.isArray(moves) || moves.length > MAX_REPERTOIRE_PLIES) return null;
  try {
    const c = new Chess(start), line = { start: c.fen(), sans: [], ucis: [], fens: [c.fen()] };
    for (const move of moves) {
      if (typeof move !== 'string' || !UCI.test(move)) return null;
      const m = c.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] });
      line.sans.push(m.san); line.ucis.push(move); line.fens.push(c.fen());
    }
    return line;
  } catch { return null; }
}

// PGN mainline or stored UCI array, always from the standard start. Reject the entire input on
// error or overflow; in particular, never silently save only a prefix of the displayed line.
export function repertoireLine(Chess, input) {
  const start = new Chess().fen();
  if (Array.isArray(input)) return replay(Chess, start, input);
  if (typeof input !== 'string' || input.length > 100_000) return null;
  try {
    const c = new Chess(); c.loadPgn(input);
    const moves = c.history({ verbose: true });
    if (moves.length && epd(moves[0].before) !== epd(start)) return null;
    if (!moves.length && epd(c.fen()) !== epd(start)) return null;
    return replay(Chess, start, moves.map(m => m.from + m.to + (m.promotion || '')));
  } catch { return null; }
}

// Capture only the displayed part. A scratch line may start at an ancestor of the game cursor
// (e.g. an engine alternative); require a real connecting position instead of inventing a path.
export function boardRepertoireLine(Chess, start, moves, scratch = null) {
  const initial = new Chess().fen();
  if (scratch) {
    if (!Array.isArray(scratch.ucis) || !Number.isInteger(scratch.i) || scratch.i < 0 || scratch.i > scratch.ucis.length) return null;
    const tail = replay(Chess, scratch.start, scratch.ucis.slice(0, scratch.i));
    if (!tail) return null;
    if (tail.start === initial) return repertoireLine(Chess, tail.ucis);
    const base = replay(Chess, start, moves);
    if (!base || epd(base.start) !== epd(initial)) return epd(tail.start) === epd(initial) ? repertoireLine(Chess, tail.ucis) : null;
    let at = base.fens.lastIndexOf(tail.start);
    if (at < 0) at = base.fens.findLastIndex(f => epd(f) === epd(tail.start));
    return at < 0 ? null : repertoireLine(Chess, [...base.ucis.slice(0, at), ...tail.ucis]);
  }
  const base = replay(Chess, start, moves);
  return base && epd(base.start) === epd(initial) ? repertoireLine(Chess, base.ucis) : null;
}

// A position graph for browsing choices; ordered lines remain the source of truth for editing
// and future drills. Transposed routes may intentionally be separate saved lines.
export function repertoireIndex(Chess, repertoire) {
  const index = new Map();
  for (const saved of repertoire.lines) {
    const line = repertoireLine(Chess, saved.moves); if (!line) continue;
    line.ucis.forEach((uci, i) => {
      const key = epd(line.fens[i]);
      if (!index.has(key)) index.set(key, new Set());
      index.get(key).add(uci);
    });
  }
  return index;
}
export function repertoireChoices(Chess, index, color, fen) {
  try {
    const c = new Chess(fen); if (c.turn() !== color) return [];
    const choices = [];
    for (const uci of index.get(epd(c.fen())) || []) {
      const step = replay(Chess, c.fen(), [uci]);
      if (step) choices.push({ uci, san: step.sans[0] });
    }
    return choices.sort((a, b) => a.uci.localeCompare(b.uci));
  } catch { return []; }
}

export function repertoirePgn(Chess, repertoire) {
  // chess.js writes header values verbatim. Keep user text inside a single quoted header value.
  const header = value => value.replace(/[\\"\r\n]/g, ' ');
  return repertoire.lines.map(saved => {
    const line = repertoireLine(Chess, saved.moves); if (!line?.ucis.length) return '';
    const c = new Chess(); line.sans.forEach(san => c.move(san));
    c.setHeader('Event', header(repertoire.name)); c.setHeader('Variation', header(saved.name));
    c.setHeader('KibitzRepertoireSide', repertoire.color); c.setHeader('Result', '*');
    if (saved.note) c.setComment(saved.note.replace(/[{}]/g, ' '));
    return c.pgn();
  }).filter(Boolean).join('\n\n');
}

function checkedItems(Chess, data) {
  if (!data || data.version !== 1 || !Array.isArray(data.items) || data.items.length > 32) return null;
  const ids = new Set(), items = [];
  for (const r of data.items) {
    if (!r || !text(r.id, 100) || ids.has(r.id) || !text(r.name, 100) || !['w', 'b'].includes(r.color) || !Array.isArray(r.lines) || r.lines.length > 128) return null;
    ids.add(r.id);
    const lineIds = new Set(), paths = new Set(), lines = [];
    for (const l of r.lines) {
      if (!l || !text(l.id, 100) || lineIds.has(l.id) || !text(l.name, 100) || typeof l.note !== 'string' || l.note.length > 2000 || !Array.isArray(l.moves)) return null;
      const line = repertoireLine(Chess, l.moves), path = line?.ucis.join(' ');
      if (!line?.ucis.length || paths.has(path)) return null;
      lineIds.add(l.id); paths.add(path);
      lines.push({ id: l.id, name: l.name.trim(), note: l.note, moves: line.ucis });
    }
    items.push({ id: r.id, name: r.name.trim(), color: r.color, lines });
  }
  return items;
}

// Atomic browser persistence: validate first, write second, publish to memory last. A malformed
// or future-version store stays untouched and read-only; failed writes leave the old data intact.
export function createRepertoireStore(Chess, storage) {
  const store = createStore(storage);
  let items = [], unreadable = false, revision = 0;
  try {
    const raw = storage?.getItem('kibitz.repertoires');
    if (raw != null) { const read = checkedItems(Chess, JSON.parse(raw)); if (read) items = read; else unreadable = true; }
  } catch { unreadable = true; }
  return {
    get items() { return structuredClone(items); },
    get unreadable() { return unreadable; },
    get revision() { return revision; },
    save(next) {
      if (unreadable) return 'unreadable';
      const checked = checkedItems(Chess, { version: 1, items: next });
      if (!checked) return 'invalid';
      if (!store.set('repertoires', { version: 1, items: checked })) return 'storage';
      items = checked; revision++; return null;
    },
  };
}
