// Explicit provider/purpose choices. No prompts, model output, keys or network calls are stored.
export const PRIVACY_KEY = 'kibitz.providerConsent';
export const CONSENT_HEADER = 'x-kibitz-consent';
export const CONSENT_VERSION = 1;
export const CONSENT_PROVIDERS = Object.freeze(['anthropic', 'openai', 'mistral', 'ollama']);
export const CONSENT_PURPOSES = Object.freeze(['coach', 'embeddings']);
const local = provider => ['mock', 'browser'].includes(provider);
const pair = (provider, purpose) => JSON.stringify([provider, purpose]);
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k));
const known = (provider, purpose) => CONSENT_PROVIDERS.includes(provider) && CONSENT_PURPOSES.includes(purpose);
export function providerConsentHeader(provider, purpose) {
  if (!CONSENT_PURPOSES.includes(purpose) || !local(provider) && !known(provider, purpose)) throw Error('Unknown consent destination');
  return local(provider) ? null : `v${CONSENT_VERSION}:${provider}:${purpose}`;
}
function parse(value) {
  if (!exact(value, ['version', 'revision', 'grants']) || value.version !== CONSENT_VERSION || !Number.isSafeInteger(value.revision) || value.revision < 1 || value.revision >= 1_000_000_000
    || !Array.isArray(value.grants) || value.grants.length > 8 || value.grants.some(g => !Array.isArray(g) || g.length !== 2 || !known(...g))) return null;
  const grants = new Set(value.grants.map(g => pair(...g))); if (grants.size !== value.grants.length) return null;
  return { revision: value.revision, grants };
}

/** A grant requires a successful save; a failed revocation still denies this tab immediately. */
export function createConsentStore(storage) {
  let state = { revision: 0, grants: new Set() }, unreadable = false;
  const denied = new Set();
  const read = () => {
    try {
      if (!storage) return null;
      const raw = storage.getItem(PRIVACY_KEY);
      return raw === null ? { revision: 0, grants: new Set() } : raw.length <= 4096 ? parse(JSON.parse(raw)) : null;
    } catch { return null; }
  };
  const reload = () => { const next = read(); unreadable = !next; if (next) state = next; return !!next; }; reload();
  return {
    get revision() { return state.revision; }, get unreadable() { return unreadable; }, reload,
    get key() { return JSON.stringify([unreadable, state.revision, [...state.grants].sort(), [...denied].sort()]); },
    allowed(provider, purpose) { return CONSENT_PURPOSES.includes(purpose) && (local(provider) || !unreadable && known(provider, purpose) && state.grants.has(pair(provider, purpose)) && !denied.has(pair(provider, purpose))); },
    set(provider, purpose, allowed, revision = state.revision) {
      if (!known(provider, purpose) || typeof allowed !== 'boolean') return 'invalid';
      const id = pair(provider, purpose); if (!allowed) denied.add(id);
      const latest = read(); if (!latest) { unreadable = true; return 'unreadable'; }
      if (latest.revision !== revision) { state = latest; unreadable = false; return 'conflict'; }
      const grants = new Set(latest.grants); if (allowed) grants.add(id); else grants.delete(id);
      const data = { version: CONSENT_VERSION, revision: latest.revision + 1, grants: [...grants].sort().map(g => JSON.parse(g)) }, checked = parse(data);
      if (!checked) return 'invalid';
      try { storage.setItem(PRIVACY_KEY, JSON.stringify(data)); } catch { return 'storage'; }
      state = checked; unreadable = false; denied.delete(id); return null;
    },
  };
}

/** Fence whole streamed requests, including callers which did not provide an abort signal. */
export function createPrivacyGate(store) {
  const pending = new Set();
  const reject = () => Object.assign(new Error('Allow this provider in Settings → Privacy before sending data.'), { code: 'consent_required' });
  return {
    changed() { for (const ctl of pending) ctl.abort(); pending.clear(); },
    async run(provider, purpose, operation, signal = null) {
      store.reload(); if (!store.allowed(provider, purpose)) throw reject();
      const identity = store.key, ctl = new AbortController(), abort = () => ctl.abort();
      if (signal?.aborted) ctl.abort(); else signal?.addEventListener('abort', abort, { once: true });
      pending.add(ctl);
      try {
        if (ctl.signal.aborted) throw Object.assign(Error('Cancelled'), { code: 'cancelled' });
        const attestation = providerConsentHeader(provider, purpose), headers = attestation ? { [CONSENT_HEADER]: attestation } : {};
        const result = await operation({ signal: ctl.signal, headers });
        store.reload();
        if (ctl.signal.aborted || identity !== store.key || !store.allowed(provider, purpose)) throw Object.assign(Error('Cancelled'), { code: 'cancelled' });
        return result;
      } finally { pending.delete(ctl); signal?.removeEventListener('abort', abort); }
    },
  };
}
