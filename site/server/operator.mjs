// Installation-specific local operator identity. Credentials never enter logs or provider config.
import fs from 'node:fs';
import path from 'node:path';
import { readPrivateJson } from './private-json.mjs';
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
  try { return validateOperator(readPrivateJson(filename, servedRoots)); } catch { throw invalid(); }
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
