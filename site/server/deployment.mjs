// Source-control discovery is offline and does not run Git or evaluate checkout code.
import fs from 'node:fs';
import path from 'node:path';

const SCM = new Set(['.git', '.svn', '.hg']);
const LIMIT = 16 * 1024;
export const DEPLOYMENT_ERROR = 'Final operation requires a verified deployment without readable source-control metadata.';
const fail = () => { throw Object.assign(new Error(DEPLOYMENT_ERROR), { code: 'ERR_KIBITZ_ISOLATION' }); };
const exists = file => { try { fs.lstatSync(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } };
const readSmall = file => {
  const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0));
  try {
    if (!fs.fstatSync(fd).isFile()) fail();
    const bytes = Buffer.alloc(LIMIT + 1); let length = 0, size;
    while (length < bytes.length && (size = fs.readSync(fd, bytes, length, bytes.length - length, null))) length += size;
    if (length > LIMIT) fail(); return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, length));
  } finally { fs.closeSync(fd); }
};

/** Include linked-worktree common dirs and recursively referenced object alternates. */
export function sourceControlRoots(start) {
  const roots = new Set(), pending = [], processed = new Set();
  const add = file => {
    const target = fs.realpathSync(file); roots.add(target);
    if (fs.statSync(target).isDirectory()) pending.push(target);
  };
  for (let at = fs.realpathSync(start); ; at = path.dirname(at)) {
    for (const name of SCM) {
      const file = path.join(at, name); if (!exists(file)) continue;
      add(file);
      if (name === '.git' && fs.statSync(file).isFile()) {
        const value = /^gitdir: ([^\r\n]+)\r?\n?$/.exec(readSmall(file)); if (!value) fail();
        add(path.resolve(at, value[1]));
      }
    }
    if (at === path.dirname(at)) break;
  }
  while (pending.length) {
    const root = pending.pop(); if (processed.has(root)) continue;
    if (processed.size >= 128) fail(); processed.add(root);
    const common = path.join(root, 'commondir'); if (exists(common)) add(path.resolve(root, readSmall(common).trim()));
    for (const alternates of [path.join(root, 'objects/info/alternates'), path.join(root, 'info/alternates')]) {
      if (exists(alternates)) for (const line of readSmall(alternates).split(/\r?\n/).filter(Boolean)) add(path.resolve(path.dirname(path.dirname(alternates)), line));
    }
  }
  return [...roots].sort();
}

/** Check source-control names while copying a runtime. Never follow symlinks. */
export function isSourceControlName(name) { return SCM.has(name); }

/** Candidate paths can be checked even when the OS refuses directory discovery. */
export function ancestorMetadata(start) {
  const result = [];
  for (let at = path.resolve(start); ; at = path.dirname(at)) {
    for (const name of SCM) result.push(path.join(at, name));
    if (at === path.dirname(at)) return result;
  }
}

/** A descriptor proves that the canary exists, while pathname access must fail. */
export function acceptNativeProof(fd = 3) {
  let close = false;
  try {
    const stat = fs.fstatSync(fd);
    // Without an inherited proof, fd 3 may belong to Node's event loop. Do not
    // close an unrelated descriptor while refusing an untrusted child marker.
    close = stat.isFile();
    if (!stat.isFile() || stat.size < 1 || stat.size > LIMIT || stat.nlink !== 1 || (stat.mode & 0o077)) fail();
    const bytes = Buffer.alloc(stat.size); let length = 0, size;
    while (length < bytes.length && (size = fs.readSync(fd, bytes, length, bytes.length - length, length))) length += size;
    if (length !== bytes.length) fail();
    const proof = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (proof.version !== 1 || typeof proof.file !== 'string' || !path.isAbsolute(proof.file) || !/^[a-f0-9]{64}$/.test(proof.nonce)
      || !Array.isArray(proof.metadata) || proof.metadata.length > 128) fail();
    assertMetadataUnavailable([proof.file, ...proof.metadata]);
  } catch { fail(); } finally { if (close) try { fs.closeSync(fd); } catch {} }
}

/** This marker is produced only in the source-free image build, never in a checkout. */
export function imageDeployment(site) {
  const marker = path.join(site, '.kibitz-image.json');
  if (!exists(marker)) return false;
  try {
    const value = JSON.parse(readSmall(marker));
    if (value.version !== 1 || value.kind !== 'source-free-image') fail();
    assertMetadataUnavailable(ancestorMetadata(site)); return true;
  } catch { fail(); }
}

/** Called during the isolated image build, before copying its explicit runtime set. */
export function writeImageDeployment(site) {
  assertMetadataUnavailable(ancestorMetadata(site));
  fs.writeFileSync(path.join(site, '.kibitz-image.json'), JSON.stringify({ version: 1, kind: 'source-free-image' }) + '\n', { flag: 'wx', mode: 0o444 });
}

/**
 * The immutable package/launcher manifest describes original application metadata.
 * OS restrictions, not this check, must deny it. This fails before storage/listening.
 */
export function assertMetadataUnavailable(metadata) {
  if (!Array.isArray(metadata) || metadata.length > 256 || metadata.some(file => typeof file !== 'string' || !path.isAbsolute(file))) fail();
  for (const root of metadata) {
    for (const file of [root, path.join(root, 'HEAD'), path.join(root, 'config'), path.join(root, 'packed-refs'), path.join(root, 'objects'), path.join(root, 'refs')]) {
      let fd;
      try {
        const entry = fs.statSync(file);
        if (entry.isDirectory()) { fs.readdirSync(file); fail(); }
        if (entry.isFile()) {
          fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NONBLOCK || 0)); fail();
        }
      } catch (error) {
        if (!['ENOENT', 'ENOTDIR', 'EACCES', 'EPERM'].includes(error.code)) throw error;
      } finally { if (fd !== undefined) fs.closeSync(fd); }
    }
  }
}
