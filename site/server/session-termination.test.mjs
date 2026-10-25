import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { DatabaseSync } from 'node:sqlite';
import { tlsMaterial } from '../tests/helpers/tls-material.mjs';
import { httpsCli, tlsRequest } from '../tests/helpers/https-cli.mjs';
import { legacyCookieData } from '../tests/helpers/legacy-cookie-data.mjs';
import { validateOperator, newOperator } from './operator.mjs';
import { sessionStore, SESSION_AGE } from './sessions.mjs';
import { PERMISSIONS, validatePermissions } from './permissions.mjs';
import { createSessionApi } from './session-api.mjs';
import { createApi } from './api.mjs';
import { loadConfig, loadEmbeddingConfig } from './ai.mjs';
import { createLibraryApi } from './library-api.mjs';
import { createLibraryStore } from './library-store.mjs';

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const sid = response => response.headers['set-cookie'].find(value => value.startsWith('__Host-kibitz_session=')).split(';')[0];
async function fixture(t, { provider, embedder, validate, clock = () => Date.now(), identityReady } = {}) {
  const identity = tlsMaterial(), setup = validateOperator({ version: 1, id: identity.operatorId, secret: identity.secret });
  const registry = path.join(identity.dir, 'sessions.sqlite'); fs.writeFileSync(registry, '', { flag: 'wx', mode: 0o600 });
  const store = sessionStore(registry, { now: clock }), books = createLibraryStore();
  const auth = createSessionApi({ operator: setup, store, permissions: () => validatePermissions({ version: 1, operator: setup.id, allow: [...PERMISSIONS] }, setup), now: clock, pollMs: 15 });
  const identityOf = (req, res, kind) => { const value = auth.identity(req, res, kind); identityReady?.resolve(); return value; };
  const library = createLibraryApi({ store: books, identity: identityOf, ...(validate ? { validate } : {}) });
  const api = createApi({ config: loadConfig({ AI_PROVIDER: 'mock' }), identity: identityOf, ...(provider ? { provider } : {}), ...(embedder ? { embedder, embeddingConfig: loadEmbeddingConfig({ EMBEDDING_PROVIDER: 'mock' }) } : {}), log: { error() {}, info() {} } });
  const server = https.createServer({ key: fs.readFileSync(identity.key), cert: identity.ca }, async (req, res) => { if (await auth.handle(req, res) || await library(req, res) || await api(req, res)) return; res.end(); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const base = `https://127.0.0.1:${server.address().port}`;
  t.after(async () => { auth.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); books.close(); store.close(); identity.close(); });
  const call = (route, options) => tlsRequest(base + route, identity.ca, options);
  const login = async () => { const response = await call('/api/library/session', { body: { secret: identity.secret, migrate: true } }); assert.equal(response.status, 200); return sid(response); };
  return { identity, setup, registry, store, books, base, call, login };
}
function pendingRequest(base, ca, cookie, route, body, { flush = false } = {}) {
  let resolve; const done = new Promise(result => { resolve = result; }); let text = '', settled = false;
  const finish = value => { if (!settled) { settled = true; resolve({ ...value, text }); } };
  const req = https.request(base + route, { ca, agent: false, method: 'POST', headers: { cookie, 'content-type': 'application/json' } }, res => {
    res.on('data', part => text += part); res.once('end', () => finish({ status: res.statusCode })); res.once('aborted', () => finish({ closed: true }));
  });
  req.once('error', () => finish({ closed: true })); req.setTimeout(5000, () => { req.destroy(); finish({ timeout: true }); });
  if (flush) req.flushHeaders(); else req.end(JSON.stringify(body)); return { done, req };
}

test('real CLI logout invalidates copied tokens across restart while preserving records and proof-authorized recovery', { timeout: 15000 }, async t => {
  const identity = tlsMaterial(); t.after(identity.close); const root = path.join(identity.dir, 'public'); fs.mkdirSync(root); fs.writeFileSync(path.join(root, '_test.html'), '<title>Termination fixture</title>');
  const data = legacyCookieData(identity.dir), legacy = `kibitz_uid=${data.uid}; kibitz_library=${data.token}`;
  let server; t.after(async () => server?.close());
  const start = async () => { const script = process.env.KIBITZ_TERMINATION_SERVER_SCRIPT; server = await httpsCli({ script, root, key: identity.key, cert: identity.cert, operatorSecret: identity.secret, library: data.library, usage: data.usage,
    extra: script ? ['--operator', identity.operator, '--sessions', path.join(identity.dir, 'sessions.sqlite')] : [] }); };
  await start(); const cookie = await server.login(legacy), independent = await server.login();
  const call = (route, opts) => tlsRequest(server.base + route, identity.ca, opts);
  for (const options of [{ headers: { origin: 'https://attacker.invalid' }, body: {} }, { body: { unwanted: true } }]) {
    const failed = await call('/api/session/logout', { cookie, ...options }); assert([400, 403].includes(failed.status), 'Invalid logout response status: ' + failed.status); assert.equal(failed.headers['set-cookie'], undefined);
    assert.equal((await call('/api/ai/status', { cookie })).status, 200);
  }
  const logout = await call('/api/session/logout', { cookie, body: {} }); assert.equal(logout.status, 200); assert.match(logout.headers['set-cookie'][0], /__Host-kibitz_session=; Path=\/; Secure; HttpOnly; SameSite=Strict; Max-Age=0$/);
  for (const route of ['/api/ai/status', '/api/library/records']) assert.equal((await call(route, { cookie })).status, 401);
  assert.equal((await call('/api/session/logout', { cookie, body: {} })).status, 401);
  assert.equal((await call('/api/ai/status', { cookie: independent })).status, 200);
  await server.close(); await start(); assert.equal((await call('/api/library/records', { cookie })).status, 401);
  const recovered = await server.login(legacy); assert.deepEqual((await call('/api/library/records', { cookie: recovered })).data().games, [data.record]);
  const db = new DatabaseSync(path.join(identity.dir, 'sessions.sqlite')); db.prepare('UPDATE sessions SET expires=?').run(Date.now() - 1); db.close();
  assert.equal((await call('/api/library/records', { cookie: recovered })).status, 401); await server.close(); await start();
  assert.equal((await call('/api/library/records', { cookie: recovered })).status, 401);
});

test('revocation cannot remove another operator or credential epoch; expired rows can be pruned without losing ownership', { timeout: 15000 }, async t => {
  const f = await fixture(t), a = f.setup, b = validateOperator(newOperator()), issued = f.store.issue(a);
  assert.equal(f.store.revoke(b, issued.value), false); assert(f.store.verify(a, issued.value));
  const changed = validateOperator({ ...newOperator(), id: a.id }); assert.equal(f.store.revoke(changed, issued.value), false);
  assert.equal(f.store.revoke(a, issued.value), true); assert.equal(f.store.revoke(a, issued.value), false); assert.throws(() => f.store.verify(a, issued.value));
  let now = 100; const store = sessionStore(':memory:', { limit: 1, now: () => now }); t.after(store.close);
  const original = store.issue(a), claims = store.verify(a, original.value); now += SESSION_AGE;
  const next = store.issue(a, claims); assert.equal(store.verify(a, next.value).library, claims.library); store.revoke(a, next.value); assert.throws(() => store.issue(b, claims), error => error.code === 'session_conflict');
});

for (const route of ['sample', 'test', 'structured']) test(`logout aborts a held ${route} request and suppresses uncancellable late output; other sessions remain usable`, { timeout: 15000 }, async t => {
  const started = deferred(), gate = deferred(), aborted = deferred();
  const provider = { async *chat(_messages, { signal }) { signal.addEventListener('abort', () => aborted.resolve(), { once: true }); started.resolve(); yield 'BEFORE'; await gate.promise; yield 'PRIVATE_LATE_OUTPUT'; return {}; } };
  const f = await fixture(t, { provider }); t.after(gate.resolve); const cookie = await f.login(), other = await f.login();
  const pending = pendingRequest(f.base, f.identity.ca, cookie, '/api/ai/' + route, { prompt: 'hello', format: 'annotations' }); await started.promise;
  assert.equal((await f.call('/api/session/logout', { cookie, body: {} })).status, 200); await aborted.promise; gate.resolve();
  const result = await pending.done; assert(result.closed); assert(!result.text.includes('PRIVATE_LATE_OUTPUT'));
  assert.equal((await f.call('/api/ai/status', { cookie: other })).status, 200);
});

test('logout during asynchronous library validation prevents the later private mutation', { timeout: 15000 }, async t => {
  const started = deferred(), gate = deferred(); const f = await fixture(t, { validate: async () => { started.resolve(); await gate.promise; } }); t.after(gate.resolve);
  const cookie = await f.login(), before = (await f.call('/api/library/records', { cookie })).data();
  const record = { id: 'late-book', title: 'private', tags: [] };
  const pending = pendingRequest(f.base, f.identity.ca, cookie, '/api/library/records', { scope: before.scope, revision: before.revision, changes: [{ collection: 'books', id: record.id, record }] });
  await started.promise; await f.call('/api/session/logout', { cookie, body: {} }); gate.resolve(); assert((await pending.done).closed);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(f.books.read(before.scope), before);
});

test('another actual CLI process revokes a held stream through the shared registry', { timeout: 15000 }, async t => {
  const started = deferred(), gate = deferred(), aborted = deferred();
  const f = await fixture(t, { provider: { async *chat(_messages, { signal }) { signal.addEventListener('abort', () => aborted.resolve(), { once: true }); started.resolve(); yield 'BEFORE'; await gate.promise; yield 'PRIVATE_CROSS_PROCESS'; return {}; } } }); t.after(gate.resolve);
  const cookie = await f.login(), root = path.join(f.identity.dir, 'public'); fs.mkdirSync(root); fs.writeFileSync(path.join(root, '_test.html'), '<title>Other process</title>');
  const other = await httpsCli({ root, key: f.identity.key, cert: f.identity.cert, operatorSecret: f.identity.secret }); t.after(other.close);
  const pending = pendingRequest(f.base, f.identity.ca, cookie, '/api/ai/sample', { prompt: 'hello' }); await started.promise;
  assert.equal((await tlsRequest(other.base + '/api/session/logout', f.identity.ca, { cookie, body: {} })).status, 200);
  await aborted.promise; gate.resolve(); const result = await pending.done; assert(result.closed); assert(!result.text.includes('PRIVATE_CROSS_PROCESS'));
});

test('backend expiry between headers and body rejects provider admission, even before the polling timer fires', { timeout: 15000 }, async t => {
  let now = Date.now(), calls = 0; const ready = deferred();
  const f = await fixture(t, { clock: () => now, identityReady: ready, provider: { async *chat() { calls++; yield 'PRIVATE'; return {}; } } });
  const cookie = await f.login(), pending = pendingRequest(f.base, f.identity.ca, cookie, '/api/ai/sample', undefined, { flush: true });
  await ready.promise; now += SESSION_AGE; pending.req.end(JSON.stringify({ prompt: 'after expiry' }));
  const result = await pending.done; assert(result.closed || result.status === 401); assert.equal(calls, 0); assert(!result.text.includes('PRIVATE'));
});

test('absolute backend expiry stops held model output and library writes without a logout request', { timeout: 15000 }, async t => {
  let now = Date.now(); const streamStarted = deferred(), writeStarted = deferred(), gate = deferred(), aborted = deferred();
  const f = await fixture(t, { clock: () => now,
    provider: { async *chat(_messages, { signal }) { signal.addEventListener('abort', () => aborted.resolve(), { once: true }); streamStarted.resolve(); yield 'BEFORE'; await gate.promise; yield 'PRIVATE_EXPIRED'; return {}; } },
    validate: async () => { writeStarted.resolve(); await gate.promise; } }); t.after(gate.resolve);
  const cookie = await f.login(), before = (await f.call('/api/library/records', { cookie })).data();
  const stream = pendingRequest(f.base, f.identity.ca, cookie, '/api/ai/sample', { prompt: 'hello' }); await streamStarted.promise;
  const record = { id: 'expired-book', title: 'private', tags: [] };
  const write = pendingRequest(f.base, f.identity.ca, cookie, '/api/library/records', { scope: before.scope, revision: before.revision, changes: [{ collection: 'books', id: record.id, record }] }); await writeStarted.promise;
  now += SESSION_AGE; await aborted.promise; gate.resolve();
  const result = await stream.done; assert(result.closed); assert(!result.text.includes('PRIVATE_EXPIRED')); const rejected = await write.done; assert(rejected.closed || rejected.status === 401);
  await new Promise(resolve => setImmediate(resolve)); assert.deepEqual(f.books.read(before.scope), before);
});

test('logout cancels held embeddings and prevents vectors being returned after termination', { timeout: 15000 }, async t => {
  const started = deferred(), aborted = deferred(), gate = deferred();
  const f = await fixture(t, { embedder: { async embedBatch(_texts, { signal }) { signal.addEventListener('abort', () => aborted.resolve(), { once: true }); started.resolve(); await gate.promise; return { vectors: [[0.11, 0.22]], usage: { input: 1, output: 0 } }; } } }); t.after(gate.resolve);
  const cookie = await f.login(), meta = (await f.call('/api/ai/embeddings', { cookie })).data();
  const pending = pendingRequest(f.base, f.identity.ca, cookie, '/api/ai/embeddings', { texts: ['private passage'], fingerprint: meta.fingerprint, scope: meta.scope }); await started.promise;
  await f.call('/api/session/logout', { cookie, body: {} }); await aborted.promise; gate.resolve();
  const result = await pending.done; assert(result.closed); assert(!result.text.includes('vectors'));
});
