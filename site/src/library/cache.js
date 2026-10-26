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

/** Explicit erasure of this noncanonical cache, including unknown/future formats. */
export function deleteLibraryCacheDatabase(factory, name = LIBRARY_CACHE_DB) {
  if (!factory) return Promise.reject(error('library_cache_unavailable'));
  return new Promise((resolve, reject) => {
    let request, settled = false;
    const finish = cause => { if (settled) return; settled = true; clearTimeout(timer); cause ? reject(cause) : resolve(undefined); };
    const timer = setTimeout(() => finish(error('library_cache_blocked')), 3000);
    try { request = factory.deleteDatabase(name); } catch { finish(error('library_cache_unavailable')); return; }
    request.onsuccess = () => finish(null); request.onerror = () => finish(error('library_cache_unavailable'));
    // Other owned connections close on versionchange. A blocked delete is never acknowledged.
  });
}

/**
 * Wait for transaction completion. Ordinary reads/writes preserve future formats;
 * explicit clear cancels earlier work before erasing the derived cache.
 * @param {{factory?: IDBFactory|null, name?: string, now?: () => string}} [options]
 */
export function createLibraryCache(options = {}) {
  let factory;
  try { factory = options.factory === undefined ? globalThis.indexedDB : options.factory; } catch { factory = null; }
  let connection = null, opening = null, closed = false, generation = 0, clearing = null, cleanupFailed = false;
  const pending = new Set();
  const current = gen => { if (closed || gen !== generation || cleanupFailed) throw error('library_cache_unavailable'); };
  const invalidate = () => {
    generation++; for (const cancel of [...pending]) cancel(); pending.clear();
    connection?.close(); connection = null; opening = null;
  };
  const connect = async () => {
    const gen = generation;
    if (clearing) await clearing;
    current(gen);
    if (!factory) throw error('library_cache_unavailable');
    if (connection) return connection;
    if (opening) return opening;
    opening = new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => refuse(error('library_cache_unavailable')), 3000);
      const cancel = () => refuse(error('library_cache_unavailable'));
      const refuse = cause => { if (!settled) { settled = true; clearTimeout(timer); pending.delete(cancel); reject(cause); } };
      pending.add(cancel);
      let request;
      try { request = factory.open(options.name || LIBRARY_CACHE_DB, 1); }
      catch { refuse(error('library_cache_unavailable')); return; }
      request.onupgradeneeded = event => {
        if (event.oldVersion !== 0 || gen !== generation || closed) { request.transaction.abort(); return; }
        request.result.createObjectStore('snapshots', { keyPath: 'scope' });
      };
      request.onblocked = () => refuse(error('library_cache_blocked'));
      request.onerror = () => refuse(error(request.error?.name === 'VersionError' ? 'library_cache_version' : 'library_cache_unavailable'));
      request.onsuccess = () => {
        const db = request.result;
        if (settled || closed || gen !== generation) { db.close(); refuse(error('library_cache_unavailable')); return; }
        if (!db.objectStoreNames.contains('snapshots') || db.transaction('snapshots').objectStore('snapshots').keyPath !== 'scope') {
          db.close(); refuse(error('library_cache_version')); return;
        }
        db.onversionchange = event => {
          if (connection === db) { invalidate(); if (event.newVersion === null) cleanupFailed = true; }
          else db.close();
        };
        connection = db; settled = true; clearTimeout(timer); pending.delete(cancel); resolve(db);
      };
    });
    return opening;
  };
  const transact = async (scope, write = null, remove = false) => {
    const gen = generation;
    if (!libraryScope(scope)) throw error('library_cache_invalid');
    if (write) { validateLibrarySnapshot(write); write = structuredClone(write); }
    const db = await connect(); current(gen);
    return new Promise((resolve, reject) => {
      let tx, value = remove ? undefined : null, failure = null, settled = false;
      const finish = cause => {
        if (settled) return; settled = true; pending.delete(cancel);
        cause ? reject(cause) : resolve(value);
      };
      const cancel = () => { failure = error('library_cache_unavailable'); try { tx.abort(); } catch { finish(failure); } };
      try { tx = db.transaction('snapshots', write || remove ? 'readwrite' : 'readonly'); }
      catch { finish(error('library_cache_unavailable')); return; }
      pending.add(cancel);
      tx.oncomplete = () => { try { current(gen); finish(null); } catch (cause) { finish(cause); } };
      tx.onabort = () => finish(failure || error('library_cache_write'));
      const store = tx.objectStore('snapshots');
      if (remove) { store.delete(scope); return; }
      const request = store.get(scope);
      request.onsuccess = () => {
        try {
          current(gen); value = cacheEntry(request.result, scope);
          if (write) {
            value = cacheEntry({ version: 1, scope, snapshot: write, cachedAt: (options.now || (() => new Date().toISOString()))() }, scope);
            store.put(value);
          }
        } catch (cause) { failure = cause; try { tx.abort(); } catch { finish(failure); } }
      };
    });
  };
  return {
    read: scope => transact(scope),
    write: snapshot => transact(snapshot?.scope, snapshot),
    remove: scope => transact(scope, null, true),
    clear() {
      invalidate(); cleanupFailed = true;
      const operation = Promise.resolve(clearing).catch(() => {}).then(() => deleteLibraryCacheDatabase(factory, options.name || LIBRARY_CACHE_DB));
      clearing = operation;
      operation.then(() => { if (clearing === operation) { clearing = null; cleanupFailed = false; } }, () => { if (clearing === operation) clearing = null; });
      return operation;
    },
    close() { closed = true; invalidate(); },
  };
}
