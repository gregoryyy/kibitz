import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { CURRICULUM } from '../../src/curriculum/catalogue.js';
import { compileCurriculum } from '../../src/curriculum/curriculum.js';
import { PUZZLES } from '../../src/curriculum/puzzle-data.js';
import { compilePuzzle } from '../../src/curriculum/puzzles.js';
import { startLessonSession, submitLessonMove, lessonDestinations, submitReflection, assessReflection, revealLesson } from '../../src/curriculum/session.js';

const catalogue = compileCurriculum(Chess, CURRICULUM);
const exercises = catalogue.modules.flatMap(m => m.lessons.flatMap(l => l.exercises));
const exercise = id => exercises.find(e => e.id === id);

test('all 100 catalogue exercises start as detached sessions with their exact learner FEN and evidence type', () => {
  assert.equal(exercises.length, 100);
  for (const e of exercises) {
    const session = startLessonSession(Chess, e);
    assert.equal(session.fen, e.fen); assert.equal(session.learner, new Chess(e.fen).turn());
    assert.equal(session.type, e.goal === 'mate' ? 'mate' : e.puzzle ? 'recorded-line' : 'reflection');
    assert.equal(session.complete, false); session.exercise.title.en = 'changed'; assert.notEqual(e.title.en, 'changed');
  }
  const session = startLessonSession(Chess, exercise('queen-mate-white'));
  assert.ok(lessonDestinations(Chess, session.fen).get('g6').includes('g7'));
});

test('mate exercises accept every actual mate, reject illegal input and distinguish legal non-mates without moving the position', () => {
  const e = { ...structuredClone(exercise('queen-mate-white')), fen: '7k/5K2/6Q1/8/8/8/8/8 w - - 0 1', line: ['g6g7'] };
  const session = startLessonSession(Chess, e), original = structuredClone(session);
  const invalid = submitLessonMove(Chess, session, 'not a move'); assert.equal(invalid.kind, 'invalid'); assert.equal(invalid.state, session);
  const miss = submitLessonMove(Chess, session, 'Qg1'); assert.equal(miss.kind, 'not-mate'); assert.equal(miss.state.fen, session.fen); assert.equal(miss.state.outside, 1);
  const alternate = submitLessonMove(Chess, session, 'Qg8#');
  assert.equal(alternate.kind, 'complete'); assert.equal(alternate.state.result, 'mate'); assert.equal(new Chess(alternate.state.fen).isCheckmate(), true);
  assert.deepEqual(alternate.state.played, ['g6g8']); assert.deepEqual(session, original);
  assert.equal(submitLessonMove(Chess, alternate.state, 'Kh7').kind, 'inactive');
  assert.equal(submitLessonMove(Chess, startLessonSession(Chess, exercise('rook-mate-black')), 'Tf1', 'de').state.result, 'mate');
});

test('source recall follows canonical learner moves and one recorded opponent reply; outside legal choices have no strength grade', () => {
  const e = exercises.find(e => e.puzzle?.id === '00008'); let session = startLessonSession(Chess, e);
  const choice = new Chess(session.fen).moves({ verbose: true }).find(m => m.from + m.to !== e.line[0] && !m.san.endsWith('#'));
  const outside = submitLessonMove(Chess, session, choice.san);
  assert.equal(outside.kind, 'outside'); assert.equal(outside.state.fen, session.fen); assert.equal(outside.state.attempts, 1); assert.equal(outside.state.complete, false);
  session = outside.state;
  for (let i = 0; i < e.line.length; i += 2) {
    const result = submitLessonMove(Chess, session, e.line[i]); session = result.state;
    assert.equal(result.kind, i + 2 >= e.line.length ? 'complete' : 'advance');
    assert.deepEqual(session.played, e.line.slice(0, i + 2));
  }
  assert.equal(session.result, 'recorded-line'); assert.equal(session.outside, 1); assert.equal(session.attempts, 4);
  assert.equal(session.learner, 'w'); assert.match(e.fen, / 0 25$/);
});

test('typed and board promotions request an explicit piece; a recorded underpromotion is retained', () => {
  const p = compilePuzzle(Chess, { ...structuredClone(PUZZLES[0]), id: 'abc12', sourceFen: '7k/P7/8/8/8/8/8/6K1 b - - 0 1', moves: ['h8g7', 'a7a8n'], themes: ['promotion'] });
  const e = { ...structuredClone(exercise('king-route-reflection')), fen: p.fen, line: p.line, puzzle: p };
  const session = startLessonSession(Chess, e);
  for (const input of ['a8', 'a7a8']) {
    const result = submitLessonMove(Chess, session, input);
    assert.equal(result.kind, 'promotion'); assert.deepEqual(new Set(result.promotion.choices), new Set(['q', 'r', 'b', 'n']));
    assert.equal(result.state, session); assert.equal(result.state.attempts, 0);
  }
  const result = submitLessonMove(Chess, session, 'a7a8n');
  assert.equal(result.kind, 'complete'); assert.equal(new Chess(result.state.fen).get('a8').type, 'n'); assert.equal(result.state.result, 'recorded-line');
});

test('reflections require a bounded written answer and explicit self-assessment; revealing is never a solve', () => {
  const session = startLessonSession(Chess, exercise('king-route-reflection'));
  assert.equal(submitLessonMove(Chess, session, 'Ke4').kind, 'inactive');
  assert.equal(assessReflection(session, 'met'), null); assert.equal(submitReflection(session, ' '), null); assert.equal(submitReflection(session, 'x'.repeat(2001)), null);
  const answer = '<img src=x onerror=alert(1)> Consider the opponent’s pawn race.';
  const compare = submitReflection(session, answer); assert.equal(compare.response, answer); assert.equal(compare.complete, false);
  const result = assessReflection(compare, 'practice'); assert.equal(result.result, 'reflection'); assert.equal(result.assessment, 'practice'); assert.equal(result.complete, true);
  assert.equal(assessReflection(result, 'met'), null); assert.equal(session.response, '');
  const revealed = revealLesson(session); assert.equal(revealed.result, 'revealed'); assert.equal(revealed.complete, true); assert.equal(revealed.revealed, true);
  assert.equal(revealed.assessment, null); assert.equal(revealed.attempts, 0);
});

test('broken examples and lines continuing after the automatic fifty-move end cannot start a session', () => {
  const e = structuredClone(exercise('queen-mate-white'));
  assert.throws(() => startLessonSession(Chess, { ...e, line: ['a1a8'] }), /Invalid lesson/);
  assert.throws(() => startLessonSession(Chess, { ...e, goal: 'win' }), /goal/);
  assert.throws(() => startLessonSession(Chess, { ...e, line: ['g6g1'] }), /mate/);
  assert.throws(() => startLessonSession(Chess, { ...e, fen: e.fen.replace(' 0 1', ' 99 1'), line: ['g6g1', 'h8h7', 'g1g7'] }), /after game end/);
});
