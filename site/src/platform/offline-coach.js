// Retain only the explicitly selected browser-model descriptor, never a network/API response.
export const OFFLINE_COACH_KEY = 'kibitz.offlineCoach';
function descriptor(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join() !== 'bytes,name,url'
    || typeof value.url !== 'string' || !/^models\/[a-z0-9][a-z0-9._-]{0,120}\.gguf$/.test(value.url)
    || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 120 || [...value.name].some(c => c.codePointAt(0) < 32 || c.codePointAt(0) === 127)
    || !Number.isSafeInteger(value.bytes) || value.bytes <= 0 || value.bytes > 8_000_000_000) return null;
  return { url: value.url, name: value.name, bytes: value.bytes };
}
function saved(storage) {
  const raw = storage?.getItem(OFFLINE_COACH_KEY);
  if (raw === null || raw === undefined) return { absent: true, model: null };
  if (raw.length > 2048) return { model: null };
  try {
    const value = JSON.parse(raw);
    return { model: value?.version === 1 && Object.keys(value).sort().join() === 'model,version' ? descriptor(value.model) : null };
  } catch { return { model: null }; }
}
export function rememberOfflineCoach(storage, status) {
  try {
    if (!storage) return false;
    const previous = saved(storage); if (!previous.absent && !previous.model) return false; // Preserve unknown formats, closed.
    const model = status?.available && status.provider === 'browser' ? descriptor(status.browser) : null;
    if (model) storage.setItem(OFFLINE_COACH_KEY, JSON.stringify({ version: 1, model }));
    else storage.removeItem(OFFLINE_COACH_KEY);
    return true;
  } catch { return false; }
}
export function offlineCoach(storage) {
  try {
    const model = saved(storage).model; if (!model) return null;
    return { available: true, provider: 'browser', browser: model, localOnly: true, offline: true,
      providers: [{ name: 'browser', available: true, model: model.name }], models: { quick: model.name, chat: model.name, review: model.name } };
  } catch { return null; }
}
