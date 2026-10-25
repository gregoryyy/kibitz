import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServerLibrary } from '../../src/library/server-session.js';
const a = 'a'.repeat(64), b = 'b'.repeat(64);
const snapshot = (scope = a, revision = 0, games = [{ id: 'kept', pgn: '1. e4 *' }]) => ({ version: 1, scope, revision, games, books: [] });
const response = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
function transport(...steps) {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, ...options, parsed: options.body ? JSON.parse(options.body) : null });
    const step = steps.shift();
    if (step instanceof Error) throw step;
    return typeof step === 'function' ? step(url, options) : response(step);
  };
  return { calls, fetcher };
}
function memoryCache(entries = []) {
  const saved = new Map(entries), reads = [], writes = [];
  return { reads, writes, read: async scope => { reads.push(scope); return saved.get(scope) || null; },
    write: async value => { const copy = structuredClone(value); writes.push(copy); saved.set(copy.scope, { version: 1, scope: copy.scope, snapshot: copy, cachedAt: '2026-10-24T09:00:00Z' }); }, close() {} };
}
const online = () => [{ available: true, scope: a }, snapshot()];
const code = expected => error => error.code === expected;

test('availability probes do not fetch records, upload the browser library or inspect cache buckets', async () => {
  const net = transport({ available: true, scope: null }), cache = memoryCache(), session = createServerLibrary({ ...net, cache });
  assert.equal(await session.probe(), true); assert.equal(session.state.mode, 'off'); assert.equal(session.state.snapshot, null);
  assert.deepEqual(net.calls.map(c => [c.url, c.method]), [['api/library/status', 'GET']]); assert.deepEqual(cache.reads, []); assert.deepEqual(cache.writes, []); session.close();
});

test('cache fallback needs a freshly verified scope; fresh offline loads never use a previous owner cache', async () => {
  const saved = { version: 1, scope: a, snapshot: snapshot(), cachedAt: '2026-10-24T09:00:00Z' };
  const cache = memoryCache([[a, saved]]), known = createServerLibrary({ ...transport({ available: true, scope: a }, new Error('offline')), cache });
  await known.connect(); assert.equal(known.state.mode, 'cached'); assert.equal(known.state.snapshot.scope, a); assert.deepEqual(cache.reads, [a]);
  await assert.rejects(known.change([]), code('library_readonly')); known.close();
  const hidden = memoryCache([[a, saved]]), fresh = createServerLibrary({ ...transport(new Error('offline')), cache: hidden });
  await fresh.connect(); assert.equal(fresh.state.mode, 'unavailable'); assert.equal(fresh.state.snapshot, null); assert.deepEqual(hidden.reads, []); fresh.close();
});

test('a changed scope between status and records cannot publish or cache the replacement owner', async () => {
  const cache = memoryCache(), session = createServerLibrary({ ...transport({ available: true, scope: a }, snapshot(b)), cache });
  await session.connect(); assert.equal(session.state.snapshot, null); assert.equal(session.state.mode, 'unavailable'); assert.equal(session.state.error, 'session_changed');
  assert.deepEqual(cache.reads, []); assert.deepEqual(cache.writes, []); session.close();
});

test('serialized mutation plans see the previous acknowledgement revision and preserve unchanged record identities', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const firstAck = snapshot(a, 1, [...snapshot().games, { id: 'first', pgn: '1. d4 *' }]), lastAck = snapshot(a, 2, [...firstAck.games, { id: 'second', pgn: '1. c4 *' }]);
  const net = transport(...online(), async () => { await gate; return response(firstAck); }, lastAck), cache = memoryCache(), session = createServerLibrary({ ...net, cache });
  await session.connect(); const kept = session.state.snapshot.games[0];
  const first = session.change(() => [{ collection: 'games', id: 'first', record: firstAck.games[1] }]);
  let seenRevision;
  const second = session.change(current => { seenRevision = current.revision; return [{ collection: 'games', id: 'second', record: lastAck.games[2] }]; });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(net.calls.filter(c => c.method === 'POST').length, 1);
  release(); await Promise.all([first, second]);
  assert.equal(seenRevision, 1); assert.deepEqual(net.calls.filter(c => c.method === 'POST').map(c => [c.parsed.scope, c.parsed.revision]), [[a, 0], [a, 1]]);
  assert.equal(session.state.snapshot.games[0], kept); assert.deepEqual(cache.writes.map(s => s.revision), [0, 1, 2]);
  const n = net.calls.length; await session.change([]); assert.equal(net.calls.length, n); session.close();
});

test('an acknowledged server save remains successful when its optional cache write fails', async () => {
  const net = transport(...online(), snapshot(a, 1)), cache = memoryCache(), session = createServerLibrary({ ...net, cache });
  await session.connect(); cache.write = async () => { throw new Error('quota'); };
  const saved = await session.change([{ collection: 'games', id: 'kept', record: snapshot().games[0] }]);
  assert.equal(saved.revision, 1); assert.equal(session.state.mode, 'online'); assert.equal(session.state.cacheAvailable, false); assert.equal(session.state.error, ''); session.close();
});

