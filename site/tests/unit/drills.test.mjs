/** @file Repertoire recall, review identity and atomic persistence; no live engine/provider. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { repertoireLine } from '../../src/repertoire.js';
import { buildDrillCards, drillQueue, checkDrillMove, scheduleDrillReview, createDrillStore } from '../../src/drills.js';

const DAY = 86_400_000, NOW = 1_800_000_000_000;
const saved = (pgn, name = pgn) => ({ name, moves: repertoireLine(Chess, pgn).ucis });
const rep = (pgns = ['1. e4 e5 2. Nf3 Nc6'], extra = {}) => ({ id: 'r', color: 'w', lines: pgns.map(p => saved(p)), ...extra });
const cards = r => buildDrillCards(Chess, r || rep());
const clean = { mistakes: 0, hints: 0, revealed: false };
function memory() {
  const data = new Map(); let blocked = false;
  return { getItem: k => data.get(k) ?? null, setItem: (k, v) => { if (blocked) throw new Error('quota'); data.set(k, v); }, block: value => { blocked = value; }, data };
}

/** Shared prefixes and transpositions represent one recall, with every saved move accepted. */
test('cards merge positions and alternatives, keeping the repertoire side and a legal reply', () => {
  const r = rep(['1. Nf3 d5 2. g3 Nf6 3. Bg2', '1. g3 d5 2. Nf3 Nf6 3. c4']);
  const deck = cards(r), initial = deck[0];
  assert.deepEqual(initial.choices.map(c => c.san), ['Nf3', 'g3']);
  assert.equal(deck.length, 4, 'shared transposed third-move position is asked once');
  const transposed = deck.find(c => c.choices.some(x => x.san === 'Bg2'));
  assert.deepEqual(transposed.choices.map(c => c.san), ['c4', 'Bg2']);
  for (const card of deck) for (const choice of card.choices) assert.equal(checkDrillMove(Chess, card, choice.uci).kind, 'correct');
  const black = cards(rep(['1. e4 c5 2. Nf3 d6'], { color: 'b' }));
  assert.equal(black.length, 2); assert.equal(black[0].fen.split(' ')[1], 'b');
  const answer = checkDrillMove(Chess, black[0], 'c5');
  assert.deepEqual(answer.sans, ['c5', 'Nf3']); assert.equal(answer.fen.split(' ')[1], 'b');
  assert.deepEqual(cards(rep(['1. e4'], { color: 'b' })), []);
});

test('review identities survive renamed notes, move counters and reordered routes, but reset changed choices/side', () => {
  const r = rep(), first = cards(r)[0];
  assert.equal(cards({ ...r, lines: r.lines.map(l => ({ ...l, name: 'Renamed', note: 'Edited' })) })[0].key, first.key);
  const repeated = cards(rep(['1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3']));
  assert.equal(repeated.length, 2, 'a repeated initial position is not another question');
  const a = rep(['1. e4 e5', '1. d4 d5']), b = { ...a, lines: [...a.lines].reverse() };
  assert.equal(cards(a)[0].key, cards(b)[0].key);
  assert.notEqual(cards(a)[0].key, first.key);
  assert.notEqual(cards(rep(undefined, { id: 'another' }))[0].key, first.key);
  assert.notEqual(cards(rep(undefined, { color: 'b' }))[0].key, first.key);
  const original = structuredClone(r); cards(r); assert.deepEqual(r, original);
});

/** Legal outside choices test recall only; illegal input never advances or changes the question. */
test('answer checking distinguishes invalid moves from legal unsaved choices and replays the opponent reply', () => {
  const card = cards()[0], before = structuredClone(card);
  assert.deepEqual(checkDrillMove(Chess, card, 'e2e5'), { kind: 'invalid' });
  assert.deepEqual(checkDrillMove(Chess, card, '<script>'), { kind: 'invalid' });
  assert.deepEqual(checkDrillMove(Chess, card, 'd4'), { kind: 'outside', san: 'd4' });
  const answer = checkDrillMove(Chess, card, 'e2e4');
  assert.deepEqual(answer.sans, ['e4', 'e5']); assert.deepEqual(answer.ucis, ['e2e4', 'e7e5']);
  assert.equal(answer.fen, repertoireLine(Chess, '1. e4 e5').fens[2]);
  assert.deepEqual(card, before);
});

test('castling, promotion and line-end moves retain exact legal notation without invented replies', () => {
  const castling = cards(rep(['1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. O-O'])).at(-1);
  assert.deepEqual(checkDrillMove(Chess, castling, 'O-O').sans, ['O-O']);
  const promotion = cards(rep(['1. a4 h5 2. a5 h4 3. a6 h3 4. axb7 hxg2 5. bxa8=N'])).at(-1);
  assert.deepEqual(checkDrillMove(Chess, promotion, 'b7a8n').sans, ['bxa8=N']);
  assert.equal(checkDrillMove(Chess, promotion, 'b7a8q').kind, 'outside');
  const long = cards(rep([], { lines: [saved('1. e4 e5'), { name: 'Broken', moves: ['e2e5'] }] }));
  assert.equal(long.length, 1, 'an unreadable line contributes no cards');
});

