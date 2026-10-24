// A versioned public app bundle only. API, model weights and other origins stay on the network.
export const OFFLINE_CACHE_PREFIX = 'kibitz-app-v1:';
export const offlineCachePrefix = scope => OFFLINE_CACHE_PREFIX + encodeURIComponent(new URL(scope).pathname) + ':';

export function offlineAsset(request, scope, assets) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  const url = new URL(request.url), base = new URL(scope);
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return null;
  const relative = url.pathname.slice(base.pathname.length);
  if (request.mode === 'navigate' && ['', 'index.html', '_test.html', 'offline.html'].includes(relative)) return 'offline.html';
  return !url.search && assets.some(asset => asset.path === relative) ? relative : null;
}

/** Install atomically with respect to activation; discard incomplete new bundles. */
export async function installOfflineBundle({ caches, fetcher, digest, scope, assets, name }) {
  const cache = await caches.open(name);
  try {
    // Serial writes bound memory while checking the larger WASM files.
    for (const asset of assets) {
      const url = new URL(asset.path, scope).href;
      const response = await fetcher(url, { cache: 'no-store', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(30_000) });
      if (!response.ok || response.type === 'opaque') throw Error('Offline asset unavailable');
      const bytes = await response.clone().arrayBuffer();
      if (bytes.byteLength !== asset.bytes || await digest(bytes) !== asset.sha256) throw Error('Offline asset changed');
      await cache.put(url, response);
    }
  } catch (error) { await caches.delete(name); throw error; }
}

export function registerOfflineWorker(worker, assets, revision) {
  const scope = worker.registration.scope, prefix = offlineCachePrefix(scope), name = prefix + revision;
  worker.addEventListener('install', event => event.waitUntil(installOfflineBundle({
    caches: worker.caches, fetcher: worker.fetch.bind(worker), scope, assets, name,
    digest: async bytes => [...new Uint8Array(await worker.crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join(''),
  })));
  // Waiting updates activate only after the old app's tabs close. Never replace an in-progress game.
  worker.addEventListener('activate', event => event.waitUntil((async () => {
    for (const old of await worker.caches.keys()) if (old.startsWith(prefix) && old !== name) await worker.caches.delete(old);
    // The first install also starts controlling only on the next navigation, so it cannot
    // pair an already loaded older page with this bundle's modules.
  })()));
  worker.addEventListener('fetch', event => {
    const path = offlineAsset(event.request, scope, assets); if (!path) return;
    event.respondWith((async () => {
      const response = await worker.caches.match(new URL(path, scope).href, { cacheName: name });
      // Do not mix a newer network module into this bundle if browser storage was evicted.
      if (!response) return new Response('Offline copy unavailable. Remove it in Settings and prepare again.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      return event.request.method === 'HEAD' ? new Response(null, { status: response.status, headers: response.headers }) : response;
    })());
  });
  worker.addEventListener('message', event => {
    if (event.data !== 'kibitz-offline-status' || !event.ports[0]) return;
    event.waitUntil((async () => {
      try {
        for (const asset of assets) if (!await worker.caches.match(new URL(asset.path, scope).href, { cacheName: name })) { event.ports[0].postMessage({ ready: false }); return; }
        event.ports[0].postMessage({ ready: true, revision, bytes: assets.reduce((sum, asset) => sum + asset.bytes, 0) });
      } catch { event.ports[0].postMessage({ ready: false }); }
    })());
  });
}
