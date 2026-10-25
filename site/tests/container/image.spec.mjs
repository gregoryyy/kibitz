import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { test, expect, open, move } from '../e2e/fixtures.mjs';
import { openContainerApp } from './startup.mjs';
import { tlsMaterial } from '../helpers/tls-material.mjs';

test.use({ launchOptions: { args: ['--host-resolver-rules=MAP kibitz.test 127.0.0.1', '--no-proxy-server'] } });

const image = process.env.KIBITZ_CONTAINER_IMAGE || 'kibitz:container-test';
const suffix = randomUUID().slice(0, 8), name = `kibitz-image-${suffix}`, volume = `kibitz-data-${suffix}`;
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', timeout: 60_000, maxBuffer: 2_000_000 });
let base;
function publishedBase(container = name) {
  const address = docker('port', container, '8765/tcp').trim();
  expect(address).toMatch(/^127\.0\.0\.1:\d+$/);
  return 'http://' + address;
}
test.beforeAll(async () => {
  docker('volume', 'create', volume);
  docker('run', '-d', '--pull=never', '--name', name, '--init', '--read-only', '--cap-drop=ALL',
    '--security-opt=no-new-privileges', '--tmpfs', '/tmp:mode=1777', '--publish', '127.0.0.1::8765',
    '--mount', `type=volume,src=${volume},dst=/data`, '--env', 'AI_PROVIDER=mock', '--env', 'AI_LOCAL_ONLY=1', '--env', 'KIBITZ_HEALTH_HTTPS=0', image,
    'scripts/serve.mjs', 'dist', '--api', '--http-dev', '--env=', '--host', '0.0.0.0', '--port', '8765',
    '--index', '_test.html', '--usage', '/data/usage.sqlite', '--library', '/data/library.sqlite');
  base = publishedBase();
  await expect.poll(async () => {
    try { return (await fetch(base + '/manifest.webmanifest', { signal: AbortSignal.timeout(2000) })).status; }
    catch { return 0; }
  }, { timeout: 30_000 }).toBe(200);
});
test.afterEach(async ({ request }, info) => {
  if (info.status === info.expectedStatus) return;
  try {
    const state = JSON.parse(docker('inspect', name))[0];
    await info.attach('container-state', { body: JSON.stringify({ state: state.State, ports: state.NetworkSettings.Ports }), contentType: 'application/json' });
    await info.attach('container-log', { body: docker('logs', name), contentType: 'text/plain' });
  } catch { /* Preserve the original failure when startup did not create a container. */ }
});
test.afterAll(() => {
  const errors = [];
  try { docker('rm', '-f', name); } catch (error) {
    if (!String(error.stderr).includes('No such container')) errors.push(error);
  }
  try { docker('volume', 'rm', volume); } catch (error) {
    if (!String(error.stderr).includes('no such volume')) errors.push(error);
  }
  if (errors.length) throw new AggregateError(errors, 'Container test cleanup failed');
});

