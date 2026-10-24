// Curriculum records and queries (TODO 6.1). Pure; rules are injected, never an AI verdict.
import { TAG_LABELS } from '../chess/knowledge.js';
import { checkStart } from '../chess/play.js';
import { playLine } from '../coach/annotations.js';

/** @typedef {{en: string, de: string}} LessonText */
/** @typedef {{id: string, title: LessonText, level: number, tags: string[], prompt: LessonText, fen: string, goal: 'mate'|'reflection', line: string[], rubric: LessonText[]}} Exercise */
/** @typedef {{id: string, title: LessonText, level: number, tags: string[], prerequisites: string[], introduction: LessonText, objectives: LessonText[], exercises: Exercise[]}} Lesson */
/** @typedef {{id: string, title: LessonText, level: number, tags: string[], lessons: Lesson[]}} LessonModule */
/** @typedef {{version: number, source: {title: LessonText, author: string, licence: string}, modules: LessonModule[]}} Curriculum */

export const CURRICULUM_LIMITS = Object.freeze({ modules: 24, lessons: 200, exercises: 2000, line: 40 });
const ID = /^[a-z][a-z0-9-]{0,79}$/;
const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const id = value => typeof value === 'string' && ID.test(value);
const require = (ok, message) => { if (!ok) throw new Error(`Invalid curriculum: ${message}`); };
const text = (s, max) => typeof s === 'string' && s.trim().length > 0 && s.length <= max;
const level = n => Number.isInteger(n) && n >= 1 && n <= 4;
const tags = list => Array.isArray(list) && list.length > 0 && list.length <= 20 && new Set(list).size === list.length && list.every(t => Object.hasOwn(TAG_LABELS, t));
const localized = (s, max) => s && typeof s === 'object' && text(s.en, max) && text(s.de, max);

/** Select authored text; unsupported interface languages fall back to English. */
export function lessonText(/** @type {LessonText} */ value, language = 'en') { return value[language === 'de' ? 'de' : 'en']; }

/**
 * Validate and detach an authored catalogue. IDs are global within each record kind; prerequisite
 * edges must name existing lessons and form a DAG. A recorded line is only a legal example.
 * Mate exercises additionally prove terminal checkmate for the learner's side through chess.js;
 * this does not claim a unique solution. Reflection rubrics are authored guidance, not grading.
 * @param {import('../coach/tutor.js').ChessConstructor} Chess Injected rules implementation.
 * @param {Curriculum} input Authored records, treated as untrusted at this boundary.
 * @returns {Curriculum}
 */
export function compileCurriculum(Chess, input) {
  const data = structuredClone(input);
  require(data?.version === 1, 'version');
  require(localized(data.source?.title, 160) && text(data.source?.author, 160) && text(data.source?.licence, 160), 'source');
  require(Array.isArray(data.modules) && data.modules.length > 0 && data.modules.length <= CURRICULUM_LIMITS.modules, 'modules');
  const moduleIds = new Set(), lessons = new Map(), exerciseIds = new Set();
  for (const module of data.modules) {
    require(module && id(module.id) && !moduleIds.has(module.id), 'module id'); moduleIds.add(module.id);
    require(localized(module.title, 160) && level(module.level) && tags(module.tags), 'module metadata');
    require(Array.isArray(module.lessons) && module.lessons.length > 0, 'lessons');
    for (const lesson of module.lessons) {
      require(lesson && id(lesson.id) && !lessons.has(lesson.id), 'lesson id'); lessons.set(lesson.id, lesson);
      require(lessons.size <= CURRICULUM_LIMITS.lessons, 'lesson limit');
      require(localized(lesson.title, 160) && level(lesson.level) && lesson.level >= module.level && tags(lesson.tags), 'lesson metadata');
      require(localized(lesson.introduction, 4000), 'introduction');
      require(Array.isArray(lesson.objectives) && lesson.objectives.length > 0 && lesson.objectives.length <= 8 && lesson.objectives.every(o => localized(o, 500)), 'objectives');
      require(Array.isArray(lesson.prerequisites) && lesson.prerequisites.length <= 20 && new Set(lesson.prerequisites).size === lesson.prerequisites.length, 'prerequisites');
      require(Array.isArray(lesson.exercises) && lesson.exercises.length > 0, 'exercises');
      for (const e of lesson.exercises) {
        require(e && id(e.id) && !exerciseIds.has(e.id), 'exercise id'); exerciseIds.add(e.id);
        require(exerciseIds.size <= CURRICULUM_LIMITS.exercises, 'exercise limit');
        require(localized(e.title, 160) && level(e.level) && e.level >= lesson.level && tags(e.tags) && localized(e.prompt, 1000), 'exercise metadata');
        require(['mate', 'reflection'].includes(e.goal), 'exercise goal');
        require(Array.isArray(e.rubric) && e.rubric.length > 0 && e.rubric.length <= 8 && e.rubric.every(r => localized(r, 500)), 'rubric');
        require(typeof e.fen === 'string' && e.fen.length < 150, 'exercise position');
        const position = checkStart(Chess, e.fen);
        require(!position.error, 'exercise position'); e.fen = position.fen;
        require(Array.isArray(e.line) && e.line.length > 0 && e.line.length <= CURRICULUM_LIMITS.line && e.line.every(m => UCI.test(m)), 'exercise line');
        const line = playLine(Chess, e.fen, e.line);
        require(line && line.ucis.length === e.line.length, 'illegal exercise line');
        if (e.goal === 'mate') {
          const end = new Chess(line.fens.at(-1));
          require(end.isCheckmate() && end.turn() !== new Chess(e.fen).turn(), 'mate is not established for the learner');
        }
      }
    }
  }
  const complete = new Set(), visiting = new Set();
  function visit(id) {
    require(!visiting.has(id), 'cyclic prerequisites');
    if (complete.has(id)) return;
    visiting.add(id);
    const lesson = lessons.get(id);
    for (const prerequisite of lesson.prerequisites) {
      require(lessons.has(prerequisite) && lessons.get(prerequisite).level <= lesson.level, 'unknown or higher-level prerequisite');
      visit(prerequisite);
    }
    visiting.delete(id); complete.add(id);
  }
  for (const id of lessons.keys()) visit(id);
  return data;
}

/**
 * Filter the hierarchy without changing its IDs/order or mutating the validated catalogue.
 * A level is a ceiling, so earlier foundations remain available; themes match lesson/exercise
 * tags rather than admitting unrelated lessons just because their parent module has that tag.
 * @param {Curriculum} catalogue Validated records.
 * @param {{level?: number, theme?: string, module?: string}} [options]
 * @returns {LessonModule[]}
 */
export function curriculumModules(catalogue, { level: maximum = 4, theme = '', module: moduleId = '' } = {}) {
  require(level(maximum) && (theme === '' || Object.hasOwn(TAG_LABELS, theme)), 'filter');
  return structuredClone(catalogue.modules.filter(m => !moduleId || m.id === moduleId).map(m => ({ ...m,
    lessons: m.lessons.filter(l => l.level <= maximum).map(l => ({ ...l,
      exercises: l.exercises.filter(e => e.level <= maximum && (!theme || l.tags.includes(theme) || e.tags.includes(theme))),
    })).filter(l => l.exercises.length),
  })).filter(m => m.lessons.length));
}
