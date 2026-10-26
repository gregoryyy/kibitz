import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, open, move } from './fixtures.mjs';
import { sourceControlRoots } from '../../server/deployment.mjs';
import { tlsMaterial } from '../helpers/tls-material.mjs';
import { httpsCli } from '../helpers/https-cli.mjs';

test.use({ ignoreHTTPSErrors: true, launchOptions: { args: ['--host-resolver-rules=MAP kibitz.test 127.0.0.1', '--no-proxy-server'] } }); // Synthetic CA only.
test('final native runtime hides original Git metadata while board, engine, mock coaching and private storage work', async ({ page }) => {
  const identity = tlsMaterial(), site = fileURLToPath(new URL('../..', import.meta.url)), script = process.env.KIBITZ_ISOLATION_SERVER_SCRIPT;
  const files = sourceControlRoots(site).flatMap(root => fs.statSync(root).isFile() ? [root] : ['HEAD', 'config'].map(name => path.join(root, name)).filter(fs.existsSync));
  expect(files.length).toBeGreaterThan(0);
  let server;
  try {
    server = await httpsCli({ root: path.join(site, 'dist'), key: identity.key, cert: identity.cert, operatorSecret: identity.secret,
      library: path.join(identity.dir, 'library.sqlite'), final: true, script,
      nodeArgs: ['--import', fileURLToPath(new URL('../fixtures/native-isolation.mjs', import.meta.url))], env: { KIBITZ_NATIVE_PROBE_PATHS: JSON.stringify(files) },
      extra: script ? ['--operator', identity.operator, '--permissions', identity.policy, '--sessions', path.join(identity.dir, 'sessions.sqlite')] : [] });
    expect(server.output()).toContain('Native source metadata: unavailable'); expect(server.output()).not.toContain('Native source metadata: readable');
    const external = [];
    await page.route('**/*', route => {
      if (new URL(route.request().url()).origin !== server.base) { external.push(route.request().url()); return route.abort(); }
      return route.continue();
    });
    const cookie = await server.login();
    await page.context().addCookies([{ name: '__Host-kibitz_session', value: cookie.split('=')[1], url: server.base, secure: true, httpOnly: true, sameSite: 'Strict' }]);
    await open(page, server.base + '/?debug'); await move(page, 'e2', 'e4'); await expect(page.locator('#moves button')).toHaveCount(2);
    await page.locator('[data-tab="coach"]').click(); await page.locator('#coachInput').fill('Explain this position'); await page.locator('#coachSend').click();
    await expect(page.locator('#chat .msg.coach').last()).toContainText('Mock coach');
    const statuses = await page.evaluate(async () => {
      const routes = ['/api/library/records', '/.git/config', '/%2egit/HEAD', '/.svn/entries', '/.hg/store'];
      return Promise.all(routes.map(async route => (await fetch(route)).status));
    });
    expect(statuses).toEqual([200, 404, 404, 404, 404]);
    expect(external).toEqual([]); expect(server.output()).not.toContain(identity.dir);
  } finally { await server?.close(); identity.close(); }
});
