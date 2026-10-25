import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { parseDpkgStatus, readDpkgInventory, readBoundedFile } from '../../scripts/image-inventory.mjs';

test('Debian inventory reads installed identities with exact epochs/releases and ignores description/removed-package text', () => {
  assert.deepEqual(parseDpkgStatus('Package: zlib1g\nStatus: install ok installed\nVersion: 1:1.2.13.dfsg-1\nDescription: sample\n Package: forged\n\nPackage: removed\nStatus: deinstall ok config-files\nVersion: 1\n'), [{ name: 'zlib1g', version: '1:1.2.13.dfsg-1' }]);
  assert.deepEqual(parseDpkgStatus('Package: libc6\nVersion: 2.41-12\nArchitecture: amd64\n'), [{ name: 'libc6', version: '2.41-12' }]);
  for (const source of ['Package: bad/name\nVersion: 1\n', 'Package: libc6\n', 'Package: libc6\nVersion: 1\nVersion: 2\n']) assert.throws(() => parseDpkgStatus(source));
});

test('dpkg status and distroless status.d produce deterministic independent inventories without a package-manager executable', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'kibitz-os-inventory-'));
  try {
    fs.mkdirSync(path.join(temp, 'status.d'));
    fs.writeFileSync(path.join(temp, 'status'), 'Package: zlib1g\nStatus: install ok installed\nVersion: 1:1.3.1-2\n');
    fs.writeFileSync(path.join(temp, 'status.d/libc6'), 'Package: libc6\nVersion: 2.41-12\n');
    fs.writeFileSync(path.join(temp, 'status.d/libc6.md5sums'), '123456789 file\n');
    assert.equal(readDpkgInventory(temp), 'libc6\t2.41-12\nzlib1g\t1:1.3.1-2\n');
    fs.writeFileSync(path.join(temp, 'status.d/duplicate'), 'Package: libc6\nVersion: 1\n');
    assert.throws(() => readDpkgInventory(temp), /Conflicting/);
    fs.unlinkSync(path.join(temp, 'status.d/duplicate'));
    fs.symlinkSync(path.join(temp, 'status'), path.join(temp, 'status.d/alias'));
    assert.throws(() => readDpkgInventory(temp), /ELOOP|symbolic link/);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test('an atomic replacement/symlink after descriptor validation cannot redirect evidence to another file', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'kibitz-evidence-race-'));
  try {
    const file = path.join(temp, 'report'), privateFile = path.join(temp, 'private');
    fs.writeFileSync(file, 'approved'); fs.writeFileSync(privateFile, 'SYNTHETIC_PRIVATE'); let closed = 0;
    const io = { ...fs, fstatSync(fd) {
      const result = fs.fstatSync(fd); fs.renameSync(file, file + '.old'); fs.symlinkSync(privateFile, file); return result;
    }, closeSync(fd) { closed++; fs.closeSync(fd); } };
    assert.equal(readBoundedFile(file, 16, io).toString(), 'approved'); assert.equal(closed, 1);
    assert.throws(() => readBoundedFile(file, 32), /ELOOP|symbolic link/);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test('actual byte bounds survive growth after fstat and descriptors close on failure', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'kibitz-evidence-growth-'));
  try {
    const file = path.join(temp, 'report'); fs.writeFileSync(file, 'small'); let closed = 0;
    const io = { ...fs, fstatSync(fd) {
      const result = fs.fstatSync(fd); fs.appendFileSync(file, 'more than the capacity'); return result;
    }, closeSync(fd) { closed++; fs.closeSync(fd); } };
    assert.throws(() => readBoundedFile(file, 8, io), /capacity/); assert.equal(closed, 1);
    assert.throws(() => readBoundedFile(temp, 16), /Invalid evidence file/);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test('missing or non-file inventory never becomes an empty clean result', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'kibitz-os-missing-'));
  try {
    assert.throws(() => readDpkgInventory(temp), /Missing/);
    fs.mkdirSync(path.join(temp, 'status')); assert.throws(() => readDpkgInventory(temp), /Invalid/);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
