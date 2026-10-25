import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { tlsMaterial } from '../tests/helpers/tls-material.mjs';
import { httpsCli, tlsRequest } from '../tests/helpers/https-cli.mjs';
import { updatePermissions } from '../tests/helpers/permission-policy.mjs';
import { legacyCookieData } from '../tests/helpers/legacy-cookie-data.mjs';
import { PERMISSIONS, readPermissions } from './permissions.mjs';
import { validateOperator } from './operator.mjs';
import { createSessionApi } from './session-api.mjs';
import { sessionStore } from './sessions.mjs';
import { createApi } from './api.mjs';
import { loadConfig } from './ai.mjs';

const routes = [
  ['GET', '/api/ai/status', 'ai:read'], ['POST', '/api/ai/config', 'ai:configure'], ['POST', '/api/ai/test', 'ai:test'],
  ['POST', '/api/ai/sample', 'ai:coach'], ['POST', '/api/ai/structured', 'ai:coach'],
  ['GET', '/api/ai/embeddings', 'ai:embed'], ['POST', '/api/ai/embeddings', 'ai:embed'],
  ['GET', '/api/library/status', 'library:read'], ['GET', '/api/library/records', 'library:read'],
  ['POST', '/api/library/records', 'library:write'], ['POST', '/api/library/erase', 'library:erase'],
];
async function fixture(t, allow = [...PERMISSIONS], existing = false) {
  const identity = tlsMaterial({ permissions: allow }); t.after(identity.close);
  const root = path.join(identity.dir, 'public'); fs.mkdirSync(root); fs.writeFileSync(path.join(root, '_test.html'), '<title>Permission boundary</title>');
  const data = existing ? legacyCookieData(identity.dir) : null, script = process.env.KIBITZ_PERMISSION_SERVER_SCRIPT;
  const server = await httpsCli({ root, key: identity.key, cert: identity.cert, operatorSecret: identity.secret, final: true, script,
    ...(data ? { library: data.library, usage: data.usage } : {}),
    extra: script ? ['--operator', identity.operator, '--sessions', path.join(identity.dir, 'sessions.sqlite')] : [] }); t.after(server.close);
  const cookie = await server.login(data ? `kibitz_uid=${data.uid}; kibitz_library=${data.token}` : '');
  return { identity, server, root, cookie, data, call: (route, options = {}) => tlsRequest(server.base + route, identity.ca, { cookie, ...options }) };
}

test('an authenticated operator with no grants cannot execute any gateway or library function or alter usage/data', async t => {
  const f = await fixture(t, [], true);
  const db = new DatabaseSync(f.data.usage, { readOnly: true }); t.after(() => db.close()); const counters = () => db.prepare('SELECT * FROM counters ORDER BY scope').all(); const before = counters();
  for (const [method, route] of routes) {
    const response = await f.call(route, { method, ...(method === 'POST' ? { body: {} } : {}) });
    assert.equal(response.status, 403, route); assert.equal(response.data().error.code, 'permission_denied'); assert.equal(response.headers['set-cookie'], undefined);
    for (const marker of [f.data.uid, f.data.token, 'legacy-study', f.identity.secret, f.identity.operatorId]) assert(!response.text.includes(marker));
  }
  assert.deepEqual(counters(), before); const status = await f.call('/api/session/status'); assert.deepEqual(status.data().permissions, []); assert.equal(status.data().authenticated, true);
  updatePermissions(f.identity, [...PERMISSIONS]); const retained = await f.call('/api/library/records'); assert.equal(retained.status, 200); assert.equal(retained.data().scope, f.data.scope); assert.deepEqual(retained.data().games, [f.data.record]);
  assert(!f.server.output().includes(f.identity.secret)); assert(!f.server.output().includes(f.identity.operatorId));
});

test('the real CLI enforces independent function grants including both library read and mutation permissions', async t => {
  const f = await fixture(t), initial = (await f.call('/api/library/records')).data(); let revision = initial.revision;
  for (const grant of PERMISSIONS) {
    updatePermissions(f.identity, ['library:write', 'library:erase'].includes(grant) ? ['library:read', grant] : [grant]);
    for (const [method, route, required] of routes) {
      const allowed = grant === required || required === 'library:read' && grant.startsWith('library:');
      let body = { prompt: 'Explain the position', format: 'annotations' };
      if (route === '/api/library/records') body = { scope: initial.scope, revision, changes: [{ collection: 'books', id: 'permitted-book', record: { id: 'permitted-book', title: 'Private reference', tags: [] } }] };
      if (route === '/api/library/erase') body = { scope: initial.scope, revision, confirm: true };
      if (required === 'ai:embed' && allowed && method === 'POST') { const meta = (await f.call(route)).data(); body = { texts: ['private passage'], fingerprint: meta.fingerprint, scope: meta.scope }; }
      const response = await f.call(route, { method, ...(method === 'POST' ? { body } : {}) }); assert.equal(response.status, allowed ? 200 : 403, grant + ' ' + method + ' ' + route);
      if (!allowed) assert.equal(response.data().error.code, 'permission_denied');
      else if (method === 'POST' && route.startsWith('/api/library/')) revision = response.data().revision;
    }
  }
  updatePermissions(f.identity, ['library:write']); assert.equal((await f.call('/api/library/records', { body: { scope: initial.scope, revision, changes: [] } })).status, 403);
  // Neither browser fields nor the provider-consent header can add policy grants.
  for (const route of ['/api/ai/sample?permission=ai:coach', '/api/ai/test']) assert.equal((await f.call(route, { headers: { 'x-kibitz-provider-consent': 'mock:coach' }, body: { permissions: [...PERMISSIONS], prompt: 'hello' } })).status, 403);
});

