import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClientSession, SESSION_BOUNDARY_KEY } from '../../src/platform/client-session.js';
const a = 'a'.repeat(64), b = 'b'.repeat(64);
const active = (clientId = a, expires = 10000) => ({ required: true, authenticated: true, clientId, expires });
const response = value => new Response(JSON.stringify(value));
function storage() {
  const saved = new Map(); let fail = false;
  return { saved, getItem: key => { if (fail) throw Error(); return saved.get(key) ?? null; }, setItem: (key, value) => { if (fail) throw Error(); saved.set(key, value); }, fail: value => { fail = value; } };
}
function fixture(options = {}) {
  const memory = options.storage || storage(), ended = [], timers = new Map(); let time = 1000, mono = 0, next = 0;
  const session = createClientSession({ storage: memory, now: () => time, elapsed: () => mono, schedule: (fn, ms) => { timers.set(++next, { fn, ms }); return next; }, unschedule: id => timers.delete(id), nonce: () => 'nonce-' + ++next,
    serialize: operation => Promise.resolve().then(operation), fetcher: async () => response(active()), onEnd: reason => { ended.push(reason); return true; }, ...options });
  return { session, ended, memory, timers, advance: (wall, elapsed) => { time += wall; mono += elapsed; } };
}

test('a first protected request verifies deployment/session first; unknown/offline status never reaches the protected endpoint', async () => {
  const calls = [], f = fixture({ fetcher: async url => { calls.push(url); return response(url === 'api/session/status' ? active() : { ok: true }); } });
  assert.deepEqual(await (await f.session.request('api/library/records')).json(), { ok: true }); assert.deepEqual(calls, ['api/session/status', 'api/library/records']); f.session.close();
  let count = 0; const offline = fixture({ fetcher: async () => { count++; throw Error('offline'); } });
  await assert.rejects(offline.session.request('api/library/records')); assert.equal(count, 1); offline.session.close();
});

test('HTTP development remains usable without a storage/session authority', async () => {
  const f = fixture({ storage: null, fetcher: async url => response(url === 'api/session/status' ? { required: false, authenticated: false } : { ok: true }) });
  assert.deepEqual(await (await f.session.request('api/ai/status')).json(), { ok: true }); f.session.close();
});

test('offline absolute expiry clears locally, aborts requests and denies new calls without depending on another network response', async () => {
  const f = fixture(); await f.session.observe(active()); f.advance(9000, 9000);
  assert.equal(f.session.check(), false); assert.equal(f.session.state.authenticated, false); assert.deepEqual(f.ended, ['session_expired']);
  await assert.rejects(f.session.request('api/library/records'), { code: 'session_expired' });
  const marker = JSON.parse(f.memory.getItem(SESSION_BOUNDARY_KEY)); assert.equal(marker.blocked, '*'); assert.deepEqual(Object.keys(marker).sort(), ['blocked', 'nonce', 'version']); f.session.close();
});

test('wall-clock rollback and repeated same-session probes cannot extend the monotonic expiry deadline', async () => {
  const f = fixture(); await f.session.observe(active()); f.advance(-5000, 8000); await f.session.observe(active()); f.advance(0, 1001);
  assert.equal(f.session.check(), false); assert.equal(f.session.state.reason, 'session_expired'); f.session.close();
});

test('an armed expiry timer performs cleanup without another user action', async () => {
  const f = fixture(); await f.session.observe(active()); assert.equal(f.timers.size, 1);
  const timer = [...f.timers.values()][0]; assert.equal(timer.ms, 9000); f.advance(9000, 9000); timer.fn();
  assert.equal(f.session.state.authenticated, false); assert.deepEqual(f.ended, ['session_expired']); f.session.close();
});

