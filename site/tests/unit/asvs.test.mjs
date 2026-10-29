import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { baseline, validateChecklist, renderChecklist, evidenceExists } from '../../scripts/check-asvs.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const checklist = JSON.parse(readFileSync(resolve(root, 'docs/security/asvs-l1.json'), 'utf8'));
const copy = () => structuredClone(checklist);
const rejects = (change, pattern) => {
  const data = copy(); change(data);
  assert.match(validateChecklist(data).join('\n'), pattern);
};

test('pinned L1 assessment has all 70 controls, real evidence and a fresh readable document', () => {
  assert.equal(baseline.length, 70);
  assert.equal(new Set(baseline).size, 70);
  assert.deepEqual(validateChecklist(checklist), []);
  assert.equal(readFileSync(resolve(root, 'docs/security/asvs-l1.md'), 'utf8'), renderChecklist(checklist));
  assert.ok(checklist.controls.some(r => r.status === 'open'));
  assert.ok(checklist.controls.some(r => r.status === 'deviation'));
  assert.match(renderChecklist(checklist), /do not establish ASVS compliance/);
});

test('missing, duplicated, foreign-level and unversioned requirements cannot silently change coverage', () => {
  rejects(d => d.controls.pop(), /Missing ID: v5.0.0-15.3.1/);
  rejects(d => d.controls.push(d.controls[0]), /Duplicate ID/);
  rejects(d => d.controls[0].id = 'v5.0.0-1.1.1', /Unknown L1 ID/);
  rejects(d => d.controls[0].id = '1.2.1', /Unknown L1 ID/);
  rejects(d => d.controls = null, /Missing controls array/);
  rejects(d => d.controls[0] = null, /Invalid control/);
});

test('a new standard, source, scope or unsupported disposition requires an explicit baseline review', () => {
  for (const [key, value] of [['version', '5.1.0'], ['level', 2], ['totalRequirements', 344], ['sha256', '0'.repeat(64)], ['url', 'https://untrusted.invalid/source']]) {
    rejects(d => d.source[key] = value, /Incorrect source/);
  }
  rejects(d => d.scope = 'hosted-with-accounts', /Incorrect deployment scope/);
  rejects(d => d.revision = 'main', /Missing reviewed revision/);
  rejects(d => d.controls[0].status = 'passed', /Invalid status/);
  rejects(d => d.controls[0].method = 'looks-fine', /Invalid method/);
});

test('assessments need meaningful notes, suitable evidence and visible gap follow-ups', () => {
  rejects(d => d.controls[0].note = '  ', /Missing or invalid assessment/);
  rejects(d => d.controls[0].topic = 'hidden\nrow', /Missing or invalid assessment/);
  rejects(d => d.controls[0].note = 'a'.repeat(2001), /Missing or invalid assessment/);
  for (const evidence of [[], null, 'docs/security/asvs.md', ['docs/no-such-asvs-file.md']]) {
    rejects(d => d.controls[0].evidence = evidence, /Invalid evidence/);
  }
  rejects(d => d.controls[0].evidence = ['site/server/api.mjs'], /Code and test evidence required/);
  rejects(d => d.controls[0].method = 'scope-review', /Verification needs evidence review/);
  rejects(d => { d.controls[0].method = 'documentation-review'; d.controls[0].evidence = ['site/server/api.mjs']; }, /Documentation evidence required/);
  rejects(d => delete d.controls.find(r => r.status === 'open').followUp, /Missing follow-up/);
});

test('evidence paths reject traversal, absolute paths, hidden secrets and symlink escapes', () => {
  for (const path of ['../docs/security/asvs.md', '/etc/passwd', 'docs/../.env', 'docs/.env', 'site/server/../../.env', 'docs/security//asvs.md', 'docs/security/asvs.md#x', 'docs/security/asvs.md?x']) {
    assert.equal(evidenceExists(path), false, path);
  }
  const parent = mkdtempSync(resolve(root, 'docs/asvs-path-test-'));
  const outside = mkdtempSync(resolve(tmpdir(), 'kibitz-asvs-outside-'));
  try {
    writeFileSync(resolve(outside, 'outside.md'), 'Existing evidence outside the repository.');
    symlinkSync(outside, resolve(parent, 'escape'));
    assert.equal(evidenceExists(`docs/${parent.split('/').at(-1)}/escape/outside.md`), false);
  } finally {
    rmSync(parent, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test('generated table treats assessment metadata as literal text and uses fixed source links', () => {
  const data = copy();
  data.controls[0].topic = '<img src=x onerror=alert(1)> | [attack](javascript:alert(1)) `code` &';
  data.controls[0].note = '**heading** _x_ \\ [link](https://untrusted.invalid)';
  assert.deepEqual(validateChecklist(data), []);
  const rendered = renderChecklist(data);
  assert.ok(!rendered.includes('<img'));
  assert.ok(!rendered.includes('[attack]'));
  assert.ok(!rendered.includes('`code`'));
  assert.ok(rendered.includes('&#124;'));
  assert.ok(rendered.includes('&#38;'));
  assert.equal(rendered.split('\n').filter(line => line.startsWith('| [v5.0.0-')).length, 70);
  assert.ok(rendered.includes('https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x10-V1-Encoding-and-Sanitization.md'));
});

test('offline CLI rejects document drift and bad arguments without rewriting; explicit generation repairs it', () => {
  const temp = mkdtempSync(resolve(tmpdir(), 'kibitz-asvs-cli-'));
  try {
    mkdirSync(resolve(temp, 'site/scripts'), { recursive: true });
    mkdirSync(resolve(temp, 'docs/security'), { recursive: true });
    const script = resolve(temp, 'site/scripts/check-asvs.mjs');
    writeFileSync(script, readFileSync(resolve(root, 'site/scripts/check-asvs.mjs')));
    const data = copy();
    for (const row of data.controls) {
      row.status = 'not-applicable'; row.method = 'scope-review'; row.evidence = ['docs/scope.md'];
    }
    writeFileSync(resolve(temp, 'docs/scope.md'), 'Test-only local scope.');
    writeFileSync(resolve(temp, 'docs/security/asvs-l1.json'), JSON.stringify(data));
    const output = resolve(temp, 'docs/security/asvs-l1.md');
    writeFileSync(output, 'stale');
    const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env: {} });
    let result = run();
    assert.equal(result.status, 1); assert.match(result.stderr, /is stale/);
    assert.equal(readFileSync(output, 'utf8'), 'stale');
    result = run('--unknown');
    assert.equal(result.status, 1); assert.match(result.stderr, /Usage:/);
    result = run('--write'); assert.equal(result.status, 0, result.stderr);
    result = run(); assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /70\/70; 0 verified, 70 not-applicable/);
    assert.match(result.stdout, /not compliance/);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});

test('stdin and eval imports do not run the CLI or resolve a non-file entrypoint', () => {
  const script = new URL('../../scripts/check-asvs.mjs', import.meta.url).href;
  const input = `await import(${JSON.stringify(script)}); console.log('imported');`;
  for (const args of [['--input-type=module', '-'], ['--input-type=module', '--eval', input]]) {
    const result = spawnSync(process.execPath, args, { input, encoding: 'utf8', env: {} });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, 'imported\n');
    assert.equal(result.stderr, '');
  }
});
