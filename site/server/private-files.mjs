// Operator-selected SQLite paths; request data never supplies a filesystem path.
import fs from 'node:fs';
import path from 'node:path';

/**
 * Prepare a private regular file outside every served tree, including parent symlinks.
 * @param {string} filename
 * @param {string|string[]} servedRoots Existing public directories; a string supports older callers.
 */
export function privateDatabaseFile(filename, servedRoots) {
  if (filename === ':memory:') return filename;
  if (typeof filename !== 'string' || !filename.trim()) throw new Error('Specify a private database file.');
  const directories = Array.isArray(servedRoots) ? servedRoots : [servedRoots];
  if (!directories.length) throw new Error('Specify at least one served directory.');
  const roots = directories.map(root => fs.realpathSync(root)), requested = path.resolve(filename), missing = [];
  let ancestor = path.dirname(requested);
  while (!fs.existsSync(ancestor)) { missing.unshift(path.basename(ancestor)); ancestor = path.dirname(ancestor); }
  const file = path.join(fs.realpathSync(ancestor), ...missing, path.basename(requested));
  if (roots.some(root => file === root || file.startsWith(root + path.sep))) throw new Error('The database must be outside every served directory.');
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  let fd;
  try { fd = fs.openSync(file, 'wx', 0o600); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  finally { if (fd !== undefined) fs.closeSync(fd); }
  const st = fs.lstatSync(file);
  if (!st.isFile() || st.isSymbolicLink() || (st.mode & 0o077)) throw new Error('The database must be a private regular file (mode 0600).');
  return file;
}