test('local termination survives reload and refuses passive reuse until fresh proof and acknowledged cleanup', async () => {
  const f = fixture(); await f.session.observe(active()); assert.equal(await f.session.end(), true);
  const reloaded = fixture({ storage: f.memory }); assert.equal(await reloaded.session.observe(active()), false); assert.equal(reloaded.session.state.authenticated, false);
  assert.equal(await reloaded.session.observe(active(b), true, reloaded.session.ticket()), true); assert.equal(reloaded.session.state.authenticated, true);
  assert.equal(JSON.parse(f.memory.getItem(SESSION_BOUNDARY_KEY)).blocked, null); f.session.close(); reloaded.session.close();
});

test('changed identity never silently adopts a replacement, including a same-expiry session', async () => {
  const f = fixture(); await f.session.observe(active()); assert.equal(await f.session.observe(active(b)), false);
  assert.equal(f.session.state.reason, 'session_changed'); assert.equal(f.session.state.authenticated, false); assert.equal(await f.session.observe(active(b)), false);
  assert.equal(await f.session.observe(active(b), true, f.session.ticket()), true); f.session.close();
});

test('failed cleanup or unreadable/failed marker storage blocks automatic reuse and fresh activation until explicit recovery', async () => {
  let ok = false; const f = fixture({ onEnd: () => ok }); await f.session.observe(active()); assert.equal(await f.session.end(), false);
  assert.equal(await f.session.observe(active(b), true, f.session.ticket()), false); ok = true; assert.equal(await f.session.end(), true); assert.equal(await f.session.observe(active(b), true, f.session.ticket()), true);
  f.memory.fail(true); assert.equal(await f.session.end(), false); assert.equal(f.session.state.persistenceFailed, true); assert.equal(await f.session.observe(active(b), true, f.session.ticket()), false);
  f.memory.fail(false); await f.session.end(); assert.equal(await f.session.observe(active(b), true, f.session.ticket()), true); f.session.close();
});

test('malformed/future and oversized markers deny reuse; explicit fresh-proof reset is separate', async () => {
  for (const raw of ['{bad', JSON.stringify({ version: 99, retain: true }), 'x'.repeat(300)]) {
    const memory = storage(); memory.setItem(SESSION_BOUNDARY_KEY, raw); const f = fixture({ storage: memory });
    assert.equal(await f.session.observe(active()), false); assert.equal(memory.getItem(SESSION_BOUNDARY_KEY), raw);
    assert.equal(await f.session.observe(active(b), true, f.session.ticket()), true); f.session.close();
  }
});

test('a late status response cannot reactivate a locally ended session', async () => {
  let release; const f = fixture({ fetcher: () => new Promise(resolve => { release = resolve; }) });
  const probe = f.session.probe().catch(error => error.code); await f.session.end(); release(response(active()));
  assert.equal(await probe, 'session_expired'); assert.equal(f.session.state.authenticated, false); f.session.close();
});

test('a 401 invalidates all clients even with an unreadable error body; a function-specific 403 retains authentication', async () => {
  for (const status of [401, 403]) {
    const f = fixture({ fetcher: async () => new Response('not JSON', { status }) }); await f.session.observe(active());
    if (status === 401) { await assert.rejects(f.session.request('api/ai/status'), { code: 'session_expired' }); assert.equal(f.session.state.authenticated, false); }
    else { assert.equal((await f.session.request('api/ai/config')).status, 403); assert.equal(f.session.state.authenticated, true); }
    f.session.close();
  }
});

test('termination aborts/cancels an entire streaming body and cannot deliver a late chunk even if its transport ignores abort', async () => {
  let source, cancelled = false, signal;
  const body = new ReadableStream({ start: controller => { source = controller; }, cancel: () => { cancelled = true; } });
  const f = fixture({ fetcher: async (_url, init) => { signal = init.signal; return new Response(body); } }); await f.session.observe(active());
  const reader = (await f.session.request('api/ai/sample')).body.getReader(); source.enqueue(new TextEncoder().encode('first'));
  assert.equal(new TextDecoder().decode((await reader.read()).value), 'first'); const late = reader.read().catch(error => error.code);
  await f.session.end(); assert.equal(await late, 'session_expired'); assert.equal(signal.aborted, true); assert.equal(cancelled, true); f.session.close();
});

