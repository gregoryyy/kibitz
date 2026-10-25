// Explicit, credential-free TLS handshakes only: no HTTP, inference, downloads or redirects.
import tls from 'node:tls';
import net from 'node:net';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const INPUT_ERROR = 'Supply 1–32 unique named HTTP(S) origins without credentials, paths, queries or fragments.';
/** @type {{name:string, minVersion:import('node:tls').SecureVersion, maxVersion:import('node:tls').SecureVersion}[]} */
const PROBES = [
  { name: 'runtime-default', minVersion: tls.DEFAULT_MIN_VERSION, maxVersion: tls.DEFAULT_MAX_VERSION },
  { name: 'recommended', minVersion: 'TLSv1.2', maxVersion: 'TLSv1.3' },
  .../** @type {import('node:tls').SecureVersion[]} */ (['TLSv1.2', 'TLSv1.3', 'TLSv1', 'TLSv1.1']).map(version => ({ name: version, minVersion: version, maxVersion: version })),
];
const ERRORS = new Map([
  ['ERR_SSL_TLSV1_ALERT_PROTOCOL_VERSION', 'peer_rejected_version'],
  ['ERR_SSL_NO_PROTOCOLS_AVAILABLE', 'local_policy_refused'],
  ['ERR_SSL_NO_CIPHERS_AVAILABLE', 'local_policy_refused'],
  ['ERR_SSL_UNSUPPORTED_PROTOCOL', 'attempt_failed'],
  ['ERR_TLS_CERT_ALTNAME_INVALID', 'hostname_failed'],
  ['DEPTH_ZERO_SELF_SIGNED_CERT', 'trust_failed'], ['SELF_SIGNED_CERT_IN_CHAIN', 'trust_failed'],
  ['UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'trust_failed'], ['UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'trust_failed'],
  ['CERT_HAS_EXPIRED', 'expired'], ['CERT_NOT_YET_VALID', 'not_yet_valid'],
  ['ECONNREFUSED', 'connection_refused'], ['ENOTFOUND', 'dns_failed'],
]);

