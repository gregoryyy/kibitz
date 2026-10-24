import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPracticeSchedule, practiceQueue, ownPracticeCards, lessonScheduleReceipt, scheduleCardKey, SCHEDULE_KEY } from '../../src/player/schedule.js';
import { scheduleDrillReview, createDrillStore } from '../../src/openings/drills.js';

const NOW = 1_800_000_000_000, DAY = 86_400_000;
const lesson = (id = 'one', revision = 'v1') => ({ kind: 'lesson', scope: 'curriculum', id, revision });
const own = (scope = 'owner1', revision = 'target1') => ({ kind: 'own', scope, id: 'mistake-one', revision, source: JSON.stringify([scope, 'game1', 2, 'fen', 'move']) });
const event = (id = 'event1', extra = {}) => ({ id, at: NOW, basis: 'mate', mistakes: 0, hints: 0, revealed: false, ...extra });
function memory() {
  const data = new Map(); let block = false;
  return { getItem: k => data.get(k) ?? null, setItem: (k, v) => { if (block) throw Error('quota'); data.set(k, v); }, data, block: value => { block = value; } };
}
const get = (store, card = lesson()) => store.entries.get(scheduleCardKey(card));

test('lessons and own exercises reuse opening intervals without mixing their evidence classes', () => {
  const storage = memory(), schedule = createPracticeSchedule(storage), card = lesson(), ownCard = own();
  assert.equal(schedule.record(card, event()), null);
  assert.equal(get(schedule).record.intervalDays, 1);
  assert.equal(schedule.record(card, event('two', { at: NOW + DAY })), null);
  assert.equal(get(schedule).record.intervalDays, 3);
  assert.equal(schedule.record(card, event('three', { at: NOW + 4 * DAY, hints: 1 })), null);
  assert.equal(get(schedule).record.intervalDays, 3); assert.equal(get(schedule).record.grade, 'hard');
  assert.equal(schedule.record(card, event('four', { at: NOW + 7 * DAY, basis: 'revealed', revealed: true })), null);
  assert.equal(get(schedule).record.due, NOW + 7 * DAY + 600_000);
  assert.equal(schedule.record(ownCard, event('own', { basis: 'engine-target' })), null);
  assert.equal(get(schedule, ownCard).basis, 'engine-target');
  assert.equal(schedule.record(ownCard, event('wrong', { basis: 'mate' })), 'invalid');
  assert.equal(schedule.record(card, event('wrong', { basis: 'rules-mate' })), 'invalid');
  const clean = scheduleDrillReview(null, { mistakes: 0, hints: 0, revealed: false }, NOW);
  assert.equal(get(schedule, ownCard).record.due, clean.due);
});

test('a rubric comparison stays self-assessed, with more-practice scheduled in ten minutes', () => {
  const schedule = createPracticeSchedule(memory());
  assert.equal(schedule.record(lesson(), event('reflection', { basis: 'reflection-practice' })), null);
  assert.equal(get(schedule).basis, 'reflection-practice'); assert.equal(get(schedule).record.grade, 'again');
  assert.equal(get(schedule).record.due, NOW + 600_000);
  assert.equal(schedule.record(lesson('two'), event('met', { basis: 'reflection-met' })), null);
  assert.equal(get(schedule, lesson('two')).record.grade, 'good');
});

test('failed saves keep old state and an exact retry/reload counts a completed result once', () => {
  const storage = memory(), schedule = createPracticeSchedule(storage);
  storage.block(true); assert.equal(schedule.record(lesson(), event()), 'storage'); assert.equal(schedule.entries.size, 0);
  storage.block(false); assert.equal(schedule.record(lesson(), event()), null);
  assert.equal(schedule.record(lesson(), event()), null); assert.equal(get(schedule).record.reviews, 1);
  const reload = createPracticeSchedule(storage); assert.equal(reload.record(lesson(), event()), null); assert.equal(get(reload).record.reviews, 1);
  const detached = reload.entries; detached.get(scheduleCardKey(lesson())).record.reviews = 999; assert.equal(get(reload).record.reviews, 1);
});

test('writes reread sequential tab activity and delayed older receipts preserve a newer due date', () => {
  const storage = memory(), a = createPracticeSchedule(storage), b = createPracticeSchedule(storage);
  a.record(lesson(), event('newer', { at: NOW + DAY }));
  b.record(lesson('two'), event('other')); b.record(lesson(), event('late', { at: NOW }));
  a.reload(); assert.equal(a.entries.size, 2); assert.equal(get(a).record.lastAt, NOW + DAY); assert.equal(get(a).record.reviews, 1);
  assert.equal(get(a).record.due, NOW + 2 * DAY);
  assert.ok(JSON.parse(storage.data.get(SCHEDULE_KEY)).recent.includes('late'));
});

test('unknown/corrupt formats remain untouched, including changes made after the store was opened', () => {
  const storage = memory(), schedule = createPracticeSchedule(storage);
  for (const raw of ['{bad', JSON.stringify({ version: 99, keep: 'future' }), JSON.stringify({ version: 1, entries: [], recent: [], extra: true })]) {
    storage.data.set(SCHEDULE_KEY, raw); assert.equal(schedule.record(lesson(), event()), 'unreadable'); assert.equal(schedule.unreadable, true);
    assert.equal(storage.data.get(SCHEDULE_KEY), raw);
  }
  storage.data.delete(SCHEDULE_KEY); assert.equal(schedule.reload(), true); assert.equal(schedule.unreadable, false);
  assert.equal(schedule.record(lesson(), event()), null);
  assert.equal(createPracticeSchedule(null).record(lesson(), event()), 'unreadable');
});