test('termination does not require an abandoned response body to be read before cancellation', async () => {
  let cancelled = false; const body = new ReadableStream({ cancel: () => { cancelled = true; } });
  const f = fixture({ fetcher: async () => new Response(body) }); await f.session.observe(active()); await f.session.request('api/ai/sample');
  await f.session.end(); assert.equal(cancelled, true); f.session.close();
});

test('broadcast and storage invalidation clear remote state without echo or automatic adoption', async () => {
  let receive, sent = 0; const channel = { addEventListener: (_type, handler) => { receive = handler; }, removeEventListener() {}, close() {}, postMessage: () => { sent++; } };
  const f = fixture({ channel }); await f.session.observe(active()); receive({ data: { version: 1, type: 'ended', nonce: 'remote' } });
  assert.equal(f.session.state.authenticated, false); assert.equal(sent, 0); assert.equal(await f.session.observe(active()), false);
  await f.session.observe(active(b), true, f.session.ticket()); f.session.storageChanged(); assert.equal(f.session.state.authenticated, false); assert.equal(sent, 1); f.session.close();
});

test('oversized/invalid status bodies and invalid expiry metadata cannot establish a session', async () => {
  for (const value of [{ ...active(), expires: 0 }, { ...active(), expires: Number.MAX_SAFE_INTEGER }, { ...active(), clientId: 'raw-token-is-not-an-id' }]) {
    const f = fixture(); assert.equal(await f.session.observe(value), false); assert.equal(f.session.state.authenticated, false); f.session.close();
  }
  const f = fixture({ fetcher: async () => new Response('x'.repeat(9000)) }); await assert.rejects(f.session.probe(), { code: 'session_unavailable' }); assert.equal(f.session.state.authenticated, false); f.session.close();
});

test('repeated development probes do not abort independent in-flight requests, while removing final authentication cannot unlock an existing client', async () => {
  let release; const f = fixture({ fetcher: async () => new Promise(resolve => { release = resolve; }) });
  await f.session.observe({ required: false, authenticated: false }); const request = f.session.request('api/ai/sample');
  await f.session.observe({ required: false, authenticated: false }); release(response({ ok: true })); assert.deepEqual(await (await request).json(), { ok: true }); f.session.close();
  const final = fixture(); await final.session.observe(active()); assert.equal(await final.session.observe({ required: false, authenticated: false }), false);
  assert.equal(final.session.state.required, true); assert.equal(final.session.check(), false); final.session.close();
});

test('missed cross-tab events are detected from the marker before any protected request, even while offline', async () => {
  const f = fixture(); await f.session.observe(active()); f.memory.setItem(SESSION_BOUNDARY_KEY, JSON.stringify({ version: 1, blocked: null, nonce: 'changed-elsewhere' }));
  assert.equal(f.session.check(), false); assert.equal(f.session.state.reason, 'session_changed'); f.session.close();
});

test('pending cleanup is distinct from failed cleanup and cannot be acknowledged before its operation settles', async () => {
  let release; const f = fixture({ onEnd: () => new Promise(resolve => { release = resolve; }) }); await f.session.observe(active());
  const cleanup = f.session.end(); assert.equal(f.session.state.cleaning, true); assert.equal(f.session.state.cleanupFailed, false); assert.equal(f.session.check(), false);
  release(false); assert.equal(await cleanup, false); assert.equal(f.session.state.cleaning, false); assert.equal(f.session.state.cleanupFailed, true); f.session.close();
});

test('explicit whole-browser erasure can preserve its live backend session without immediately recreating owned browser data', async () => {
  const f = fixture(); await f.session.observe(active()); await f.session.end(); await f.session.observe(active(b), true, f.session.ticket());
  assert.equal(f.memory.saved.size, 1); f.memory.saved.clear(); f.session.storageReset();
  assert.equal(f.session.check(), true); assert.equal(f.memory.saved.size, 0); f.session.close();
});

