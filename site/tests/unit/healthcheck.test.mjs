import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { probe, run } from '../../scripts/healthcheck.mjs';
import { tlsMaterial } from '../helpers/tls-material.mjs';

async function listen(server, t) {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return server.address().port;
}

test('the fixed health request follows no redirect, carries no identity and bounds stalled responses', async t => {
  const seen = []; let code = 200, stalled = false;
  const port = await listen(http.createServer((req, res) => {
    seen.push({ url: req.url, cookie: req.headers.cookie, authorization: req.headers.authorization });
    if (stalled) return;
    res.writeHead(code, { Location: 'https://must-not-contact.invalid/' }); res.end('{}');
  }), t);
  assert.equal(await probe({ port }), true);
  code = 302; assert.equal(await probe({ port }), false);
  code = 500; assert.equal(await probe({ port }), false);
  stalled = true; assert.equal(await probe({ port, timeout: 50 }), false);
  assert.deepEqual(seen, Array.from({ length: 4 }, () => ({ url: '/manifest.webmanifest', cookie: undefined, authorization: undefined })));
});

test('TLS health checks require the intended CA and do not fall back to plaintext', async t => {
  const identity = tlsMaterial(); t.after(identity.close); let calls = 0;
  const port = await listen(https.createServer({ key: fs.readFileSync(identity.key), cert: identity.ca }, (req, res) => { calls++; res.end('{}'); }), t);
  assert.equal(await probe({ secure: true, ca: identity.ca, port }), true);
  assert.equal(await probe({ secure: true, port }), false);
  assert.equal(await probe({ port }), false);
  assert.equal(calls, 1);
});

test('health configuration rejects invalid/partial trust settings and bounds certificate reads without exposing errors', async t => {
  const identity = tlsMaterial(); t.after(identity.close); const seen = [];
  const check = async options => { seen.push(options); return true; };
  assert.equal(await run({}, check), true);
  assert.equal(await run({ KIBITZ_HEALTH_HTTPS: '1', KIBITZ_HEALTH_CA: identity.cert }, check), true);
  assert.equal(seen[0].secure, false); assert.equal(seen[1].secure, true); assert.deepEqual(seen[1].ca, identity.ca);
  const oversized = path.join(identity.dir, 'oversized.pem'); fs.writeFileSync(oversized, Buffer.alloc(1024 * 1024 + 1));
  const empty = path.join(identity.dir, 'empty.pem'), malformed = path.join(identity.dir, 'invalid.pem');
  fs.writeFileSync(empty, ''); fs.writeFileSync(malformed, 'SYNTHETIC_BAD_CA');
  for (const env of [{ KIBITZ_HEALTH_HTTPS: 'yes' }, { KIBITZ_HEALTH_CA: identity.cert },
    { KIBITZ_HEALTH_HTTPS: '1', KIBITZ_HEALTH_CA: path.join(identity.dir, 'missing.pem') },
    { KIBITZ_HEALTH_HTTPS: '1', KIBITZ_HEALTH_CA: oversized },
    { KIBITZ_HEALTH_HTTPS: '1', KIBITZ_HEALTH_CA: empty },
    { KIBITZ_HEALTH_HTTPS: '1', KIBITZ_HEALTH_CA: malformed }]) assert.equal(await run(env, check), false);
  assert.equal(seen.length, 2);
});
