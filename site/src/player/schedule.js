// Browser-local spaced practice (TODO 9.4), reusing the existing opening-drill intervals.
import { scheduleDrillReview } from '../openings/drills.js';

export const SCHEDULE_KEY = 'kibitz.practiceSchedule';
export const SCHEDULE_LIMITS = Object.freeze({ entries: 4000, recent: 2048, revision: 65536, characters: 8_000_000, count: 1_000_000_000 });
const TYPES = ['lesson', 'own'], BASES = ['mate', 'recorded-line', 'reflection-met', 'reflection-practice', 'engine-target', 'rules-mate', 'revealed'];
const integer = n => Number.isSafeInteger(n) && n >= 0 && n <= SCHEDULE_LIMITS.count;
const time = n => Number.isSafeInteger(n) && n >= 0 && n <= 8_640_000_000_000_000;
const text = (v, max) => typeof v === 'string' && !!v && v.length <= max && !v.includes('\0') && v.isWellFormed();
const exact = (o, keys) => o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).length === keys.length && keys.every(k => Object.hasOwn(o, k));
const token = id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(id);
const keyOf = card => JSON.stringify([card.kind, card.scope, card.id, card.revision]);
function cardValid(card) {
  return exact(card, card?.kind === 'own' ? ['kind', 'scope', 'id', 'revision', 'source'] : ['kind', 'scope', 'id', 'revision']) && TYPES.includes(card.kind) && token(card.id) && text(card.revision, SCHEDULE_LIMITS.revision)
    && (card.kind !== 'own' || text(card.source, 8192))
    && text(card.scope, 2048) && (card.kind !== 'lesson' || card.scope === 'curriculum');
}
function resultValid(card, event) {
  return exact(event, ['id', 'at', 'basis', 'mistakes', 'hints', 'revealed']) && token(event.id) && time(event.at) && BASES.includes(event.basis)
    && integer(event.mistakes) && integer(event.hints) && typeof event.revealed === 'boolean' && event.revealed === (event.basis === 'revealed')
    && (card.kind === 'lesson' ? !['engine-target', 'rules-mate'].includes(event.basis) : ['engine-target', 'rules-mate', 'revealed'].includes(event.basis));
}
function recordValid(r) {
  return exact(r, ['reviews', 'clean', 'mistakes', 'hints', 'lapses', 'grade', 'intervalDays', 'lastAt', 'due'])
    && ['reviews', 'clean', 'mistakes', 'hints', 'lapses'].every(k => integer(r[k])) && r.reviews > 0 && r.clean + r.lapses <= r.reviews
    && ['again', 'hard', 'good'].includes(r.grade) && Number.isSafeInteger(r.intervalDays) && r.intervalDays >= 0 && r.intervalDays <= 180
    && (r.grade === 'again' ? r.intervalDays === 0 : r.intervalDays > 0) && time(r.lastAt) && time(r.due) && r.due > r.lastAt;
}
function parse(data) {
  if (!exact(data, ['version', 'entries', 'recent']) || data.version !== 1 || !Array.isArray(data.entries) || data.entries.length > SCHEDULE_LIMITS.entries
    || !Array.isArray(data.recent) || data.recent.length > SCHEDULE_LIMITS.recent || data.recent.some(id => !token(id)) || new Set(data.recent).size !== data.recent.length) return null;
  const entries = new Map();
  for (const entry of data.entries) {
    if (!exact(entry, ['card', 'basis', 'record']) || !cardValid(entry.card) || !BASES.includes(entry.basis) || !recordValid(entry.record)
      || !resultValid(entry.card, { id: 'validation', at: entry.record.lastAt, basis: entry.basis, mistakes: 0, hints: 0, revealed: entry.basis === 'revealed' })) return null;
    const key = keyOf(entry.card); if (entries.has(key)) return null; entries.set(key, structuredClone(entry));
  }
  return { entries, recent: data.recent.slice() };
}

