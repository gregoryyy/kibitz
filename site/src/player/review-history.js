// Current-library review trends. Counts describe recorded evidence, not a learner diagnosis.
import { TAG_LABELS } from '../chess/knowledge.js';

export function renderReviewHistory(root, summary, { allowed, onOpen, t }) {
  const node = (tag, text, raw = false) => { const n = document.createElement(tag); n.textContent = raw ? text : t(text); n.setAttribute('translate', 'no'); return n; };
  root.replaceChildren(node('h3', 'Review trends'));
  if (!allowed) { root.append(node('p', 'Review trends are hidden while you play with restricted help.')); return; }
  root.append(node('p', 'Your own reviewed games in this library. Phases are estimates; themes describe checked engine opportunities.'),
    node('p', t('Reviewed games: {g}. Measured player moves: {m}/{n}.', { g: summary.games, m: summary.measured, n: summary.ownMoves }), true));
  if (summary.ignored > summary.unsupported) root.append(node('p', 'Some saved reviews lack compatible evidence. Re-run their review to include them.'));
  if (summary.unsupported) root.append(node('p', 'Some review formats are unsupported and have been kept unchanged.'));
  if (!summary.measured) { root.append(node('p', 'Review your own played games to build this history.')); return; }
  const table = node('table', ''); table.className = 'counts';
  const head = node('tr', ''); for (const title of ['Phase', 'Measured moves', 'Mistakes / blunders', 'Inaccuracies', 'Average accuracy']) head.append(node('th', title));
  const thead = node('thead', ''); thead.append(head); const body = node('tbody', '');
  for (const [phase, data] of Object.entries(summary.phases)) {
    const row = node('tr', ''); row.dataset.reviewPhase = phase;
    for (const [i, value] of [TAG_LABELS[phase], data.measured, data.errors, data.inaccuracies, data.accuracy === null ? '–' : `${Math.round(data.accuracy)}%`].entries()) row.append(node(i ? 'td' : 'th', String(value), !!i));
    body.append(row);
  }
  table.append(thead, body); const wrap = node('div', ''); wrap.style.overflowX = 'auto'; wrap.append(table); root.append(wrap);
  root.append(node('p', t('Tactical checks: {n}. Confirmed opportunities: {c}.', { n: summary.checkedThemes, c: summary.confirmed }), true),
    node('p', 'Unverified cases are not counted as absence. These counts do not establish why you made a mistake.'));
  const themes = node('ul', '');
  for (const [tag, count] of [...summary.themes].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) themes.append(node('li', `${t(TAG_LABELS[tag])}: ${count}`, true));
  root.append(themes);
  for (const sample of summary.samples.slice().sort((a, b) => b.decision.drop - a.decision.drop).slice(0, 6)) {
    const card = node('article', ''); card.className = 'study-hit'; card.dataset.reviewGame = sample.g.id;
    card.append(node('h4', String(sample.g.title || [sample.g.white, sample.g.black].filter(Boolean).join(' – ')).slice(0, 240), true),
      node('p', sample.playedLabel, true), node('p', sample.decision.motif.proof.tags.map(tag => t(TAG_LABELS[tag])).join(' · '), true),
      node('p', 'Recorded checked continuation'), node('p', sample.line.join(' '), true));
    const button = node('button', 'Open reviewed opportunity'); button.type = 'button'; button.className = 'btn small'; button.addEventListener('click', () => onOpen(sample)); card.append(button); root.append(card);
  }
}
