import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const installer = pathToFileURL(fileURLToPath(new URL('../../scripts/install.mjs', import.meta.url))).href;

test('an existing incomplete dependency directory is repaired before building a usable page; complete installs are reused', async ({ page }) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kibitz-build-install-')), bin = path.join(directory, 'bin');
  try {
    fs.mkdirSync(bin); fs.mkdirSync(path.join(directory, 'node_modules'));
    fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ name: 'synthetic-build', type: 'module', dependencies: { parse5: '8.0.1' } }));
    fs.writeFileSync(path.join(directory, 'package-lock.json'), '{"lockfileVersion":3}');
    fs.writeFileSync(path.join(directory, 'build.mjs'), `import { parse } from 'parse5'; import fs from 'node:fs';
      fs.writeFileSync('page.html', '<!doctype html><p id="ready">Build ready: ' + parse('').nodeName + '</p>');`);
    // A bounded local npm stand-in: the real installer/child processes run, while
    // this fixture makes no package-registry request and executes no package scripts.
    fs.writeFileSync(path.join(bin, 'npm'), `#!/usr/bin/env node
import fs from 'node:fs';
const command = process.argv[2]; fs.appendFileSync('npm-calls', command + '\\n');
if (command === 'ls') process.exit(fs.existsSync('node_modules/parse5/index.js') ? 0 : 1);
if (command !== 'ci') process.exit(2);
fs.mkdirSync('node_modules/parse5', { recursive: true });
fs.writeFileSync('node_modules/parse5/package.json', JSON.stringify({ name: 'parse5', version: '8.0.1', type: 'module', exports: './index.js' }));
fs.writeFileSync('node_modules/parse5/index.js', "export const parse = () => ({ nodeName: '#document' });");
`, { mode: 0o700 });
    const options = { cwd: directory, env: { ...process.env, PATH: bin + path.delimiter + process.env.PATH }, timeout: 10_000 };
    let failed = false;
    try { await run(process.execPath, ['build.mjs'], options); }
    catch (error) { failed = String(error.stderr).includes('ERR_MODULE_NOT_FOUND'); }
    expect(failed).toBe(true); // The old directory-only install check left this failure intact.
    const install = () => run(process.execPath, ['--input-type=module', '-e', `import { ensureDependencies } from ${JSON.stringify(installer)}; ensureDependencies({ directory: ${JSON.stringify(directory)} });`], options);
    await install(); await run(process.execPath, ['build.mjs'], options);
    await install(); expect(fs.readFileSync(path.join(directory, 'npm-calls'), 'utf8').split('\n').filter(command => command === 'ci')).toHaveLength(1);
    fs.rmSync(path.join(directory, 'node_modules/parse5'), { recursive: true });
    await install(); await run(process.execPath, ['build.mjs'], options);
    expect(fs.readFileSync(path.join(directory, 'npm-calls'), 'utf8').split('\n').filter(command => command === 'ci')).toHaveLength(2);
    await page.setContent(fs.readFileSync(path.join(directory, 'page.html'), 'utf8'));
    await expect(page.locator('#ready')).toHaveText('Build ready: #document');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
