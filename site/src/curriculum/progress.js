// Browser-local lesson results (TODO 6.7). Evidence classes stay separate; no Elo/mastery model.
import { TAG_LABELS } from '../chess/knowledge.js';
import { createStore } from '../platform/store.js';

export const LESSON_PROGRESS_KEY = 'kibitz.lessonProgress';
export const PROGRESS_LIMITS = Object.freeze({ entries: 4000, recent: 2048, revision: 65536, characters: 8_000_000, counter: 1_000_000_000 });
const KINDS = ['mate', 'recorded-line', 'reflection', 'revealed'];
const COUNTS = ['completions', 'mates', 'recalls', 'reflections', 'met', 'practice', 'reveals', 'unassisted', 'choices', 'hints', 'outside', 'worked'];
const ID = /^[a-z][a-z0-9-]{0,79}$/;
const count = n => Number.isSafeInteger(n) && n >= 0;
const time = n => count(n) && n <= 8_640_000_000_000_000;
const attemptId = id => typeof id === 'string' && !/\s/.test(id) && /^[A-Za-z0-9_-]{1,80}$/.test(id);
const key = (id, revision) => id + ':' + revision; // IDs cannot contain ':'; revisions are exact data.

/** @typedef {{completions: number, mates: number, recalls: number, reflections: number, met: number, practice: number, reveals: number, unassisted: number, choices: number, hints: number, outside: number, worked: number, lastAt: number, lastKind: string}} LessonRecord */
/** @typedef {{exerciseId: string, revision: string, record: LessonRecord}} ProgressEntry */
/** @typedef {{id: string, at: number, lessonId: string, exerciseId: string, kind: string, attempts: number, outside: number, hints: number, worked: boolean, revealed: boolean, assessment: string|null}} LessonCompletion */
const empty = () => ({ completions: 0, mates: 0, recalls: 0, reflections: 0, met: 0, practice: 0, reveals: 0, unassisted: 0, choices: 0, hints: 0, outside: 0, worked: 0 });

/** Exact task revision; changing position, line, prompt or rubric does not inherit old credit. */
export function lessonRevision(/** @type {import('./curriculum.js').Exercise} */ exercise) {
  return JSON.stringify([exercise.goal, exercise.fen, exercise.line, exercise.puzzle?.id || null, exercise.prompt, exercise.rubric]);
}

/** @param {import('./curriculum.js').Curriculum} catalogue */
export function lessonProgressIndex(catalogue) {
  const items = new Map();
  for (const module of catalogue.modules) for (const lesson of module.lessons) for (const exercise of lesson.exercises) {
    items.set(exercise.id, { id: exercise.id, lessonId: lesson.id, revision: lessonRevision(exercise),
      type: exercise.goal === 'mate' ? 'mate' : exercise.puzzle ? 'source' : 'reflection', tags: [...new Set([...lesson.tags, ...exercise.tags])] });
  }
  return items;
}

function validRecord(record) {
  return record && COUNTS.every(k => count(record[k]) && record[k] <= PROGRESS_LIMITS.counter) && record.completions > 0
    && record.mates + record.recalls + record.reflections + record.reveals === record.completions
    && record.met + record.practice === record.reflections && record.unassisted <= record.mates + record.recalls
    && record.worked <= record.completions && record.outside <= record.choices && time(record.lastAt) && KINDS.includes(record.lastKind)
    && record[{ mate: 'mates', 'recorded-line': 'recalls', reflection: 'reflections', revealed: 'reveals' }[record.lastKind]] > 0;
}

/** Validate saved data before use/write; unknown task revisions stay retained but uncredited. */
function readProgress(data) {
  if (data?.version !== 1 || !Array.isArray(data.entries) || data.entries.length > PROGRESS_LIMITS.entries
    || !Array.isArray(data.recent) || data.recent.length > PROGRESS_LIMITS.recent || !data.recent.every(attemptId) || new Set(data.recent).size !== data.recent.length) return null;
  const entries = new Map();
  for (const entry of data.entries) {
    if (!entry || typeof entry.exerciseId !== 'string' || /\s/.test(entry.exerciseId) || !ID.test(entry.exerciseId) || typeof entry.revision !== 'string'
      || !entry.revision || entry.revision.length > PROGRESS_LIMITS.revision || !validRecord(entry.record)) return null;
    const id = key(entry.exerciseId, entry.revision); if (entries.has(id)) return null;
    const record = Object.fromEntries([...COUNTS, 'lastAt', 'lastKind'].map(k => [k, entry.record[k]]));
    entries.set(id, { exerciseId: entry.exerciseId, revision: entry.revision, record });
  }
  return { entries, recent: data.recent.slice() };
}

/** Validate a completion against the task's supported evidence class, without storing prose. */
function validCompletion(event, item) {
  return item && event && attemptId(event.id) && time(event.at) && event.lessonId === item.lessonId && event.exerciseId === item.id
    && KINDS.includes(event.kind) && [event.attempts, event.outside, event.hints].every(n => count(n) && n <= PROGRESS_LIMITS.counter) && event.outside <= event.attempts
    && typeof event.worked === 'boolean' && typeof event.revealed === 'boolean' && event.revealed === (event.kind === 'revealed')
    && (event.kind === 'reflection' ? ['met', 'practice'].includes(event.assessment) && item.type === 'reflection' && event.attempts === 0 : event.assessment === null)
    && (event.kind !== 'mate' || ['mate', 'source'].includes(item.type) && event.attempts > 0)
    && (event.kind !== 'recorded-line' || item.type === 'source' && event.attempts > 0);
}

