// The settings form owns drafts; the store owns acknowledged preferences and revisions.
import { RATING_POOLS, RATING_CONTROLS } from './profile.js';

export function createProfilePanel(root, { store, onChange, t }) {
  const field = name => root.querySelector(`[data-profile="${name}"]`);
  const controls = ['rating', 'pool', 'timeControl', 'goals'].map(field), message = field('message');
  let baseRevision = store.revision, dirty = false;
  for (const [name, choices] of [['pool', RATING_POOLS], ['timeControl', RATING_CONTROLS]]) for (const [value, label] of Object.entries(choices)) {
    const option = document.createElement('option'); option.value = value; option.textContent = t(label); option.setAttribute('translate', 'no'); field(name).append(option);
  }
  const say = text => { message.textContent = t(text); };
  const buttons = () => {
    for (const button of root.querySelectorAll('#optLevel button')) { button.setAttribute('aria-pressed', String(+button.dataset.v === store.value.level)); button.disabled = store.unreadable; }
    for (const control of [...controls, field('save')]) control.disabled = store.unreadable;
  };
  const populate = () => {
    const profile = store.value;
    field('rating').value = profile.rating.value === null ? '' : String(profile.rating.value);
    field('pool').value = profile.rating.pool; field('timeControl').value = profile.rating.timeControl; field('goals').value = profile.goals;
    dirty = false; baseRevision = store.revision; buttons();
    say(store.unreadable ? 'The saved profile cannot be read. It has been kept without changes.' : '');
  };
  const result = status => {
    say({ saved: 'Profile saved in this browser.', invalid: 'Check the rating and use at most 500 characters for goals.', unavailable: 'The profile could not be saved. Your draft is still here.', conflict: 'The profile changed in another tab. Reload the profile before saving.' }[status]);
    buttons();
  };
  root.querySelector('#optLevel').addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button || button.disabled) return;
    const status = store.save({ ...store.value, level: +button.dataset.v }, dirty ? baseRevision : store.revision);
    if (status === 'saved') { baseRevision = store.revision; onChange(store.value); }
    result(status);
  });
  for (const control of controls) control.addEventListener('input', () => { dirty = true; });
  field('form').addEventListener('submit', event => {
    event.preventDefault();
    const raw = field('rating').value.trim(), value = raw === '' ? null : /^\d{1,4}$/.test(raw) ? +raw : NaN;
    const status = store.save({ level: store.value.level, rating: { value, pool: field('pool').value, timeControl: field('timeControl').value, basis: 'self-reported' }, goals: field('goals').value }, baseRevision);
    if (status === 'saved') { populate(); onChange(store.value); }
    result(status);
  });
  field('reload').addEventListener('click', () => { store.reload(); populate(); onChange(store.value); });
  populate();
  return { reload() { store.reload(); onChange(store.value); if (!dirty) populate(); else { buttons(); say('The profile changed in another tab. Reload the profile before saving.'); } } };
}
