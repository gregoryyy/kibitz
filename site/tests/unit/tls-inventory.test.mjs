import { test } from 'node:test';
import assert from 'node:assert/strict';
import tls from 'node:tls';
import net from 'node:net';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { inventoryTls, validateEndpoints } from '../../scripts/tls-inventory.mjs';
import { tlsMaterial } from '../helpers/tls-material.mjs';

const endpoint = origin => [{ name: 'fixture', origin }];
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(`https://127.0.0.1:${server.address().port}`)));
const stop = server => new Promise(resolve => server.close(resolve));

test('validate all origins without echoing credentials, paths or unsupported endpoint input', async () => {
  const sentinel = 'PRIVATE_SENTINEL';
  for (const origin of [`https://user:${sentinel}@example.com`, `https://example.com/${sentinel}`, `https://example.com/?${sentinel}`,
    `https://example.com/#${sentinel}`, 'file:///tmp/key', 'https://example.com/secret/..', 'https://example.com/.', 'https://example.com?', 'https://example.com#', 'https://example.com\\', 'https://example.com\n']) {
    await assert.rejects(inventoryTls(endpoint(origin)), error => !error.message.includes(sentinel));
  }
  for (const input of [[], null, [{ name: '../secret', origin: 'https://example.com' }], [...endpoint('https://example.com'), ...endpoint('https://example.net')], Array(33).fill(endpoint('https://example.com')[0])]) assert.throws(() => validateEndpoints(input));
  assert.deepEqual(validateEndpoints(endpoint('https://EXAMPLE.com:443/')), endpoint('https://example.com'));
});

test('plaintext origins are recorded without ever making a socket or HTTP request', async () => {
  let connections = 0;
  const server = net.createServer(socket => { connections++; socket.destroy(); });
  const origin = (await listen(server)).replace('https:', 'http:');
  try {
    const report = await inventoryTls(endpoint(origin));
    assert.deepEqual(report.endpoints[0].observations, [{ probe: 'none', outcome: 'plaintext_not_contacted' }]);
    assert.equal(connections, 0);
  } finally { await stop(server); }
});

test('negotiates preferred TLS 1.3 and forced TLS 1.2 with trust, rejects older versions without claiming every error is peer refusal', async () => {
  const fixture = tlsMaterial(); let bytes = 0;
  const server = tls.createServer({ key: fs.readFileSync(fixture.key), cert: fixture.ca, minVersion: 'TLSv1.2', maxVersion: 'TLSv1.3' }, socket => socket.on('data', data => { bytes += data.length; }));
  server.on('tlsClientError', () => {});
  const origin = await listen(server);
  try {
    const report = await inventoryTls(endpoint(origin), { ca: fixture.ca, timeoutMs: 2000 });
    assert.equal(report.client.trust, 'explicit-ca'); assert.match(report.client.caSha256, /^[a-f0-9]{64}$/);
    const probes = new Map(report.endpoints[0].observations.map(value => [value.probe, value]));
    assert.equal(probes.get('recommended').protocol, 'TLSv1.3');
    assert.equal(probes.get('TLSv1.2').protocol, 'TLSv1.2'); assert.equal(probes.get('TLSv1.3').protocol, 'TLSv1.3');
    for (const version of ['TLSv1', 'TLSv1.1']) assert.notEqual(probes.get(version).outcome, 'negotiated');
    assert.match(probes.get('recommended').peerSha256, /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/);
    assert.equal(bytes, 0, 'probe sends no application data');
    assert.ok(!JSON.stringify(report).includes('PRIVATE KEY'));
    const untrusted = await inventoryTls(endpoint(origin), { timeoutMs: 2000 });
    assert.equal(untrusted.endpoints[0].observations.find(p => p.probe === 'recommended').outcome, 'trust_failed');
  } finally { await stop(server); fixture.close(); }
});

test('reports TLS 1.2-only endpoints and bounds stalled handshakes without leaks', async () => {
  const fixture = tlsMaterial();
  const server = tls.createServer({ key: fs.readFileSync(fixture.key), cert: fixture.ca, minVersion: 'TLSv1.2', maxVersion: 'TLSv1.2' });
  server.on('tlsClientError', () => {});
  const origin = await listen(server);
  try {
    const report = await inventoryTls(endpoint(origin), { ca: fixture.ca, timeoutMs: 2000 });
    const probes = report.endpoints[0].observations;
    assert.equal(probes.find(p => p.probe === 'recommended').protocol, 'TLSv1.2');
    assert.equal(probes.find(p => p.probe === 'TLSv1.3').outcome, 'peer_rejected_version');
  } finally { await stop(server); fixture.close(); }
  const sockets = new Set();
  const stalled = net.createServer(socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  const stalledOrigin = await listen(stalled);
  try {
    const report = await inventoryTls(endpoint(stalledOrigin), { timeoutMs: 100 });
    assert.ok(report.endpoints[0].observations.every(p => p.outcome === 'timeout' || p.outcome === 'local_policy_refused'));
  } finally { for (const socket of sockets) socket.destroy(); await stop(stalled); }
});

test('CLI invalid-input diagnostics never expose raw input or private file paths', () => {
  const sentinel = 'PRIVATE_SENTINEL';
  for (const args of [['--endpoint', `cloud=https://key:${sentinel}@example.com`], ['--endpoint', 'cloud=https://example.com', '--ca', '/absent/' + sentinel]]) {
    const result = spawnSync(process.execPath, ['scripts/tls-inventory.mjs', ...args], { cwd: new URL('../../', import.meta.url), encoding: 'utf8' });
    assert.equal(result.status, 1); assert.equal(result.stdout, ''); assert.ok(!result.stderr.includes(sentinel));
  }
});
