import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('CodeQL initialization and analysis use the same immutable action revision', () => {
  const workflow = readFileSync(new URL('../../../.github/workflows/codeql.yml', import.meta.url), 'utf8');
  const steps = [...workflow.matchAll(/uses:\s+github\/codeql-action\/([\w-]+)@([^\s#]+)/g)];
  assert.ok(steps.some(([, action]) => action === 'init'), 'initialization is present');
  assert.ok(steps.some(([, action]) => action === 'analyze'), 'analysis is present');
  for (const [, action, revision] of steps) {
    assert.match(revision, /^[a-f0-9]{40}$/, `${action} must remain commit-pinned`);
  }
  assert.equal(new Set(steps.map(([, , revision]) => revision)).size, 1,
    'CodeQL steps share configuration and must use the same revision');
});
