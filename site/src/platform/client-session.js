// Client invalidation is separate from backend authorization and provider consent.
export const SESSION_BOUNDARY_KEY = 'kibitz.sessionBoundary';
const id = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const fault = code => Object.assign(Error('Local server session unavailable.'), { code });
const validMarker = value => value && Object.keys(value).length === 3 && value.version === 1
  && (value.blocked === null || value.blocked === '*') && typeof value.nonce === 'string' && /^[a-zA-Z0-9-]{1,64}$/.test(value.nonce);

/**
 * No token/proof/private payload is stored. The marker only prevents automatic
 * reuse of a locally terminated session; it cannot authenticate a request.
 * @param {{fetcher?: typeof fetch, storage?: Storage|null, channel?: BroadcastChannel|null,
 * now?:()=>number, elapsed?:()=>number, schedule?:typeof setTimeout, unschedule?:typeof clearTimeout,
 * nonce?:()=>string, serialize?:(operation:()=>any)=>Promise<any>, onEnd?:(reason:string)=>Promise<boolean>|boolean}} [options]
 */
export function createClientSession({ fetcher = fetch, storage = null, channel = null, now = () => Date.now(), elapsed = () => performance.now(),
  schedule = setTimeout, unschedule = clearTimeout, nonce = () => crypto.randomUUID(), serialize = withSessionLock, onEnd = async () => true } = {}) {
  const state = { required: null, authenticated: false, ended: false, reason: '', expires: null, cleaning: false, cleanupFailed: false, persistenceFailed: false };
  let deploymentVerified = false, clientId = null, acceptedNonce = null, generation = 0, deadline = null, expiryTimer = null, cleanup = null, closed = false, probing = null;
  const pending = new Set(), listeners = new Set();
  const notify = () => { for (const listener of listeners) listener(state); };
  const marker = () => {
    try { if (!storage) throw Error(); const raw = storage.getItem(SESSION_BOUNDARY_KEY); if (raw === null) return null;
      if (raw.length > 256) throw Error(); const value = JSON.parse(raw); if (!validMarker(value)) throw Error(); return value;
    } catch { return { blocked: '*', unreadable: true }; }
  };
  // A retained boundary also guards offline browser-model fallback before status is reachable.
  if (marker()) state.required = true;
  const broadcastEvent = value => { try { channel?.postMessage({ version: 1, type: 'ended', nonce: value }); } catch { /* the storage event remains */ } };
  const publish = (blocked, value = nonce(), broadcast = true) => {
    const entry = { version: 1, blocked, nonce: value };
    try { if (!storage || !validMarker(entry)) throw Error(); storage.setItem(SESSION_BOUNDARY_KEY, JSON.stringify(entry)); state.persistenceFailed = false; }
    catch { state.persistenceFailed = true; }
    if (broadcast) broadcastEvent(value);
    return !state.persistenceFailed;
  };
  const invalidate = () => { generation++; for (const ctl of pending) ctl.abort(); pending.clear(); unschedule(expiryTimer); expiryTimer = null; };
  function end(reason = 'signout', broadcast = true) {
    invalidate(); clientId = null; deadline = null;
    state.authenticated = false; state.expires = null; state.ended = true; state.reason = reason; state.cleaning = true; state.cleanupFailed = false;
    let result; try { result = onEnd(reason); } catch { result = false; }
    const erased = Promise.resolve(result).then(value => value !== false, () => false);
    let recorded = Promise.resolve(!state.persistenceFailed);
    if (broadcast) {
      const value = nonce(); broadcastEvent(value);
      recorded = Promise.resolve().then(() => serialize(() => publish('*', value, false))).catch(() => { state.persistenceFailed = true; return false; });
    }
    const operation = Promise.all([erased, recorded]); cleanup = operation;
    notify();
    return operation.then(([ok, saved]) => {
      if (cleanup === operation) { cleanup = null; state.cleaning = false; state.cleanupFailed = !ok; notify(); }
      return ok && saved;
    });
  }
  function check() {
    if (closed) return false;
    const saved = state.authenticated ? marker() : null;
    if (state.authenticated && (saved?.unreadable || saved?.blocked === '*' || (saved?.nonce ?? null) !== acceptedNonce)) { void end('session_changed', false); return false; }
    if (state.authenticated && (now() >= state.expires || elapsed() >= deadline)) { void end('session_expired'); return false; }
    return state.required === false || state.authenticated && !state.ended;
  }
  function arm() {
    unschedule(expiryTimer);
    if (!state.authenticated) return;
    expiryTimer = schedule(() => { if (check()) arm(); }, Math.max(1, Math.min(state.expires - now(), deadline - elapsed(), 60_000)));
    expiryTimer?.unref?.();
  }
  async function observe(value, explicit = false, ticket = null) {
    if (closed || !value || typeof value.required !== 'boolean' || typeof value.authenticated !== 'boolean') throw fault('session_unavailable');
    if (explicit && (!ticket || ticket.generation !== generation)) return false;
    if (explicit && !state.ended) { await end('session_changed'); return false; }
    if (!explicit && state.authenticated && !check()) return false;
    const gen = generation;
    if (!value.required && deploymentVerified && state.required === true) { await end('session_changed'); return false; }
    state.required = value.required; deploymentVerified = true;
    if (!value.required) { clientId = null; state.authenticated = false; state.expires = null; state.ended = false; state.reason = ''; notify(); return true; }
    if (!value.authenticated) { if (!state.ended) await end('session_expired', false); return false; }
    if (!id(value.clientId) || !Number.isSafeInteger(value.expires) || value.expires <= now() || value.expires - now() > 12 * 60 * 60 * 1000 + 60_000) {
      await end('session_expired'); return false;
    }
    const saved = marker();
    if (!explicit && (state.ended || saved?.blocked === '*' || saved?.unreadable)) {
      if (!state.ended) await end('session_expired', false); return false;
    }
    if (clientId && clientId !== value.clientId && !explicit) { await end('session_changed'); return false; }
    if (cleanup) await cleanup;
    if (closed || gen !== generation) return false;
    if (state.cleanupFailed || state.persistenceFailed) { notify(); return false; }
    const activate = () => {
      if (closed || gen !== generation || value.expires <= now()) return false;
      if (!explicit && clientId && clientId !== value.clientId) { void end('session_changed'); return false; }
      const latest = marker();
      if (!explicit && (latest?.unreadable || latest?.blocked || (latest?.nonce ?? null) !== (saved?.nonce ?? null))) { void end('session_changed', false); return false; }
      if (explicit && ((marker()?.nonce ?? null) !== ticket.nonce || !publish(null))) return false;
      const sameSession = clientId === value.clientId;
      clientId = value.clientId; acceptedNonce = marker()?.nonce ?? null; state.authenticated = true; state.expires = value.expires; state.ended = false; state.reason = '';
      deadline = sameSession && deadline !== null ? Math.min(deadline, elapsed() + value.expires - now()) : elapsed() + value.expires - now(); arm(); notify(); return gen === generation && state.authenticated;
    };
    try { return await serialize(activate); } catch { state.persistenceFailed = true; await end('session_unavailable', false); return false; }
  }
  async function probe() {
    if (closed) throw fault('session_expired');
    if (probing) return probing;
    const gen = generation, ctl = new AbortController(), timer = schedule(() => ctl.abort(), 10_000); pending.add(ctl);
    const operation = (async () => {
      try {
        const response = await fetcher('api/session/status', { credentials: 'same-origin', redirect: 'error', cache: 'no-store', signal: ctl.signal });
        if (gen !== generation || closed || ctl.signal.aborted) throw fault('session_expired');
        if (response.status === 401) { await end('session_expired'); throw fault('session_expired'); }
        if (!response.ok || +response.headers.get('content-length') > 8192 || !response.body) throw fault('session_unavailable');
        const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true }); let text = '', bytes = 0;
        while (true) {
          const part = await reader.read(); if (gen !== generation || closed || ctl.signal.aborted) { await reader.cancel(); throw fault('session_expired'); }
          if (part.done) break; bytes += part.value.byteLength;
          if (bytes > 8192) { await reader.cancel(); throw fault('session_unavailable'); } text += decoder.decode(part.value, { stream: true });
        }
        const value = JSON.parse(text + decoder.decode()); await observe(value); return value;
      } finally { unschedule(timer); pending.delete(ctl); }
    })();
    probing = operation;
    try { return await operation; } finally { if (probing === operation) probing = null; }
  }
  async function request(input, init = {}) {
    if (state.required === null || state.required === true && !state.authenticated && !state.ended) await probe();
    if (!check()) throw fault('session_expired');
    const gen = generation, ctl = new AbortController(), abort = () => ctl.abort();
    let reader = null;
    const cancelBody = () => { void reader?.cancel().catch(() => {}); };
    if (init.signal?.aborted) ctl.abort(); else init.signal?.addEventListener('abort', abort, { once: true });
    pending.add(ctl);
    const release = () => { pending.delete(ctl); init.signal?.removeEventListener('abort', abort); ctl.signal.removeEventListener('abort', cancelBody); };
    const current = () => { if (closed || gen !== generation || !check()) throw fault('session_expired'); if (ctl.signal.aborted) throw fault('cancelled'); };
    try {
      current();
      const response = await fetcher(input, { ...init, credentials: 'same-origin', redirect: 'error', signal: ctl.signal }); current();
      if (response.status === 401) { void end('session_expired'); throw fault('session_expired'); }
      if (!response.body) { release(); return response; }
      reader = response.body.getReader(); ctl.signal.addEventListener('abort', cancelBody, { once: true });
      const body = new ReadableStream({
        async pull(controller) {
          try { current(); const part = await reader.read(); current();
            if (part.done) { release(); controller.close(); } else controller.enqueue(part.value);
          } catch (error) { release(); ctl.abort(); void reader.cancel().catch(() => {}); controller.error(error); }
        },
        cancel() { release(); ctl.abort(); return reader.cancel(); },
      }, { highWaterMark: 0 });
      return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
    } catch (error) { release(); throw error; }
  }
  const receive = event => { const value = event.data;
    if (!closed && state.required !== false && value?.version === 1 && value.type === 'ended' && typeof value.nonce === 'string' && value.nonce.length <= 64) void end('session_changed', false);
  };
  channel?.addEventListener('message', receive);
  return { state, observe, probe, request, end, check,
    generation: () => generation, ticket: () => Object.freeze({ generation, nonce: marker()?.nonce ?? null }),
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    // Explicit whole-browser erasure preserves the live backend session, as the data controls promise.
    storageReset() { if (marker() === null) acceptedNonce = null; },
    storageChanged() { if (!closed) void end('session_changed', false); },
    close() { closed = true; invalidate(); channel?.removeEventListener('message', receive); channel?.close(); listeners.clear(); },
  };
}

