import net from 'node:net';
import { PERMISSIONS, validatePermissions, permissionGranted } from './permissions.mjs';
import { SESSION_GUARD } from './session-guard.mjs';
import { operatorProof } from './operator.mjs';
import { SessionError, SESSION_COOKIE, sessionCookie, sessionToken } from './sessions.mjs';
import { legacyGrouping, retainGrouping } from './cookies.mjs';

const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(body)); return true; };
function boundary(req, hostname) {
  const scheme = req.socket.encrypted ? 'https:' : 'http:';
  let url; try { url = new URL(`${scheme}//${req.headers.host}`); } catch { throw new SessionError('forbidden'); }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if ((hostname ? host !== hostname : host !== 'localhost' && !net.isIP(host)) || req.headers['sec-fetch-site'] === 'cross-site') throw new SessionError('forbidden');
  if (req.headers.origin) {
    let origin; try { origin = new URL(req.headers.origin).origin; } catch { throw new SessionError('forbidden'); }
    if (origin !== url.origin) throw new SessionError('forbidden');
  }
}
function readJson(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) return Promise.reject(new SessionError('bad_request'));
  return new Promise((resolve, reject) => {
    const chunks = []; let bytes = 0, settled = false;
    const finish = (error, value) => { if (settled) return; settled = true; clearTimeout(timer); if (error) reject(error); else resolve(value); };
    const timer = setTimeout(() => { finish(new SessionError('bad_request')); req.destroy(); }, 5000);
    req.on('data', chunk => { bytes += chunk.length; if (bytes > 4096) finish(new SessionError('bad_request')); else chunks.push(chunk); });
    req.once('end', () => { if (settled) return; try { finish(null, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)))); } catch { finish(new SessionError('bad_request')); } });
    req.once('error', () => finish(new SessionError('bad_request'))); req.once('aborted', () => finish(new SessionError('bad_request')));
  });
}
export function createSessionApi({ operator = null, store = null, hostname = null, now = () => Date.now(), pollMs = 250, permissions = () => null } = {}) {
  let attempts = 0, windowAt = now();
  const required = !!operator, active = new Set();
  const stop = value => { for (const entry of active) if (entry.value === value) entry.res.destroy(); };

  const policy = () => {
    try { return validatePermissions(permissions(), operator); } catch { throw new SessionError('permission_unavailable'); }
  };
  const allowed = scope => !!scope && permissionGranted(policy(), scope);
  const requirePermission = scope => { if (!allowed(scope)) throw new SessionError('permission_denied'); };
  const grants = () => { const current = policy(); return PERMISSIONS.filter(scope => permissionGranted(current, scope)); };
  const verify = req => {
    if (!req.socket.encrypted || !operator || !store) throw new SessionError();
    try { return store.verify(operator, sessionToken(req)); }
    catch (error) { throw error instanceof SessionError ? error : new SessionError('unavailable'); }
  };
  return {
    close() { for (const entry of active) entry.res.destroy(); },
    identity(req, res, kind) {
      const session = verify(req);
      if (!req[SESSION_GUARD]) {
        const value = sessionToken(req), entry = { value, res }; let permission = null;
        const check = () => { if (res.destroyed) throw new SessionError(); const session = verify(req); if (permission !== null) requirePermission(permission); return session; };
        req[SESSION_GUARD] = res[SESSION_GUARD] = { check, allowed, permissions: grants,
          authorize: scope => { permission = scope; check(); requirePermission(scope); },
          run: action => { if (res.destroyed) throw new SessionError(); return store.run(operator, value, () => { requirePermission(permission); return action(); }); } };

        active.add(entry);
        // Durable storage checks cover revocation by another native process too.
        const inspect = () => { try { check(); } catch { res.destroy(); } };
        const poll = setInterval(inspect, pollMs); poll.unref();
        const expiry = setTimeout(inspect, Math.max(1, session.expires - now())); expiry.unref();
        const clean = () => { clearInterval(poll); clearTimeout(expiry); active.delete(entry); };
        res.once('close', clean); res.once('finish', clean);
      }
      return session[kind];
    },
    async handle(req, res) {
      const route = new URL(req.url, 'http://x').pathname;
      if (!['/api/session/status', '/api/library/session', '/api/session/logout'].includes(route)) return false;
      try {
        boundary(req, hostname);
        if (route === '/api/session/status' && req.method === 'GET') {
          let session; try { session = verify(req); } catch (error) { if (!(error instanceof SessionError) || error.code !== 'session_expired') throw error; }
          return json(res, 200, { required, authenticated: !!session, ...(session ? { expires: session.expires, permissions: grants() } : {}) });
        }
        if (route === '/api/session/logout' && req.method === 'POST') {
          if (!required || !req.socket.encrypted || !store) throw new SessionError('forbidden');
          const value = sessionToken(req), body = await readJson(req);
          if (!body || Array.isArray(body) || Object.keys(body).length) throw new SessionError('bad_request');
          // Expired registered tokens can be removed too; unknown/other-owner tokens cannot.
          if (!store.revoke(operator, value)) throw new SessionError();
          stop(value); sessionCookie(res, '', 0);
          return json(res, 200, { required: true, authenticated: false });
        }
        if (route !== '/api/library/session' || req.method !== 'POST') throw new SessionError('bad_request');
        if (!required || !req.socket.encrypted || !store) throw new SessionError('forbidden');
        if (now() - windowAt >= 60_000) { windowAt = now(); attempts = 0; }
        if (++attempts > 10) throw new SessionError('rate_limited');
        const body = await readJson(req);
        if (!body || Object.keys(body).some(key => !['secret', 'migrate'].includes(key)) || typeof body.migrate !== 'boolean') throw new SessionError('bad_request');
        if (!operatorProof(operator, body.secret)) throw new SessionError();
        const currentGrants = grants();
        // Library-path endpoint receives both original canonical grouping cookies.
        const present = (req.headers.cookie || '').split(';').some(part => part.trim() === SESSION_COOKIE || part.trim().startsWith(SESSION_COOKIE + '='));
        const previous = present ? sessionToken(req) : null;
        let legacy = {};
        if (body.migrate) {
          legacy = legacyGrouping(req);
          if (previous && Object.keys(legacy).length < 2) legacy = { ...store.recover(operator, previous), ...legacy };
        }
        const issued = store.issue(operator, legacy, previous);
        if (previous) stop(previous);
        retainGrouping(res, store.verify(operator, issued.value));
        sessionCookie(res, issued.value);
        return json(res, 200, { required: true, authenticated: true, expires: issued.expires, permissions: currentGrants });
      } catch (error) {
        const fault = error instanceof SessionError ? error : new SessionError(error?.code === 'bad_request' ? 'bad_request' : 'unavailable');
        return json(res, fault.status, { error: { code: fault.code, message: fault.message } });
      }
    },
  };
}
