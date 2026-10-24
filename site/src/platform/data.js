// Explicit data portability/erasure. This page runs without the app's autosave workers.
import { LIBRARY_CACHE_DB } from '../library/cache.js';

export const DATA_LIMITS = Object.freeze({ keys: 256, characters: 32_000_000 });
const failure = code => Object.assign(new Error('Data operation failed.'), { code });

/** Preserve raw values, including unknown formats; never collect unrelated origin storage. */
export function browserData(storage) {
  if (!storage) throw failure('storage');
  const entries = []; let characters = 0;
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i); if (!key?.startsWith('kibitz.')) continue;
    const value = storage.getItem(key); if (value === null) throw failure('changed');
    characters += key.length + value.length;
    if (entries.length >= DATA_LIMITS.keys || characters > DATA_LIMITS.characters) throw failure('limit');
    entries.push([key, value]);
  }
  return entries.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
}

export function exportBrowserData(storage, now = new Date()) {
  return JSON.stringify({ format: 'kibitz-browser-data', version: 1, exportedAt: now.toISOString(), entries: browserData(storage) }, null, 2);
}

/** Intentional whole-cache erasure also works with future schema versions. */
export function eraseLibraryCache(factory, name = LIBRARY_CACHE_DB) {
  if (!factory) return Promise.reject(failure('cache'));
  return new Promise((resolve, reject) => {
    let request, settled = false;
    const finish = (error = null) => { if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve(undefined); };
    const timer = setTimeout(() => finish(failure('cache_blocked')), 3000);
    try { request = factory.deleteDatabase(name); } catch { finish(failure('cache')); return; }
    request.onsuccess = () => finish(); request.onerror = () => finish(failure('cache'));
    // onversionchange lets other cache connections close; timeout never claims success.
  });
}

/** No cross-key transaction: on any failure the caller must report incomplete erasure. */
export async function eraseBrowserData(storage, expected, eraseCache) {
  const unchanged = () => {
    if (!Array.isArray(expected) || JSON.stringify(browserData(storage)) !== JSON.stringify(expected)) throw failure('changed');
  };
  unchanged(); await eraseCache(); unchanged();
  for (const [key, value] of expected) {
    if (storage.getItem(key) !== value) throw failure('changed');
    storage.removeItem(key);
  }
  if (browserData(storage).length) throw failure('changed');
}
