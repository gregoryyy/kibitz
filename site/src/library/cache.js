// IndexedDB is a cache for an explicitly selected server library, never an upload queue.
import { libraryScope, validateLibrarySnapshot } from './storage.js';
export const LIBRARY_CACHE_DB = 'kibitz-library';
const error = code => Object.assign(new Error('Library cache unavailable.'), { code });
const cacheEntry = (entry, scope) => {
  if (!entry) return null;
  if (entry.version !== 1) throw error('library_cache_version');
  if (entry.scope !== scope || typeof entry.cachedAt !== 'string' || !Number.isFinite(Date.parse(entry.cachedAt))) throw error('library_cache_invalid');
  validateLibrarySnapshot(entry.snapshot);
  if (entry.snapshot.scope !== scope) throw error('library_cache_invalid');
  return entry;
};

/**
 * Wait for transaction completion, not individual request success. Future formats are preserved.
 * @param {{factory?: IDBFactory|null, name?: string, now?: () => string}} [options]
 */
export function createLibraryCache(options = {}) {
  let factory;
  try { factory = options.factory === undefined ? globalThis.indexedDB : options.factory; } catch { factory = null; }
  let connection = null, opening = null, closed = false;
  const connect = () => {
    if (closed || !factory) return Promise.reject(error('library_cache_unavailable'));
    if (connection) return Promise.resolve(connection);
    if (opening) return opening;
    opening = new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => refuse(error('library_cache_unavailable')), 3000);
      const refuse = cause => { if (!settled) { settled = true; clearTimeout(timer); reject(cause); } };
      let request;
      try { request = factory.open(options.name || LIBRARY_CACHE_DB, 1); }
      catch { refuse(error('library_cache_unavailable')); return; }
      request.onupgradeneeded = event => {
        if (event.oldVersion !== 0) { request.transaction.abort(); return; }
        request.result.createObjectStore('snapshots', { keyPath: 'scope' });
      };
      request.onblocked = () => refuse(error('library_cache_blocked'));
      request.onerror = () => refuse(error(request.error?.name === 'VersionError' ? 'library_cache_version' : 'library_cache_unavailable'));
      request.onsuccess = () => {
        const db = request.result;
        if (settled || closed) { db.close(); refuse(error('library_cache_unavailable')); return; }
        if (!db.objectStoreNames.contains('snapshots') || db.transaction('snapshots').objectStore('snapshots').keyPath !== 'scope') {
          db.close(); refuse(error('library_cache_version')); return;
        }
        db.onversionchange = () => { db.close(); connection = null; opening = null; };
        connection = db; settled = true; clearTimeout(timer); resolve(db);
      };
    });
    return opening;
  };
  const transact = async (scope, write = null) => {
    if (!libraryScope(scope)) throw error('library_cache_invalid');
    if (write) { validateLibrarySnapshot(write); write = structuredClone(write); }
    const db = await connect();
    if (closed) throw error('library_cache_unavailable');
    return new Promise((resolve, reject) => {
      let tx;
      try { tx = db.transaction('snapshots', write ? 'readwrite' : 'readonly'); }
      catch { reject(error('library_cache_unavailable')); return; }
      let value = null, failure = null;
      tx.oncomplete = () => resolve(value);
      tx.onabort = () => reject(failure || error('library_cache_write'));
      const store = tx.objectStore('snapshots'), request = store.get(scope);
      request.onsuccess = () => {
        try {
          value = cacheEntry(request.result, scope);
          if (write) {
            value = cacheEntry({ version: 1, scope, snapshot: write, cachedAt: (options.now || (() => new Date().toISOString()))() }, scope);
            store.put(value);
          }
        } catch (cause) { failure = cause; tx.abort(); }
      };
      // Request/storage errors use the native transaction abort, so partial cache writes never succeed.
    });
  };
  return {
    read: scope => transact(scope),
    write: snapshot => transact(snapshot?.scope, snapshot),
    async remove(scope) {
      if (!libraryScope(scope)) throw error('library_cache_invalid');
      const db = await connect();
      if (closed) throw error('library_cache_unavailable');
      return new Promise((resolve, reject) => {
        const tx = db.transaction('snapshots', 'readwrite');
        tx.oncomplete = () => resolve(undefined); tx.onabort = () => reject(error('library_cache_write'));
        tx.objectStore('snapshots').delete(scope);
      });
    },
    close() { closed = true; connection?.close(); connection = null; },
  };
}
