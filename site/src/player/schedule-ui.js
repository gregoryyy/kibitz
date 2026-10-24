// A bounded, source-bound queue. Each board's existing player owns grading and saving.
import { practiceQueue, scheduleCardKey } from './schedule.js';
const BASES = { mate: 'Mate verified by rules', 'recorded-line': 'Recorded line recalled', 'reflection-met': 'Self-assessed: met',
  'reflection-practice': 'Self-assessed: more practice', 'engine-target': 'Engine target reached', 'rules-mate': 'Mate verified by rules', revealed: 'Example revealed' };

export function createPracticePanel(root, { state, onOpen, onRetry, language = 'en', t }) {
  const doc = root.ownerDocument;
  let version = 0;
  const el = (tag, label = '', raw = false) => { const n = doc.createElement(tag); n.textContent = raw ? label : t(label); n.setAttribute('translate', 'no'); return n; };
  root.setAttribute('translate', 'no'); root.setAttribute('data-raw', '');
  root.append(el('h3', 'Spaced practice'), el('p', 'Due reviews come first, then new exercises. Up to 20 items are shown. Intervals reflect practice results, not measured ability.'));
  const controls = el('div'); controls.className = 'row'; controls.style.flexWrap = 'wrap';
  const label = el('label', 'Practice type'), type = el('select'); type.id = 'practiceType';
  for (const [value, title] of [['', 'All practice'], ['lesson', 'Lessons'], ['opening', 'Opening recalls'], ['own', 'Own mistakes']]) { const option = el('option', title); option.value = value; type.append(option); }
  label.append(' ', type);
  const freshLabel = el('label'), fresh = el('input'); fresh.type = 'checkbox'; fresh.id = 'practiceNew'; fresh.checked = true;
  freshLabel.append(fresh, ' ', doc.createTextNode(t('Include new exercises')));
  const update = el('button', 'Refresh queue'); update.type = 'button'; update.className = 'btn small'; update.addEventListener('click', refresh);
  controls.append(label, freshLabel, update); root.append(controls);
  const status = el('p'); status.id = 'practiceStatus'; status.setAttribute('role', 'status');
  const retry = el('button', 'Retry practice saves'); retry.id = 'practiceRetry'; retry.type = 'button'; retry.className = 'btn small'; retry.addEventListener('click', onRetry);
  const summary = el('p'); summary.id = 'practiceCounts';
  const list = el('ol'); list.id = 'practiceQueue'; list.style.paddingInlineStart = '1.5em';
  root.append(status, retry, summary, list); type.addEventListener('change', refresh); fresh.addEventListener('change', refresh);
  function refresh() {
    const run = ++version, snapshot = state(), { cards, entries, now, allowed, unreadable, pending } = snapshot;
    retry.hidden = !pending;
    status.textContent = !allowed ? t('Practice queue is hidden while you play with restricted help.')
      : unreadable ? t('Some practice data cannot be read. Its original data is preserved; those reviews are unavailable.')
        : !pending ? t('Practice schedules are saved in this browser.') : '';
    if (pending) status.textContent += (status.textContent ? ' ' : '') + t('Pending practice results: {n}. Retry saving before closing this tab.', { n: pending });
    list.replaceChildren(); summary.textContent = ''; if (!allowed) return;
    const counts = { due: 0, fresh: 0, upcoming: 0 };
    for (const card of cards) {
      if (type.value && card.kind !== type.value) continue;
      const record = card.kind === 'opening' ? card.review : card.fresh ? null : entries.get(scheduleCardKey(card))?.record;
      counts[!record ? 'fresh' : record.due <= now ? 'due' : 'upcoming']++;
    }
    summary.textContent = t('Due: {due} · new: {fresh} · upcoming: {upcoming}', counts);
    const queue = practiceQueue(cards, entries, now, { kind: type.value, includeNew: fresh.checked });
    if (!queue.length) { list.append(el('li', 'No practice is due with these filters.')); return; }
    for (const { card, record, due } of queue) {
      const row = el('li'); row.style.marginBlock = '0.6em'; row.style.overflowWrap = 'anywhere';
      const title = el('span', card.label, true); row.append(title, ' · ', el('span', t({ lesson: 'Lesson', opening: 'Opening recall', own: 'Own mistake' }[card.kind]), true));
      row.append(' · ', el('span', due === null ? t('New') : t('Due {date}', { date: new Date(due).toLocaleString(language) }), true));
      if (record) row.append(' · ', el('span', t('Last result: {basis}', { basis: t(BASES[card.basis] || 'Repertoire recalled') }), true));
      const open = el('button', 'Practise'); open.type = 'button'; open.className = 'btn small'; open.style.marginInlineStart = '0.5em';
      open.dataset.practiceKind = card.kind; open.dataset.practiceId = card.id || card.key;
      open.addEventListener('click', () => { if (run === version && snapshot.current() && state().allowed && !root.closest('[hidden]')) onOpen(card, snapshot.current); });
      row.append(open); list.append(row);
    }
  }
  return { refresh };
}
