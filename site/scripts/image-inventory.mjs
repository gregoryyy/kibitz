// Read-only Debian inventory for both dpkg and shell-less distroless runtimes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Check and read the opened object; bound actual bytes if it grows after fstat.
export function readBoundedFile(file, maxBytes, io = fs) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 64 * 1024 * 1024) throw Error('Invalid evidence capacity');
  const fd = io.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0) | (fs.constants.O_NONBLOCK ?? 0));
  try {
    const entry = io.fstatSync(fd);
    if (!entry.isFile() || entry.size > maxBytes) throw Error('Invalid evidence file');
    const chunks = [], block = Buffer.allocUnsafe(64 * 1024); let total = 0;
    while (true) {
      const count = io.readSync(fd, block, 0, Math.min(block.length, maxBytes + 1 - total), null);
      if (!count) break;
      total += count; if (total > maxBytes) throw Error('Evidence capacity exceeded');
      chunks.push(Buffer.from(block.subarray(0, count)));
    }
    return Buffer.concat(chunks, total);
  } finally { io.closeSync(fd); }
}

export function parseDpkgStatus(text) {
  if (typeof text !== 'string' || text.length > 16 * 1024 * 1024) throw Error('Invalid Debian inventory');
  const packages = [];
  for (const stanza of text.split(/\r?\n\s*\r?\n/)) {
    const fields = new Map();
    for (const line of stanza.split(/\r?\n/)) {
      if (/^\s/.test(line)) continue; // Continuation/description text is not a field.
      const match = /^([A-Za-z-]+): (.*)$/.exec(line); if (!match) continue;
      if (fields.has(match[1])) throw Error('Duplicate Debian inventory field');
      fields.set(match[1], match[2]);
    }
    if (!fields.has('Package') && !fields.has('Version')) continue; // e.g. a md5sums file.
    if (fields.has('Status') && fields.get('Status') !== 'install ok installed') continue;
    const name = fields.get('Package'), version = fields.get('Version');
    if (!/^[a-z0-9][a-z0-9+.-]{0,199}$/.test(name || '') || !/^[A-Za-z0-9.+:~_-]{1,200}$/.test(version || '')) throw Error('Invalid Debian package identity');
    packages.push({ name, version });
  }
  return packages;
}

export function readDpkgInventory(root = '/var/lib/dpkg') {
  const records = [], status = path.join(root, 'status'), directory = path.join(root, 'status.d');
  const read = file => {
    records.push(...parseDpkgStatus(readBoundedFile(file, 16 * 1024 * 1024).toString('utf8')));
  };
  try { read(status); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  let names = [];
  try { names = fs.readdirSync(directory); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (names.length > 10_000) throw Error('Debian inventory capacity exceeded');
  for (const name of names) read(path.join(directory, name));
  const packages = new Map();
  for (const { name, version } of records) {
    if (packages.has(name) && packages.get(name) !== version) throw Error('Conflicting Debian package versions');
    packages.set(name, version);
  }
  if (!packages.size) throw Error('Missing Debian package inventory');
  return [...packages].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([name, version]) => `${name}\t${version}`).join('\n') + '\n';
}

let main = false;
try { main = !!process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch { /* Inert when imported. */ }
if (main) {
  try { if (process.argv.length !== 2) throw Error(); process.stdout.write(readDpkgInventory()); }
  catch { console.error('Debian package inventory unavailable.'); process.exitCode = 1; }
}
