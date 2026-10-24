import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openPrivateLibrary } from './library-files.mjs';

test('private database files are outside the static tree, mode 0600, persistent, and reject direct/parent symlinks', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kibitz-library-paths-')), root = path.join(dir, 'dist'); fs.mkdirSync(root);
  try {
    const file = path.join(dir, '.kibitz-data', 'library.sqlite'), owner = 'a'.repeat(64);
    let store = openPrivateLibrary(file, root);
    store.change(owner, 0, [{ collection: 'games', id: 'g', record: { id: 'g', pgn: '1. e4 *' } }]); store.close();
    assert.equal(fs.statSync(file).mode & 0o777, 0o600); assert.equal(fs.statSync(path.dirname(file)).mode & 0o777, 0o700);
    store = openPrivateLibrary(file, root); assert.equal(store.read(owner).games[0].id, 'g'); store.close();
    assert.throws(() => openPrivateLibrary(path.join(root, 'private', 'library.sqlite'), root), /outside/);
    assert.equal(fs.existsSync(path.join(root, 'private')), false);
    const alias = path.join(dir, 'alias'); fs.symlinkSync(root, alias);
    assert.throws(() => openPrivateLibrary(path.join(alias, 'private', 'library.sqlite'), root), /outside/);
    assert.equal(fs.existsSync(path.join(root, 'private')), false);
    const link = path.join(dir, 'link.sqlite'); fs.symlinkSync(file, link);
    assert.throws(() => openPrivateLibrary(link, root), /private regular file/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('pre-existing public-readable files are preserved without chmod or a schema rewrite; memory mode creates no file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kibitz-library-private-'));
  try {
    const file = path.join(dir, 'original.sqlite'); fs.writeFileSync(file, 'Retained original file'); fs.chmodSync(file, 0o644);
    assert.throws(() => openPrivateLibrary(file, dir), /outside/); // even a private file cannot live in the served directory
    const root = path.join(dir, 'dist'); fs.mkdirSync(root);
    assert.throws(() => openPrivateLibrary(file, root), /private regular file/);
    assert.equal(fs.readFileSync(file, 'utf8'), 'Retained original file'); assert.equal(fs.statSync(file).mode & 0o777, 0o644);
    const store = openPrivateLibrary(':memory:', root); assert.deepEqual(store.read('b'.repeat(64)).games, []); store.close();
    assert.equal(fs.existsSync(path.join(dir, ':memory:')), false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