test('image runs without root or development/private checkout files and keeps databases outside static hosting', async ({ request }) => {
  const code = `
    const fs=require('node:fs');
    console.log(JSON.stringify({uid:process.getuid(),
      git:fs.existsSync('/app/.git'),serverGit:fs.existsSync('/app/site/.git'),
      privateSentinel:fs.existsSync('/app/site/server/.env.container-test'),
      eslint:fs.existsSync('/app/site/node_modules/eslint'),
      shell:fs.existsSync('/bin/sh'),npm:fs.existsSync('/usr/local/lib/node_modules/npm'),
      dataMode:fs.statSync('/data').mode&0o777,
      usageMode:fs.statSync('/data/usage.sqlite').mode&0o777,
      libraryMode:fs.statSync('/data/library.sqlite').mode&0o777}));`;
  expect(JSON.parse(docker('exec', name, 'node', '-e', code))).toEqual({ uid: 1000, git: false, serverGit: false,
    privateSentinel: false, eslint: false, shell: false, npm: false, dataMode: 0o700, usageMode: 0o600, libraryMode: 0o600 });
  const info = JSON.parse(docker('inspect', name))[0];
  expect(info.Config.User).toBe('1000:1000'); expect(info.HostConfig.ReadonlyRootfs).toBe(true);
  expect(info.HostConfig.CapDrop).toContain('ALL');
  expect(info.Config.Labels['org.opencontainers.image.revision']).toBe(process.env.GITHUB_SHA || 'development');
  expect(info.Config.Env.some(value => /^(ANTHROPIC|OPENAI|MISTRAL)_API_KEY=/.test(value))).toBe(false);
  for (const path of ['/.git/config', '/.env', '/server/.env.container-test', '/data/usage.sqlite', '/data/library.sqlite']) {
    expect((await request.get(base + path)).status(), path).toBe(404);
  }
  const status = await request.get(base + '/api/ai/status');
  expect((await status.json()).provider).toBe('mock');
  const page = await request.get(base + '/');
  expect(page.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(page.headers()['cross-origin-embedder-policy']).toBe('require-corp');
  expect((await request.get(base + '/icon.svg')).headers()['content-type']).toBe('image/svg+xml; charset=utf-8');
});

test('packaged Stockfish plays and packaged library/mock coach work in the real browser', async ({ page }, info) => {
  await page.route('https://**/*', route => route.abort()); // No fonts, providers or model downloads.
  if (await openContainerApp(page, base + '/?debug', open)) {
    await info.attach('initial-network-change-recovery', { body: JSON.stringify({
      reason: 'local module loads aborted with ERR_NETWORK_CHANGED', navigations: 2,
    }), contentType: 'application/json' });
  }
  await move(page, 'e2', 'e4'); await expect(page.locator('#moves button')).toHaveCount(2);
  await page.locator('[data-tab="library"]').click();
  await page.locator('#libList .game').filter({ hasText: 'Opera' }).getByRole('button', { name: 'Open' }).click();
  await page.locator('[data-tab="coach"]').click();
  await expect(page.locator('#coachSend')).toBeEnabled();
  await page.locator('#coachInput').fill('What is the plan?'); await page.locator('#coachSend').click();
  await expect(page.locator('#chat .msg.coach').last()).toContainText('Mock coach');
});

test('private volume retains library and usage across restart while another cookie group stays isolated', async ({ playwright }) => {
  const owner = await playwright.request.newContext(), other = await playwright.request.newContext();
  try {
    const initial = await (await owner.get(base + '/api/library/records')).json();
    const record = { id: 'container-study', kind: 'study', pgn: '1. e4 e5 *' };
    const saved = await owner.post(base + '/api/library/records', { data: { scope: initial.scope, revision: initial.revision,
      changes: [{ collection: 'games', id: record.id, record }] } });
    expect(saved.status()).toBe(200);
    const before = await (await owner.get(base + '/api/ai/status')).json();
    const answer = await owner.post(base + '/api/ai/sample', { data: { prompt: 'Container persistence test' } });
    expect(answer.status()).toBe(200); expect(await answer.text()).toContain('"done":true');
    const independent = await (await other.get(base + '/api/library/records')).json();
    expect(independent.scope).not.toBe(initial.scope); expect(independent.games).toEqual([]);
    docker('restart', '--time', '10', name);
    // Docker may allocate a new host port when the original request used port 0.
    // Browser cookies remain scoped to the same host, independently of its port.
    base = publishedBase();
    await expect.poll(async () => {
      try { return (await owner.get(base + '/api/library/status')).status(); } catch { return 0; }
    }, { timeout: 30_000 }).toBe(200);
    const restored = await (await owner.get(base + '/api/library/records')).json();
    expect(restored.scope).toBe(initial.scope); expect(restored.games).toEqual([record]);
    expect((await (await other.get(base + '/api/library/records')).json()).games).toEqual([]);
    const after = await (await owner.get(base + '/api/ai/status')).json();
    expect(after.user.requests).toBe(before.user.requests + 1);
    expect(after.usage.requests).toBe(before.usage.requests + 1);
    await expect.poll(() => JSON.parse(docker('inspect', name))[0].State.Health.Status, { timeout: 45_000 }).toBe('healthy');
  } finally { await owner.dispose(); await other.dispose(); }
});

test('the previous packaging volume opens under the minimal runtime with the same owner, usage and isolation', async ({ playwright }) => {
  const previous = `kibitz-previous-${suffix}`, upgraded = `kibitz-upgraded-${suffix}`, data = `kibitz-upgrade-data-${suffix}`;
  const owner = await playwright.request.newContext(), other = await playwright.request.newContext();
  const errors = [], containers = new Set();
  const start = (container, runtime) => {
    containers.add(container);
    docker('run', '-d', '--pull=never', '--name', container, '--init', '--read-only', '--cap-drop=ALL',
      '--security-opt=no-new-privileges', '--tmpfs', '/tmp:mode=1777', '--publish', '127.0.0.1::8765',
      '--mount', `type=volume,src=${data},dst=/data`, '--env', 'AI_PROVIDER=mock', '--env', 'AI_LOCAL_ONLY=1',
      '--env', 'KIBITZ_HEALTH_HTTPS=0', runtime, ...(runtime === 'kibitz:previous-runtime' ? ['node'] : []),
      'scripts/serve.mjs', 'dist', '--api', '--http-dev', '--env=', '--host', '0.0.0.0', '--port', '8765',
      '--index', '_test.html', '--usage', '/data/usage.sqlite', '--library', '/data/library.sqlite');
    return publishedBase(container);
  };
  const ready = async url => expect.poll(async () => {
    try { return (await owner.get(url + '/api/library/status')).status(); } catch { return 0; }
  }, { timeout: 30_000 }).toBe(200);
  try {
    docker('volume', 'create', data);
    const old = start(previous, 'kibitz:previous-runtime'); await ready(old);
    const initial = await (await owner.get(old + '/api/library/records')).json();
    const record = { id: 'runtime-upgrade-study', kind: 'study', pgn: '1. d4 d5 *' };
    const saved = await owner.post(old + '/api/library/records', { data: { scope: initial.scope, revision: initial.revision,
      changes: [{ collection: 'games', id: record.id, record }] } }); expect(saved.status()).toBe(200);
    const before = await (await owner.get(old + '/api/ai/status')).json();
    const answer = await owner.post(old + '/api/ai/sample', { data: { prompt: 'Synthetic runtime compatibility check' } });
    expect(answer.status()).toBe(200); expect(await answer.text()).toContain('"done":true');
    docker('rm', '--force', previous);
    containers.delete(previous);
    const next = start(upgraded, image); await ready(next);
    const restored = await (await owner.get(next + '/api/library/records')).json();
    expect(restored.scope).toBe(initial.scope); expect(restored.games).toEqual([record]);
    expect((await (await other.get(next + '/api/library/records')).json()).games).toEqual([]);
    const after = await (await owner.get(next + '/api/ai/status')).json();
    expect(after.user.requests).toBe(before.user.requests + 1); expect(after.usage.requests).toBe(before.usage.requests + 1);
  } catch (error) { errors.push(error); }
  finally {
    const disposed = await Promise.allSettled([owner.dispose(), other.dispose()]);
    for (const result of disposed) if (result.status === 'rejected') errors.push(result.reason);
    for (const container of containers) {
      try { docker('rm', '--force', container); }
      catch (error) { if (!/No such container/i.test(String(error.stderr))) errors.push(error); }
    }
    try { docker('volume', 'rm', data); }
    catch (error) { if (!/no such volume/i.test(String(error.stderr))) errors.push(error); }
  }
  if (errors.length) throw new AggregateError(errors, 'Runtime compatibility check or cleanup failed');
});

test('the packaged non-root server supports native HTTPS from read-only operator identity files', async ({ browser, playwright }, info) => {
  const identity = tlsMaterial(), container = `kibitz-tls-${suffix}`, material = `kibitz-tls-material-${suffix}`;
  const containers = new Set(), errors = []; let context, client;
  try {
    docker('volume', 'create', material);
    // Test setup copies only synthetic bytes into a private, runtime-owned volume.
    // No host path is writable from the initializer; the app runs as its usual UID.
    docker('run', '--rm', '--pull=never', '--user', '0:0', '--network', 'none', '--read-only',
      '--mount', `type=bind,src=${identity.dir},dst=/input,readonly`, '--mount', `type=volume,src=${material},dst=/tls`,
      '--entrypoint', 'node', image, '-e', `const fs=require('node:fs');
        for(const name of ['key.pem','cert.pem']){fs.copyFileSync('/input/'+name,'/tls/'+name);fs.chmodSync('/tls/'+name,0o600);fs.chownSync('/tls/'+name,1000,1000);}
        fs.chmodSync('/tls',0o700);fs.chownSync('/tls',1000,1000);`);
    containers.add(container);
    docker('run', '-d', '--pull=never', '--name', container, '--init', '--read-only', '--cap-drop=ALL',
      '--security-opt=no-new-privileges', '--publish', '127.0.0.1::8765', '--mount', `type=volume,src=${material},dst=/tls,readonly`,
      '--tmpfs', '/data:mode=0700,uid=1000,gid=1000',
      '--health-interval', '2s', '--health-start-period', '0s',
      '--env', 'KIBITZ_HEALTH_HTTPS=1', '--env', 'KIBITZ_HEALTH_CA=/tls/cert.pem',
      '--env', 'AI_PROVIDER=mock', '--env', 'AI_LOCAL_ONLY=1', image);
    const probeUrl = publishedBase(container).replace('http:', 'https:'), url = probeUrl.replace('127.0.0.1', 'kibitz.test');
    // Node API clients connect directly to the mapped loopback port; Chromium resolves
    // the .test name with a browser-only loopback resolver rule. Both send the real application authority.
    client = await playwright.request.newContext({ ignoreHTTPSErrors: true, extraHTTPHeaders: { host: new URL(url).host } });
    await expect.poll(async () => { try { return (await client.get(probeUrl + '/manifest.webmanifest')).status(); } catch { return 0; } }, { timeout: 30_000 }).toBe(200);
    expect(docker('exec', container, 'node', '-p', 'process.getuid()').trim()).toBe('1000');
    expect(JSON.parse(docker('inspect', container))[0].Mounts.find(mount => mount.Destination === '/tls').RW).toBe(false);
    for (const route of ['/api/ai/status', '/api/library/records']) {
      const response = await client.get(probeUrl + route); expect(response.status()).toBe(200);
      expect(response.headers()['strict-transport-security']).toBe('max-age=31536000');
      expect(response.headers()['set-cookie']).toMatch(/^__Secure-kibitz_(uid|library)=/);
      expect(response.headers()['set-cookie']).toContain('; Secure');
    }
    context = await browser.newContext({ ignoreHTTPSErrors: true }); const page = await context.newPage();
    await page.route('**/*', route => new URL(route.request().url()).origin === url ? route.continue() : route.abort());
    await open(page, url + '/?debug'); await expect(page.locator('#board cg-board')).toBeVisible();
    for (const file of ['/tls/key.pem', '/key.pem', '/.git/config']) {
      const response = await client.get(probeUrl + file); expect(response.status()).toBe(404);
      expect(response.headers()['strict-transport-security']).toBe('max-age=31536000');
    }
    await expect.poll(() => JSON.parse(docker('inspect', container))[0].State.Health.Status, { timeout: 15_000 }).toBe('healthy');
    expect(docker('logs', container)).not.toContain('PRIVATE KEY');
  } catch (error) {
    errors.push(error);
    try { await info.attach('tls-container-log', { body: docker('logs', container), contentType: 'text/plain' }); } catch {}
  }
  finally {
    const disposed = await Promise.allSettled([context?.close(), client?.dispose()]);
    for (const result of disposed) if (result.status === 'rejected') errors.push(result.reason);
    for (const target of containers) { try { docker('rm', '--force', target); } catch (error) { errors.push(error); } }
    try { docker('volume', 'rm', material); } catch (error) { errors.push(error); }
    identity.close();
  }
  if (errors.length) throw new AggregateError(errors, 'Container TLS check or cleanup failed');
});
