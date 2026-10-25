// Operator-selected server identity only; never fetch, generate or log certificates/keys.
import fs from 'node:fs';
import path from 'node:path';
import { createSecureContext } from 'node:tls';

const LIMIT = 1024 * 1024;
const HINT = 'Configure both TLS PEM files outside served directories; the private key must have owner-only permissions.';

function readIdentityFile(filename, roots, privateKey) {
  // Resolve parent aliases, but open the leaf without following a symlink.
  const absolute = path.resolve(filename);
  const file = path.join(fs.realpathSync(path.dirname(absolute)), path.basename(absolute));
  if (roots.some(root => file === root || file.startsWith(root + path.sep))) throw Error();
  const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0));
  try {
    const entry = fs.fstatSync(fd);
    const leaf = fs.lstatSync(file);
    if (!entry.isFile() || entry.size < 1 || entry.size > LIMIT || entry.nlink !== 1
      || leaf.isSymbolicLink() || leaf.dev !== entry.dev || leaf.ino !== entry.ino
      || (privateKey && process.platform !== 'win32' && (entry.mode & 0o077))) throw Error();
    const buffer = Buffer.alloc(LIMIT + 1);
    let size = 0, count;
    while (size < buffer.length && (count = fs.readSync(fd, buffer, size, buffer.length - size, null))) size += count;
    if (!size || size > LIMIT) throw Error();
    return buffer.subarray(0, size);
  } finally { fs.closeSync(fd); }
}

/**
 * Validate identities before opening storage/listeners; invalid TLS never selects HTTP.
 * Parent directories remain operator-owned, as for the public/private storage roots.
 * @param {{key?: string, cert?: string, servedRoots: string[]}} options
 * @returns {import('node:https').ServerOptions|null}
 */
export function loadTlsOptions({ key, cert, servedRoots }) {
  if (key === undefined && cert === undefined) return null;
  try {
    if (typeof key !== 'string' || !key.trim() || typeof cert !== 'string' || !cert.trim()
      || !Array.isArray(servedRoots) || !servedRoots.length) throw Error();
    const roots = servedRoots.map(root => fs.realpathSync(root));
    const options = { key: readIdentityFile(key, roots, true), cert: readIdentityFile(cert, roots, false),
      minVersion: /** @type {const} */ ('TLSv1.2') };
    // Parse the pair here, before any private database can be created. OpenSSL also
    // checks that the leaf certificate matches the supplied unencrypted private key.
    createSecureContext(options);
    return options;
  } catch { throw Object.assign(new Error(HINT), { code: 'ERR_KIBITZ_TLS_CONFIG' }); }
}
