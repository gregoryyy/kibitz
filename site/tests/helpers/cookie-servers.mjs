// Real loopback HTTP/TLS fixtures; keys exist only in a temporary private directory.
// Isolated legacy-cookie transport tests inject identityCookie and an explicit mock authorizer; the final CLI
// uses the issued-session authority instead. No provider/env file is used.
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { identityCookie } from '../../server/cookies.mjs';
import { createApi } from '../../server/api.mjs';
import { loadConfig, loadEmbeddingConfig } from '../../server/ai.mjs';
import { createLibraryApi } from '../../server/library-api.mjs';
import { createLibraryStore } from '../../server/library-store.mjs';

export async function cookieServers() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kibitz-cookie-tls-')), key = path.join(dir, 'key.pem'), cert = path.join(dir, 'cert.pem'), config = path.join(dir, 'openssl.cnf');
  fs.chmodSync(dir, 0o700);
  const servers = [], stores = [];
  const close = async () => {
    for (const server of servers) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    for (const store of stores) store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  };
  try {
    fs.writeFileSync(config, '[req]\ndistinguished_name=dn\n[dn]\n[fixture]\nsubjectAltName=IP:127.0.0.1,DNS:localhost\nbasicConstraints=critical,CA:TRUE\n');
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '1', '-subj', '/CN=localhost', '-config', config, '-extensions', 'fixture', '-keyout', key, '-out', cert], { stdio: 'ignore' });
    fs.chmodSync(key, 0o600);
    const urls = {};
    for (const encrypted of [false, true]) {
      const store = createLibraryStore(); stores.push(store);
      const library = createLibraryApi({ store, identity: identityCookie, authorize: () => {}, allowInsecureHttp: !encrypted }), api = createApi({ identity: identityCookie, authorize: () => {}, allowInsecureHttp: !encrypted, config: loadConfig({ AI_PROVIDER: 'mock' }), embeddingConfig: loadEmbeddingConfig({ EMBEDDING_PROVIDER: 'mock' }) });
      const handle = async (req, res) => {
        if (await library(req, res) || await api(req, res)) return;
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end('<!doctype html><title>Cookie transport fixture</title>');
      };
      const server = encrypted ? https.createServer({ key: fs.readFileSync(key), cert: fs.readFileSync(cert) }, handle) : http.createServer(handle);
      servers.push(server);
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
      urls[encrypted ? 'https' : 'http'] = `${encrypted ? 'https' : 'http'}://127.0.0.1:${server.address().port}`;
    }
    return { ...urls, ca: fs.readFileSync(cert), close };
  } catch (error) { await close(); throw error; }
}
