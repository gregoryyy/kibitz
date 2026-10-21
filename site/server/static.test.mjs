import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { cspFor, isHiddenPath, BASE_HEADERS, offlineHtml } from './static.mjs';

const sha = s => `'sha256-${crypto.createHash('sha256').update(s, 'utf8').digest('base64')}'`;

test('CSP allows inline scripts by hash only, not external or injected ones', () => {
  const inline = '\nimport { x } from "./x.js";\nx();\n';
  const csp = cspFor(`<p>hi</p><script type="module">${inline}</script><script src="a.js"></script>`);
  const scriptSrc = csp.split('; ').find(d => d.startsWith('script-src'));
  assert.ok(scriptSrc.includes(sha(inline)));
  assert.equal((scriptSrc.match(/sha256-/g) || []).length, 1, 'external <script src> needs no hash');
  assert.doesNotMatch(scriptSrc, /unsafe-inline/);
  assert.notEqual(cspFor('<script>alert(1)</script>'), csp);
});

test('CSP blocks framing, plugins and base-tag hijacking, and allows what the page needs', () => {
  const csp = cspFor('');
  for (const d of ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'none'", "connect-src 'self'", "worker-src 'self' blob:", 'https://fonts.gstatic.com']) assert.ok(csp.includes(d), d);
  assert.ok(csp.includes("'wasm-unsafe-eval'"));
});

test('dot-segments are hidden, ordinary paths are not', () => {
  for (const p of ['/.env', '/.git/config', '/sub/.secret', '\\.env']) assert.equal(isHiddenPath(p), true, p);
  for (const p of ['/', '/_test.html', '/sf.wasm', '/a/b.js', '/./x.js']) assert.equal(isHiddenPath(p), false, p);
});

test('base headers deny framing and sniffing', () => {
  assert.equal(BASE_HEADERS['X-Frame-Options'], 'DENY');
  assert.equal(BASE_HEADERS['X-Content-Type-Options'], 'nosniff');
});

test('every response makes the page cross-origin isolated (COOP + COEP), for the multi-threaded engine', () => {
  assert.equal(BASE_HEADERS['Cross-Origin-Opener-Policy'], 'same-origin');
  assert.equal(BASE_HEADERS['Cross-Origin-Embedder-Policy'], 'require-corp');
  assert.equal(BASE_HEADERS['Cross-Origin-Resource-Policy'], 'same-origin');
});

test('offline: the CSP allows no other host, and the page loses its Google Fonts links', () => {
  const page = '<title>K</title>\n<link rel="preconnect" href="https://fonts.googleapis.com">\n  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=X&display=swap">\n<link rel="icon" href="icon.svg">\n<p>hi</p>';
  const off = offlineHtml(page);
  assert.doesNotMatch(off, /fonts\.g/);
  assert.match(off, /<link rel="icon" href="icon.svg">/);
  assert.match(off, /<p>hi<\/p>/);
  const csp = cspFor(off, { offline: true });
  assert.doesNotMatch(csp, /https:/);
  assert.match(csp, /font-src 'self'(;|$)/);
  assert.match(csp, /connect-src 'self'/);
  assert.match(cspFor(page), /https:\/\/fonts\.gstatic\.com/, 'online keeps the fonts');
});
