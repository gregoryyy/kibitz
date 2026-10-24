// Ownership-bound server library session. The browser-only library is a separate store.
import { createLibraryCache } from './cache.js';
import { libraryScope, LIBRARY_LIMITS, validateLibrarySnapshot } from './storage.js';
const problem = code => Object.assign(new Error('Server library request failed.'), { code });
const encoder = new TextEncoder();
function retainedSnapshot(previous, next) {
  if (previous?.scope !== next.scope) return next;
  const retain = (old, incoming) => {
    const byId = new Map(old.map(record => [record.id, record]));
    return incoming.map(record => { const known = byId.get(record.id); return known && JSON.stringify(known) === JSON.stringify(record) ? known : record; });
  };
  return { ...next, games: retain(previous.games, next.games), books: retain(previous.books, next.books) };
}
/**
 * @param {{fetcher?: typeof fetch, cache?: ReturnType<typeof createLibraryCache>, onChange?: (state: any) => void}} [options]
 */
export function createServerLibrary({ fetcher = fetch, cache = createLibraryCache(), onChange = () => {} } = {}) {
  const state = { available: false, mode: 'off', snapshot: null, cacheAvailable: null, busy: false, error: '' };
  let generation = 0, queue = Promise.resolve(), closed = false;
  const pending = new Set();
  const notify = () => onChange(state);
  const current = gen => { if (closed || gen !== generation) throw problem('library_cancelled'); };
  const invalidate = () => { generation++; for (const request of pending) request.abort(); pending.clear(); };
  async function request(gen, path, body = undefined) {
    current(gen);
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 15_000); pending.add(ctl);
    try {
      const response = await fetcher('api/library/' + path, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', redirect: 'error', signal: ctl.signal,
        ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
      current(gen);
      const limit = path === 'status' || !response.ok ? 8192 : LIBRARY_LIMITS.totalBytes + 1_000_000;
      if (+response.headers.get('content-length') > limit) throw problem('library_response_invalid');
      const reader = response.body?.getReader(), decoder = new TextDecoder('utf-8', { fatal: true });
      let bytes = 0, text = '';
      if (!reader) throw problem('library_response_invalid');
      while (true) {
        const chunk = await reader.read(); current(gen);
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > limit) { await reader.cancel(); throw problem('library_response_invalid'); }
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
      const value = JSON.parse(text); current(gen);
      if (!response.ok) {
        const code = value?.error?.code;
        throw problem(['conflict', 'session_changed', 'no_session', 'invalid_record', 'invalid_changes', 'quota', 'record_too_large', 'too_large', 'rate_limited'].includes(code) ? code : 'library_unavailable');
      }
      return value;
    } catch (error) {
      current(gen);
      if (typeof error?.code === 'string') throw error;
      throw problem('library_unavailable');
    } finally { clearTimeout(timer); pending.delete(ctl); }
  }
  async function remember(gen, snapshot) {
    try { await cache.write(snapshot); current(gen); state.cacheAvailable = true; }
    catch (error) { current(gen); state.cacheAvailable = false; }
  }
  async function probe() {
    const gen = generation;
    try {
      const value = await request(gen, 'status'); current(gen); state.available = value?.available === true;
      if (state.snapshot && state.available && value.scope !== state.snapshot.scope) {
        invalidate(); state.snapshot = null; state.mode = 'unavailable'; state.busy = false; state.cacheAvailable = null; state.error = 'session_changed';
      }
    }
    catch (error) { if (gen !== generation) return; state.available = false; }
    notify(); return state.available;
  }
  async function connect() {
    if (closed) throw problem('library_cancelled');
    invalidate(); const gen = generation, previous = state.snapshot;
    state.mode = 'connecting'; state.snapshot = null; state.busy = true; state.error = ''; state.cacheAvailable = null; notify();
    let verified = null;
    try {
      const status = await request(gen, 'status');
      if (status?.available !== true || status.scope !== null && !libraryScope(status.scope)) throw problem('library_unavailable');
      state.available = true; verified = status.scope;
      const snapshot = validateLibrarySnapshot(await request(gen, 'records')); current(gen);
      if (verified && snapshot.scope !== verified) throw problem('session_changed');
      state.snapshot = retainedSnapshot(previous, snapshot); state.mode = 'online'; notify();
      await remember(gen, snapshot); current(gen);
      return state.snapshot;
    } catch (error) {
      current(gen);
      const identityChanged = ['session_changed', 'no_session'].includes(error.code);
      if (verified && !identityChanged) {
        try {
          const saved = await cache.read(verified); current(gen);
          if (saved) { state.snapshot = retainedSnapshot(previous, saved.snapshot); state.mode = 'cached'; state.cacheAvailable = true; }
        } catch (cacheError) { current(gen); state.cacheAvailable = false; }
      }
      if (!state.snapshot) state.mode = 'unavailable';
      state.error = identityChanged ? 'session_changed' : 'library_unavailable';
      return null;
    } finally { if (gen === generation) { state.busy = false; notify(); } }
  }
  function change(plan) {
    const gen = generation;
    const operation = queue.then(async () => {
      current(gen);
      if (state.mode !== 'online' || !state.snapshot) throw problem('library_readonly');
      const before = state.snapshot, changes = typeof plan === 'function' ? plan(before) : plan;
      if (!Array.isArray(changes) || changes.length > LIBRARY_LIMITS.changes) throw problem('invalid_changes');
      if (!changes.length) return before;
      const body = { scope: before.scope, revision: before.revision, changes }, serialized = JSON.stringify(body);
      if (serialized.length > LIBRARY_LIMITS.batchBytes || encoder.encode(serialized).byteLength > LIBRARY_LIMITS.batchBytes) throw problem('too_large');
      state.busy = true; state.error = ''; notify();
      try {
        const snapshot = validateLibrarySnapshot(await request(gen, 'records', body)); current(gen);
        if (snapshot.scope !== before.scope) throw problem('session_changed');
        state.snapshot = retainedSnapshot(before, snapshot); state.mode = 'online'; notify();
        await remember(gen, snapshot); current(gen);
        return state.snapshot; // Cache failure cannot revoke an acknowledged SQLite commit.
      } catch (error) {
        current(gen);
        state.error = error.code || 'library_unavailable';
        if (['session_changed', 'no_session'].includes(error.code)) { state.snapshot = null; state.mode = 'unavailable'; }
        else if (error.code === 'conflict') state.mode = 'conflict';
        else if (!['invalid_record', 'invalid_changes', 'quota', 'record_too_large', 'too_large', 'rate_limited'].includes(error.code)) state.mode = 'cached';
        throw error;
      } finally { if (gen === generation) { state.busy = false; notify(); } }
    });
    queue = operation.catch(() => {}); return operation;
  }
  return { state, probe, connect, refresh: connect, change,
    disconnect() { invalidate(); state.mode = 'off'; state.snapshot = null; state.busy = false; state.error = ''; state.cacheAvailable = null; notify(); },
    close() { invalidate(); closed = true; state.mode = 'off'; state.snapshot = null; state.busy = false; cache.close(); notify(); },
  };
}