/** Validate every input before contacting even the first endpoint. Never echo rejected input. */
export function validateEndpoints(endpoints) {
  if (!Array.isArray(endpoints) || !endpoints.length || endpoints.length > 32) throw Error(INPUT_ERROR);
  const names = new Set();
  return endpoints.map(entry => {
    try {
      if (!entry || typeof entry.name !== 'string' || !/^[a-z][a-z0-9-]{0,47}$/.test(entry.name)
        || names.has(entry.name) || typeof entry.origin !== 'string' || entry.origin.length > 2048) throw Error();
      const url = new URL(entry.origin);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password
        || !/^https?:\/\/[^/]+\/?$/i.test(entry.origin) || url.pathname !== '/' || url.search || url.hash || /[?#@\\\s]/.test(entry.origin)) throw Error();
      names.add(entry.name);
      return { name: entry.name, origin: url.origin };
    } catch { throw Error(INPUT_ERROR); }
  });
}

/** @param {URL} url @param {{name:string, minVersion:import('node:tls').SecureVersion, maxVersion:import('node:tls').SecureVersion}} probe @param {{ca?: Buffer, timeoutMs: number}} options */
function handshake(url, probe, { ca, timeoutMs }) {
  return new Promise(resolve => {
    let socket, timer, complete = false;
    const finish = result => {
      if (complete) return;
      complete = true; clearTimeout(timer); socket?.destroy(); resolve({ probe: probe.name, ...result });
    };
    // Total timer includes DNS and TLS, rather than only inactivity after connection.
    timer = setTimeout(() => finish({ outcome: 'timeout' }), timeoutMs);
    try {
      const host = url.hostname.replace(/^\[|\]$/g, '');
      socket = tls.connect({ host, port: Number(url.port || 443), servername: net.isIP(host) ? undefined : host,
        minVersion: probe.minVersion, maxVersion: probe.maxVersion, rejectUnauthorized: true,
        ...(ca ? { ca } : {}) }, () => {
        if (!socket.authorized) return finish({ outcome: 'trust_failed' });
        const cert = socket.getPeerCertificate();
        finish({ outcome: 'negotiated', protocol: socket.getProtocol(), cipher: socket.getCipher().standardName,
          peerSha256: cert.fingerprint256, validFrom: cert.valid_from, validTo: cert.valid_to });
      });
      socket.once('error', error => finish({ outcome: ERRORS.get(error.code) || 'attempt_failed' }));
      socket.once('close', () => finish({ outcome: 'connection_closed' }));
    } catch { finish({ outcome: 'local_configuration_failed' }); }
  });
}

/**
 * Observations are point-in-time direct Node handshakes, never an application/browser pass.
 * Plaintext origins are recorded but not contacted. Custom CAs never imply public trust.
 * @param {{name:string, origin:string}[]} endpoints
 * @param {{ca?: Buffer, timeoutMs?: number}} [options]
 */
export async function inventoryTls(endpoints, { ca, timeoutMs = 5000 } = {}) {
  const selected = validateEndpoints(endpoints);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000
    || (ca !== undefined && (!Buffer.isBuffer(ca) || !ca.length || ca.length > 1024 * 1024))) throw Error('Invalid TLS probe options.');
  const report = { version: 1, observedAt: new Date().toISOString(), client: { node: process.version, openssl: process.versions.openssl,
    minVersion: tls.DEFAULT_MIN_VERSION, maxVersion: tls.DEFAULT_MAX_VERSION,
    trust: ca ? 'explicit-ca' : 'node-default', caSha256: ca ? createHash('sha256').update(ca).digest('hex') : null,
    extraCaConfigured: !!process.env.NODE_EXTRA_CA_CERTS, nodeOptionsConfigured: !!process.env.NODE_OPTIONS,
    certificateValidation: 'required', defaultCaCount: tls.getCACertificates('default').length,
    defaultCaSetSha256: createHash('sha256').update(tls.getCACertificates('default').slice().sort().join('\n')).digest('hex') },
  scope: 'Direct TLS handshake only; no HTTP, redirects, SDK, browser, proxy, model or deployment verification.', endpoints: [] };
  // At most six sockets at once. The explicit manifest is bounded to 32 endpoints.
  for (const entry of selected) {
    const url = new URL(entry.origin);
    report.endpoints.push({ ...entry, observations: url.protocol === 'http:' ? [{ probe: 'none', outcome: 'plaintext_not_contacted' }]
      : await Promise.all(PROBES.map(probe => handshake(url, probe, { ca, timeoutMs }))) });
  }
  return report;
}

async function main() {
  try {
    const { values } = parseArgs({ options: { endpoint: { type: 'string', multiple: true }, ca: { type: 'string' }, 'timeout-ms': { type: 'string', default: '5000' } } });
    const endpoints = (values.endpoint || []).map(value => {
      const at = value.indexOf('='); return { name: value.slice(0, at), origin: value.slice(at + 1) };
    });
    validateEndpoints(endpoints);
    // Only an explicitly selected public trust bundle is read; no key/env file discovery.
    let ca;
    if (values.ca) {
      const fd = fs.openSync(values.ca, fs.constants.O_RDONLY | (fs.constants.O_NONBLOCK || 0));
      try {
        const stat = fs.fstatSync(fd); if (!stat.isFile() || stat.size < 1 || stat.size > 1024 * 1024) throw Error();
        const buffer = Buffer.alloc(1024 * 1024 + 1); let size = 0, count;
        while (size < buffer.length && (count = fs.readSync(fd, buffer, size, buffer.length - size, null))) size += count;
        if (!size || size > 1024 * 1024) throw Error(); ca = buffer.subarray(0, size);
      } finally { fs.closeSync(fd); }
    }
    console.log(JSON.stringify(await inventoryTls(endpoints, { ca, timeoutMs: Number(values['timeout-ms']) }), null, 2));
  } catch { console.error('TLS inventory failed. Check named origins, timeout and optional public CA file; no input or raw TLS errors are logged.'); process.exitCode = 1; }
}
const isMain = () => {
  try { return !!process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
};
if (isMain()) await main();
