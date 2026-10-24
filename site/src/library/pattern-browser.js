// Local pattern browsing; the app owns permission, source freshness and board navigation.
import { TAG_LABELS } from '../chess/knowledge.js';
import { patternMatches } from './patterns.js';

export function createPatternBrowser(root, { state, onOpen, t }) {
  const field = name => root.querySelector(`[data-pattern="${name}"]`);
  const tag = field('tag'), collection = field('collection'), status = field('status'), results = field('results'), message = field('message');
  const node = (type, text, raw = false) => { const n = document.createElement(type); n.textContent = raw ? text : t(text); n.setAttribute('translate', 'no'); return n; };
  for (const [value, label] of Object.entries(TAG_LABELS)) { const option = node('option', label); option.value = value; tag.append(option); }
  const selection = () => [tag.value, collection.value, status.value].join('|');
  const render = () => {
    const captured = state(), selected = selection();
    results.replaceChildren(); message.textContent = '';
    field('controls').hidden = !captured.allowed;
    field('locked').hidden = captured.allowed;
    if (!root.open || !captured.allowed || !captured.visible) return;
    if (!tag.value) { message.textContent = t('Choose a detected pattern.'); return; }
    if (!captured.ready) { message.textContent = t('Indexing source patterns…'); return; }
    const hits = patternMatches(captured.index, { tag: tag.value, collection: collection.value || undefined, status: status.value || undefined });
    message.textContent = t(hits.length ? 'Showing up to 20 source occurrences.' : 'No matching source patterns.');
    const valid = () => { const now = state(); return root.open && now.allowed && now.visible && now.index === captured.index && now.generation === captured.generation && selection() === selected; };
    for (const hit of hits) {
      const { g, p, pattern } = hit, card = node('article', ''); card.className = 'study-hit';
      card.dataset.patternId = pattern.id; card.dataset.collection = g.collection; card.dataset.gameId = g.id; card.dataset.ply = p.ply;
      const title = String(g.title || g.white || 'Source game').slice(0, 240);
      card.append(node('h4', g.collection === 'classic' ? t(title) : title, true),
        node('p', TAG_LABELS[pattern.tag]), node('p', pattern.role === 'position' ? 'Position theme' : 'Recorded move pattern'),
        node('p', { rules: 'Rules-checked fact', candidate: 'Pattern candidate; payoff unverified', heuristic: 'Position heuristic; plan unverified' }[pattern.status]),
        node('p', pattern.labels.length ? pattern.labels.join(' ') : p.ply ? p.label : 'Starting position', !!(pattern.labels.length || p.ply)));
      const button = node('button', 'Open source position'); button.className = 'btn small'; button.type = 'button';
      button.addEventListener('click', () => { if (valid()) onOpen(hit, valid); }); card.append(button); results.append(card);
    }
  };
  for (const control of [tag, collection, status]) control.addEventListener('change', render);
  root.addEventListener('toggle', render);
  return { render };
}
