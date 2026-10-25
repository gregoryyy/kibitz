// Installation-specific local operator identity. Credentials never enter logs or provider config.
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

const invalid = () => Object.assign(new Error('Configure a private operator identity and session database outside served directories.'), { code: 'ERR_KIBITZ_OPERATOR_CONFIG' });
const digest = value => createHash('sha256').update(value).digest();
export const newOperator = () => ({ version: 1, id: randomBytes(16).toString('hex'), secret: randomBytes(32).toString('base64url') });
export function validateOperator(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== 'id,secret,version' || value.version !== 1
    || typeof value.id !== 'string' || typeof value.secret !== 'string' || !/^[a-f0-9]{32}$/.test(value.id) || !/^[A-Za-z0-9_-]{43}$/.test(value.secret)) throw invalid();
  return Object.freeze({ ...value, epoch: digest(value.secret).toString('hex') });
}
export function operatorProof(operator, secret) {
  return typeof secret === 'string' && /^[A-Za-z0-9_-]{43}$/.test(secret) && timingSafeEqual(digest(secret), Buffer.from(operator.epoch, 'hex'));
}
export function readOperator(filename, servedRoots) {
  let fd;
  try {
    if (typeof filename !== 'string' || !filename.trim()) throw invalid();
    const target = path.join(fs.realpathSync(path.dirname(path.resolve(filename))), path.basename(filename));
    if (servedRoots.some(root => target === root || target.startsWith(root + path.sep))) throw invalid();
    fd = fs.openSync(target, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0));
    const stat = fs.fstatSync(fd), leaf = fs.lstatSync(target);
    if (!stat.isFile() || stat.nlink !== 1 || stat.size < 1 || stat.size > 4096 || leaf.isSymbolicLink()
      || stat.dev !== leaf.dev || stat.ino !== leaf.ino || process.platform !== 'win32' && stat.mode & 0o077) throw invalid();
    const bytes = Buffer.alloc(4097); let size = 0, count;
    while (size < bytes.length && (count = fs.readSync(fd, bytes, size, bytes.length - size, null))) size += count;
    if (size > 4096) throw invalid();
    return validateOperator(JSON.parse(bytes.subarray(0, size).toString('utf8')));
  } catch { throw invalid(); }
  finally { if (fd !== undefined) fs.closeSync(fd); }
}
export function initializeOperator(filename) {
  let fd;
  try {
    fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true, mode: 0o700 });
    fd = fs.openSync(filename, 'wx', 0o600); // Never replace an existing identity or another file.
    fs.writeFileSync(fd, JSON.stringify(newOperator(), null, 2) + '\n'); fs.fsyncSync(fd);
  } catch { throw invalid(); }
  finally { if (fd !== undefined) fs.closeSync(fd); }
}