test('unknown acknowledgements require refresh rather than a blind retry, retaining the current view until then', async () => {
  const net = transport(...online(), new Error('connection lost after commit'), { available: true, scope: a }, snapshot(a, 1));
  const session = createServerLibrary({ ...net, cache: memoryCache() }); await session.connect(); const before = session.state.snapshot;
  await assert.rejects(session.change([{ collection: 'games', id: 'kept', record: before.games[0] }]));
  assert.equal(session.state.snapshot, before); assert.equal(session.state.mode, 'cached');
  const n = net.calls.length; await assert.rejects(session.change([]), code('library_readonly')); assert.equal(net.calls.length, n);
  await session.refresh(); assert.equal(session.state.snapshot.revision, 1); assert.equal(session.state.mode, 'online'); session.close();
});

test('conflicts keep the current record/draft identity; expired or changed sessions clear their private snapshot', async () => {
  for (const [error, status] of [['conflict', 409], ['session_changed', 409], ['no_session', 401]]) {
    const net = transport(...online(), () => response({ error: { code: error } }, status)), session = createServerLibrary({ ...net, cache: memoryCache() });
    await session.connect(); const before = session.state.snapshot;
    await assert.rejects(session.change([{ collection: 'games', id: 'kept', record: before.games[0] }]), code(error));
    assert.equal(session.state.snapshot, error === 'conflict' ? before : null); assert.equal(session.state.mode, error === 'conflict' ? 'conflict' : 'unavailable'); session.close();
  }
});

test('disconnect cancels pending and queued mutations; an old response cannot republish data or cache it for a new context', async () => {
  let release; const gate = new Promise(resolve => { release = resolve; });
  const net = transport(...online(), async () => { await gate; return response(snapshot(a, 1)); }), cache = memoryCache(), session = createServerLibrary({ ...net, cache });
  await session.connect();
  const first = session.change([{ collection: 'games', id: 'kept', record: snapshot().games[0] }]).catch(e => e.code);
  const queued = session.change([]).catch(e => e.code);
  await new Promise(resolve => setImmediate(resolve)); session.disconnect(); release();
  assert.equal(await first, 'library_cancelled'); assert.equal(await queued, 'library_cancelled'); assert.equal(session.state.snapshot, null); assert.equal(session.state.mode, 'off');
  assert.deepEqual(cache.writes.map(s => s.revision), [0]); assert.equal(net.calls.filter(c => c.method === 'POST').length, 1); session.close();
});

test('probes detect a changed cookie owner, and a closed session cannot reconnect or write', async () => {
  const net = transport(...online(), { available: true, scope: b }), session = createServerLibrary({ ...net, cache: memoryCache() });
  await session.connect(); await session.probe(); assert.equal(session.state.snapshot, null); assert.equal(session.state.error, 'session_changed');
  session.close(); const n = net.calls.length; await assert.rejects(session.connect(), code('library_cancelled')); await assert.rejects(session.change([]), code('library_cancelled')); assert.equal(net.calls.length, n);
});

test('an explicit server permission denial never falls back to a previously cached private collection', async () => {
  const saved = { version: 1, scope: a, snapshot: snapshot(), cachedAt: '2026-10-24T09:00:00Z' }, cache = memoryCache([[a, saved]]);
  const net = transport({ available: true, scope: a }, () => response({ error: { code: 'permission_denied' } }, 403));
  const session = createServerLibrary({ ...net, cache }); await session.connect();
  assert.equal(session.state.snapshot, null); assert.equal(session.state.mode, 'unavailable'); assert.equal(session.state.error, 'permission_denied'); assert.deepEqual(cache.reads, []); session.close();
});

test('a fresh permission denial during a probe withdraws the current private snapshot', async () => {
  const cache = memoryCache(), net = transport(...online(), () => response({ error: { code: 'permission_denied' } }, 403));
  const session = createServerLibrary({ ...net, cache }); await session.connect(); assert(session.state.snapshot);
  await session.probe(); assert.equal(session.state.snapshot, null); assert.equal(session.state.mode, 'unavailable'); assert.equal(session.state.error, 'permission_denied'); session.close();
});

test('an unverifiable permission response is not treated as an offline cache fallback', async () => {
  const saved = { version: 1, scope: a, snapshot: snapshot(), cachedAt: '2026-10-24T09:00:00Z' }, cache = memoryCache([[a, saved]]);
  const net = transport({ available: true, scope: a }, () => response({ error: { code: 'permission_unavailable' } }, 503));
  const session = createServerLibrary({ ...net, cache }); await session.connect();
  assert.equal(session.state.snapshot, null); assert.equal(session.state.mode, 'unavailable'); assert.equal(session.state.error, 'permission_unavailable'); assert.deepEqual(cache.reads, []); session.close();
});
