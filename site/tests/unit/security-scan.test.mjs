import test from 'node:test';
import assert from 'node:assert/strict';
import { checkHeaders, checkZap, stagingTarget, command, REQUIRED_PATHS, ZAP_IMAGE } from '../../scripts/security-scan.mjs';

const target = 'http://127.0.0.1:9123';
const report = () => ({ '@version': '2.17.0', site: [{ '@name': target, alerts: [] }] });
const coverage = () => ({ paths: [...REQUIRED_PATHS], passivePending: 0, enabledRules: ['10010', '10038'] });
// Test policy written independently of the production header generator.
const headers = () => new Headers({
  'content-type': 'text/html; charset=utf-8', 'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer', 'x-frame-options': 'DENY', 'cross-origin-opener-policy': 'same-origin',
  'cross-origin-embedder-policy': 'require-corp', 'cross-origin-resource-policy': 'same-origin',
  'content-security-policy': "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' blob: 'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='; worker-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
});

test('scan target is always a dedicated loopback HTTP origin and scanner is digest-pinned', () => {
  assert.equal(stagingTarget(target), target);
  assert.match(ZAP_IMAGE, /^ghcr\.io\/zaproxy\/zaproxy:2\.17\.0@sha256:[a-f0-9]{64}$/);
  for (const value of ['https://127.0.0.1:9123', 'http://localhost:9123', 'http://example.com:9123', 'http://127.0.0.1', `${target}/private`, `${target}?x`, `${target}#x`, 'http://u:p@127.0.0.1:9123']) {
    assert.throws(() => stagingTarget(value), undefined, value);
  }
});

test('header audit fails on missing or weakened boundaries, duplicate CSP and executable broad sources', () => {
  assert.deepEqual(checkHeaders(headers()), []);
  for (const name of ['content-type', 'content-security-policy', 'x-content-type-options', 'referrer-policy', 'x-frame-options', 'cross-origin-opener-policy', 'cross-origin-embedder-policy', 'cross-origin-resource-policy']) {
    const changed = headers(); changed.delete(name);
    assert.ok(checkHeaders(changed).length, name);
  }
  for (const source of ["'unsafe-inline'", "'unsafe-eval'", '*', 'https:', 'data:', 'https://untrusted.invalid']) {
    const changed = headers(); changed.set('content-security-policy', changed.get('content-security-policy').replace("script-src 'self'", `script-src 'self' ${source}`));
    assert.ok(checkHeaders(changed).includes('Unexpected CSP script source'), source);
  }
  for (const directive of ['default-src', 'connect-src', 'object-src', 'base-uri', 'form-action', 'frame-ancestors', 'worker-src']) {
    const changed = headers(); changed.set('content-security-policy', changed.get('content-security-policy') + `; ${directive} *`);
    assert.ok(checkHeaders(changed).some(e => e.includes('Duplicate CSP')), directive);
  }
  const externalOnly = headers();
  externalOnly.set('content-security-policy', externalOnly.get('content-security-policy').replace(/ 'sha256-[^']+'/g, ''));
  assert.ok(checkHeaders(externalOnly).includes('Missing inline script hashes'));
  assert.deepEqual(checkHeaders(externalOnly, { inline: false }), []);
});

test('high findings fail even if baseline exit status would call them WARN; lower findings remain visible', () => {
  const data = report();
  data.site[0].alerts.push({ pluginid: '123', riskcode: '2', instances: [{ uri: target + '/' }] });
  let result = checkZap(data, coverage(), target);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.alerts, [{ id: '123', risk: 2, instances: 1 }]);
  data.site[0].alerts.push({ pluginid: '456', riskcode: '3', instances: [{ uri: target + '/data.html' }] });
  result = checkZap(data, coverage(), target);
  assert.ok(result.errors.includes('High ZAP alert 456'));
  assert.equal(result.alerts.length, 2);
});

test('absent, malformed, wrong-target or wrong-version reports cannot become a clean scan', () => {
  for (const data of [null, {}, { site: [] }, { ...report(), '@version': 'weekly' }, { ...report(), site: [{ '@name': 'https://untrusted.invalid', alerts: [] }] }, { ...report(), site: [{ '@name': target }] }]) {
    assert.ok(checkZap(data, coverage(), target).errors.length, JSON.stringify(data));
  }
  for (const alert of [null, {}, { pluginid: 'x', riskcode: '0', instances: [{}] }, { pluginid: '1', riskcode: '-1', instances: [{}] }, { pluginid: '1', riskcode: '0', instances: [] }]) {
    const data = report(); data.site[0].alerts = [alert];
    assert.ok(checkZap(data, coverage(), target).errors.includes('Malformed ZAP alert'));
  }
});

test('coverage needs every read-only seed, enabled passive rules and completed passive processing', () => {
  assert.deepEqual(checkZap(report(), coverage(), target), { errors: [], alerts: [] });
  for (const path of REQUIRED_PATHS) {
    const data = coverage(); data.paths = data.paths.filter(p => p !== path);
    assert.ok(checkZap(report(), data, target).errors.includes(`Unscanned required path ${path}`));
  }
  for (const data of [null, {}, { ...coverage(), passivePending: 1 }, { ...coverage(), enabledRules: [] }, { ...coverage(), enabledRules: ['untrusted-rule'] }]) {
    assert.ok(checkZap(report(), data, target).errors.length);
  }
});

test('security child commands have a real deadline and propagate nonzero exit status', async () => {
  assert.equal(await command(process.execPath, ['-e', 'process.exit(7)'], { timeout: 2000, env: {} }), 7);
  await assert.rejects(command(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { timeout: 100, env: {} }), /deadline exceeded/);
});
