import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { cspFor, isHiddenPath, BASE_HEADERS, offlineHtml } from './static.mjs';

const sha = s => `'sha256-${crypto.createHash('sha256').update(s, 'utf8').digest('base64')}'`;

test('CSP hashes the trusted document inline scripts and excludes external script bodies', () => {
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
  assert.equal(cspFor(page).split('; ').find(d => d.startsWith('font-src ')), "font-src 'self' https://fonts.gstatic.com", 'online keeps the exact font source');
});

test('CSP follows parsed tag/attribute boundaries and browser text normalization', () => {
  const body = 'globalThis.good = "A &amp; B";';
  for (const html of [`<SCRIPT>${body}</SCRIPT >`, `<script data-note="a > b">${body}</script\n>`, `<script data-src="metadata">${body}</script>`]) {
    assert.ok(cspFor(html).includes(sha(body)), html);
  }
  assert.ok(cspFor('<script>\r\nglobalThis.good = true;\r</script>').includes(sha('\nglobalThis.good = true;\n')));
  assert.ok(!cspFor(`<script SRC="external.js">${body}</script>`).includes(sha(body)));
  assert.ok(!cspFor(`<script src="">${body}</script>`).includes(sha(body)));
});

test('CSP excludes inert and unfinished script-looking content without treating data as HTML', () => {
  const fake = 'globalThis.inert = true;', good = 'globalThis.active = true;';
  const html = `<!-- <script>${fake}</script> --><textarea><script>${fake}</script></textarea><template><script>${fake}</script></template><noscript><script>${fake}</script></noscript><script type="application/json">${fake}</script><script>${good}</script><script>${fake}`;
  assert.ok(!cspFor(html).includes(sha(fake))); assert.ok(cspFor(html).includes(sha(good)));
});

test('data-block and script-type distinctions preserve module/import-map policy without authorizing inert code', () => {
  const body = 'globalThis.typeProbe = true;';
  for (const type of ['application/json', 'text/plain', 'unknown', ' module ', '\u00a0text/javascript\u00a0', 'text/javascript;charset=utf-8']) {
    assert.ok(!cspFor(`<script type="${type}">${body}</script>`).includes(sha(body)), type);
  }
  for (const type of ['', 'MODULE', 'importmap', 'speculationrules', ' TeXt/JavaScript\t', 'application/x-javascript']) {
    assert.ok(cspFor(`<script type="${type}">${body}</script>`).includes(sha(body)), type);
  }
  assert.ok(!cspFor(`<script language="vbscript">${body}</script>`).includes(sha(body)));
  assert.ok(cspFor(`<script language="javascript">${body}</script>`).includes(sha(body)));
});

test('SVG script text uses its parsed text and href semantics; duplicate hashes stay bounded', () => {
  const raw = 'globalThis.svg = "A &amp; B";', decoded = 'globalThis.svg = "A & B";';
  const html = `<svg><script>${raw}</script><script href="external.js">external</script></svg>`;
  assert.ok(cspFor(html).includes(sha(decoded))); assert.ok(!cspFor(html).includes(sha('external')));
  assert.equal(cspFor(`<script>${decoded}</script><script>${decoded}</script>`).split(sha(decoded)).length - 1, 1);
});

test('the entire policy input must be trusted: parsing does not sanitize supplied executable code', () => {
  const body = 'globalThis.untrusted = true;';
  assert.ok(cspFor(`<script>${body}</script>`).includes(sha(body)), 'callers must never supply model/user HTML to this function');
});