/**
 * Preserve malformed/future data read-only. A successful atomic localStorage write precedes
 * publishing counters; failures can be retried with the same completion ID. Refresh from
 * storage before a write so sequential activity in another tab is retained.
 * @param {Storage|null} storage
 * @param {import('./curriculum.js').Curriculum} catalogue Validated tasks.
 */
export function createLessonProgressStore(storage, catalogue) {
  const store = createStore(storage), index = lessonProgressIndex(catalogue);
  let state = readProgress({ version: 1, entries: [], recent: [] }), unreadable = false;
  function read() {
    if (!storage) return null;
    try {
      const raw = storage?.getItem(LESSON_PROGRESS_KEY);
      if (raw == null) return readProgress({ version: 1, entries: [], recent: [] });
      if (raw.length > PROGRESS_LIMITS.characters) return null;
      return readProgress(JSON.parse(raw));
    } catch { return null; }
  }
  const loaded = read(); if (loaded) state = loaded; else unreadable = true;
  return {
    get entries() { return structuredClone(state.entries); },
    get unreadable() { return unreadable; },
    reload() { const next = read(); unreadable = !next; if (next) state = next; },
    /** @param {LessonCompletion} event */
    record(event) {
      const item = index.get(event?.exerciseId);
      if (!validCompletion(event, item)) return 'invalid';
      const latest = read();
      if (!latest) { unreadable = true; return 'unreadable'; }
      unreadable = false;
      if (latest.recent.includes(event.id)) { state = latest; return null; }
      const id = key(item.id, item.revision), previous = latest.entries.get(id)?.record;
      if (!previous && latest.entries.size >= PROGRESS_LIMITS.entries) return 'limit';
      /** @type {LessonRecord} */
      const record = { ...empty(), ...(previous || {}), lastAt: Math.max(previous?.lastAt || 0, event.at), lastKind: event.kind };
      record.completions++; record.choices += event.attempts; record.hints += event.hints; record.outside += event.outside; record.worked += Number(event.worked);
      if (event.kind === 'mate') record.mates++;
      else if (event.kind === 'recorded-line') record.recalls++;
      else if (event.kind === 'reflection') { record.reflections++; record[event.assessment]++; }
      else record.reveals++;
      if (['mate', 'recorded-line'].includes(event.kind) && !event.hints && !event.outside && !event.worked) record.unassisted++;
      if (!validRecord(record)) return 'invalid';
      const entries = new Map(latest.entries); entries.set(id, { exerciseId: item.id, revision: item.revision, record });
      const data = { version: 1, entries: [...entries.values()], recent: [...latest.recent, event.id].slice(-PROGRESS_LIMITS.recent) };
      const checked = readProgress(data); if (!checked) return 'invalid';
      if (JSON.stringify(data).length > PROGRESS_LIMITS.characters) return 'limit';
      if (!store.set('lessonProgress', data)) return 'storage';
      state = checked; return null;
    },
  };
}

/**
 * Current-task totals per lesson/theme. Labels are evidence counts, not an Elo or mastery
 * estimate. Overlapping themes can share an exercise; self-assessments remain separate.
 * @param {import('./curriculum.js').Curriculum} catalogue
 * @param {Map<string, ProgressEntry>} entries
 * @param {object} [challenges] Existing coach counters, validated and kept separate.
 */
export function summarizeLessonProgress(catalogue, entries, challenges = {}) {
  const index = lessonProgressIndex(catalogue), lessons = new Map(), themes = new Map();
  const total = () => ({ total: 0, practised: 0, ...empty() });
  const overall = total(), active = new Set(), exercises = [];
  for (const module of catalogue.modules) for (const lesson of module.lessons) lessons.set(lesson.id, { id: lesson.id, title: structuredClone(lesson.title), ...total() });
  const add = (target, record) => { target.total++; if (record) { target.practised++; for (const k of COUNTS) target[k] += record[k]; } };
  for (const item of index.values()) {
    const id = key(item.id, item.revision); active.add(id);
    const record = entries.get(id)?.record; add(overall, record); add(lessons.get(item.lessonId), record);
    exercises.push({ id: item.id, record: record ? structuredClone(record) : null });
    for (const tag of item.tags) {
      if (!themes.has(tag)) themes.set(tag, { tag, ...total(), coachRight: 0, coachTries: 0 });
      add(themes.get(tag), record);
    }
  }
  let ignoredChallenges = 0;
  const coachRows = challenges && typeof challenges === 'object' && !Array.isArray(challenges) ? Object.entries(challenges).slice(0, 200) : [];
  for (const [tag, value] of coachRows) {
    if (!Object.hasOwn(TAG_LABELS, tag) || !value || !count(value.right) || !count(value.tries) || value.right > value.tries || value.tries > PROGRESS_LIMITS.counter) { ignoredChallenges++; continue; }
    if (!themes.has(tag)) themes.set(tag, { tag, ...total(), coachRight: 0, coachTries: 0 });
    themes.get(tag).coachRight = value.right; themes.get(tag).coachTries = value.tries;
  }
  return { overall, lessons: [...lessons.values()], themes: [...themes.values()], exercises,
    older: [...entries.keys()].filter(id => !active.has(id)).length, ignoredChallenges };
}