/** No secret or content is sent over this same-origin invalidation channel. */
export function openSessionChannel() { try { return new BroadcastChannel('kibitz-session-v1'); } catch { return null; } }

/** Recheck suspended documents before protected work; elapsed expiry also works offline. */
export function bindClientSession(session, host = window, doc = document) {
  const resume = () => { if (session.state.required === true && session.check()) void session.probe().catch(() => session.check()); };
  const visible = () => { if (doc.visibilityState === 'visible') resume(); };
  const storage = event => { if (session.state.required === true && (event.key === SESSION_BOUNDARY_KEY || event.key === null)) session.storageChanged(); };
  host.addEventListener('pageshow', resume); host.addEventListener('online', resume); host.addEventListener('storage', storage); doc.addEventListener('visibilitychange', visible);
  const interval = host.setInterval(visible, 30_000);
  return () => { host.clearInterval(interval); host.removeEventListener('pageshow', resume); host.removeEventListener('online', resume); host.removeEventListener('storage', storage); doc.removeEventListener('visibilitychange', visible); session.close(); };
}

/** Serialize marker commits across cooperating clients; never hold this over a proof request. */
export async function withSessionLock(operation) {
  if (!globalThis.navigator?.locks) throw fault('session_coordination_unavailable');
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 3000);
  try { return await navigator.locks.request('kibitz-session-boundary-v1', { signal: ctl.signal }, operation); }
  finally { clearTimeout(timer); }
}
