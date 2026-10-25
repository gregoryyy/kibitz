import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { copyFonts } from '../../scripts/build-fonts.mjs';

const source = new URL('../../src/fonts/', import.meta.url);

test('the built public/offline bundle retains the three original typefaces, pinned bytes and complete licences', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', source), 'utf8'));
  assert.equal(manifest.revision, 'e7db6ca603fd4862010383ff17ffd6cc4ffac1c0');
  assert.deepEqual(manifest.assets.filter(a => a.kind === 'font').map(a => a.file).sort(), ['bricolage-grotesque.ttf', 'instrument-sans.ttf', 'jetbrains-mono.ttf']);
  assert.equal(manifest.assets.filter(a => a.kind === 'licence').length, 3);
  const worker = fs.readFileSync(new URL('../../dist/sw.js', import.meta.url), 'utf8');
  for (const asset of manifest.assets) {
    const built = fs.readFileSync(new URL('../../dist/fonts/' + asset.file, import.meta.url));
    assert.equal(built.length, asset.bytes);
    assert.equal(createHash('sha256').update(built).digest('hex'), asset.sha256);
    assert.ok(asset.source.startsWith(`https://raw.githubusercontent.com/google/fonts/${manifest.revision}/ofl/`));
    assert.ok(worker.includes(`fonts/${asset.file}`));
    if (asset.kind === 'licence') assert.ok(built.includes('SIL OPEN FONT LICENSE Version 1.1'));
  }
});

test('a changed font/licence, absent inventory or path escape fails before publishing unchecked assets', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'kibitz-font-integrity-'));
  try {
    const input = path.join(temp, 'input'), output = path.join(temp, 'output'); fs.mkdirSync(input);
    const bytes = Buffer.from('synthetic font'), manifest = { assets: [{ file: 'test.ttf', bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }] };
    const save = data => fs.writeFileSync(path.join(input, 'manifest.json'), JSON.stringify(data));
    fs.writeFileSync(path.join(input, 'test.ttf'), bytes); save(manifest);
    copyFonts(input, output); assert.deepEqual(fs.readFileSync(path.join(output, 'test.ttf')), bytes);
    fs.rmSync(output, { recursive: true });
    fs.writeFileSync(path.join(input, 'test.ttf'), Buffer.alloc(bytes.length, 120));
    assert.throws(() => copyFonts(input, output), /integrity/); assert.ok(!fs.existsSync(output));
    for (const data of [{ assets: [] }, { assets: [{ ...manifest.assets[0], file: '../escape.ttf' }] }]) {
      save(data); assert.throws(() => copyFonts(input, output), /inventory|asset/); assert.ok(!fs.existsSync(output));
    }
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
