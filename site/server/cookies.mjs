// Opaque local grouping identifiers, not authentication (TODO 11.4.2.3).
import { randomBytes } from 'node:crypto';

const KINDS = {
  usage: { legacy: 'kibitz_uid', path: '/api/', bytes: 16, pattern: /^[A-Za-z0-9_-]{22}$/ },
  library: { legacy: 'kibitz_library', path: '/api/library/', bytes: 32, pattern: /^[A-Za-z0-9_-]{43}$/ },
};
export class CookieError extends Error {
  constructor(code) { super(code === 'forbidden' ? 'HTTPS is required for this API.' : 'Invalid or ambiguous identity cookie.'); this.code = code; }
}

function values(header, name) {
  return (header || '').split(';').map(part => part.trim()).filter(part => part === name || part.startsWith(name + '='))
    .map(part => part.startsWith(name + '=') ? part.slice(name.length + 1) : '');
}
function append(res, value) {
  const previous = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', [...(previous ? Array.isArray(previous) ? previous : [previous] : []), value]);
}

/**
 * Native TLS alone selects the protected namespace. Never trust forwarding headers.
 * Migration preserves the exact token and therefore all existing store keys. Ambiguous
 * secure identities fail without replacing cookies, so recovery never silently loses an owner.
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {'usage'|'library'} kind
 * @param {{allowInsecureHttp?: boolean, create?: boolean}} [options]
 * @returns {string|null}
 */
export function identityCookie(req, res, kind, { allowInsecureHttp = false, create = false } = {}) {
  const secure = !!/** @type {import('node:tls').TLSSocket} */ (req.socket).encrypted;
  if (!secure && !allowInsecureHttp) throw new CookieError('forbidden');
  const policy = KINDS[kind], name = secure ? '__Secure-' + policy.legacy : policy.legacy.replace('kibitz_', 'kibitz_dev_');
  const current = values(req.headers.cookie, name);
  let token = current.length === 1 && policy.pattern.test(current[0]) ? current[0] : null;
  if (secure && current.length && !token) throw new CookieError('bad_request');
  const legacy = secure ? values(req.headers.cookie, policy.legacy) : [];
  let issue = false;
  if (secure && !token && legacy.length) {
    if (legacy.length !== 1 || !policy.pattern.test(legacy[0])) throw new CookieError('bad_request');
    token = legacy[0]; issue = true;
  }
  if (!token && create) { token = randomBytes(policy.bytes).toString('base64url'); issue = true; }
  const attributes = `; Path=${policy.path}; HttpOnly; SameSite=Strict`;
  if (issue) append(res, `${name}=${token}${attributes}; Max-Age=31536000${secure ? '; Secure' : ''}`);
  if (secure && legacy.length) append(res, `${policy.legacy}=${attributes}; Secure; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
  return token;
}
