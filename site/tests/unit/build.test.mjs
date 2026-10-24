// Build before running unit tests: check the actual distributable's module tree and imports.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const src = path.join(root, 'src'), dist = path.join(root, 'dist');
const modules = readdirSync(src, { recursive: true }).filter(f => f.endsWith('.js'));

test('the build preserves every source module under its source directory, without old flat copies', () => {
  assert.ok(modules.length > 0);
  for (const file of modules) {
    assert.equal(readFileSync(path.join(dist, file), 'utf8'), readFileSync(path.join(src, file), 'utf8'), file);
    if (path.dirname(file) !== '.') assert.equal(existsSync(path.join(dist, path.basename(file))), false, `obsolete flat module: ${file}`);
  }
});

test('relative imports in the built page and application modules resolve inside the distributable', () => {
  for (const file of ['index.html', 'data.html', ...modules]) {
    const content = readFileSync(path.join(dist, file), 'utf8');
    for (const [, specifier] of content.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*)['"](\.[^'"]+\.js)['"]/g)) {
      const target = path.resolve(dist, path.dirname(file), specifier);
      assert.ok(target.startsWith(dist + path.sep), `${file}: ${specifier} escapes dist/`);
      assert.ok(existsSync(target), `${file}: missing ${specifier}`);
    }
  }
});
