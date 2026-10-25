// Bounded descriptor reads for private operator-owned configuration, outside public trees.
import fs from 'node:fs';
import path from 'node:path';
export function readPrivateJson(filename, servedRoots) {
  let fd;
  try {
    if (typeof filename !== 'string' || !filename.trim()) throw Error();
    const target = path.join(fs.realpathSync(path.dirname(path.resolve(filename))), path.basename(filename));
    if (servedRoots.some(root => target === root || target.startsWith(root + path.sep))) throw Error();
    fd = fs.openSync(target, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0));
    const stat = fs.fstatSync(fd), leaf = fs.lstatSync(target);
    if (!stat.isFile() || stat.nlink !== 1 || stat.size < 1 || stat.size > 4096 || leaf.isSymbolicLink()
      || stat.dev !== leaf.dev || stat.ino !== leaf.ino || process.platform !== 'win32' && stat.mode & 0o077) throw Error();
    const bytes = Buffer.alloc(4097); let size = 0, count;
    while (size < bytes.length && (count = fs.readSync(fd, bytes, size, bytes.length - size, null))) size += count;
    if (size > 4096) throw Error();
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, size)));
  } catch { throw Error('Invalid private JSON configuration.'); }
  finally { if (fd !== undefined) fs.closeSync(fd); }
}
