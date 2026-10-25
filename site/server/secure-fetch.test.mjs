import { test } from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import http from 'node:http';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createProvider, loadConfig, loadEmbeddingConfig, publicStatus } from './ai.mjs';
import { secureFetch, transportUrl, TransportError } from './secure-fetch.mjs';
import { tlsMaterial } from '../tests/helpers/tls-material.mjs';
import { wire } from '../tests/fixtures/ai-wire.mjs';
const run = promisify(execFile);
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(`${server instanceof https.Server ? 'https' : 'http'}://127.0.0.1:${server.address().port}`)));
const close = server => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); };
const question = [{ role: 'user', content: 'Synthetic context' }];

test('default provider and embedding configs refuse every plaintext/credential-bearing override without reflecting its value', () => {
  for (const provider of ['anthropic', 'openai', 'mistral', 'ollama']) {
    const P = provider.toUpperCase(), base = { AI_PROVIDER: provider, [`${P}_API_KEY`]: 'synthetic', [`${P}_MODEL`]: 'fixture', OLLAMA_ALLOWED_HOSTS: '127.0.0.1,localhost,elsewhere.invalid' };
    for (const url of ['http://127.0.0.1:11434', 'http://elsewhere.invalid', 'https://user:PRIVATE_SENTINEL@localhost', 'https://localhost/?key=PRIVATE_SENTINEL', 'file:///PRIVATE_SENTINEL']) {
      const config = loadConfig({ ...base, [`${P}_BASE_URL`]: url });
      assert.equal(config.available, false); assert.throws(() => createProvider(config, { client: {} }), { code: 'unavailable' }); assert.doesNotMatch(JSON.stringify(publicStatus(config)), /PRIVATE_SENTINEL|elsewhere\.invalid/);
      if (provider !== 'anthropic') assert.equal(loadEmbeddingConfig({ ...base, [`${P}_BASE_URL`]: url, EMBEDDING_PROVIDER: provider, EMBEDDING_MODEL: 'fixture' }).available, false);
    }
    assert.equal(loadConfig({ ...base, [`${P}_BASE_URL`]: 'https://localhost:11434' }).available, true);
    assert.equal(loadConfig({ ...base, [`${P}_BASE_URL`]: 'http://127.0.0.1:11434' }, { allowInsecureLoopback: true }).available, true);
    assert.equal(loadConfig({ ...base, [`${P}_BASE_URL`]: 'http://elsewhere.invalid' }, { allowInsecureLoopback: true }).available, false);
  }
  assert.equal(loadConfig({ AI_PROVIDER: 'ollama', OLLAMA_MODEL: 'fixture' }).available, false);
  for (const url of ['http://localhost/model.gguf', 'https://elsewhere.invalid/model.gguf', '//elsewhere.invalid/m.gguf', 'models/../m.gguf']) {
    assert.equal(loadConfig({ AI_PROVIDER: 'browser', BROWSER_MODEL_URL: url }).available, false);
  }
});

test('preflight refuses plaintext before fetch; providers never follow even an HTTPS redirect with credentials or body', async () => {
  let calls = 0, cancel = 0;
  const fetcher = async (_input, init) => { calls++; assert.equal(init.redirect, 'manual'); return new Response(new ReadableStream({ cancel() { cancel++; } }), { status: 307, headers: { location: 'http://localhost/private' } }); };
  await assert.rejects(secureFetch('http://127.0.0.1', {}, { fetcher }), TransportError); assert.equal(calls, 0);
  await assert.rejects(secureFetch('https://fixture.invalid', { method: 'POST', body: 'private', headers: { authorization: 'synthetic' } }, { fetcher }), TransportError);
  assert.equal(calls, 1); assert.equal(cancel, 1);
});

test('public downloads validate all hops, bound redirect loops and never forward request credentials', async () => {
  const seen = [];
  const fetcher = async (input, init) => { seen.push(String(input)); assert.equal(init.redirect, 'manual'); assert.equal(init.headers, undefined);
    return seen.length === 1 ? new Response(null, { status: 302, headers: { location: 'https://cdn.invalid/signed?token=PRIVATE_SENTINEL' } }) : new Response('verified bytes'); };
  assert.equal(await (await secureFetch('https://source.invalid/file', {}, { fetcher, download: true })).text(), 'verified bytes');
  assert.equal(seen.length, 2);
  for (const location of ['http://localhost/plaintext', 'file:///secret', 'https://user:PRIVATE_SENTINEL@cdn.invalid/file']) {
    let calls = 0;
    await assert.rejects(secureFetch('https://source.invalid/file', {}, { download: true, fetcher: async () => { calls++; return new Response(null, { status: 302, headers: { location } }); } }), error => error instanceof TransportError && !error.message.includes('PRIVATE_SENTINEL'));
    assert.equal(calls, 1);
  }
  let calls = 0;
  await assert.rejects(secureFetch('https://source.invalid/file', {}, { download: true, fetcher: async () => { calls++; return new Response(null, { status: 302, headers: { location: '/loop' } }); } }), TransportError);
  assert.equal(calls, 6);
});

