import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ensureDependencies } from '../../scripts/install.mjs';

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kibitz-install-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(path.join(directory, 'package.json'), '{"dependencies":{"parse5":"8.0.1"}}');
  fs.writeFileSync(path.join(directory, 'package-lock.json'), '{"lockfileVersion":3}');
  const calls = []; let complete = false, fail = false, partial = false;
  const run = (command, args, options) => {
    assert.equal(command, 'npm'); assert.equal(options.cwd, directory); calls.push(args);
    if (args[0] === 'ls') return { status: complete ? 0 : 1 };
    if (fail) return { status: 1 };
    fs.mkdirSync(path.join(directory, 'node_modules'), { recursive: true }); complete = !partial;
    return { status: 0 };
  };
  return { directory, calls, run, marker: path.join(directory, 'node_modules', '.kibitz-install'),
    missing: () => { complete = false; }, fail: () => { fail = true; }, partial: () => { partial = true; } };
}

test('an existing incomplete directory is repaired, including development dependencies with scripts disabled', t => {
  const f = fixture(t); fs.mkdirSync(path.join(f.directory, 'node_modules'));
  assert.deepEqual(ensureDependencies(f), { installed: true });
  assert.deepEqual(f.calls[0], ['ci', '--ignore-scripts', '--include=dev', '--no-audit', '--no-fund']);
  assert(fs.existsSync(f.marker));
  const count = f.calls.length;
  assert.deepEqual(ensureDependencies(f), { installed: false }); assert.equal(f.calls.length, count + 1); assert.equal(f.calls.at(-1)[0], 'ls');
});

test('manifest, lockfile and runtime changes invalidate a previous successful install', t => {
  const f = fixture(t); ensureDependencies({ ...f, runtime: 'runtime-a' });
  for (const name of ['package.json', 'package-lock.json']) {
    fs.appendFileSync(path.join(f.directory, name), '\n');
    assert.equal(ensureDependencies({ ...f, runtime: 'runtime-a' }).installed, true);
  }
  assert.equal(ensureDependencies({ ...f, runtime: 'runtime-b' }).installed, true);
  assert.equal(ensureDependencies({ ...f, runtime: 'runtime-b' }).installed, false);
});

test('a successful stamp does not hide missing or mismatched dependencies', t => {
  const f = fixture(t); ensureDependencies(f); f.missing();
  assert.equal(ensureDependencies(f).installed, true); assert.equal(f.calls.filter(args => args[0] === 'ci').length, 2);
});

test('failed or incomplete repairs remove the success stamp and fail rather than continuing to build', t => {
  for (const kind of ['fail', 'partial']) {
    const f = fixture(t); ensureDependencies(f); f.missing(); f[kind]();
    assert.throws(() => ensureDependencies(f), /incomplete/); assert(!fs.existsSync(f.marker));
  }
});

test('a removed stamp is treated as an unverified install', t => {
  const f = fixture(t); ensureDependencies(f); fs.unlinkSync(f.marker);
  assert.equal(ensureDependencies(f).installed, true);
});
