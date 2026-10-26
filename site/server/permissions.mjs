// Explicit operator-bound grants; neither browser consent nor a grouping cookie grants functions.
import fs from 'node:fs';
import path from 'node:path';
import { readPrivateJson } from './private-json.mjs';
import { SessionError } from './sessions.mjs';
import { SESSION_GUARD } from './session-guard.mjs';

export const PERMISSIONS = Object.freeze(['ai:read', 'ai:coach', 'ai:configure', 'ai:test', 'ai:embed', 'library:read', 'library:write', 'library:erase']);
const routes = new Map([
  ['GET /api/ai/status', 'ai:read'], ['POST /api/ai/config', 'ai:configure'], ['POST /api/ai/test', 'ai:test'],
  ['POST /api/ai/sample', 'ai:coach'], ['POST /api/ai/structured', 'ai:coach'],
  ['GET /api/ai/embeddings', 'ai:embed'], ['POST /api/ai/embeddings', 'ai:embed'],
  ['GET /api/library/status', 'library:read'], ['GET /api/library/records', 'library:read'],
  ['POST /api/library/records', 'library:write'], ['POST /api/library/erase', 'library:erase'],
]);
const invalid = () => Object.assign(new Error('Configure a private, operator-bound permission policy outside served directories.'), { code: 'ERR_KIBITZ_PERMISSIONS_CONFIG' });
export const permissionFor = req => routes.get(`${req.method} ${new URL(req.url, 'http://x').pathname}`);
export function validatePermissions(value, operator) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== 'allow,operator,version'
    || value.version !== 1 || value.operator !== operator.id || !Array.isArray(value.allow) || value.allow.length > PERMISSIONS.length
    || value.allow.some(scope => !PERMISSIONS.includes(scope)) || new Set(value.allow).size !== value.allow.length) throw invalid();
  return Object.freeze({ version: 1, operator: operator.id, allow: Object.freeze([...value.allow]) });
}
export function permissionGranted(policy, scope) {
  return PERMISSIONS.includes(scope) && policy.allow.includes(scope)
    && (!['library:write', 'library:erase'].includes(scope) || policy.allow.includes('library:read'));
}
export function readPermissions(filename, servedRoots, operator) {
  try { return validatePermissions(readPrivateJson(filename, servedRoots), operator); } catch { throw invalid(); }
}
export function initializePermissions(filename, operator, allow) {
  let fd;
  try {
    const policy = validatePermissions({ version: 1, operator: operator.id, allow }, operator);
    fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true, mode: 0o700 });
    fd = fs.openSync(filename, 'wx', 0o600); fs.writeFileSync(fd, JSON.stringify(policy, null, 2) + '\n'); fs.fsyncSync(fd);
  } catch { throw invalid(); }
  finally { if (fd !== undefined) fs.closeSync(fd); }
}
export function authorizeFunction(req, scope, { allowInsecureHttp = false } = {}) {
  if (!req.socket.encrypted && allowInsecureHttp) return; // Synthetic development is not final authorization.
  const guard = req[SESSION_GUARD]; if (!guard) throw new SessionError('permission_denied');
  guard.authorize(scope);
}
export function functionFlags(req) {
  const guard = req[SESSION_GUARD]; if (!guard) return undefined;
  const scopes = new Set(guard.permissions());
  return { coach: scopes.has('ai:coach'), configure: scopes.has('ai:configure'), test: scopes.has('ai:test'), embed: scopes.has('ai:embed') };
}
