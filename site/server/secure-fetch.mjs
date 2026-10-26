// Shared outbound boundary. Runtime and every redirect are checked before data is sent.
import tls from 'node:tls';

export class TransportError extends Error {
  constructor() { super('The connection requires the reviewed HTTPS transport policy.'); this.code = 'transport_blocked'; }
}

/** Refuse weakened process defaults; TLS 1.3 must remain available/preferred. */
export function assertTlsRuntime() {
  if (!['TLSv1.2', 'TLSv1.3'].includes(tls.DEFAULT_MIN_VERSION) || tls.DEFAULT_MAX_VERSION !== 'TLSv1.3'
    || process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') throw new TransportError();
}

/** Endpoint paths/queries are allowed here for SDKs and signed download URLs; never URL credentials. */
export function transportUrl(input, { allowInsecureLoopback = false } = {}) {
  try {
    const raw = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
    if (typeof raw !== 'string' || /[\\\s]/.test(raw)) throw Error();
    const url = new URL(raw);
    if (url.username || url.password || url.hash || !url.hostname) throw Error();
    if (url.protocol === 'https:') { assertTlsRuntime(); return url; }
    if (allowInsecureLoopback && url.protocol === 'http:' && ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname)) return url;
  } catch { /* Never echo endpoint, credentials, signed URL or runtime configuration. */ }
  throw new TransportError();
}

/**
 * Provider requests never redirect. Public GET downloads may follow up to five
 * HTTPS hops without inheriting caller headers, credentials or a request body.
 * Dynamic fetch lookup preserves isolated mock fixtures; production uses Node fetch.
 * @param {Parameters<typeof fetch>[0]} input
 * @param {Parameters<typeof fetch>[1]} [init]
 * @param {{fetcher?:typeof fetch, allowInsecureLoopback?:boolean, download?:boolean}} [options]
 * @returns {Promise<Response>}
 */
export async function secureFetch(input, init = {}, { fetcher = fetch, allowInsecureLoopback = false, download = false } = {}) {
  let url = transportUrl(input, { allowInsecureLoopback }), response;
  for (let hop = 0; ; hop++) {
    init.signal?.throwIfAborted();
    response = await fetcher(hop ? url : input, { ...init, redirect: 'manual' });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    void response.body?.cancel().catch(() => {});
    if (!download || hop >= 5 || (init.method && init.method !== 'GET') || init.body || init.headers || init.credentials === 'include') throw new TransportError();
    try {
      const next = new URL(response.headers.get('location') || '', url);
      if (!response.headers.get('location') || next.protocol !== 'https:') throw Error();
      // Even explicit development cannot downgrade a redirected download.
      url = transportUrl(next);
    } catch { throw new TransportError(); }
  }
}
