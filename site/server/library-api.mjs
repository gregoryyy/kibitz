// Same-origin, cookie-scoped persistence. No provider calls or automatic browser-library upload.
import crypto from 'node:crypto';
import { authorizeFunction, permissionFor } from './permissions.mjs';
import { checkSession, sessionAction } from './session-guard.mjs';
import { developmentIdentity } from './session-identity.mjs';
import net from 'node:net';
import { Chess } from 'chess.js';
import { compileLibraryGame } from '../src/library/library.js';
import { LIBRARY_LIMITS } from './library-store.mjs';

const HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Cookie' };
const ERRORS = {
  permission_unavailable: [503, 'Local operator permissions cannot be verified. Check private server configuration.'],
  permission_denied: [403, 'This function is disabled for the local operator.'],
  session_expired: [401, 'Sign in to the local server to continue.'],
  forbidden: [403, 'Cross-origin library access is not allowed.'],
  bad_request: [400, 'Invalid library request.'],
  invalid_record: [400, 'A library record is invalid or unsupported.'],
  invalid_changes: [400, 'Invalid library changes.'],
  record_too_large: [413, 'A library record is too large.'],
  too_large: [413, 'The library request is too large.'],
  quota: [413, 'The server library is full.'],
  conflict: [409, 'The library changed. Refresh before retrying.'],
  session_changed: [409, 'The library session changed. Reconnect before retrying.'],
  no_session: [401, 'Connect to the server library before saving.'],
  unavailable: [503, 'Server library storage is unavailable.'],
  not_found: [404, 'Not found.'],
  method: [405, 'Method not allowed.'],
  content_type: [415, 'Content-Type must be application/json.'],
  rate_limited: [429, 'Too many library writes. Try again in a minute.'],
};
/** @returns {never} */
const fail = code => { throw Object.assign(new Error(code), { code }); };
const json = (res, status, body) => {
  const send = () => { res.writeHead(status, HEADERS); res.end(JSON.stringify(body)); return true; };
  return status < 400 ? sessionAction(res, send) : send();
};
const scopeOf = token => crypto.createHash('sha256').update('kibitz-library-v1\0' + token).digest('hex');
function checkOrigin(req, hostname) {
  let host;
  try { host = new URL(`http://${req.headers.host}`).hostname.replace(/^\[|\]$/g, ''); } catch { fail('forbidden'); }
  if ((hostname ? host !== hostname : host !== 'localhost' && !net.isIP(host)) || req.headers['sec-fetch-site'] === 'cross-site') fail('forbidden');
  if (req.headers.origin) {
    const scheme = req.socket.encrypted ? 'https:' : 'http:';
    let origin;
    try { origin = new URL(req.headers.origin).origin; } catch { fail('forbidden'); }
    if (origin !== new URL(`${scheme}//${req.headers.host}`).origin) fail('forbidden');
  }
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let bytes = 0; const chunks = [];
    req.on('data', chunk => { bytes += chunk.length; if (bytes <= LIBRARY_LIMITS.batchBytes) chunks.push(chunk); });
    req.on('end', () => {
      if (bytes > LIBRARY_LIMITS.batchBytes) return reject(Object.assign(new Error('too_large'), { code: 'too_large' }));
      try { resolve(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)))); }
      catch { reject(Object.assign(new Error('bad_request'), { code: 'bad_request' })); }
    });
    req.on('error', reject);
    req.on('aborted', () => reject(Object.assign(new Error('bad_request'), { code: 'bad_request' })));
  });
}

