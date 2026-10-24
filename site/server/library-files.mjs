// Server-selected private storage paths; request data never supplies a filesystem path.
import fs from 'node:fs';
import path from 'node:path';
import { createLibraryStore } from './library-store.mjs';

/** Create a private DB outside the served tree, including through parent symlinks. */
export function openPrivateLibrary(filename, staticRoot) {
  if (filename === ':memory:') return createLibraryStore();
  if (typeof filename !== 'string' || !filename.trim()) throw new Error('Specify a server library database file.');
  const root = fs.realpathSync(staticRoot), requested = path.resolve(filename), missing = [];
  let ancestor = path.dirname(requested);
  while (!fs.existsSync(ancestor)) { missing.unshift(path.basename(ancestor)); ancestor = path.dirname(ancestor); }
  const file = path.join(fs.realpathSync(ancestor), ...missing, path.basename(requested));
  if (file === root || file.startsWith(root + path.sep)) throw new Error('The library database must be outside the served directory.');
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  let fd;
  try { fd = fs.openSync(file, 'wx', 0o600); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  finally { if (fd !== undefined) fs.closeSync(fd); }
  const st = fs.lstatSync(file);
  if (!st.isFile() || st.isSymbolicLink() || (st.mode & 0o077)) throw new Error('The library database must be a private regular file (mode 0600).');
  return createLibraryStore(file);
}
