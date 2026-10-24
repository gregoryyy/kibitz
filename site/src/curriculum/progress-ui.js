// Progress presentation keeps proof, recall, self-assessment and reveal counts distinct.
import { TAG_LABELS } from '../chess/knowledge.js';
import { lessonText } from './curriculum.js';
import { translator } from '../platform/i18n.js';

/**
 * @param {HTMLElement} root
 * @param {{language?: string, t?: (text: string, vars?: object) => string, onRetry?: () => void}} [options]
 */
export function createLessonProgressPanel(root, { language = 'en', t: translate, onRetry } = {}) {
  const doc = root.ownerDocument, fallback = translator({});
  /** @type {(text: string, vars?: object) => string} */
  const t = translate || ((text, vars) => fallback.t(text, vars));
  const el = (tag, attrs = {}, ...children) => {
    const node = doc.createElement(tag); node.setAttribute('data-raw', '');
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    for (const child of children.flat()) node.append(typeof child === 'string' ? doc.createTextNode(child) : child);
    return node;
  };
  root.classList.add('lesson-progress'); root.setAttribute('translate', 'no');
  const status = el('p', { id: 'lessonProgressStatus', role: 'status', class: 'hint', tabindex: '-1' });
  const overview = el('p', { id: 'lessonProgressOverview' });
  const retry = el('button', { id: 'lessonProgressRetry', type: 'button', class: 'btn' }, t('Retry saving progress'));
  retry.addEventListener('click', () => { onRetry?.(); if (!retry.hidden) retry.focus(); else status.focus(); });
  const details = el('details', { id: 'lessonProgressDetails' }, el('summary', {}, t('Progress by lesson and theme')));
  const lessons = el('tbody', { id: 'lessonProgressRows' }), themes = el('tbody', { id: 'themeProgressRows' });
  const table = (caption, body, name) => el('table', { class: 'lesson-progress-table' }, el('caption', {}, t(caption)),
    el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, t(name)), el('th', { scope: 'col' }, t('Practised')), el('th', { scope: 'col' }, t('Results')))), body);
  details.append(table('Lesson results', lessons, 'Lesson'), table('Theme results', themes, 'Theme'));
  const note = el('p', { class: 'hint' }), older = el('p', { class: 'hint', id: 'lessonProgressOlder' });
  root.replaceChildren(el('h3', {}, t('Lesson progress')), status, retry, overview, note, older, details);
  const metrics = record => [
    t('Verified mates: {n}', { n: record.mates }), t('Source recalls: {n}', { n: record.recalls }),
    t('Rubric comparisons: {n}', { n: record.reflections }), t('Examples revealed: {n}', { n: record.reveals }),
  ];
  const resultCell = (record, coach = null) => el('td', {}, ...metrics(record).map(text => el('div', {}, text)),
    ...(record.reflections ? [el('div', {}, t('Self-assessed met: {met}; needs practice: {practice}', { met: record.met, practice: record.practice }))] : []),
    el('div', { class: 'hint' }, t('Unassisted completions: {n}', { n: record.unassisted })),
    ...(record.hints || record.outside ? [el('div', { class: 'hint' }, t('Hints: {hints}; outside reference: {outside}', { hints: record.hints, outside: record.outside }))] : []),
    ...(coach?.tries ? [el('div', { class: 'coach-progress' }, t('Coach challenges: {right}/{tries}', { right: coach.right, tries: coach.tries }))] : []));
  return {
    /**
     * Update existing nodes so expanded details and keyboard focus survive completions.
     * @param {ReturnType<typeof import('./progress.js').summarizeLessonProgress>|null} summary
     * @param {{pending?: number, error?: string|null, unreadable?: boolean}} [state]
     */
    render(summary, { pending = 0, error = null, unreadable = false } = {}) {
      status.textContent = unreadable ? t('Saved lesson progress cannot be read. Its original data is preserved.')
        : pending ? t(pending === 1 ? 'Progress could not be saved. 1 result is waiting in this tab.' : 'Progress could not be saved. {n} results are waiting in this tab.', { n: pending })
          : t('Lesson results are saved in this browser.');
      if (unreadable && pending) status.textContent += ' ' + t(pending === 1 ? '1 result is waiting in this tab.' : '{n} results are waiting in this tab.', { n: pending });
      if (error === 'limit') status.textContent += ' ' + t('The progress store has reached its size limit.');
      retry.hidden = pending === 0;
      overview.hidden = note.hidden = details.hidden = !summary;
      older.hidden = !summary?.older;
      if (!summary) { overview.textContent = ''; lessons.replaceChildren(); themes.replaceChildren(); return; }
      overview.textContent = t('{n} of {total} exercises practised.', { n: summary.overall.practised, total: summary.overall.total }) + ' ' + metrics(summary.overall).join(' · ');
      note.textContent = t('Mates, source recall, self-assessment and revealed examples are counted separately. Coach challenge counters are shown alongside.');
      older.textContent = summary.older ? t('Results for older exercise versions are retained separately.') : '';
      lessons.replaceChildren(...summary.lessons.map(l => el('tr', { 'data-progress-lesson-row': l.id }, el('th', { scope: 'row' }, lessonText(l.title, language)),
        el('td', { class: 'progress-practised' }, `${l.practised}/${l.total}`), resultCell(l))));
      themes.replaceChildren(...summary.themes.map(row => el('tr', { 'data-progress-theme-row': row.tag }, el('th', { scope: 'row' }, t(TAG_LABELS[row.tag])),
        el('td', { class: 'progress-practised' }, row.total ? `${row.practised}/${row.total}` : '—'), resultCell(row, { right: row.coachRight, tries: row.coachTries }))));
    },
  };
}