test('cross-collection scope fields and unknown functions cannot broaden an allowed operator session', async t => {
  const f = await fixture(t), a = (await f.call('/api/library/records')).data(), other = await f.server.login();
  const b = (await f.call('/api/library/records', { cookie: other })).data(); assert.notEqual(a.scope, b.scope);
  const response = await f.call('/api/library/records', { cookie: other, body: { scope: a.scope, revision: a.revision, changes: [] } }); assert.equal(response.status, 409);
  assert.equal((await f.call('/api/ai/unknown')).status, 403);
  updatePermissions(f.identity, [...PERMISSIONS], 'a'.repeat(32));
  const bad = await f.call('/api/ai/status'); assert.equal(bad.status, 503); assert.equal(bad.data().error.code, 'permission_unavailable'); assert(!bad.text.includes(f.identity.operatorId));
  // A broken/missing feature policy cannot prevent termination of the operator's own session.
  assert.equal((await f.call('/api/session/logout', { body: {} })).status, 200);
});

test('missing, invalid or public permission configuration stops actual CLI startup before private database creation', t => {
  const identity = tlsMaterial(); t.after(identity.close); const root = path.join(identity.dir, 'public'); fs.mkdirSync(root);
  const script = fileURLToPath(new URL('../scripts/serve.mjs', import.meta.url));
  const exposed = path.join(root, 'permissions.json'); fs.writeFileSync(exposed, JSON.stringify({ version: 1, operator: identity.operatorId, allow: [...PERMISSIONS] }), { flag: 'wx', mode: 0o600 });
  for (const policy of [null, path.join(identity.dir, 'missing.json'), exposed]) {
    const dir = path.join(identity.dir, 'never-create');
    const result = spawnSync(process.execPath, [script, root, '--api', '--env=', '--operator', identity.operator, '--tls-key', identity.key, '--tls-cert', identity.cert,
      '--sessions', path.join(dir, 'sessions.sqlite'), '--usage', path.join(dir, 'usage.sqlite'), ...(policy ? ['--permissions', policy] : [])], { encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 1); assert.equal(JSON.parse(result.stderr.trim()).code, 'ERR_KIBITZ_PERMISSIONS_CONFIG'); assert(!fs.existsSync(dir)); assert(!result.stderr.includes(identity.dir));
  }
});

test('revoking a function while a provider is held cancels output without revoking the authenticated session', { timeout: 15000 }, async t => {
  const identity = tlsMaterial(); t.after(identity.close); const operator = validateOperator({ version: 1, id: identity.operatorId, secret: identity.secret });
  const store = sessionStore(); t.after(store.close); const auth = createSessionApi({ operator, store, pollMs: 10, permissions: () => readPermissions(identity.policy, [], operator) });
  let release, aborted; const gate = new Promise(resolve => { release = resolve; }), stopped = new Promise(resolve => { aborted = resolve; });
  const provider = { async *chat(_messages, { signal }) { signal.addEventListener('abort', aborted, { once: true }); yield 'BEFORE'; await gate; yield 'PRIVATE_LATE'; return {}; } };
  const api = createApi({ config: loadConfig({ AI_PROVIDER: 'mock' }), provider, identity: auth.identity, log: { error() {}, info() {} } });
  const server = https.createServer({ key: fs.readFileSync(identity.key), cert: identity.ca }, async (req, res) => { if (await auth.handle(req, res) || await api(req, res)) return; res.end(); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(async () => { release(); auth.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const base = `https://127.0.0.1:${server.address().port}`, cookie = '__Host-kibitz_session=' + store.issue(operator).value;
  let delivered; const firstChunk = new Promise(resolve => { delivered = resolve; });
  const pending = new Promise((resolve, reject) => {
    const req = https.request(base + '/api/ai/sample', { ca: identity.ca, agent: false, method: 'POST', headers: { cookie, 'content-type': 'application/json' } }, res => {
      let text = ''; res.on('data', part => { text += part; if (text.includes('BEFORE')) delivered(); });
      res.once('aborted', () => resolve({ closed: true, text })); res.once('error', () => resolve({ closed: true, text }));
      res.once('end', () => resolve({ status: res.statusCode, text }));
    });
    req.once('error', reject); req.setTimeout(5000, () => req.destroy(Error('fixture timeout'))); req.end(JSON.stringify({ prompt: 'private' }));
  }); pending.catch(() => {});
  await Promise.race([firstChunk, pending.then(result => { throw Error('Stream ended before its held part: ' + result.status); })]);
  updatePermissions(identity, ['ai:read']); await stopped; release(); const result = await pending;
  assert(result.closed); assert(!result.text.includes('PRIVATE_LATE'));
  assert.equal((await tlsRequest(base + '/api/ai/status', identity.ca, { cookie })).status, 200);
  assert.equal((await tlsRequest(base + '/api/ai/sample', identity.ca, { cookie, body: { prompt: 'new request' } })).status, 403);
});

test('a standalone TLS handler cannot turn a custom grouping identity into function authority', async t => {
  const identity = tlsMaterial(); t.after(identity.close);
  const api = createApi({ config: loadConfig({ AI_PROVIDER: 'mock' }), identity: () => 'a'.repeat(22) });
  const server = https.createServer({ key: fs.readFileSync(identity.key), cert: identity.ca }, api);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const response = await tlsRequest(`https://127.0.0.1:${server.address().port}/api/ai/status`, identity.ca);
  assert.equal(response.status, 403); assert.equal(response.data().error.code, 'permission_denied');
});