test('weakened TLS runtime flags are rejected rather than inheriting a downgrade or trust bypass', async () => {
  const code = "import {transportUrl} from './site/server/secure-fetch.mjs'; try { transportUrl('https://fixture.invalid'); process.exitCode=2; } catch(e) { if(e.code!=='transport_blocked') process.exitCode=3; }";
  for (const args of [['--tls-min-v1.0'], ['--tls-max-v1.2'], []]) {
    const result = await run(process.execPath, [...args, '--input-type=module', '-e', code], { cwd: new URL('../../', import.meta.url), env: { ...process.env, NODE_OPTIONS: '', NODE_TLS_REJECT_UNAUTHORIZED: args.length ? '1' : '0' } });
    assert.equal(result.stdout, '');
  }
  assert.equal(transportUrl('https://example.invalid').protocol, 'https:');
});

test('real SDK coaching/embeddings/model inspection negotiate verified TLS and redirects cannot contact plaintext', async () => {
  const fixture = tlsMaterial(); let plainCalls = 0, tlsCalls = 0; const protocols = new Set();
  const plain = http.createServer((req, res) => { plainCalls++; req.resume(); res.end('unexpected'); });
  const plaintext = await listen(plain);
  const server = https.createServer({ key: fs.readFileSync(fixture.key), cert: fixture.ca, minVersion: 'TLSv1.2', maxVersion: 'TLSv1.3' }, (req, res) => {
    tlsCalls++; protocols.add(req.socket.getProtocol()); req.resume();
    if (req.url === '/manifest.webmanifest') { res.end('health'); return; }
    if (req.url.startsWith('/redirect')) { res.writeHead(307, { location: plaintext + '/leak' }); res.end(); return; }
    if (req.url.endsWith('/api/show')) { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ details: { format: 'gguf' }, model_info: { 'general.architecture': 'fixture' }, capabilities: ['embedding'] })); return; }
    if (req.url.endsWith('/embeddings')) { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ model: 'fixture', data: [{ index: 0, embedding: [1, 0] }] })); return; }
    const provider = req.url.split('/')[1]; res.writeHead(200, { 'content-type': 'text/event-stream' }); res.end(wire(provider));
  });
  server.on('tlsClientError', () => {});
  const origin = await listen(server);
  const code = `import assert from 'node:assert/strict';
    import {complete,createProvider,createEmbedder,loadConfig,loadEmbeddingConfig} from './site/server/ai.mjs';
    const origin=process.argv[1];
    for(const provider of ['anthropic','openai','mistral','ollama']) {
      const P=provider.toUpperCase(), env={AI_PROVIDER:provider,[P+'_API_KEY']:'synthetic',[P+'_MODEL']:'fixture',[P+'_BASE_URL']:origin+'/'+provider};
      assert.equal((await complete(createProvider(loadConfig(env)),${JSON.stringify(question)})).text,'Control the centre.');
      if(provider!=='anthropic') assert.deepEqual(await createEmbedder(loadEmbeddingConfig({...env,EMBEDDING_PROVIDER:provider,EMBEDDING_MODEL:'fixture'})).embed(['synthetic']),[[1,0]]);
    }
    const cfg=loadConfig({AI_PROVIDER:'openai',OPENAI_API_KEY:'synthetic',OPENAI_BASE_URL:origin+'/redirect'});
    await assert.rejects(complete(createProvider(cfg),${JSON.stringify(question)}),{code:'provider_error'});
    console.log('verified');`;
  try {
    const result = await run(process.execPath, ['--input-type=module', '-e', code, origin], { cwd: new URL('../../', import.meta.url), timeout: 15000,
      env: { ...process.env, NODE_OPTIONS: '', NODE_TLS_REJECT_UNAUTHORIZED: '1', NODE_EXTRA_CA_CERTS: fixture.cert } });
    assert.equal(result.stdout.trim(), 'verified'); assert.equal(plainCalls, 0); assert.ok(tlsCalls >= 9); assert.deepEqual([...protocols], ['TLSv1.3']);
    // Without the explicit fixture CA, normal Node trust rejects the same peer before HTTP.
    const before = tlsCalls;
    await assert.rejects(fetch(origin)); assert.equal(tlsCalls, before);
    const health = await run(process.execPath, ['--input-type=module', '-e', "import {probe} from './site/scripts/healthcheck.mjs'; console.log(await probe({secure:true,port:Number(new URL(process.argv[1]).port)}));", origin],
      { cwd: new URL('../../', import.meta.url), timeout: 5000, env: { ...process.env, NODE_OPTIONS: '', NODE_TLS_REJECT_UNAUTHORIZED: '0', NODE_EXTRA_CA_CERTS: '' } });
    assert.equal(health.stdout.trim(), 'false'); assert.equal(tlsCalls, before, 'health never bypasses untrusted TLS');

  } finally { await close(server); await close(plain); fixture.close(); }
});