test('malformed identities, receipt counts and impossible dates never overwrite valid history', () => {
  const storage = memory(), schedule = createPracticeSchedule(storage); schedule.record(lesson(), event());
  const before = storage.data.get(SCHEDULE_KEY);
  for (const card of [lesson('bad id'), { ...lesson(), scope: 'another-curriculum' }, { ...own(), source: '' }, { ...lesson(), revision: 'x'.repeat(65537) }]) assert.equal(schedule.record(card, event('invalid')), 'invalid');
  for (const invalid of [{ mistakes: -1 }, { hints: 1.5 }, { basis: 'prose-solve' }, { basis: 'revealed' }, { at: 8_640_000_000_000_000 }, { id: 'bad id' }]) assert.equal(schedule.record(lesson(), event('invalid', invalid)), 'invalid');
  assert.equal(storage.data.get(SCHEDULE_KEY), before);
  const corrupt = JSON.parse(before); corrupt.entries[0].record.due = corrupt.entries[0].record.lastAt;
  const raw = JSON.stringify(corrupt); storage.data.set(SCHEDULE_KEY, raw);
  assert.equal(schedule.record(lesson(), event('another')), 'unreadable'); assert.equal(storage.data.get(SCHEDULE_KEY), raw);
});

test('due ordering, filters and caps combine all three types and only current definitions retain history', () => {
  const schedule = createPracticeSchedule(memory()), ownCard = own(), opening = { kind: 'opening', key: 'opening1', review: scheduleDrillReview(null, { mistakes: 1, hints: 0, revealed: false }, NOW - 1_000_000) };
  schedule.record(lesson(), event()); schedule.record(ownCard, event('own', { basis: 'engine-target', mistakes: 1, at: NOW - 900_000 }));
  const cards = [lesson(), lesson('new'), opening, ownCard, lesson(), lesson('one', 'v2')];
  const queue = practiceQueue(cards, schedule.entries, NOW);
  assert.deepEqual(queue.map(x => x.card.kind), ['opening', 'own', 'lesson', 'lesson']);
  assert.equal(queue[0].card.key, 'opening1'); assert.equal(queue[2].record, null);
  assert.equal(practiceQueue(cards, schedule.entries, NOW, { includeNew: false }).length, 2);
  assert.equal(practiceQueue(cards, schedule.entries, NOW, { kind: 'lesson' }).length, 2);
  assert.equal(practiceQueue(cards, schedule.entries, NOW, { limit: 1 })[0].card.key, 'opening1');
  assert.equal(practiceQueue(Array.from({ length: 30 }, (_, i) => lesson('new' + i)), schedule.entries, NOW).length, 20);
  assert.throws(() => practiceQueue(cards, schedule.entries, NOW, { limit: 999 }));
});

test('own queue pointers use only the selected owner, surviving sources and latest target revision', () => {
  const schedule = createPracticeSchedule(memory()), card = own(), revised = own('owner1', 'target2'), another = own('owner2');
  schedule.record(card, event('a', { basis: 'engine-target' }));
  schedule.record(revised, event('b', { basis: 'rules-mate', at: NOW + 1 }));
  schedule.record(another, event('c', { basis: 'engine-target' }));
  const candidates = [{ key: card.source }, { key: 'brand-new-source' }];
  const deck = ownPracticeCards(candidates, schedule.entries, 'owner1');
  assert.equal(deck.length, 2); assert.equal(deck[0].revision, 'target2'); assert.equal(deck[1].fresh, true);
  assert.equal(practiceQueue(deck, schedule.entries, NOW).length, 1, 'the reviewed own target is not due yet');
  assert.deepEqual(ownPracticeCards([], schedule.entries, 'owner1'), []);
  assert.ok(ownPracticeCards([{ key: card.source }], schedule.entries, 'owner2')[0].fresh);
});

test('lesson receipts retain exact task revision and exclude response prose; assistance is explicit', () => {
  const index = new Map([['exercise', { id: 'exercise', lessonId: 'lesson', revision: 'exact-task' }]]);
  const completed = { id: 'receipt', at: NOW, lessonId: 'lesson', exerciseId: 'exercise', kind: 'reflection', assessment: 'met', outside: 0, hints: 0, worked: true, revealed: false, response: 'PRIVATE WORDS' };
  const receipt = lessonScheduleReceipt(index, completed);
  assert.equal(receipt.card.revision, 'exact-task'); assert.equal(receipt.event.basis, 'reflection-met'); assert.equal(receipt.event.hints, 1);
  assert.ok(!JSON.stringify(receipt).includes('PRIVATE WORDS')); assert.equal(lessonScheduleReceipt(new Map(), completed), null);
});

test('opening review reloads and writes preserve another tab and protect a newly introduced future format', () => {
  const storage = memory(), a = createDrillStore(storage), b = createDrillStore(storage), result = { mistakes: 0, hints: 0, revealed: false };
  assert.equal(a.record('one', result, NOW), null); assert.equal(b.record('two', result, NOW), null);
  a.reload(); assert.equal(a.records.size, 2);
  assert.equal(a.record('one', result, NOW + DAY), null);
  assert.equal(b.record('one', { ...result, mistakes: 1 }, NOW), null);
  assert.equal(b.records.get('one').due, NOW + 4 * DAY);
  const future = JSON.stringify({ version: 99, keep: 'future opening data' }); storage.data.set('kibitz.repertoireReviews', future);
  assert.equal(a.record('one', result, NOW), 'unreadable'); assert.equal(storage.data.get('kibitz.repertoireReviews'), future);
});
