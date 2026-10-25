import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import { cookieServers } from '../tests/helpers/cookie-servers.mjs';

const request = (url, headers = {}, ca = undefined) => new Promise((resolve, reject) => {
  const transport = url.startsWith('https:') ? https : http;
  // Trust only the ephemeral fixture certificate; chain/hostname validation stays enabled.
  const req = transport.get(url, { ca, headers }, res => {
    let body = ''; res.setEncoding('utf8'); res.on('data', part => body += part);
    res.on('end', () => resolve({ status: res.statusCode, cookie: res.headers['set-cookie']?.[0], data: JSON.parse(body) }));
  });
  req.on('error', reject);
});

test('new usage and library cookies use Secure on a real TLS socket, preserving their separate scopes', async t => {
  const servers = await cookieServers(); t.after(servers.close);
  for (const [route, name, scope] of [['ai/status', 'kibitz_uid', '/api/'], ['library/records', 'kibitz_library', '/api/library/']]) {
    const r = await request(servers.https + '/api/' + route, { 'x-forwarded-proto': 'http', forwarded: 'proto=http' }, servers.ca);
    assert.equal(r.status, 200); assert.ok(r.cookie.startsWith(name + '=')); assert.ok(r.cookie.includes(`Path=${scope};`));
    for (const flag of ['HttpOnly', 'SameSite=Strict', 'Secure']) assert.ok(r.cookie.split('; ').includes(flag), flag);
    const repeated = await request(servers.https + '/api/' + route, { cookie: r.cookie.split(';')[0] }, servers.ca);
    assert.equal(repeated.cookie, undefined);
    if (name === 'kibitz_uid') assert.equal(repeated.data.user.requests, 0); else assert.equal(repeated.data.scope, r.data.scope);
  }
});

test('local HTTP cookie issuance ignores spoofed forwarding headers and preserves existing identity', async t => {
  const servers = await cookieServers(); t.after(servers.close);
  for (const route of ['ai/status', 'library/records']) {
    const r = await request(servers.http + '/api/' + route, { 'x-forwarded-proto': 'https', forwarded: 'proto=https' });
    assert.equal(r.status, 200); assert.ok(!r.cookie.split('; ').includes('Secure'));
    const repeated = await request(servers.http + '/api/' + route, { cookie: r.cookie.split(';')[0] });
    assert.equal(repeated.status, 200); assert.equal(repeated.cookie, undefined);
  }
});
