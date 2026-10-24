// Lesson exercise state (TODO 6.6). No DOM, storage, engine, model or shared board state.
import { checkStart } from '../chess/play.js';
import { practiceMove, practiceDestinations } from '../chess/practice.js';
import { playLine } from '../coach/annotations.js';

/**
 * @typedef {object} LessonSession
 * @property {import('./curriculum.js').Exercise} exercise Detached validated record.
 * @property {import('../coach/annotations.js').ChessLine} example Rules-checked worked branch.
 * @property {'mate'|'recorded-line'|'reflection'} type What this exercise can actually establish.
 * @property {string} learner Root side to move.
 * @property {string} fen Current exercise position.
 * @property {number} ply Next recorded ply to recall.
 * @property {string[]} played Accepted UCI moves and recorded opponent replies.
 * @property {number} attempts Legal submitted choices, including choices outside the reference.
 * @property {number} outside Choices outside the reference; not a chess-strength verdict.
 * @property {number} hints Hints requested.
 * @property {number} hintStage Hints shown for the current position.
 * @property {boolean} worked The worked example has been viewed.
 * @property {boolean} revealed The complete example/rubric has been revealed.
 * @property {boolean} complete An exercise outcome has been recorded in this session.
 * @property {'mate'|'recorded-line'|'reflection'|'revealed'|null} result
 * @property {string} response Written reflection, for literal display only.
 * @property {'met'|'practice'|null} assessment Learner's self-assessment, not an automatic grade.
 */

/**
 * The catalogue establishes content/source validity. Check the playable boundary again so
 * the UI cannot start a broken exercise. A mate goal never implies a unique mating move.
 * @param {import('../coach/tutor.js').ChessConstructor} Chess
 * @param {import('./curriculum.js').Exercise} exercise
 * @returns {LessonSession}
 */
export function startLessonSession(Chess, exercise) {
  const data = structuredClone(exercise), position = checkStart(Chess, data.fen);
  const example = !position.error && playLine(Chess, position.fen, data.line);
  if (!example?.ucis.length || example.ucis.length !== data.line.length) throw new Error('Invalid lesson exercise');
  const replay = new Chess(position.fen);
  for (const uci of example.ucis) {
    if (replay.isGameOver()) throw new Error('Lesson line continues after game end');
    replay.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  }
  if (data.goal === 'mate') {
    const end = new Chess(example.fens.at(-1));
    if (!end.isCheckmate() || end.turn() === new Chess(position.fen).turn()) throw new Error('Invalid lesson mate');
  } else if (data.goal !== 'reflection') throw new Error('Invalid lesson goal');
  return { exercise: data, example, type: data.goal === 'mate' ? 'mate' : data.puzzle ? 'recorded-line' : 'reflection',
    learner: new Chess(position.fen).turn(), fen: position.fen, ply: 0, played: [], attempts: 0, outside: 0,
    hints: 0, hintStage: 0, worked: false, revealed: false, complete: false, result: null, response: '', assessment: null };
}

/** @typedef {{from: string, to: string, choices: string[]}} LessonPromotion */
/**
 * @param {import('../coach/tutor.js').ChessConstructor} Chess
 * @param {LessonSession} session
 * @param {string} input SAN or UCI; promotion choice must be explicit.
 * @param {string} [language]
 * @returns {{state: LessonSession, kind: 'invalid'|'outside'|'not-mate'|'advance'|'complete'|'inactive'|'promotion', promotion?: LessonPromotion, san?: string}}
 */
export function submitLessonMove(Chess, session, input, language = 'en') {
  if (session.complete || session.type === 'reflection') return { state: session, kind: 'inactive' };
  const intent = practiceMove(Chess, session.fen, input, language);
  if (intent.kind === 'invalid') return { state: session, kind: 'invalid' };
  if (intent.kind === 'promotion') return { state: session, kind: 'promotion', promotion: intent.promotion };
  const move = intent.move, c = new Chess(session.fen);
  const uci = move.from + move.to + (move.promotion || ''), next = structuredClone(session);
  next.attempts++;
  c.move({ from: move.from, to: move.to, promotion: move.promotion });
  // A legal actual checkmate is sufficient, even if it differs from the recorded solution.
  if (c.isCheckmate() && c.turn() !== session.learner) {
    next.fen = c.fen(); next.played.push(uci); next.complete = true; next.result = 'mate';
    return { state: next, kind: 'complete', san: move.san };
  }
  if (uci !== session.example.ucis[session.ply]) {
    next.outside++; return { state: next, kind: session.type === 'mate' && session.example.ucis.length === 1 ? 'not-mate' : 'outside', san: move.san };
  }
  next.played.push(uci); next.ply++;
  // One recorded opponent reply, never a fresh engine/model recommendation.
  if (next.ply < next.example.ucis.length && c.turn() !== next.learner) {
    const reply = next.example.ucis[next.ply++];
    c.move({ from: reply.slice(0, 2), to: reply.slice(2, 4), promotion: reply[4] }); next.played.push(reply);
  }
  next.fen = c.fen(); next.hintStage = 0;
  if (next.ply === next.example.ucis.length) {
    next.complete = true; next.result = next.type === 'mate' ? 'mate' : 'recorded-line';
  }
  return { state: next, kind: next.complete ? 'complete' : 'advance', san: move.san };
}

/** Legal destinations for the isolated exercise board; no premoves or free dragging. */
export function lessonDestinations(/** @type {import('../coach/tutor.js').ChessConstructor} */ Chess, /** @type {string} */ fen) {
  return practiceDestinations(Chess, fen);
}

/** Store a literal bounded response before exposing the reflection rubric; no automatic grade. */
export function submitReflection(/** @type {LessonSession} */ session, /** @type {string} */ response) {
  if (session.type !== 'reflection' || session.complete || typeof response !== 'string' || !response.trim() || response.length > 2000) return null;
  return { ...structuredClone(session), response: response.trim() };
}

/** @returns {LessonSession|null} */
export function assessReflection(/** @type {LessonSession} */ session, /** @type {'met'|'practice'} */ assessment) {
  if (session.type !== 'reflection' || session.complete || !session.response || !['met', 'practice'].includes(assessment)) return null;
  return { ...structuredClone(session), complete: true, result: 'reflection', assessment };
}

/** Reveal completes a viewed example, never a successful solve. */
export function revealLesson(/** @type {LessonSession} */ session) {
  if (session.complete) return session;
  return { ...structuredClone(session), revealed: true, complete: true, result: /** @type {const} */ ('revealed'), fen: session.example.fens.at(-1) };
}
