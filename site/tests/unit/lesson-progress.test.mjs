import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { CURRICULUM } from '../../src/curriculum/catalogue.js';
import { compileCurriculum } from '../../src/curriculum/curriculum.js';
import { createLessonProgressStore, summarizeLessonProgress, lessonRevision, LESSON_PROGRESS_KEY, PROGRESS_LIMITS } from '../../src/curriculum/progress.js';

const catalogue = compileCurriculum(Chess, CURRICULUM), lessonOf = id => catalogue.modules.flatMap(m => m.lessons).find(l => l.exercises.some(e => e.id === id));
const source = catalogue.modules.find(m => m.id === 'lichess-puzzles').lessons.flatMap(l => l.exercises).find(e => e.puzzle.id === '00008');
let sequence = 0;
const event = (id, kind = 'mate', extra = {}) => ({ id: 'attempt-' + ++sequence, at: 1000 + sequence, lessonId: lessonOf(id).id, exerciseId: id, kind,
  attempts: ['reflection', 'revealed'].includes(kind) ? 0 : 1, outside: 0, hints: 0, worked: false, revealed: kind === 'revealed', assessment: kind === 'reflection' ? 'met' : null, ...extra });
class FakeStorage {
  map = new Map(); fail = false;
  getItem(key) { return this.map.get(key) ?? null; }
  setItem(key, value) { if (this.fail) throw new Error('quota'); this.map.set(key, value); }
}
const summarize = store => summarizeLessonProgress(catalogue, store.entries);

test('saved results distinguish mates, source recall, rubric self-assessment and reveal per lesson/theme', () => {
  const storage = new FakeStorage(), store = createLessonProgressStore(storage, catalogue);
  assert.equal(store.record(event('back-rank-white')), null);
  assert.equal(store.record(event(source.id, 'recorded-line', { attempts: 3 })), null);
  assert.equal(store.record(event('king-route-reflection', 'reflection', { response: 'PRIVATE-ANSWER-NOT-FOR-STORAGE' })), null);
  assert.equal(store.record(event('back-rank-black', 'revealed')), null);
  const summary = summarize(store);
  assert.equal(summary.overall.total, 100); assert.equal(summary.overall.practised, 4);
  assert.deepEqual(['mates', 'recalls', 'reflections', 'met', 'reveals'].map(k => summary.overall[k]), [1, 1, 1, 1, 1]);
  assert.equal(summary.overall.unassisted, 2); assert.equal(summary.overall.choices, 4);
  const lesson = summary.lessons.find(l => l.id === 'back-rank-mate'); assert.equal(lesson.practised, 2); assert.equal(lesson.total, 2);
  const theme = summary.themes.find(t => t.tag === 'back-rank'); assert.equal(theme.practised, 2); assert.equal(theme.mates, 1); assert.equal(theme.reveals, 1);
  const reload = createLessonProgressStore(storage, catalogue); assert.deepEqual(summarize(reload), summary);
  const snapshot = store.entries; snapshot.clear(); assert.equal(store.entries.size, 4);
  assert.equal(JSON.stringify([...storage.map.values()]).includes('PRIVATE-ANSWER-NOT-FOR-STORAGE'), false);
});

test('hinted/worked/outside-reference results remain separate from unassisted completions and self-reports', () => {
  const store = createLessonProgressStore(new FakeStorage(), catalogue);
  store.record(event('back-rank-white', 'mate', { hints: 2, worked: true, outside: 1, attempts: 2 }));
  store.record(event('back-rank-white'));
  store.record(event('king-route-reflection', 'reflection', { assessment: 'practice', hints: 1 }));
  const summary = summarize(store).overall;
  assert.equal(summary.mates, 2); assert.equal(summary.unassisted, 1); assert.equal(summary.hints, 3);
  assert.equal(summary.outside, 1); assert.equal(summary.worked, 1); assert.equal(summary.practice, 1); assert.equal(summary.met, 0);
});

test('failed writes publish no counters, retry IDs are idempotent and sequential tabs retain each other’s work', () => {
  const storage = new FakeStorage(), a = createLessonProgressStore(storage, catalogue), b = createLessonProgressStore(storage, catalogue), first = event('back-rank-white');
  storage.fail = true; assert.equal(a.record(first), 'storage'); assert.equal(a.entries.size, 0); assert.equal(storage.getItem(LESSON_PROGRESS_KEY), null);
  storage.fail = false; assert.equal(a.record(first), null); assert.equal(a.record(first), null); assert.equal(summarize(a).overall.mates, 1);
  assert.equal(b.record(event('back-rank-black')), null); assert.equal(summarize(b).overall.mates, 2);
  assert.equal(a.record(event(source.id, 'recorded-line')), null); assert.equal(summarize(a).overall.practised, 3);
  b.reload(); assert.deepEqual(summarize(a), summarize(b));
});

