import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tlsMaterial } from '../tests/helpers/tls-material.mjs';
import { httpsCli, tlsRequest } from '../tests/helpers/https-cli.mjs';
import { legacyCookieData } from '../tests/helpers/legacy-cookie-data.mjs';
import { createApi } from './api.mjs';
import { createLibraryApi } from './library-api.mjs';
import { loadConfig } from './ai.mjs';
import { PERMISSIONS, validatePermissions } from './permissions.mjs';
import { createSessionApi } from './session-api.mjs';
import { sessionStore } from './sessions.mjs';
import { newOperator, validateOperator } from './operator.mjs';

async function fixture(t, options = {}) {
  const identity = tlsMaterial(); t.after(identity.close);
  const root = path.join(identity.dir, 'public'); fs.mkdirSync(root); fs.writeFileSync(path.join(root, '_test.html'), '<title>Session boundary</title>');
  const server = await httpsCli({ root, key: identity.key, cert: identity.cert, operatorSecret: identity.secret, final: true, ...options }); t.after(server.close);
  return { identity, root, server, call: (route, options) => tlsRequest(server.base + route, identity.ca, options) };
}

test('real final CLI rejects missing, forged, duplicate and raw grouping assertions before all gateway/library functions', async t => {
  const { server, identity, call } = await fixture(t);
  const legacy = 'kibitz_uid=' + 'a'.repeat(22) + '; __Secure-kibitz_library=' + 'b'.repeat(43);
  for (const [route, body] of [['/api/ai/status'], ['/api/ai/config', {}], ['/api/ai/test', {}], ['/api/ai/sample', { prompt: 'private prompt' }],
    ['/api/ai/structured', {}], ['/api/ai/embeddings'], ['/api/ai/embeddings', {}], ['/api/library/status'], ['/api/library/records'], ['/api/library/records', {}], ['/api/library/erase', {}]]) {
    const response = await call(route, { cookie: legacy, body }); assert.equal(response.status, 401, route); assert.equal(response.headers['set-cookie'], undefined); assert.equal(response.headers['cache-control'], 'no-store');
  }
  assert.deepEqual((await call('/api/session/status')).data(), { required: true, authenticated: false });
  const bad = await call('/api/library/session', { body: { secret: 'x'.repeat(43), migrate: true }, cookie: legacy }); assert.equal(bad.status, 401); assert.equal(bad.headers['set-cookie'], undefined);
  const cookie = await server.login(); const value = cookie.split('=')[1];
  for (const forged of ['__Host-kibitz_session=' + 'x'.repeat(43), cookie + '; ' + cookie, '__Host-kibitz_session=' + value.slice(1)]) assert.equal((await call('/api/ai/status', { cookie: forged })).status, 401);
  const status = await call('/api/ai/status', { cookie }); assert.equal(status.status, 200); assert.equal(status.data().usage.requests, 0);
  const answer = await call('/api/ai/sample', { cookie, body: { prompt: 'Explain the position' } }); assert.equal(answer.status, 200); assert.match(answer.text.trim().split('\n').map(line => JSON.parse(line).text || '').join(''), /Mock coach/);
  assert(!server.output().includes(identity.secret)); assert(!server.output().includes(value)); assert(!server.output().includes('private prompt'));
});

test('fresh operator proof adopts existing private records; changing legacy assertions after sign-in cannot change ownership', async t => {
  const { server, identity } = await fixture(t); const data = legacyCookieData(identity.dir);
  // Start the actual CLI with pre-existing databases, separately from the initial empty fixture.
  await server.close(); const migrated = await httpsCli({ root: path.join(identity.dir, 'public'), key: identity.key, cert: identity.cert, operatorSecret: identity.secret, library: data.library, usage: data.usage, final: true }); t.after(migrated.close);
  const request = (route, opts) => tlsRequest(migrated.base + route, identity.ca, opts);
  const proof = await request('/api/library/session', { cookie: `kibitz_uid=${data.uid}; kibitz_library=${data.token}`, body: { secret: identity.secret, migrate: true } });
  assert.equal(proof.status, 200); assert.equal(proof.headers['set-cookie'].length, 5);
  const protectedCookie = proof.headers['set-cookie'].find(value => value.startsWith('__Host-kibitz_session='));
  assert.match(protectedCookie, /Path=\/; Secure; HttpOnly; SameSite=Strict; Max-Age=43200$/);
  const cookie = protectedCookie.split(';')[0];
  const locators = proof.headers['set-cookie'].filter(value => value.startsWith('__Secure-')).map(value => value.split(';')[0]).join('; ');
  const fresh = await migrated.login(locators);
  assert.equal((await request('/api/library/records', { cookie: fresh })).data().scope, data.scope);
  assert.equal((await request('/api/library/records', { cookie: locators })).status, 401); // locators never authorize
  const saved = await request('/api/library/records', { cookie: cookie + '; __Secure-kibitz_library=' + 'z'.repeat(43) });
  assert.equal(saved.status, 200); assert.equal(saved.data().scope, data.scope); assert.deepEqual(saved.data().games, [data.record]);
  assert.equal((await request('/api/ai/status', { cookie })).data().user.requests, 1);
  await migrated.close(); const restarted = await httpsCli({ root: path.join(identity.dir, 'public'), key: identity.key, cert: identity.cert, operatorSecret: identity.secret, library: data.library, usage: data.usage, final: true }); t.after(restarted.close);
  assert.equal((await tlsRequest(restarted.base + '/api/library/records', identity.ca, { cookie })).data().scope, data.scope);
  const renewed = await restarted.login(cookie);
  assert.equal((await tlsRequest(restarted.base + '/api/library/records', identity.ca, { cookie })).status, 401); // old session invalidated at reauthentication
  assert.equal((await tlsRequest(restarted.base + '/api/library/records', identity.ca, { cookie: renewed })).data().scope, data.scope);
});

