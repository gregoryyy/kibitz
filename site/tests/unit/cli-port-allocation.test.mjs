// A released probe port is deliberately reclaimed before a CLI child can bind.
// Atomic OS allocation must still let the actual persistence fixtures succeed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
test('CLI persistence fixtures survive immediate reclamation of released probe ports', () => {
  const env = { ...process.env, NODE_OPTIONS: '' }; delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ['--require', fileURLToPath(new URL('../fixtures/reclaim-probe-ports.cjs', import.meta.url)), '--test', '--test-reporter=tap', 'server/usage-serve.test.mjs', 'server/library-serve.test.mjs'], {
    cwd: fileURLToPath(new URL('../../', import.meta.url)), encoding: 'utf8', timeout: 30_000, maxBuffer: 1024 * 1024,
    env,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /# tests 3\b/);
  assert.match(result.stdout, /# pass 3\b/);
});