test('future/malformed saved data stays byte-for-byte intact and can be recovered without overwriting it', () => {
  const unavailable = createLessonProgressStore(null, catalogue); assert.equal(unavailable.unreadable, true); assert.equal(unavailable.record(event('back-rank-white')), 'unreadable');
  const validStorage = new FakeStorage(), seed = createLessonProgressStore(validStorage, catalogue); seed.record(event('back-rank-white'));
  const valid = JSON.parse(validStorage.getItem(LESSON_PROGRESS_KEY)), broken = [];
  for (const change of [d => { d.version = 99; }, d => { d.entries[0].record.mates = -1; }, d => { d.entries[0].record.choices = Infinity; },
    d => { d.entries[0].record.completions = 10; }, d => { d.entries.push(d.entries[0]); }, d => { d.recent.push(d.recent[0]); },
    d => { d.entries[0].exerciseId += '\n'; }, d => { d.entries[0].record.mates = PROGRESS_LIMITS.counter + 1; }]) {
    const copy = structuredClone(valid); change(copy); broken.push(JSON.stringify(copy));
  }
  broken.push('{broken JSON', 'null');
  for (const raw of broken) {
    const storage = new FakeStorage(); storage.setItem(LESSON_PROGRESS_KEY, raw);
    const store = createLessonProgressStore(storage, catalogue); assert.equal(store.unreadable, true);
    assert.equal(store.record(event('back-rank-white')), 'unreadable'); assert.equal(storage.getItem(LESSON_PROGRESS_KEY), raw); assert.equal(store.entries.size, 0);
    storage.setItem(LESSON_PROGRESS_KEY, validStorage.getItem(LESSON_PROGRESS_KEY)); store.reload(); assert.equal(store.unreadable, false); assert.equal(summarize(store).overall.mates, 1);
  }
});

test('changed task revisions retain old results while keeping current lesson/theme credit separate', () => {
  const storage = new FakeStorage(), store = createLessonProgressStore(storage, catalogue); store.record(event('back-rank-white'));
  const changed = structuredClone(catalogue), target = changed.modules[0].lessons[0].exercises[0]; target.fen = target.fen.replace(' 0 1', ' 0 2');
  const updated = createLessonProgressStore(storage, changed), before = summarizeLessonProgress(changed, updated.entries);
  assert.equal(before.overall.practised, 0); assert.equal(before.older, 1); assert.equal(updated.entries.size, 1);
  assert.equal(updated.record(event('back-rank-white')), null);
  const after = summarizeLessonProgress(changed, updated.entries); assert.equal(after.overall.practised, 1); assert.equal(after.overall.mates, 1); assert.equal(after.older, 1); assert.equal(updated.entries.size, 2);
  const prompt = structuredClone(target); prompt.prompt.en += ' Updated.'; assert.notEqual(lessonRevision(prompt), lessonRevision(target));
  const rubric = structuredClone(target); rubric.rubric[0].de += ' Anders.'; assert.notEqual(lessonRevision(rubric), lessonRevision(target));
  const metadata = structuredClone(source); metadata.puzzle.rating += 100; assert.equal(lessonRevision(metadata), lessonRevision(source));
  // Valid bounded prose can expand when JSON escapes control characters. Its task revision
  // must still be saveable, rather than leaving an otherwise valid result pending forever.
  const escaped = structuredClone(catalogue), text = escaped.modules[0].lessons[0].exercises[0];
  text.prompt = { en: 'X' + '\0'.repeat(999), de: 'X' + '\0'.repeat(999) };
  text.rubric = Array.from({ length: 8 }, () => ({ en: 'X' + '\0'.repeat(499), de: 'X' + '\0'.repeat(499) }));
  const checked = compileCurriculum(Chess, escaped); assert.ok(lessonRevision(text).length <= PROGRESS_LIMITS.revision);
  assert.equal(createLessonProgressStore(new FakeStorage(), checked).record(event('back-rank-white')), null);
});

test('unsupported evidence classes, mismatched tasks and malformed completions never write progress', () => {
  const storage = new FakeStorage(), store = createLessonProgressStore(storage, catalogue);
  const invalid = [event('king-route-reflection'), event('back-rank-white', 'recorded-line'), event(source.id, 'reflection'),
    event('back-rank-white', 'mate', { lessonId: 'wrong' }), event('back-rank-white', 'mate', { id: 'bad\n' }),
    event('back-rank-white', 'revealed', { revealed: false }), event('back-rank-white', 'mate', { outside: 2 }),
    event('back-rank-white', 'mate', { at: NaN }), event('back-rank-white', 'mate', { hints: -1 }),
    event('back-rank-white', 'mate', { assessment: 'met' }), event('king-route-reflection', 'reflection', { assessment: 'automatic-pass' })];
  for (const result of invalid) assert.equal(store.record(result), 'invalid');
  assert.equal(storage.getItem(LESSON_PROGRESS_KEY), null); assert.equal(store.entries.size, 0);
});

test('existing coach challenge counters are validated and displayed separately from curriculum evidence', () => {
  const store = createLessonProgressStore(new FakeStorage(), catalogue);
  const summary = summarizeLessonProgress(catalogue, store.entries, { fork: { right: 2, tries: 3 }, calculation: { right: 1, tries: 1 },
    unknown: { right: 1, tries: 2 }, pin: { right: 10, tries: 1 }, skewer: { right: Infinity, tries: Infinity } });
  const fork = summary.themes.find(t => t.tag === 'fork'); assert.equal(fork.coachRight, 2); assert.equal(fork.coachTries, 3);
  assert.equal(fork.mates, 0); assert.equal(fork.recalls, 0); assert.equal(summary.overall.practised, 0); assert.equal(summary.ignoredChallenges, 3);
});
