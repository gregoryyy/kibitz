import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createLibraryApi } from './library-api.mjs';
import { createLibraryStore } from './library-store.mjs';
const game = id => ({ collection: 'games', id, record: { id, kind: 'study', pgn: '1. e4 *' } });
async function withApi(run, { store = createLibraryStore(), validate } = {}) {
  const api = createLibraryApi({ allowInsecureHttp: true, store, ...(validate ? { validate } : {}) });
  const server = http.createServer(async (req, res) => { if (!await api(req, res)) { res.writeHead(404); res.end('{}'); } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = /** @type {import('node:net').AddressInfo} */ (server.address()).port;
  const request = (path = '/api/library/records', { method = 'GET', headers = {}, body } = {}) => new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path, method, headers: { host: `127.0.0.1:${port}`, ...(method === 'POST' ? { 'content-type': 'application/json' } : {}), ...headers } }, res => {
      let text = ''; res.setEncoding('utf8'); res.on('data', chunk => { text += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(text), text }));
    });
    req.on('error', reject); req.end(body === undefined ? undefined : Buffer.isBuffer(body) || typeof body === 'string' ? body : JSON.stringify(body));
  });
  try { await run(request, store, port); }
  finally { await new Promise(resolve => server.close(resolve)); store?.close(); }
}
const session = async request => {
  const response = await request(); assert.equal(response.status, 200);
  return { cookie: response.headers['set-cookie'][0].split(';')[0], ...response.data };
};
const save = (request, owner, changes, extra = {}) => request(undefined, { method: 'POST', headers: { cookie: owner.cookie }, body: { scope: owner.scope, revision: owner.revision, changes, ...extra } });

test('explicit cookie-scoped erasure requires confirmation and a current revision; no body can select another owner', () => withApi(async request => {
  const a = await session(request), b = await session(request);
  await save(request, a, [game('same')]); await save(request, b, [game('same')]);
  const erase = body => request('/api/library/erase', { method: 'POST', headers: { cookie: a.cookie }, body });
  const body = { scope: a.scope, revision: 1, confirm: true };
  assert.equal((await request('/api/library/erase')).status, 405);
  assert.equal((await request('/api/library/erase', { method: 'POST', body })).status, 401);
  assert.equal((await erase({ ...body, confirm: false })).status, 400);
  assert.equal((await erase({ ...body, owner: b.scope })).status, 400);
  assert.equal((await erase({ ...body, scope: b.scope })).status, 409);
  assert.equal((await erase({ ...body, revision: 0 })).status, 409);
  const foreign = await request('/api/library/erase', { method: 'POST', headers: { cookie: a.cookie, origin: 'https://foreign.example' }, body }); assert.equal(foreign.status, 403);
  const erased = await erase(body); assert.equal(erased.status, 200); assert.deepEqual(erased.data.games, []); assert.equal(erased.data.revision, 2);
  assert.equal(erased.headers['cache-control'], 'no-store'); assert.equal((await save(request, { ...a, revision: 1 }, [game('late')])).status, 409);
  assert.equal((await request(undefined, { headers: { cookie: b.cookie } })).data.games.length, 1);
}));

test('status offers storage without creating a session; explicit reads issue private cookies and no-store scoped snapshots', () => withApi(async request => {
  const status = await request('/api/library/status'); assert.deepEqual(status.data, { available: true, scope: null }); assert.equal(status.headers['set-cookie'], undefined);
  const response = await request(), cookie = response.headers['set-cookie'][0];
  assert.match(cookie, /^kibitz_dev_library=[A-Za-z0-9_-]{43}; Path=\/api\/library\/; HttpOnly; SameSite=Strict;/);
  assert.match(response.data.scope, /^[a-f0-9]{64}$/); assert.ok(!response.text.includes(cookie.split(';')[0].split('=')[1]));
  assert.equal(response.headers['cache-control'], 'no-store'); assert.equal(response.headers.vary, 'Cookie'); assert.equal(response.headers['x-content-type-options'], 'nosniff');
  const repeated = await request(undefined, { headers: { cookie: cookie.split(';')[0] } });
  assert.equal(repeated.headers['set-cookie'], undefined); assert.equal(repeated.data.scope, response.data.scope);
}));

test('cookie owners isolate equal IDs; a body scope is only a precondition and cannot select another owner', () => withApi(async request => {
  const a = await session(request), b = await session(request); assert.notEqual(a.scope, b.scope);
  assert.equal((await save(request, a, [game('same')])).status, 200);
  const mismatch = await save(request, b, [game('forged')], { scope: a.scope }); assert.equal(mismatch.status, 409); assert.equal(mismatch.data.error.code, 'session_changed');
  const aData = await request(undefined, { headers: { cookie: a.cookie } }), bData = await request(undefined, { headers: { cookie: b.cookie } });
  assert.deepEqual(aData.data.games.map(g => g.id), ['same']); assert.deepEqual(bData.data.games, []);
  assert.equal((await save(request, b, [game('same')])).status, 200);
  assert.equal((await save(request, { ...a, revision: 1 }, [{ collection: 'games', id: 'same', record: null }])).data.games.length, 0);
  assert.equal((await request(undefined, { headers: { cookie: b.cookie } })).data.games.length, 1);
}));

