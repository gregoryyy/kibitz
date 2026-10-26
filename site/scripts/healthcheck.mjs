// Fixed loopback/static probe: no cookies, provider request, redirects or private key.
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import { X509Certificate } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readBoundedFile } from './image-inventory.mjs';

/** @returns {Promise<boolean>} */
export function probe({ secure = false, ca = undefined, port = 8765, timeout = 4000 } = {}) {
  if (typeof secure !== 'boolean' || !Number.isSafeInteger(port) || port < 1 || port > 65535
    || !Number.isSafeInteger(timeout) || timeout < 1 || timeout > 4000) return Promise.resolve(false);
  return new Promise(resolve => {
    let timer;
    const done = passed => { clearTimeout(timer); resolve(passed); };
    try {
      const request = (secure ? https : http).get({ hostname: '127.0.0.1', port,
        path: '/manifest.webmanifest', agent: false, ...(secure ? { minVersion: 'TLSv1.2', maxVersion: 'TLSv1.3', rejectUnauthorized: true } : {}), ...(secure && ca ? { ca } : {}) }, response => {
        response.resume(); response.once('end', () => done(response.statusCode === 200)); response.once('error', () => done(false));
      });
      request.once('error', () => done(false));
      timer = setTimeout(() => { request.destroy(); done(false); }, timeout);
    } catch { done(false); }
  });
}

export async function run(env = process.env, check = probe) {
  try {
    if (env.KIBITZ_HEALTH_HTTPS !== undefined && !['0', '1'].includes(env.KIBITZ_HEALTH_HTTPS)) return false;
    const secure = env.KIBITZ_HEALTH_HTTPS === '1';
    if (!secure && env.KIBITZ_HEALTH_CA) return false;
    const ca = env.KIBITZ_HEALTH_CA ? readBoundedFile(env.KIBITZ_HEALTH_CA, 1024 * 1024) : undefined;
    if (ca) new X509Certificate(ca); // Reject empty/malformed trust input before probing.
    return await check({ secure, ca });
  } catch { return false; }
}

let main = false;
try { main = !!process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch {}
if (main) {
  if (process.argv.length !== 2) process.exitCode = 1;
  else run().then(passed => { process.exitCode = passed ? 0 : 1; });
}
