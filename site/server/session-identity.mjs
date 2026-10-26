import { identityCookie } from './cookies.mjs';
import { SessionError } from './sessions.mjs';
// Direct API construction fails closed on TLS without an injected backend authority.
// Explicit plaintext development retains its separate synthetic grouping namespace.
export function developmentIdentity(req, res, kind, options) {
  if (req.socket.encrypted) throw new SessionError();
  return identityCookie(req, res, kind, options);
}
