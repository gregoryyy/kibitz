// Catalogue browsing only (TODO 6.1); the lesson player and grading are separate consumers.
import { TAG_LABELS } from '../chess/knowledge.js';
import { curriculumModules, lessonText } from './curriculum.js';
import { translator } from '../platform/i18n.js';

/**
 * Render authored text literally. This panel owns its filters and never changes a game,
 * starts engine/model work, stores progress or treats a prerequisite as a progress lock.
 * @param {HTMLElement} root Catalogue container.
 * @param {import('./curriculum.js').Curriculum} catalogue Validated, detached records.
 * @param {{language?: string, level?: number, t?: (text: string, vars?: object) => string, onOpen?: (lessonId: string, exerciseId: string) => void}} [options]
 */
export function createCurriculumPanel(root, catalogue, { language = 'en', level = 4, t: translate, onOpen } = {}) {
  const doc = root.ownerDocument;
  const fallback = translator({});
  /** @type {(text: string, vars?: object) => string} */
  const t = translate || ((text, vars) => fallback.t(text, vars));
  /**
   * @template {keyof HTMLElementTagNameMap} T
   * @param {T} tag Element name.
   * @param {Record<string, string|number>} attrs Literal attributes.
   * @param {...(string|Node|(string|Node)[])} children Safe text or elements.
   */
  const el = (tag, attrs = {}, ...children) => {
    const node = doc.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    for (const child of children.flat()) node.append(typeof child === 'string' ? doc.createTextNode(child) : child);
    return node;
  };
  const prose = (tag, value) => el(tag, { translate: 'no' }, lessonText(value, language));
  const maximum = el('select', { id: 'curriculumLevel' }, ...['Beginner', 'Club', 'Advanced', 'Expert'].map((name, i) => el('option', { value: i + 1 }, name)));
  maximum.value = String([1, 2, 3, 4].includes(Number(level)) ? Number(level) : 2);
  const theme = el('select', { id: 'curriculumTheme' }, el('option', { value: '' }, 'All themes'), ...[...new Set(catalogue.modules.flatMap(m => m.lessons.flatMap(l => [...l.tags, ...l.exercises.flatMap(e => e.tags)])))].map(tag => el('option', { value: tag }, TAG_LABELS[tag])));
  const module = el('select', { id: 'curriculumModule' }, el('option', { value: '' }, 'All modules'), ...catalogue.modules.map(m => el('option', { value: m.id, translate: 'no' }, lessonText(m.title, language))));
  const list = el('div', { id: 'curriculumList' }), status = el('p', { id: 'curriculumStatus', class: 'hint', role: 'status', translate: 'no' });
  root.replaceChildren(el('div', { class: 'curriculum-filters' },
    el('label', {}, el('span', {}, 'Up to level'), maximum),
    el('label', {}, el('span', {}, 'Theme'), theme),
    el('label', {}, el('span', {}, 'Module'), module)), status, list);
  /** @type {Map<string, import('./curriculum.js').Lesson>} */
  const lessons = new Map();
  for (const m of catalogue.modules) for (const l of m.lessons) lessons.set(l.id, l);
  /** @param {import('./curriculum.js').Exercise} exercise */
  function exerciseCard(exercise, lessonId) {
    const row = el('li', { 'data-exercise-id': exercise.id }, prose('strong', exercise.title), prose('p', exercise.prompt));
    const evidence = exercise.tablebase;
    if (evidence?.checkedAt) {
      const result = { 'white-win': 'White wins', 'black-win': 'Black wins', draw: 'Draw' }[evidence.outcome];
      row.append(el('p', { class: 'hint tablebase-evidence', translate: 'no', 'data-outcome': evidence.outcome },
        t('Syzygy: {result} · checked {date}', { result: t(result), date: evidence.checkedAt.slice(0, 10) })),
      el('p', { class: 'hint' }, 'Checked for this position and recorded line.'));
    }
    if (exercise.puzzle) {
      const p = exercise.puzzle;
      row.append(el('p', { class: 'hint puzzle-source' },
        el('span', { translate: 'no' }, t('Lichess rating: {rating} ±{deviation}', { rating: p.rating, deviation: p.ratingDeviation })), ' · ',
        el('span', { translate: 'no' }, 'CC0-1.0'), ' · ',
        el('a', { href: p.url, target: '_blank', rel: 'noopener noreferrer' }, 'Open source puzzle'), ' · ',
        el('a', { href: p.gameUrl, target: '_blank', rel: 'noopener noreferrer' }, 'Source game')),
      el('p', { class: 'hint puzzle-themes' }, el('span', {}, 'Source themes:'), ' ', el('span', { translate: 'no' }, p.themes.join(', '))));
    }
    if (onOpen) {
      const open = el('button', { type: 'button', class: 'btn', 'data-open-exercise': exercise.id }, 'Open exercise');
      open.addEventListener('click', () => onOpen(lessonId, exercise.id)); row.append(open);
    }
    return row;
  }
  function render() {
    const modules = curriculumModules(catalogue, { level: Number(maximum.value), theme: theme.value, module: module.value });
    const count = modules.reduce((n, m) => n + m.lessons.length, 0);
    status.textContent = count ? t(count === 1 ? '1 lesson' : '{n} lessons', { n: count }) : t('No lessons match these filters.');
    list.replaceChildren(...modules.map(m => {
      const section = el('section', { class: 'curriculum-module', 'data-module-id': m.id }, prose('h3', m.title));
      for (const l of m.lessons) {
        const details = el('details', { class: 'curriculum-lesson', 'data-lesson-id': l.id },
          el('summary', {}, prose('span', l.title), ' · ', el('span', { translate: 'no' }, t(['', 'Beginner', 'Club', 'Advanced', 'Expert'][l.level]))),
          prose('p', l.introduction), el('h4', {}, 'Learning goals'), el('ul', {}, ...l.objectives.map(o => prose('li', o))));
        if (l.prerequisites.length) details.append(el('p', {}, el('span', {}, 'Before this lesson:'), ' ', el('span', { translate: 'no' }, l.prerequisites.map(id => lessonText(lessons.get(id).title, language)).join(', '))));
        details.append(el('h4', { translate: 'no' }, t(l.exercises.length === 1 ? '1 exercise' : '{n} exercises', { n: l.exercises.length })), el('ol', {}, ...l.exercises.map(e => exerciseCard(e, l.id))));
        section.append(details);
      }
      return section;
    }));
    list.append(el('p', { class: 'hint', translate: 'no' }, `${lessonText(catalogue.source.title, language)} · ${catalogue.source.author} · ${catalogue.source.licence}`));
  }
  for (const select of [maximum, theme, module]) select.addEventListener('change', render);
  render();
}