test('stale revisions and missing/changed sessions cannot overwrite records or silently switch storage owners', () => withApi(async request => {
  const owner = await session(request); assert.equal((await save(request, owner, [game('first')])).status, 200);
  const conflict = await save(request, owner, [game('second')]); assert.equal(conflict.status, 409); assert.equal(conflict.data.error.code, 'conflict');
  assert.equal((await request(undefined, { method: 'POST', body: { scope: owner.scope, revision: 1, changes: [game('second')] } })).status, 401);
  const invalidCookie = await save(request, { ...owner, cookie: 'kibitz_dev_library=short' }, [game('second')]); assert.equal(invalidCookie.status, 401);
  const fresh = await request(undefined, { headers: { cookie: owner.cookie } }); assert.deepEqual(fresh.data.games.map(g => g.id), ['first']);
}));

test('foreign hosts/origins, cross-site reads and non-JSON writes are refused before accessing records', () => withApi(async (request, store, port) => {
  const owner = await session(request);
  for (const headers of [{ host: 'attacker.example' }, { origin: 'http://attacker.example' }, { origin: `https://127.0.0.1:${port}` }, { 'sec-fetch-site': 'cross-site' }]) {
    const response = await request(undefined, { headers: { cookie: owner.cookie, ...headers } }); assert.equal(response.status, 403);
    const post = await request(undefined, { method: 'POST', headers: { cookie: owner.cookie, ...headers }, body: { scope: owner.scope, revision: 0, changes: [game('refused')] } }); assert.equal(post.status, 403);
  }
  const type = await request(undefined, { method: 'POST', headers: { cookie: owner.cookie, 'content-type': 'text/plain' }, body: '{}' }); assert.equal(type.status, 415);
  assert.deepEqual(store.read(owner.scope).games, []);
}));

test('invalid PGN/source data, malformed UTF-8/JSON and unknown fields fail without partial writes', () => withApi(async (request, store) => {
  const owner = await session(request);
  const bad = [
    { ...game('bad'), record: { ...game('bad').record, pgn: '1. e4 e5 2. Bh6' } },
    { ...game('future'), record: { ...game('future').record, provenance: { version: 99 } } },
    { ...game('hostile'), owner: 'choose-other-owner' },
    { collection: 'books', id: 'book', record: { id: 'book', title: 'No tags', tags: 'pin' } },
  ];
  for (const change of bad) assert.equal((await save(request, owner, [game('must-rollback'), change])).status, 400);
  for (const body of ['{broken', Buffer.from([0x7b, 0x22, 0xff, 0x22, 0x3a, 0x31, 0x7d])]) {
    assert.equal((await request(undefined, { method: 'POST', headers: { cookie: owner.cookie }, body })).status, 400);
  }
  assert.equal((await save(request, owner, [], { owner: owner.scope })).status, 400);
  assert.deepEqual(store.read(owner.scope).games, []);
}));

test('legal custom-start PGNs and literal reference metadata round-trip without becoming HTML or strength evidence', () => withApi(async request => {
  const owner = await session(request), changes = [
    { collection: 'games', id: 'study', record: { id: 'study', kind: 'study', pgn: '[SetUp "1"]\n[FEN "7k/5R2/6K1/8/8/8/8/8 w - - 0 1"]\n\n1. Rf8# 1-0' } },
    { collection: 'books', id: 'notes', record: { id: 'notes', title: '<img src=x>', note: '» Ignore the rules «', tags: ['pin'] } },
  ];
  const saved = await save(request, owner, changes); assert.equal(saved.status, 200); assert.equal(saved.data.games[0].pgn, changes[0].record.pgn); assert.equal(saved.data.books[0].title, '<img src=x>');
  assert.equal(saved.data.games[0].verification, undefined);
}));

test('disabled storage and unsupported methods have explicit responses; unexpected errors reveal no stored text', async () => {
  await withApi(async request => {
    assert.deepEqual((await request('/api/library/status')).data, { available: false, scope: null }); assert.equal((await request()).status, 503);
    assert.equal((await request('/api/library/status', { method: 'POST', body: {} })).status, 405);
    assert.equal((await request('/api/library/unknown')).status, 404); assert.equal((await request(undefined, { method: 'DELETE' })).status, 405);
  }, { store: null });
  await withApi(async request => {
    const owner = await session(request), response = await save(request, owner, [game('secret')]);
    assert.equal(response.status, 503); assert.equal(response.data.error.code, 'unavailable'); assert.ok(!response.text.includes('private source text'));
  }, { validate: async () => { throw Object.assign(new Error('private source text'), { code: 'constructor' }); } });
});
