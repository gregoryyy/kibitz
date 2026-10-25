import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { sourceControlRoots } from './deployment.mjs';
import { tlsMaterial } from '../tests/helpers/tls-material.mjs';
import { httpsCli, tlsRequest } from '../tests/helpers/https-cli.mjs';

const site = fileURLToPath(new URL('..', import.meta.url));
const probe = fileURLToPath(new URL('../tests/fixtures/native-isolation.mjs', import.meta.url));
export const metadataFiles = () => sourceControlRoots(site).flatMap(root => fs.statSync(root).isFile() ? [root] : ['config', 'HEAD'].map(name => path.join(root, name)).filter(fs.existsSync));
const publicRoot = identity => {
  const root = path.join(identity.dir, 'public'); fs.mkdirSync(root);
  fs.writeFileSync(path.join(root, '_test.html'), '<title>Native isolation</title>'); return root;
};

test('actual final CLI cannot read original checkout/worktree metadata and still supports TLS, sessions and SQLite', async t => {
  const identity = tlsMaterial(); t.after(identity.close); const files = metadataFiles(); assert(files.length > 0);
  const script = process.env.KIBITZ_ISOLATION_SERVER_SCRIPT;
  const server = await httpsCli({ root: publicRoot(identity), key: identity.key, cert: identity.cert, operatorSecret: identity.secret,
    library: path.join(identity.dir, 'library.sqlite'), final: true, script, nodeArgs: ['--import', probe],
    env: { KIBITZ_NATIVE_PROBE_PATHS: JSON.stringify(files) },
    extra: script ? ['--operator', identity.operator, '--permissions', identity.policy, '--sessions', path.join(identity.dir, 'sessions.sqlite')] : [] });
  t.after(server.close);
  assert.match(server.output(), /Native source metadata: unavailable/); assert(!server.output().includes('Native source metadata: readable'));
  const cookie = await server.login();
  assert.equal((await tlsRequest(server.base + '/api/library/records', identity.ca, { cookie })).status, 200);
  for (const route of ['/.git/config', '/%2egit/HEAD', '/.svn/entries', '/.hg/store', '/server/deployment.mjs']) {
    assert.equal((await tlsRequest(server.base + route, identity.ca)).status, 404);
  }
  assert(!server.output().includes(identity.dir));
});

test('a forged child marker cannot replace OS proof or create private databases', t => {
  const identity = tlsMaterial(); t.after(identity.close); const root = publicRoot(identity), data = path.join(identity.dir, 'never-create');
  const result = spawnSync(process.execPath, [path.join(site, 'scripts/serve.mjs'), root, '--api', '--env=',
    '--operator', identity.operator, '--permissions', identity.policy, '--sessions', path.join(data, 'sessions.sqlite'),
    '--tls-key', identity.key, '--tls-cert', identity.cert, '--port', '0'], {
    encoding: 'utf8', timeout: 10000, env: { ...process.env, AI_PROVIDER: 'mock', KIBITZ_NATIVE_CHILD: '1' },
  });
  assert.equal(result.status, 1); assert.equal(JSON.parse(result.stderr.trim()).code, 'ERR_KIBITZ_ISOLATION');
  assert(!fs.existsSync(data)); assert(!result.stdout.includes('Serving Kibitz')); assert(!result.stderr.includes(identity.dir));
});

test('offline atomic policy replacement and unlink remain visible inside the native sandbox', async t => {
  const identity = tlsMaterial(); t.after(identity.close);
  const server = await httpsCli({ root: publicRoot(identity), key: identity.key, cert: identity.cert, operatorSecret: identity.secret, final: true }); t.after(server.close);
  const cookie = await server.login(), call = () => tlsRequest(server.base + '/api/ai/status', identity.ca, { cookie });
  assert.equal((await call()).status, 200);
  const replace = allow => {
    const next = identity.policy + '.next'; fs.writeFileSync(next, JSON.stringify({ version: 1, operator: identity.operatorId, allow }), { flag: 'wx', mode: 0o600 });
    fs.renameSync(next, identity.policy);
  };
  replace([]); assert.equal((await call()).status, 403);
  replace(['ai:read']); assert.equal((await call()).status, 200);
  fs.unlinkSync(identity.policy); assert.equal((await call()).status, 503);
  assert.equal((await tlsRequest(server.base + '/api/session/logout', identity.ca, { cookie, body: {} })).status, 200);
});