/** Reread before writes; acknowledge only a successful single-key save, with retry IDs. */
export function createPracticeSchedule(storage) {
  let state = parse({ version: 1, entries: [], recent: [] }), unreadable = false;
  const read = () => {
    try {
      if (!storage) return null;
      const raw = storage.getItem(SCHEDULE_KEY); if (raw === null) return parse({ version: 1, entries: [], recent: [] });
      return raw.length <= SCHEDULE_LIMITS.characters ? parse(JSON.parse(raw)) : null;
    } catch { return null; }
  };
  const reload = () => { const next = read(); unreadable = !next; if (next) state = next; return !!next; }; reload();
  return {
    get entries() { return structuredClone(state.entries); }, get unreadable() { return unreadable; }, reload,
    record(card, event) {
      if (!cardValid(card) || !resultValid(card, event)) return 'invalid';
      const latest = read(); if (!latest) { unreadable = true; return 'unreadable'; }
      if (latest.recent.includes(event.id)) { state = latest; unreadable = false; return null; }
      const key = keyOf(card), previous = latest.entries.get(key), entries = new Map(latest.entries);
      // A delayed older receipt must not overwrite a newer due date or last evidence class.
      if (!previous || event.at >= previous.record.lastAt) {
        const record = scheduleDrillReview(previous?.record || null, { mistakes: Math.max(event.mistakes, +(event.basis === 'reflection-practice')), hints: event.hints, revealed: event.revealed }, event.at);
        if (!record || !recordValid(record)) return 'invalid'; entries.set(key, { card: { ...card }, basis: event.basis, record });
      }
      const data = { version: 1, entries: [...entries.values()], recent: [...latest.recent, event.id].slice(-SCHEDULE_LIMITS.recent) };
      const checked = parse(data); if (!checked) return 'limit';
      const raw = JSON.stringify(data); if (raw.length > SCHEDULE_LIMITS.characters) return 'limit';
      try { storage.setItem(SCHEDULE_KEY, raw); } catch { return 'storage'; }
      state = checked; unreadable = false; return null;
    },
  };
}

/** Current content/revision/scope predicates exclude deleted and obsolete source cards. */
export function practiceQueue(cards, entries, now, { limit = 20, kind = '', includeNew = true } = {}) {
  if (!Array.isArray(cards) || !time(now) || !Number.isSafeInteger(limit) || limit < 1 || limit > 50 || !['', 'lesson', 'own', 'opening'].includes(kind) || typeof includeNew !== 'boolean') throw new Error('Invalid practice queue');
  const seen = new Set(), rows = [];
  for (const card of cards) {
    const key = card.kind === 'opening' || card.fresh ? card.key : keyOf(card);
    if (seen.has(key) || kind && card.kind !== kind) continue; seen.add(key);
    const entry = card.kind === 'opening' ? card.review : card.fresh ? null : entries.get(key)?.record;
    if (entry && !recordValid(entry) || !entry && !includeNew || entry && entry.due > now) continue;
    rows.push({ card, record: entry || null, due: entry?.due ?? null });
  }
  rows.sort((a, b) => (a.due ?? Infinity) - (b.due ?? Infinity));
  return rows.slice(0, limit);
}

export const scheduleCardKey = keyOf;

/** The latest known own target is a queue pointer; the player must qualify it afresh on opening. */
export function ownPracticeCards(candidates, entries, scope) {
  const latest = new Map();
  for (const entry of entries.values()) {
    if (entry.card.kind !== 'own' || entry.card.scope !== scope) continue;
    const prior = latest.get(entry.card.source);
    if (!prior || entry.record.lastAt >= prior.record.lastAt) latest.set(entry.card.source, entry);
  }
  return candidates.map(candidate => {
    const previous = latest.get(candidate.key);
    return { ...(previous?.card || { kind: 'own', scope, key: 'own:' + candidate.key, fresh: true }), source: candidate.key, candidate };
  });
}

/** Source progress is saved separately. Return a detached scheduling receipt after that acknowledgement. */
export function lessonScheduleReceipt(index, completion) {
  const item = index.get(completion.exerciseId); if (!item || item.lessonId !== completion.lessonId) return null;
  const basis = completion.kind === 'reflection' ? 'reflection-' + completion.assessment : completion.kind;
  return { card: { kind: 'lesson', scope: 'curriculum', id: item.id, revision: item.revision },
    event: { id: completion.id, at: completion.at, basis, mistakes: completion.outside,
      hints: Math.max(completion.hints, +completion.worked), revealed: completion.revealed } };
}