test('a retained boundary requires verification before offline browser fallback or protected work on a fresh client', async () => {
  const memory = storage(); memory.setItem(SESSION_BOUNDARY_KEY, JSON.stringify({ version: 1, blocked: a, nonce: 'ended' }));
  let requests = 0; const f = fixture({ storage: memory, fetcher: async () => { requests++; throw Error('offline'); } });
  assert.equal(f.session.state.required, true); assert.equal(f.session.check(), false); await assert.rejects(f.session.request('api/ai/status')); assert.equal(requests, 1); f.session.close();
});

test('a delayed proof response cannot reactivate after a newer termination generation', async () => {
  const f = fixture(); await f.session.end(); const ticket = f.session.ticket(); await f.session.end('newer-end');
  assert.equal(await f.session.observe(active(b), true, ticket), false); assert.equal(f.session.state.authenticated, false); assert.equal(JSON.parse(f.memory.getItem(SESSION_BOUNDARY_KEY)).blocked, '*'); f.session.close();
});

test('serialized nonce checks retain a remote termination even when no cross-tab event has yet been delivered', async () => {
  const memory = storage(); let serial = Promise.resolve(), n = 0;
  const serialize = operation => { const result = serial.then(operation); serial = result.catch(() => {}); return result; }, nonce = () => 'shared-' + ++n;
  const first = fixture({ storage: memory, serialize, nonce }), other = fixture({ storage: memory, serialize, nonce });
  await first.session.end(); const ticket = first.session.ticket(); await other.session.end('remote-end');
  assert.equal(await first.session.observe(active(b), true, ticket), false); assert.equal(JSON.parse(memory.getItem(SESSION_BOUNDARY_KEY)).blocked, '*');
  const fresh = fixture({ storage: memory, serialize, nonce }); assert.equal(await fresh.session.observe(active(b)), false);
  first.session.close(); other.session.close(); fresh.session.close();
});

test('termination after fresh activation conservatively blocks all cookies until another explicit proof', async () => {
  const memory = storage(); let n = 0; const nonce = () => 'cross-' + ++n;
  const first = fixture({ storage: memory, nonce }), other = fixture({ storage: memory, nonce }); await first.session.end();
  assert.equal(await first.session.observe(active(b), true, first.session.ticket()), true); await other.session.end('later-end'); assert.equal(first.session.check(), false);
  const fresh = fixture({ storage: memory, nonce }); assert.equal(await fresh.session.observe(active(b)), false); first.session.close(); other.session.close(); fresh.session.close();
});

test('missing or refused serialization denies authenticated activation and reports coordination failure', async () => {
  const f = fixture({ serialize: async () => { throw Error('unavailable'); } }); assert.equal(await f.session.observe(active()), false);
  assert.equal(f.session.state.authenticated, false); assert.equal(f.session.state.persistenceFailed, true); assert.equal(await f.session.end(), false); f.session.close();
});

test('concurrent passive observations cannot silently replace the first identity inside the serialization queue', async () => {
  let serial = Promise.resolve(), release; const gate = new Promise(resolve => { release = resolve; });
  const serialize = operation => { const result = serial.then(() => gate).then(operation); serial = result.catch(() => {}); return result; };
  const f = fixture({ serialize }); const first = f.session.observe(active()), replacement = f.session.observe(active(b)); release();
  assert.deepEqual(await Promise.all([first, replacement]), [true, false]); assert.equal(f.session.state.authenticated, false); assert.equal(f.session.state.reason, 'session_changed'); f.session.close();
});

test('concurrent same-session observations preserve the earliest elapsed deadline when the clock changes inside the queue', async () => {
  let serial = Promise.resolve(), operations = 0, f;
  const serialize = operation => { const result = serial.then(() => { const value = operation(); if (++operations === 1) f.advance(-5000, 8000); return value; }); serial = result.catch(() => {}); return result; };
  f = fixture({ serialize }); await Promise.all([f.session.observe(active()), f.session.observe(active())]); f.advance(0, 1001);
  assert.equal(f.session.check(), false); assert.equal(f.session.state.reason, 'session_expired'); f.session.close();
});
