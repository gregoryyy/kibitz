import { CONSENT_PROVIDERS, CONSENT_PURPOSES } from './privacy.js';
const LABELS = { anthropic: 'Claude (Anthropic)', openai: 'OpenAI', mistral: 'Mistral', ollama: 'Ollama' };
export function createPrivacyPanel(root, { store, onChange, t }) {
  const doc = root.ownerDocument, inputs = [], pending = new Map();
  const el = (tag, text = '') => { const n = doc.createElement(tag); n.textContent = t(text); n.setAttribute('translate', 'no'); return n; };
  root.setAttribute('translate', 'no'); root.setAttribute('data-raw', '');
  root.append(el('h3', 'Privacy and provider permissions'),
    el('p', 'Coach requests can include your question and conversation, selected game or position, engine lines, retrieved comments and references, and your profile goals/rating. Tool results may be sent in follow-up turns.'),
    el('p', 'Embeddings send the passages you select when building an index and your query when searching. They use a separate provider setting and permission; vectors stay in browser memory.'),
    el('p', 'Requests go through the local gateway to the configured provider endpoint. OpenAI/Mistral-compatible endpoints and the Ollama server can be operator-configured. Ask the operator about the destination and its data handling before allowing sharing.'),
    el('p', 'The engine, lessons, keyword search and library do not need a model provider. The in-browser model keeps coach content on this device and has a separate loading consent. Mock mode makes no external model request.'),
    el('p', 'The page can load fonts from Google Fonts unless the server uses offline mode. These font requests carry normal connection metadata, without coach prompts. Local-model mode does not change the operator-configured Ollama endpoint.'),
    el('p', "When usage persistence is enabled, the local server keeps daily request, token and cost totals and recent request times under a hashed browser ID. These export and erase controls leave those counters in place; the local operator manages them."),
    el('p', 'Permissions are saved in this browser. Revoking permission cancels this tab’s pending requests and blocks future requests; it cannot recall data already sent. Provider retention depends on the service/account configuration. Browser/server exports and deletion are available separately in Settings.'));
  for (const provider of CONSENT_PROVIDERS) {
    const group = el('fieldset'); group.style.minWidth = '0'; group.style.marginBlock = '12px'; group.dataset.privacyProvider = provider;
    group.append(el('legend', LABELS[provider]));
    for (const purpose of CONSENT_PURPOSES) {
      const label = el('label'), input = doc.createElement('input'); input.type = 'checkbox'; input.dataset.consentProvider = provider; input.dataset.consentPurpose = purpose;
      label.style.display = 'block'; label.append(input, ' ', doc.createTextNode(t(purpose === 'coach' ? 'Allow coach requests and connection tests' : 'Allow passage and query embeddings'))); group.append(label);
      input.addEventListener('change', () => {
        const wanted = input.checked, result = store.set(provider, purpose, wanted, +input.dataset.revision);
        const key = provider + ':' + purpose;
        if (!wanted && result) pending.set(key, { provider, purpose }); else if (!result) pending.delete(key);
        onChange(); render();
        message.textContent = t(!result ? 'Provider permissions saved in this browser.' : result === 'conflict' ? 'Permissions changed in another tab. Review the current choices and try again.'
          : !wanted ? 'Permission is blocked in this tab, but saving failed. Other tabs or a reload may retain the old permission. Retry before closing this tab.' : 'Permission could not be saved. No new permission was granted.');
      }); inputs.push({ input, provider, purpose });
    }
    root.append(group);
  }
  const message = el('p'); message.id = 'privacyStatus'; message.setAttribute('role', 'status'); root.append(message);
  const retry = el('button', 'Retry permission revocations'); retry.type = 'button'; retry.id = 'privacyRetry'; retry.className = 'btn small'; root.append(retry);
  retry.addEventListener('click', () => {
    for (const [key, choice] of pending) { store.reload(); if (!store.set(choice.provider, choice.purpose, false, store.revision)) pending.delete(key); }
    onChange(); render();
    message.textContent = t(pending.size ? 'Permission is blocked in this tab, but saving failed. Other tabs or a reload may retain the old permission. Retry before closing this tab.' : 'Provider permissions saved in this browser.');
  });
  function render() {
    for (const { input, provider, purpose } of inputs) { input.checked = store.allowed(provider, purpose); input.disabled = store.unreadable; input.dataset.revision = String(store.revision); }
    message.textContent = store.unreadable ? t('Saved provider permissions cannot be read. Their original data is preserved and network sharing is blocked.') : '';
    retry.hidden = !pending.size;
  }
  render(); return { reload() { store.reload(); onChange(); render(); } };
}
