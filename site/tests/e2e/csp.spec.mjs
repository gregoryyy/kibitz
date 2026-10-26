// Actual browser parsing against the real CLI's CSP header; synthetic trusted HTML only.
import { test, expect } from '@playwright/test';
import { spawn, execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const script = process.env.KIBITZ_CSP_SERVER || fileURLToPath(new URL('../../scripts/serve.mjs', import.meta.url));
const inertCode = 'window.cspDormant = true;';
let root, child, stopped, base;
test.beforeAll(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'kibitz-csp-'));
  fs.writeFileSync(path.join(root, 'variants.html'), '<!doctype html><meta charset="utf-8">' +
    '<SCRIPT data-note="a > b">window.cspSeen = ["quoted"];</SCRIPT >' +
    '<script data-src="metadata">window.cspSeen.push("metadata");</script\n>' +
    '<script>\r\nwindow.cspSeen.push("crlf");\r\n</script>' +
    '<script src="external.js">window.externalBodyRan = true;</script>' +
    '<svg><script>window.svgText = "A &amp; B";</script></svg>');
  fs.writeFileSync(path.join(root, 'external.js'), 'window.externalLoaded = true;');
  fs.writeFileSync(path.join(root, 'inert.html'), '<!doctype html><meta charset="utf-8">' +
    `<!--<script>${inertCode}</script>--><textarea><script>${inertCode}</script></textarea>` +
    `<template><script>${inertCode}</script></template><noscript><script>${inertCode}</script></noscript>` +
    `<script type="application/json">${inertCode}</script>` +
    '<script>window.cspActive = true;</script>');
  fs.writeFileSync(path.join(root, 'artifact.html'), '<main id="result">waiting</main><script type="module">document.getElementById("result").textContent = "module ready";</script>');
  fs.writeFileSync(path.join(root, 'styles.html'), '<!doctype html><meta charset="utf-8">' +
    '<STYLE data-note="a > b">\r\n#trusted { color: rgb(1, 2, 3); }\r</STYLE >' +
    '<template><style>#trusted { color: rgb(90, 80, 70); }</style></template>' +
    '<div id="trusted">trusted block</div><div id="attribute">attribute probe</div><div id="runtime">runtime geometry</div>');
  child = spawn(process.execPath, [script, root, '--port', '0'], { stdio: ['ignore', 'pipe', 'pipe'] });
  stopped = new Promise(resolve => child.once('exit', resolve));
  let output = '';
  base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(Error('CSP fixture startup timed out')); }, 20_000);
    child.stdout.on('data', chunk => { output += chunk; const match = output.match(/at (http:\/\/127\.0\.0\.1:\d+)\//); if (match) { clearTimeout(timer); resolve(match[1]); } });
    child.stderr.on('data', () => {});
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(Error(`CSP fixture exited (${code})`)); });
  });
});
test.afterAll(async () => {
  if (child && child.exitCode === null && child.signalCode === null) child.kill();
  await stopped; if (root) fs.rmSync(root, { recursive: true, force: true });
});
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.cspViolations = [];
    document.addEventListener('securitypolicyviolation', event => window.cspViolations.push({ directive: event.effectiveDirective, blocked: event.blockedURI }));
  });
});

test('valid HTML tag/attribute variants and normalized text execute under their actual CSP hashes', async ({ page }) => {
  await page.goto(base + '/variants.html');
  expect(await page.evaluate(() => window.cspSeen)).toEqual(['quoted', 'metadata', 'crlf']);
  expect(await page.evaluate(() => window.svgText)).toBe('A & B');
  expect(await page.evaluate(() => window.externalLoaded)).toBe(true);
  expect(await page.evaluate(() => window.externalBodyRan)).toBeUndefined();
  expect(await page.evaluate(() => window.cspViolations)).toEqual([]);
});

test('inert source text cannot grant a hash to an injected inline script', async ({ page }) => {
  const response = await page.goto(base + '/inert.html');
  expect(await page.evaluate(() => window.cspActive)).toBe(true);
  await page.evaluate(code => { const node = document.createElement('script'); node.textContent = code; document.body.append(node); }, inertCode);
  expect(await page.evaluate(() => window.cspDormant)).toBeUndefined();
  await expect.poll(() => page.evaluate(() => window.cspViolations.length)).toBe(1);
  const hash = crypto.createHash('sha256').update(inertCode).digest('base64');
  expect(response.headers()['content-security-policy']).not.toContain(hash);
});

test('the artifact-style body keeps its module executable and cross-origin isolation headers', async ({ page }) => {
  const response = await page.goto(base + '/artifact.html');
  await expect(page.locator('#result')).toHaveText('module ready');
  expect(await page.evaluate(() => window.cspViolations)).toEqual([]);
  expect(response.headers()['cross-origin-opener-policy']).toBe('same-origin');
  expect(response.headers()['cross-origin-embedder-policy']).toBe('require-corp');
});

test('untrusted styles and style attributes are blocked while hashed CSS and runtime geometry work', async ({ page }) => {
  const response = await page.goto(base + '/styles.html');
  await expect(page.locator('#trusted')).toHaveCSS('color', 'rgb(1, 2, 3)');
  await page.evaluate(() => {
    const style = document.createElement('style'); style.textContent = '#trusted { color: rgb(90, 80, 70); }'; document.body.append(style);
    document.querySelector('#attribute').setAttribute('style', 'display:none');
    document.querySelector('#runtime').style.width = '43px';
  });
  await expect(page.locator('#trusted')).toHaveCSS('color', 'rgb(1, 2, 3)');
  await expect(page.locator('#attribute')).toBeVisible();
  await expect(page.locator('#runtime')).toHaveCSS('width', '43px');
  await expect.poll(() => page.evaluate(() => window.cspViolations.map(v => v.directive).sort())).toEqual(['style-src-attr', 'style-src-elem']);
  expect(response.headers()['content-security-policy']).not.toMatch(/unsafe-inline|unsafe-hashes|fonts\.google/);
});

test('a missing parser dependency produces a bounded actionable startup error', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kibitz-csp-dependency-'));
  try {
    fs.mkdirSync(path.join(dir, 'scripts')); fs.mkdirSync(path.join(dir, 'server'));
    fs.copyFileSync(script, path.join(dir, 'scripts', 'serve.mjs'));
    for (const name of ['static.mjs', 'public-files.mjs', 'models.mjs', 'logging.mjs']) fs.copyFileSync(fileURLToPath(new URL('../../server/' + name, import.meta.url)), path.join(dir, 'server', name));
    // A self-reference guarantees a missing dependency even if a parent has node_modules.
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'parse5', type: 'module', exports: './PRIVATE_DEPENDENCY.mjs' }));
    const result = await new Promise(resolve => execFile(process.execPath, [path.join(dir, 'scripts', 'serve.mjs'), root, '--port', '0'], { timeout: 20_000 }, (error, stdout, stderr) => resolve({ code: error ? error.code : 0, stdout, stderr })));
    expect(result.code).toBe(1); expect(result.stdout).not.toContain('Serving'); expect(result.stderr).not.toContain('PRIVATE_DEPENDENCY');
    const events = result.stderr.split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line));
    expect(events).toHaveLength(1); expect(events[0]).toMatchObject({ event: 'server_error', code: 'ERR_MODULE_NOT_FOUND' });
    expect(events[0].hint).toContain('npm ci');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
