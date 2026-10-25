import net from 'node:net';
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
export function createSessionApi({ operator = null, store = null, hostname = null, now = () => Date.now() } = {}) {
  let attempts = 0, windowAt = now();
  const required = !!operator;
  const verify = req => {
    if (!req.socket.encrypted || !operator || !store) throw new SessionError();
    try { return store.verify(operator, sessionToken(req)); }
    catch (error) { throw error instanceof SessionError ? error : new SessionError('unavailable'); }
  };
  return {
    identity(req, _res, kind) { return verify(req)[kind]; },
    async handle(req, res) {
      const route = new URL(req.url, 'http://x').pathname;
      if (!['/api/session/status', '/api/library/session'].includes(route)) return false;
      try {
        boundary(req, hostname);
        if (route === '/api/session/status' && req.method === 'GET') {
          let session; try { session = verify(req); } catch (error) { if (!(error instanceof SessionError) || error.code !== 'session_expired') throw error; }
          return json(res, 200, { required, authenticated: !!session, ...(session ? { expires: session.expires } : {}) });
        }
        if (route !== '/api/library/session' || req.method !== 'POST') throw new SessionError('bad_request');
        if (!required || !req.socket.encrypted || !store) throw new SessionError('forbidden');
        if (now() - windowAt >= 60_000) { windowAt = now(); attempts = 0; }
        if (++attempts > 10) throw new SessionError('rate_limited');
        const body = await readJson(req);
        if (!body || Object.keys(body).some(key => !['secret', 'migrate'].includes(key)) || typeof body.migrate !== 'boolean') throw new SessionError('bad_request');
        if (!operatorProof(operator, body.secret)) throw new SessionError();
        // Library-path endpoint receives both original canonical grouping cookies.
        let legacy = {};
        if (body.migrate) {
          const present = (req.headers.cookie || '').split(';').some(part => part.trim() === SESSION_COOKIE || part.trim().startsWith(SESSION_COOKIE + '='));
          legacy = { ...(present ? store.recover(operator, sessionToken(req)) : {}), ...legacyGrouping(req) };
        }
        const issued = store.issue(operator, legacy);
        retainGrouping(res, store.verify(operator, issued.value));
        sessionCookie(res, issued.value);
        return json(res, 200, { required: true, authenticated: true, expires: issued.expires });
      } catch (error) {
        const fault = error instanceof SessionError ? error : new SessionError(error?.code === 'bad_request' ? 'bad_request' : 'unavailable');
        return json(res, fault.status, { error: { code: fault.code, message: fault.message } });
      }
    },
  };
}
