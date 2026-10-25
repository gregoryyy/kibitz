import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const guard = fileURLToPath(new URL('../../../utils/pdf/is-current.sh', import.meta.url));

test('PDF timestamps skip current output and rebuild missing, empty or outdated output', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'kibitz-pdf-times-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const output = join(dir, 'a document.md.pdf');
  const inputs = ['a document.md', 'style.css', 'mermaid.html', 'justfile'].map(name => join(dir, name));
  const time = new Date('2026-01-02T00:00:00Z');
  const earlier = new Date(time.getTime() - 10_000);
  const later = new Date(time.getTime() + 10_000);
  for (const path of inputs) { writeFileSync(path, 'input'); utimesSync(path, earlier, earlier); }
  const current = () => {
    const result = spawnSync('bash', [guard, output, ...inputs], { encoding: 'utf8' });
    assert.ifError(result.error);
    assert.equal(result.stderr, '');
    return result.status === 0;
  };

  assert.equal(current(), false, 'missing output');
  writeFileSync(output, ''); utimesSync(output, time, time);
  assert.equal(current(), false, 'empty output');
  writeFileSync(output, 'PDF'); utimesSync(output, time, time);
  assert.equal(current(), true, 'PDF newer than all inputs');
  for (const path of inputs) {
    utimesSync(path, later, later);
    assert.equal(current(), false, `changed input: ${path}`);
    utimesSync(path, time, time);
    assert.equal(current(), true, 'equal timestamps are current');
  }
  // Dates decide freshness even when the PDF has been replaced externally.
  writeFileSync(output, 'replacement PDF'); utimesSync(output, later, later);
  assert.equal(current(), true);
  rmSync(inputs[0]);
  assert.equal(current(), false, 'a missing input is not current');
});
