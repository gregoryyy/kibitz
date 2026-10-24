import { offlineCachePrefix } from './offline-worker.js';

const urls = base => ({ scope: new URL('./', base).href, script: new URL('sw.js', base).href });
export async function offlineRegistration(sw, base) {
  if (!sw) return null;
  const expected = urls(base), registration = await sw.getRegistration(expected.scope);
  return registration?.scope === expected.scope && [registration.active, registration.waiting, registration.installing].some(worker => worker?.scriptURL === expected.script) ? registration : null;
}

export function offlineStatus(worker) {
  if (!worker) return Promise.resolve({ ready: false });
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel(), timer = setTimeout(() => finish(Error('Offline status unavailable')), 5000);
    function finish(error = null, value = null) { clearTimeout(timer); channel.port1.close(); channel.port2.close(); error ? reject(error) : resolve(value); }
    channel.port1.onmessage = event => finish(null, event.data?.ready === true && typeof event.data.revision === 'string' ? event.data : { ready: false });
    try { worker.postMessage('kibitz-offline-status', [channel.port2]); } catch (error) { finish(error); }
  });
}

export async function prepareOffline(sw, base) {
  const expected = urls(base);
  const registration = await sw.register(expected.script, { scope: expected.scope, type: 'module', updateViaCache: 'none' });
  if (registration.active && !registration.installing) await registration.update();
  if (registration.installing) await new Promise((resolve, reject) => {
    const worker = registration.installing, timer = setTimeout(() => finish(Error('Offline preparation timed out')), 120_000);
    function finish(error = null) { clearTimeout(timer); worker.removeEventListener('statechange', changed); error ? reject(error) : resolve(undefined); }
    function changed() {
      if (worker.state === 'redundant') finish(Error('Offline preparation failed'));
      else if (worker.state === 'activated' || worker.state === 'installed' && registration.active) finish();
    }
    worker.addEventListener('statechange', changed); changed();
  });
  const state = await offlineStatus(registration.active);
  return { ...state, waiting: !!registration.waiting, incomplete: !!registration.active && !state.ready };
}

/** Remove only this app's registration and public bundles; other caches stay intact. */
export async function removeOfflineApp(sw, caches, base) {
  const registration = await offlineRegistration(sw, base);
  if (registration) await registration.unregister();
  if (!caches) return;
  const prefix = offlineCachePrefix(urls(base).scope);
  for (const name of await caches.keys()) if (name.startsWith(prefix)) await caches.delete(name);
  if ((await caches.keys()).some(name => name.startsWith(prefix))) throw Error('Offline copy could not be removed');
}

export function createOfflinePanel(root, { t, base = location.href, sw = navigator.serviceWorker, caches = globalThis.caches, supported = globalThis.isSecureContext && !!sw }) {
  root.setAttribute('translate', 'no');
  const doc = root.ownerDocument;
  const node = (tag, text) => { const n = doc.createElement(tag); n.textContent = t(text); return n; };
  const title = node('h3', 'Offline app'), description = node('p', 'Prepare the engine, browser library, reference games and lessons for use without the server. API responses and model weights are not included.');
  description.className = 'hint';
  const note = node('p', 'Ollama needs the local server. For a browser coach without the server, select In browser and load its model first; cached weights and enough device storage are required.'); note.className = 'hint';
  const prepare = node('button', 'Prepare or check updates'), remove = node('button', 'Remove offline copy'), status = node('p', 'No offline copy has been confirmed.');
  prepare.id = 'offlinePrepare'; remove.id = 'offlineRemove'; status.id = 'offlineStatus';
  for (const button of [prepare, remove]) { button.type = 'button'; button.className = 'btn small'; }
  status.className = 'hint'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  root.replaceChildren(title, description, note, prepare, doc.createTextNode(' '), remove, status);
  let busy = false, removed = false, incomplete = false, operation = 0;
  const lock = value => { busy = value; if (value) operation++; prepare.disabled = value || !supported || removed || incomplete; remove.disabled = value || !supported || removed; };
  function show(state) {
    incomplete = !!state.incomplete && !state.waiting;
    status.textContent = t(state.waiting ? 'An update is prepared. Close every Kibitz tab, then reopen the app to use it.' : state.ready ? 'Offline app ready. Browser storage can still be cleared or evicted; keep exports of your games.' : incomplete ? 'The offline copy is incomplete. Remove it, reload with the server running, then prepare again.' : 'No complete offline copy has been confirmed. Prepare it while the server is running.');
    if (!busy) lock(false);
  }
  prepare.addEventListener('click', async () => {
    if (busy || !supported) return; lock(true); status.textContent = t('Preparing the offline app… Keep this page open.');
    try { show(await prepareOffline(sw, base)); }
    catch { status.textContent = t('Offline preparation could not be confirmed. Check free storage and the local server, then retry. A failed update does not replace an active copy.'); }
    finally { lock(false); }
  });
  remove.addEventListener('click', async () => {
    if (busy || !supported) return; lock(true);
    try { await removeOfflineApp(sw, caches, base); removed = true; status.textContent = t('Offline copy removed. Saved games and model weights remain. Reload with the server running before preparing again.'); }
    catch { status.textContent = t('Offline removal could not be completed. Retry before relying on removal.'); }
    finally { lock(false); }
  });
  lock(false);
  if (!supported) status.textContent = t('Offline preparation needs service workers on localhost or HTTPS.');
  else offlineRegistration(sw, base).then(async registration => { if (!operation) { const state = await offlineStatus(registration?.active); if (!operation) show({ ...state, waiting: !!registration?.waiting, incomplete: !!registration?.active && !state.ready }); } }).catch(() => { if (!operation) show({ ready: false }); });
}
