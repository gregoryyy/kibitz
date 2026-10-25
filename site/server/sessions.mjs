// Strict backend registration: a client-supplied, well-shaped token is never a session.
import { randomBytes, createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export const SESSION_COOKIE = '__Host-kibitz_session';
export const SESSION_AGE = 12 * 60 * 60 * 1000;
const hash = value => createHash('sha256').update(value).digest('hex');
const token = size => randomBytes(size).toString('base64url');
export class SessionError extends Error {
  constructor(code = 'session_expired') {
    const messages = { permission_unavailable: [503, 'Local operator permissions cannot be verified. Check private server configuration.'], permission_denied: [403, 'This function is disabled for the local operator.'], session_expired: [401, 'Sign in to the local server to continue.'], forbidden: [403, 'Request not allowed.'],
      bad_request: [400, 'Invalid session request.'], session_conflict: [409, 'This collection belongs to a different operator. Restore the intended private identity before migrating.'],
      rate_limited: [429, 'Too many sign-in attempts. Try again in a minute.'], unavailable: [503, 'Local session storage is unavailable.'] };
    const [status, message] = messages[code] || messages.unavailable; super(message); this.code = code; this.status = status;
  }
}
export function sessionToken(req) {
  const values = (req.headers.cookie || '').split(';').map(p => p.trim()).filter(p => p === SESSION_COOKIE || p.startsWith(SESSION_COOKIE + '='));
  if (values.length !== 1) throw new SessionError();
  const value = values[0].slice(SESSION_COOKIE.length + 1);
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) throw new SessionError();
  return value;
}
export function sessionCookie(res, value, age = SESSION_AGE / 1000) {
  const previous = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', [...(previous ? Array.isArray(previous) ? previous : [previous] : []),
    `${SESSION_COOKIE}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${age}`]);
}
/** Separate version-one registry; existing usage/library schemas and identifiers remain unchanged. */
export function sessionStore(filename = ':memory:', { now = () => Date.now(), limit = 1000 } = {}) {
  const db = new DatabaseSync(filename, { timeout: 1000 });
  try {
    const version = Number(db.prepare('PRAGMA user_version').get().user_version);
    if (![0, 1].includes(version)) throw new SessionError('unavailable');
    if (!version) {
      if (db.prepare("SELECT name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").all().length) throw new SessionError('unavailable');
      db.exec(`BEGIN IMMEDIATE;
        CREATE TABLE sessions (verifier TEXT PRIMARY KEY, operator TEXT NOT NULL, epoch TEXT NOT NULL, usage TEXT NOT NULL, library TEXT NOT NULL, expires INTEGER NOT NULL);
        CREATE TABLE ownership (kind TEXT NOT NULL, scope TEXT NOT NULL, operator TEXT NOT NULL, PRIMARY KEY(kind,scope));
        PRAGMA user_version=1; COMMIT;`);
    }
    const get = db.prepare('SELECT operator,epoch,usage,library,expires FROM sessions WHERE verifier=?');
    const insert = db.prepare('INSERT INTO sessions VALUES(?,?,?,?,?,?)');
    const replaceSession = db.prepare('DELETE FROM sessions WHERE verifier=? AND operator=?');
    const revoke = db.prepare('DELETE FROM sessions WHERE verifier=? AND operator=? AND epoch=?');
    const prune = db.prepare('DELETE FROM sessions WHERE expires<=?');
    const owner = db.prepare('SELECT operator FROM ownership WHERE kind=? AND scope=?');
    const bind = db.prepare('INSERT OR IGNORE INTO ownership VALUES(?,?,?)');
    const size = db.prepare('SELECT count(*) AS n FROM sessions');
    const owners = db.prepare('SELECT count(*) AS n FROM ownership');
    db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
    return {
      close: () => db.close(),
      issue(operator, { usage = token(16), library = token(32) } = {}, previous = null) {
        if (!/^[A-Za-z0-9_-]{22}$/.test(usage) || !/^[A-Za-z0-9_-]{43}$/.test(library)) throw new SessionError('bad_request');
        db.exec('BEGIN IMMEDIATE');
        try {
          const expires = now() + SESSION_AGE, value = token(32);
          prune.run(now());
          if (previous) replaceSession.run(hash(previous), operator.id);
          if (Number(size.get().n) >= limit) throw new SessionError('unavailable');
          for (const [kind, key] of [['usage', usage], ['library', library]]) {
            const scope = hash(key), previous = owner.get(kind, scope);
            if (previous && previous.operator !== operator.id) throw new SessionError('session_conflict');
            if (!previous && Number(owners.get().n) >= limit * 2) throw new SessionError('unavailable');
            bind.run(kind, scope, operator.id);
          }
          insert.run(hash(value), operator.id, operator.epoch, usage, library, expires);
          db.exec('COMMIT'); return { value, expires };
        } catch (error) { db.exec('ROLLBACK'); throw error; }
      },
      run(operator, value, action) {
        db.exec('BEGIN IMMEDIATE');
        try { this.verify(operator, value); const result = action(); db.exec('COMMIT'); return result; }
        catch (error) { db.exec('ROLLBACK'); throw error; }
      },
      revoke(operator, value) {
        if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(value)) throw new SessionError();
        return Number(revoke.run(hash(value), operator.id, operator.epoch).changes) > 0;
      },
      recover(operator, value) {
        // Requires fresh proof; recover a still-retained row, including expired rows.
        // Protected locators preserve collections when expired rows are pruned.
        if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(value)) throw new SessionError();
        const row = get.get(hash(value));
        if (!row || row.operator !== operator.id || typeof row.usage !== 'string' || typeof row.library !== 'string') throw new SessionError();
        return { usage: row.usage, library: row.library };
      },
      verify(operator, value) {
        if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(value)) throw new SessionError();
        const row = get.get(hash(value));
        if (!row || row.operator !== operator.id || row.epoch !== operator.epoch || typeof row.expires !== 'number' || !Number.isSafeInteger(row.expires) || row.expires <= now()
          || typeof row.usage !== 'string' || !/^[A-Za-z0-9_-]{22}$/.test(row.usage) || typeof row.library !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(row.library)) throw new SessionError();
        return { usage: String(row.usage), library: String(row.library), expires: Number(row.expires) };
      },
    };
  } catch (error) { db.close(); throw error; }
}