test('due reviews precede new cards, future cards are excluded, and session limits do not mutate input', () => {
  const deck = cards(rep(['1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6'])), before = deck.slice();
  const record = scheduleDrillReview(null, clean, NOW - DAY), future = scheduleDrillReview(null, clean, NOW);
  const records = new Map([[deck[1].key, record], [deck[2].key, { ...record, due: NOW - 10 }], [deck[3].key, future]]);
  assert.deepEqual(drillQueue(deck, records, NOW).map(c => c.key), [deck[2].key, deck[1].key, deck[0].key]);
  assert.equal(drillQueue(deck, records, NOW, 2).length, 2);
  assert.equal(drillQueue(deck, records, NOW, 0).length, 0); assert.deepEqual(deck, before);
  assert.equal(drillQueue(Array.from({ length: 25 }, (_, i) => ({ ...deck[0], key: `new-${i}` })), new Map(), NOW).length, 20);
});

test('clean recall expands intervals, hint keeps a short interval, and miss/reveal restarts after ten minutes', () => {
  let record = null;
  for (const days of [1, 3, 6, 12, 24, 48, 96, 180, 180]) {
    record = scheduleDrillReview(record, clean, record?.due || NOW);
    assert.equal(record.intervalDays, days); assert.equal(record.due - record.lastAt, days * DAY);
  }
  const helped = scheduleDrillReview(null, { ...clean, hints: 1 }, NOW);
  assert.equal(helped.grade, 'hard'); assert.equal(helped.clean, 0); assert.equal(helped.hints, 1);
  const missed = scheduleDrillReview(record, { ...clean, mistakes: 2, hints: 1 }, record.due);
  assert.equal(missed.grade, 'again'); assert.equal(missed.due - missed.lastAt, 600_000);
  assert.equal(missed.lapses, 1); assert.equal(missed.mistakes, 2); assert.equal(missed.hints, 1);
  const revealed = scheduleDrillReview(null, { ...clean, revealed: true }, NOW);
  assert.equal(revealed.grade, 'again'); assert.equal(revealed.clean, 0);
  assert.equal(scheduleDrillReview(missed, clean, missed.due).intervalDays, 1);
});

test('scheduling rejects corrupt counts, malformed results and impossible timestamps', () => {
  for (const result of [null, { ...clean, mistakes: -1 }, { ...clean, hints: 0.5 }, { ...clean, revealed: 'yes' }]) assert.equal(scheduleDrillReview(null, result, NOW), null);
  for (const now of [NaN, Infinity, -1, 8_640_000_000_000_000]) assert.equal(scheduleDrillReview(null, clean, now), null);
  assert.equal(scheduleDrillReview({ ...scheduleDrillReview(null, clean, NOW), clean: 99 }, clean, NOW), null);
});

/** Progress publication is atomic, so a storage retry cannot double-count one completed recall. */
test('progress persists separately, failed writes roll back, and snapshots cannot mutate saved records', () => {
  const storage = memory(), store = createDrillStore(storage), key = cards()[0].key;
  storage.setItem('kibitz.games', 'games'); storage.setItem('kibitz.repertoires', 'lines');
  storage.block(true); assert.equal(store.record(key, clean, NOW), 'storage'); assert.equal(store.records.size, 0);
  storage.block(false); assert.equal(store.record(key, clean, NOW), null);
  assert.equal(store.records.get(key).reviews, 1); assert.equal(createDrillStore(storage).records.get(key).due, NOW + DAY);
  store.records.get(key).reviews = 100; assert.equal(store.records.get(key).reviews, 1);
  const raw = storage.getItem('kibitz.repertoireReviews');
  storage.block(true); assert.equal(store.record(key, { ...clean, revealed: true }, NOW + DAY), 'storage');
  assert.equal(storage.getItem('kibitz.repertoireReviews'), raw); assert.equal(store.records.get(key).reviews, 1);
  storage.block(false); assert.equal(store.record(key, { ...clean, revealed: true }, NOW + DAY), null);
  assert.equal(store.records.get(key).reviews, 2);
  assert.equal(storage.getItem('kibitz.games'), 'games'); assert.equal(storage.getItem('kibitz.repertoires'), 'lines');
  assert.equal(createDrillStore(null).record(key, clean, NOW), 'storage');
});

test('corrupt or future-version progress stays untouched and read-only; invalid writes do not overwrite', () => {
  const key = cards()[0].key, record = scheduleDrillReview(null, clean, NOW);
  for (const raw of ['{broken', JSON.stringify({ version: 2, entries: [] }), JSON.stringify({ version: 1, entries: [[key, { ...record, due: -1 }]] }), JSON.stringify({ version: 1, entries: [[key, record], [key, record]] })]) {
    const storage = memory(); storage.setItem('kibitz.repertoireReviews', raw);
    const store = createDrillStore(storage);
    assert.equal(store.unreadable, true); assert.equal(store.record(key, clean, NOW), 'unreadable');
    assert.equal(storage.getItem('kibitz.repertoireReviews'), raw);
  }
  const store = createDrillStore(memory());
  assert.equal(store.record('', clean, NOW), 'invalid'); assert.equal(store.records.size, 0);
});
