// Small wrapper around localStorage. set() reports failure (quota exceeded, storage blocked)
// instead of hiding it, so callers never claim to have saved something they didn't.
export function createStore(storage, prefix = 'kibitz.') {
  return {
    get(k, d) { try { const v = storage?.getItem(prefix + k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { storage.setItem(prefix + k, JSON.stringify(v)); return true; } catch { return false; } },
  };
}
// Accessing window.localStorage itself throws in some sandboxed frames.
export function browserStorage() { try { return globalThis.localStorage ?? null; } catch { return null; } }
