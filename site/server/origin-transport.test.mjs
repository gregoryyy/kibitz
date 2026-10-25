import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import { cookieServers } from '../tests/helpers/cookie-servers.mjs';

function post(base, route, headers, ca) {
  return new Promise((resolve, reject) => {
    const req = (base.startsWith('https:') ? https : http).request(base + route, {
      method: 'POST', ca, headers: { 'content-type': 'application/json', ...headers },
    }, res => {
      let body = ''; res.setEncoding('utf8'); res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject); req.end('{"prompt":"hi"}');
  });
}

for (const secure of [false, true]) test(`${secure ? 'HTTPS' : 'HTTP'} Origin must match the native scheme on every AI write route`, async t => {
  const servers = await cookieServers(); t.after(servers.close);
  const base = servers[secure ? 'https' : 'http'], host = new URL(base).host;
  const forwarded = { 'x-forwarded-proto': secure ? 'http' : 'https', forwarded: `proto=${secure ? 'http' : 'https'}` };
  for (const origin of [`${secure ? 'http' : 'https'}://${host}`, `ftp://${host}`, `blob:${base}/id`, 'null', 'invalid', `${base}9`]) {
    for (const route of ['/api/ai/config', '/api/ai/test', '/api/ai/sample', '/api/ai/structured', '/api/ai/embeddings']) {
      const r = await post(base, route, { origin, ...forwarded }, servers.ca);
      assert.equal(r.status, 403, `${route}: ${origin}`);
      assert.equal(JSON.parse(r.body).error.code, 'forbidden');
    }
  }
  for (const headers of [{ origin: base, ...forwarded }, { ...forwarded }]) {
    const r = await post(base, '/api/ai/sample', headers, servers.ca);
    assert.equal(r.status, 200, JSON.stringify(headers));
    assert.ok(r.body.split('\n').filter(Boolean).map(line => JSON.parse(line)).some(line => line.done));
  }
});