/** Validate untrusted writes separately from the store's opaque legacy-data reads. */
export async function validateLibraryChanges(changes) {
  if (!Array.isArray(changes) || changes.length > LIBRARY_LIMITS.changes) fail('invalid_changes');
  for (const change of changes) {
    if (!change || !['games', 'books'].includes(change.collection) || typeof change.id !== 'string') fail('invalid_record');
    const record = change.record;
    if (record === null) continue;
    if (!record || typeof record !== 'object' || Array.isArray(record) || record.id !== change.id) fail('invalid_record');
    if (Buffer.byteLength(JSON.stringify(record)) > LIBRARY_LIMITS.recordBytes) fail('record_too_large');
    if (change.collection === 'games') {
      try { await compileLibraryGame(Chess, record, 'library'); } catch { fail('invalid_record'); }
    } else if (typeof record.title !== 'string' || !record.title.trim() || record.title.length > 240
      || record.author !== undefined && (typeof record.author !== 'string' || record.author.length > 160)
      || record.note !== undefined && (typeof record.note !== 'string' || record.note.length > 50_000)
      || !Array.isArray(record.tags) || record.tags.length > 64 || record.tags.some(tag => typeof tag !== 'string' || tag.length > 80)) fail('invalid_record');
  }
}

/**
 * Mount before the AI gateway, which otherwise handles all /api/ paths.
 * TLS requires an issued backend session; explicit HTTP development may create a synthetic group.
 * @param {{store?: ReturnType<typeof import('./library-store.mjs').createLibraryStore>|null, validate?: typeof validateLibraryChanges, allowInsecureHttp?: boolean, hostname?: string|null, identity?: typeof developmentIdentity, authorize?: typeof authorizeFunction}} [options]
 */
export function createLibraryApi({ store = null, validate = validateLibraryChanges, allowInsecureHttp = false, hostname = null, identity = developmentIdentity, authorize = authorizeFunction } = {}) {
  let windowAt = Date.now(), writes = 0;
  return async (req, res) => {
    const { pathname } = new URL(req.url, 'http://x');
    if (pathname !== '/api/library' && !pathname.startsWith('/api/library/')) return false;
    try {
      checkOrigin(req, hostname);
      let token = identity(req, res, 'library', { allowInsecureHttp });
      authorize(req, permissionFor(req), { allowInsecureHttp });
      if (pathname === '/api/library/status') {
        if (req.method !== 'GET') fail('method');
        return json(res, 200, { available: !!store, scope: store && token ? scopeOf(token) : null });
      }
      if (!['/api/library/records', '/api/library/erase'].includes(pathname)) fail('not_found');
      if (!['GET', 'POST'].includes(req.method)) fail('method');
      const erasing = pathname === '/api/library/erase';
      if (erasing && req.method !== 'POST') fail('method');
      if (!store) fail('unavailable');
      if (req.method === 'GET') {
        if (!token) token = identity(req, res, 'library', { allowInsecureHttp, create: true });
        return json(res, 200, store.read(scopeOf(token)));
      }
      if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) fail('content_type');
      if (!token) fail('no_session');
      if (Date.now() - windowAt >= 60_000) { windowAt = Date.now(); writes = 0; }
      if (++writes > 120) fail('rate_limited');
      const body = await readJson(req), scope = scopeOf(token); checkSession(req);
      if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !(erasing ? ['scope', 'revision', 'confirm'] : ['scope', 'revision', 'changes']).includes(k))
        || !Number.isSafeInteger(body.revision) || body.revision < 0) fail('bad_request');
      if (body.scope !== scope) fail('session_changed'); // A precondition; only the cookie selects the owner.
      if (erasing) {
        if (body.confirm !== true) fail('bad_request');
        const result = sessionAction(req, () => store.erase(scope, body.revision));
        return json(res, 200, result);
      }
      await validate(body.changes);
      if (res.destroyed) return true;
      checkSession(req);
      const result = sessionAction(req, () => store.change(scope, body.revision, body.changes));
      return json(res, 200, result);
    } catch (error) {
      const code = typeof error?.code === 'string' && Object.hasOwn(ERRORS, error.code) ? error.code : 'unavailable';
      const [status, message] = ERRORS[code];
      if (!res.destroyed) json(res, status, { error: { code, message } });
      return true;
    }
  };
}
