import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { CURRICULUM } from '../../src/curriculum/catalogue.js';
import { compileCurriculum, curriculumModules } from '../../src/curriculum/curriculum.js';
import { moveMotifs, lineMotifs } from '../../src/chess/knowledge.js';

const THEMES = ['fork', 'pin', 'skewer', 'discovered-attack', 'double-check', 'deflection', 'decoy', 'overloading', 'interference', 'removing-defender', 'zwischenzug', 'back-rank', 'mate'];
const example = data => data.modules[0].lessons.find(l => l.id === 'knight-forks').exercises[0];

test('every TODO 6.2 theme has an authored bilingual lesson and a rules-checked example', () => {
  const data = compileCurriculum(Chess, CURRICULUM), module = data.modules.find(m => m.id === 'tactics');
  assert.equal(module.lessons.length, 13);
  for (const theme of THEMES) {
    const lesson = module.lessons.find(l => l.tags.includes(theme));
    assert.ok(lesson, theme); assert.ok(lesson.title.en && lesson.title.de);
    const exercises = lesson.exercises.filter(e => e.tags.includes(theme));
    assert.ok(exercises.length, theme);
    assert.ok(exercises.some(e => [...moveMotifs(Chess, e.fen, e.line[0]), ...lineMotifs(Chess, e.fen, e.line).flat()].some(m => m.tag === theme)), theme);
    for (const e of exercises) assert.ok(e.prompt.en && e.prompt.de && e.rubric.every(r => r.en && r.de));
  }
  const combinations = ['deflection', 'overloaded-defenders', 'zwischenzugs', 'decoys'];
  for (const id of combinations) assert.equal(module.lessons.find(l => l.id === id).exercises[0].goal, 'reflection');
});

test('a fork example with a legal capture explicitly disproves the assumption that recognizing a fork wins material', () => {
  const data = compileCurriculum(Chess, CURRICULUM), e = data.modules[0].lessons.find(l => l.id === 'knight-forks').exercises.find(e => e.id === 'fork-can-be-captured');
  const c = new Chess(e.fen); const before = c.board().flat().filter(p => p?.color === 'w').length;
  for (const uci of e.line) c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4) });
  assert.equal(e.goal, 'reflection'); assert.equal(c.get('c7').type, 'r'); assert.equal(c.get('c7').color, 'b');
  assert.equal(c.board().flat().filter(p => p?.color === 'w').length, before - 1);
  assert.match(e.rubric[0].en, /does not prove a material gain/);
});

test('declared motif metadata must be known, tagged and present in the legal example', () => {
  for (const pattern of ['invented', 'pin', '']) {
    const data = structuredClone(CURRICULUM), e = example(data);
    e.pattern = pattern; if (pattern === 'pin') e.tags.push('pin');
    assert.throws(() => compileCurriculum(Chess, data), /pattern/);
  }
  const data = structuredClone(CURRICULUM); example(data).tags = ['calculation'];
  assert.throws(() => compileCurriculum(Chess, data), /pattern metadata/);
});

test('advanced themes remain discoverable at their level and module tags do not admit unrelated lessons', () => {
  const data = compileCurriculum(Chess, CURRICULUM);
  assert.equal(curriculumModules(data, { module: 'tactics', level: 2, theme: 'interference' }).length, 0);
  const modules = curriculumModules(data, { module: 'tactics', level: 3, theme: 'interference' });
  assert.deepEqual(modules.flatMap(m => m.lessons.map(l => l.id)), ['interference']);
  assert.equal(curriculumModules(data, { module: 'tactics', level: 3 })[0].lessons.length, 13);
});
