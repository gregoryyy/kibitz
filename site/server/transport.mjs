// Final local deployment uses an isolated host: HSTS applies across all its ports.
// Never set a localhost-wide policy or infer a host/scheme from forwarding headers.
import net from 'node:net';

export const APP_HOST = 'kibitz.test';
export const HSTS = 'max-age=31536000';
const invalid = () => Object.assign(new Error('Invalid application transport configuration.'), { code: 'ERR_KIBITZ_APP_HOST' });

/** Only dedicated names in the reserved .test namespace are supported. */
export function applicationHost(value = APP_HOST) {
  if (typeof value !== 'string' || value.length > 253 || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+test$/.test(value)) throw invalid();
  return value;
}

/**
 * Gate before any API/static routing. A verified local static health resource is
 * the only IP/localhost alias in final mode; aliases never create an identity.
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {{hostname: string}} options
 * @returns {boolean} Whether this request may reach the normal handler.
 */
export function enforceTransport(req, res, { hostname }) {
  if (!/** @type {import('node:tls').TLSSocket} */ (req.socket).encrypted) return false;
  let parsed;
  try {
    const authority = req.headers.host;
    if (typeof authority !== 'string' || !/^(?:[a-z0-9.-]+|\[[a-f0-9:]+\])(?::[0-9]{1,5})?$/i.test(authority)) return false;
    parsed = new URL('https://' + authority);
  } catch { return false; }
  const host = parsed.hostname.replace(/^\[|\]$/g, '');
  if (host === hostname) res.setHeader('Strict-Transport-Security', HSTS);
  // Docker may publish the TLS listener on a different host port. HSTS is
  // host-wide; route Origin checks compare the browser's complete authority.
  if (parsed.port === '0') return false;
  if (host === hostname) return true;
  // No index, API, model, redirect or cookie through the probe alias.
  return (host === 'localhost' || !!net.isIP(host))
    && ['GET', 'HEAD'].includes(req.method) && req.url === '/manifest.webmanifest';
}
