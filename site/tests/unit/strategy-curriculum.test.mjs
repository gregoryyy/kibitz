import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { CURRICULUM } from '../../src/curriculum/catalogue.js';
import { compileCurriculum, curriculumModules } from '../../src/curriculum/curriculum.js';
import { positionFeatures } from '../../src/chess/knowledge.js';

const record = (data, id) => data.modules.find(m => m.id === 'strategy').lessons.find(l => l.id === id).exercises[0];
const play = e => { const c = new Chess(e.fen); for (const m of e.line) c.move({ from: m.slice(0, 2), to: m.slice(2, 4) }); return c; };

test('strategy lessons cover each requested concept with bilingual reflection rubrics and legal examples', () => {
  const data = compileCurriculum(Chess, CURRICULUM), lessons = data.modules[1].lessons;
  assert.equal(lessons.length, 11);
  for (const tag of ['iqp', 'carlsbad', 'hanging-pawns', 'weak-square', 'outpost', 'bishop-quality', 'open-file', 'king-safety', 'piece-activity', 'prophylaxis', 'king-activity']) {
    const lesson = lessons.find(l => l.tags.includes(tag)); assert.ok(lesson, tag);
    assert.ok(lesson.title.en && lesson.title.de); assert.ok(lesson.introduction.en && lesson.introduction.de);
    for (const e of lesson.exercises) { assert.equal(e.goal, 'reflection'); assert.ok(e.rubric.every(r => r.en && r.de)); play(e); }
  }
  for (const id of ['isolated-queen-pawn', 'carlsbad-plans', 'hanging-pawns']) {
    const e = record(data, id); assert.ok(positionFeatures(new Chess(e.fen)).some(f => f.tag === e.positionTag));
  }
});

test('pawn and outpost examples agree with actual support, capture and exchange relationships', () => {
  const data = compileCurriculum(Chess, CURRICULUM);
  const isolated = play(record(data, 'isolated-queen-pawn'));
  assert.ok(isolated.moves({ verbose: true }).some(m => m.from === 'e6' && m.to === 'd5' && m.captured === 'p'));
  const hanging = play(record(data, 'hanging-pawns'));
  assert.ok(hanging.attackers('c5', 'w').includes('d4')); assert.ok(!hanging.attackers('d5', 'w').includes('c5'));
  const e = record(data, 'outposts'), c = new Chess(e.fen);
  assert.deepEqual(c.attackers('d5', 'b').filter(s => c.get(s).type === 'p'), []);
  assert.ok(c.attackers('d5', 'w').includes('e4'));
  const after = play(e); assert.ok(after.moves({ verbose: true }).some(m => m.from === 'f6' && m.to === 'd5' && m.captured === 'n'));
});

test('bishop colour, open-file, pawn-cover, activity and flight-square claims are checked as board facts', () => {
  const data = compileCurriculum(Chess, CURRICULUM), bishop = record(data, 'good-and-bad-bishops');
  const colour = square => (square.charCodeAt(0) + Number(square[1])) % 2;
  assert.equal(colour('f1'), colour('d3')); assert.equal(colour('f1'), colour('e4'));
  assert.equal(play(bishop).get('h3').type, 'b');
  const open = record(data, 'open-files'), c = new Chess(open.fen);
  assert.ok(c.board().flat().filter(p => p?.type === 'p').every(p => p.square[0] !== 'e'));
  const cover = record(data, 'king-safety'), before = new Chess(cover.fen), after = play(cover);
  assert.ok(before.attackers('f3', 'w').includes('g2')); assert.ok(before.attackers('h3', 'w').includes('g2'));
  assert.ok(after.attackers('f4', 'w').includes('g3')); assert.ok(after.attackers('h4', 'w').includes('g3'));
  const knight = play(record(data, 'piece-activity'));
  for (const sq of ['d5', 'e4', 'a4', 'b5']) assert.ok(knight.attackers(sq, 'w').includes('c3'));
  const prophylaxis = play(record(data, 'prophylaxis'));
  assert.equal(prophylaxis.get('h2'), undefined); assert.equal(prophylaxis.isAttacked('h2', 'b'), false);
});

test('a declared position feature must be known, tagged and present in that exact starting position', () => {
  for (const tag of ['invented', 'carlsbad', '']) {
    const data = structuredClone(CURRICULUM), e = record(data, 'isolated-queen-pawn');
    e.positionTag = tag; if (tag === 'carlsbad') e.tags.push(tag);
    assert.throws(() => compileCurriculum(Chess, data), /position (tag|feature)/);
  }
  const data = structuredClone(CURRICULUM); record(data, 'isolated-queen-pawn').tags = ['planning'];
  assert.throws(() => compileCurriculum(Chess, data), /position tag metadata/);
});

test('strategy theme filtering is precise and advanced hanging-pawn material respects the level ceiling', () => {
  const data = compileCurriculum(Chess, CURRICULUM);
  assert.deepEqual(curriculumModules(data, { theme: 'outpost' }).flatMap(m => m.lessons.map(l => l.id)), ['outposts']);
  assert.equal(curriculumModules(data, { level: 2, theme: 'hanging-pawns' }).length, 0);
  assert.equal(curriculumModules(data, { level: 3, module: 'strategy' })[0].lessons.length, 11);
});