test('replacing the operator rejects another owner’s issued session and refuses collection reassignment on actual restart', async t => {
  const { identity, root, server } = await fixture(t);
  const issued = await tlsRequest(server.base + '/api/library/session', identity.ca, { body: { secret: identity.secret, migrate: true } });
  const cookie = issued.headers['set-cookie'].filter(value => !value.includes('Max-Age=0')).map(value => value.split(';')[0]).join('; ');
  await server.close(); const replacement = newOperator(); fs.writeFileSync(identity.operator, JSON.stringify(replacement));
  fs.writeFileSync(identity.policy, JSON.stringify({ version: 1, operator: replacement.id, allow: [...PERMISSIONS] }));
  const next = await httpsCli({ root, key: identity.key, cert: identity.cert, operatorSecret: replacement.secret, final: true }); t.after(next.close);
  assert.equal((await tlsRequest(next.base + '/api/ai/status', identity.ca, { cookie })).status, 401);
  const adoption = await tlsRequest(next.base + '/api/library/session', identity.ca, { cookie: cookie.split('; ').filter(part => part.startsWith('__Secure-')).join('; '), body: { secret: replacement.secret, migrate: true } });
  assert.equal(adoption.status, 409); assert.equal(adoption.headers['set-cookie'], undefined);
});

test('session proof is bounded, JSON only, same-origin, non-cacheable and rate limited without issuing cookies on failure', async t => {
  const { identity, call } = await fixture(t);
  const body = { secret: identity.secret, migrate: true };
  for (const headers of [{ origin: 'https://attacker.invalid' }, { 'sec-fetch-site': 'cross-site' }]) {
    const response = await call('/api/library/session', { body, headers }); assert.equal(response.status, 403); assert.equal(response.headers['set-cookie'], undefined);
  }
  for (const [value, headers] of [[body, { 'content-type': 'text/plain' }], [{ ...body, unexpected: true }, {}], [{ ...body, secret: 'x'.repeat(5000) }, {}]]) {
    const response = await call('/api/library/session', { body: value, headers }); assert.equal(response.status, 400); assert.equal(response.headers['set-cookie'], undefined);
  }
  let limited = false;
  for (let i = 0; i < 12; i++) { const response = await call('/api/library/session', { body: { secret: 'x'.repeat(43), migrate: false } }); if (response.status === 429) limited = true; assert.equal(response.headers['set-cookie'], undefined); }
  assert(limited);
});

test('missing or public operator configuration fails before creating any private databases', t => {
  const identity = tlsMaterial(); t.after(identity.close); const root = path.join(identity.dir, 'public'); fs.mkdirSync(root);
  const script = fileURLToPath(new URL('../scripts/serve.mjs', import.meta.url));
  for (const operator of [undefined, path.join(root, 'operator.json')]) {
    if (operator) fs.writeFileSync(operator, fs.readFileSync(identity.operator), { mode: 0o600 });
    const dir = path.join(identity.dir, 'must-not-create');
    const result = spawnSync(process.execPath, [script, root, '--api', '--env=', '--tls-key', identity.key, '--tls-cert', identity.cert,
      '--sessions', path.join(dir, 'sessions.sqlite'), '--usage', path.join(dir, 'usage.sqlite'), ...(operator ? ['--operator', operator] : [])], { encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 1); assert.equal(JSON.parse(result.stderr.trim()).code, 'ERR_KIBITZ_OPERATOR_CONFIG'); assert(!fs.existsSync(dir)); assert(!result.stderr.includes(identity.secret));
  }
});

test('direct TLS API construction fails closed without a backend identity authority', async t => {
  const identity = tlsMaterial(); t.after(identity.close);
  const api = createApi({ config: loadConfig({ AI_PROVIDER: 'mock' }) }), library = createLibraryApi();
  const server = https.createServer({ key: fs.readFileSync(identity.key), cert: identity.ca }, async (req, res) => { if (await library(req, res) || await api(req, res)) return; res.end(); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  for (const route of ['/api/ai/status', '/api/library/status']) assert.equal((await tlsRequest(`https://127.0.0.1:${server.address().port}${route}`, identity.ca, { cookie: '__Secure-kibitz_uid=' + 'a'.repeat(22) })).status, 401);
});

test('the documented proof limit resets after one minute without permanently disabling the operator', async t => {
  const identity = tlsMaterial(); t.after(identity.close); let now = 1000;
  const operator = validateOperator(newOperator()), store = sessionStore(':memory:', { now: () => now }); t.after(store.close);
  const api = createSessionApi({ operator, store, permissions: () => validatePermissions({ version: 1, operator: operator.id, allow: [...PERMISSIONS] }, operator), now: () => now });
  const server = https.createServer({ key: fs.readFileSync(identity.key), cert: identity.ca }, (req, res) => api.handle(req, res));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const url = `https://127.0.0.1:${server.address().port}/api/library/session`;
  for (let i = 0; i < 10; i++) assert.equal((await tlsRequest(url, identity.ca, { body: { secret: 'x'.repeat(43), migrate: true } })).status, 401);
  assert.equal((await tlsRequest(url, identity.ca, { body: { secret: operator.secret, migrate: true } })).status, 429);
  now += 60_000; const allowed = await tlsRequest(url, identity.ca, { body: { secret: operator.secret, migrate: true } }); assert.equal(allowed.status, 200);
});
