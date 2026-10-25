import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { tlsMaterial } from '../tests/helpers/tls-material.mjs';
import { httpsCli } from '../tests/helpers/https-cli.mjs';
import { legacyCookieData } from '../tests/helpers/legacy-cookie-data.mjs';

function request(url, ca, cookie = '', body = undefined, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { ca, agent: false, timeout: 5000, method: body === undefined ? 'GET' : 'POST',
      headers: { cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers } }, res => {
      let text = ''; res.setEncoding('utf8'); res.on('data', part => text += part);
      res.on('end', () => resolve({ status: res.statusCode, cookies: res.headers['set-cookie'] || [], data: JSON.parse(text) }));
    });
    req.once('error', reject); req.once('timeout', () => req.destroy(Error('Request timed out')));
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

test('real native HTTPS migration preserves library ownership, revisions, usage, restart and recoverable legacy identities', async t => {
  const identity = tlsMaterial(); t.after(identity.close);
  const root = path.join(identity.dir, 'public'); fs.mkdirSync(root); fs.writeFileSync(path.join(root, '_test.html'), '<title>Migration fixture</title>');
  const data = legacyCookieData(identity.dir), backup = `kibitz_uid=${data.uid}; kibitz_library=${data.token}`;
  let server;
  t.after(async () => { await server?.close(); });
  const start = async script => { server = await httpsCli({ script, root, key: identity.key, cert: identity.cert, library: data.library, usage: data.usage }); };
  await start();
  const call = (route, cookie, body, headers) => request(server.base + '/api/' + route, identity.ca, cookie, body, headers);
  const original = await call('library/status', backup); assert.equal(original.data.scope, data.scope);
  assert.equal(original.cookies.length, 2); assert(original.cookies[0].startsWith(`__Secure-kibitz_library=${data.token};`));
  const usage = await call('ai/status', backup); assert.equal(usage.data.user.requests, 1); assert.equal(usage.data.usage.requests, 1);
  assert.equal(usage.data.user.input, 11); assert.equal(usage.data.user.output, 7);
  const protectedCookie = `__Secure-kibitz_uid=${data.uid}; __Secure-kibitz_library=${data.token}`;
  const before = await call('library/records', protectedCookie); assert.equal(before.data.revision, 1); assert.deepEqual(before.data.games, [data.record]); assert.deepEqual(before.cookies, []);
  const next = { id: 'after-upgrade', kind: 'study', pgn: '1. d4 d5 *' };
  const saved = await call('library/records', protectedCookie, { scope: data.scope, revision: 1, changes: [{ collection: 'games', id: next.id, record: next }] });
  assert.equal(saved.status, 200); assert.equal(saved.data.revision, 2);
  assert.equal((await call('ai/test', protectedCookie, {})).status, 200);
  const refused = await call('library/records', `__Secure-kibitz_library=invalid; ${backup}`);
  assert.equal(refused.status, 400); assert.deepEqual(refused.cookies, []);
  const forbidden = await call('ai/status', backup, undefined, { origin: 'http://attacker.invalid' }); assert.equal(forbidden.status, 403); assert.deepEqual(forbidden.cookies, []);
  const stranger = await call('library/records', ''); assert.notEqual(stranger.data.scope, data.scope); assert.deepEqual(stranger.data.games, []);
  await server.close(); await start(process.env.KIBITZ_COOKIE_ROLLBACK_SCRIPT);
  // The saved pre-upgrade identity still selects every post-upgrade write. No database downgrade,
  // token rewrite or snapshot restoration is needed when the browser profile is rolled back.
  const restored = await call('library/records', backup); assert.equal(restored.data.scope, data.scope);
  assert.equal(restored.data.revision, 2); assert.deepEqual(restored.data.games.map(game => game.id).sort(), ['after-upgrade', 'legacy-study']);
  const counted = await call('ai/status', backup); assert.equal(counted.data.user.requests, 2); assert.equal(counted.data.usage.requests, 2);
  await server.close();
  for (const file of [data.library, data.usage]) {
    const db = new DatabaseSync(file, { readOnly: true });
    try { assert.equal(db.prepare('PRAGMA user_version').get().user_version, 1); } finally { db.close(); }
  }
  assert(!server.output().includes(data.uid)); assert(!server.output().includes(data.token));
});

test('cookie-bearing CLI modes require TLS before database creation; explicit HTTP development cannot combine with TLS', () => {
  const identity = tlsMaterial();
  try {
    const root = path.join(identity.dir, 'public'); fs.mkdirSync(root);
    const script = fileURLToPath(new URL('../scripts/serve.mjs', import.meta.url));
    for (const flags of [['--api'], ['--library', path.join(identity.dir, 'missing', 'library.sqlite')],
      ['--api', '--http-dev', '--tls-key', identity.key, '--tls-cert', identity.cert]]) {
      const result = spawnSync(process.execPath, [script, root, '--env=', '--usage', path.join(identity.dir, 'missing', 'usage.sqlite'), ...flags], { encoding: 'utf8', timeout: 10_000 });
      assert.equal(result.status, 1); assert(!result.stdout.includes('Serving'));
      assert.equal(JSON.parse(result.stderr.trim()).code, 'ERR_KIBITZ_HTTPS_REQUIRED'); assert(!fs.existsSync(path.join(identity.dir, 'missing')));
    }
  } finally { identity.close(); }
});
