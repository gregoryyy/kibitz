import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { CURRICULUM } from '../../src/curriculum/catalogue.js';
import { compileCurriculum, curriculumModules, lessonText } from '../../src/curriculum/curriculum.js';

const first = data => data.modules[0].lessons[0];
const invalid = (change, reason) => {
  const data = structuredClone(CURRICULUM); change(data);
  assert.throws(() => compileCurriculum(Chess, data), reason);
};

test('authored modules contain stable lesson/exercise IDs, bilingual goals, sources and legal positions', () => {
  const data = compileCurriculum(Chess, CURRICULUM);
  assert.deepEqual(data.modules.map(m => m.id), ['tactics', 'strategy', 'endgames']);
  assert.equal(data.source.licence, 'GPL-3.0-or-later');
  assert.equal(data.modules.flatMap(m => m.lessons).length, 3);
  assert.equal(data.modules.flatMap(m => m.lessons.flatMap(l => l.exercises)).length, 5);
  assert.equal(lessonText(first(data).title, 'de'), 'Ein gefangener König auf der Grundreihe');
  assert.equal(lessonText(first(data).title, 'fr'), first(data).title.en);
  for (const m of data.modules) for (const l of m.lessons) for (const e of l.exercises) {
    const c = new Chess(e.fen), learner = c.turn();
    for (const uci of e.line) c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    if (e.goal === 'mate') { assert.equal(c.isCheckmate(), true); assert.notEqual(c.turn(), learner); }
  }
  first(data).title.en = 'changed'; assert.notEqual(first(CURRICULUM).title.en, 'changed');
});

test('level ceilings and themes filter exercises and remove empty lessons/modules without mutating records', () => {
  const data = compileCurriculum(Chess, CURRICULUM);
  assert.deepEqual(curriculumModules(data, { level: 1 }).map(m => m.id), ['tactics', 'endgames']);
  assert.deepEqual(curriculumModules(data, { theme: 'planning' }).map(m => m.id), ['strategy']);
  assert.equal(curriculumModules(data, { module: 'strategy', level: 1 }).length, 0);
  assert.equal(curriculumModules(data, { module: 'missing' }).length, 0);
  const selected = curriculumModules(data, { theme: 'back-rank' });
  selected[0].lessons[0].exercises.pop(); assert.equal(first(data).exercises.length, 2);
  assert.throws(() => curriculumModules(data, { level: 0 }), /filter/);
  assert.throws(() => curriculumModules(data, { theme: '<img>' }), /filter/);
});

test('invalid schemas, missing/duplicate IDs, absent translations and out-of-range levels are rejected', () => {
  invalid(d => { d.version = 2; }, /version/);
  invalid(d => { delete d.modules[0].id; }, /module id/);
  invalid(d => { d.modules.push(d.modules[0]); }, /module id/);
  invalid(d => { d.modules[1].lessons[0].id = first(d).id; }, /lesson id/);
  invalid(d => { first(d).exercises.push(first(d).exercises[0]); }, /exercise id/);
  invalid(d => { delete first(d).title.de; }, /lesson metadata/);
  invalid(d => { first(d).level = 5; }, /lesson metadata/);
  invalid(d => { first(d).tags = ['invented']; }, /lesson metadata/);
  invalid(d => { first(d).objectives = []; }, /objectives/);
  invalid(d => { first(d).exercises[0].rubric = []; }, /rubric/);
  invalid(d => { d.source.licence = ''; }, /source/);
});

test('prerequisites must exist, respect levels and form an acyclic graph', () => {
  invalid(d => { first(d).prerequisites = ['missing']; }, /prerequisite/);
  invalid(d => { first(d).prerequisites = ['active-king']; }, /higher-level/);
  invalid(d => { first(d).prerequisites = ['queen-and-king-mate']; }, /cyclic/);
  invalid(d => { first(d).prerequisites = [first(d).id]; }, /cyclic/);
});

test('illegal positions/lines and unsupported mate claims fail; stale castling rights are normalized before replay', () => {
  invalid(d => { first(d).exercises[0].fen = 'bad FEN'; }, /position/);
  invalid(d => { first(d).exercises[0].line = ['a1a8']; }, /illegal exercise line/);
  invalid(d => { first(d).exercises[0].line = ['e1e7']; }, /mate is not established/);
  invalid(d => { first(d).exercises[0].line = Array(41).fill('e1e8'); }, /exercise line/);
  invalid(d => { first(d).exercises[0].goal = 'win'; }, /exercise goal/);
  const data = structuredClone(CURRICULUM), exercise = first(data).exercises[0];
  exercise.fen = '4k3/8/8/8/8/8/8/4K2R w KQ - 0 1'; exercise.goal = 'reflection'; exercise.line = ['e1g1'];
  assert.equal(first(compileCurriculum(Chess, data)).exercises[0].fen.split(' ')[2], 'K');
  exercise.line = ['e1c1']; assert.throws(() => compileCurriculum(Chess, data), /illegal exercise line/);
});
