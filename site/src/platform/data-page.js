import { createOperatorPanel } from './operator-ui.js';
import { browserStorage } from './store.js';
import { pickLang, translator } from './i18n.js';
import DE from './i18n-de.js';
import { browserData, exportBrowserData, eraseBrowserData, eraseLibraryCache } from './data.js';
import { createLibraryCache } from '../library/cache.js';
import { removeOfflineApp } from './offline-app.js';
import { validateLibrarySnapshot, LIBRARY_LIMITS } from '../library/storage.js';

const $ = selector => document.querySelector(selector), storage = browserStorage();
let savedLanguage = null; try { savedLanguage = JSON.parse(storage?.getItem('kibitz.lang')); } catch { /* default language */ }
const language = pickLang(savedLanguage, [...navigator.languages]), i18n = translator(language === 'de' ? DE : {}), t = (text, parts) => i18n.t(text, parts);
document.documentElement.lang = language;
document.title = 'Kibitz — ' + t('Your data');
for (const node of document.querySelectorAll('[data-i18n]')) { node.textContent = t(node.textContent); node.setAttribute('translate', 'no'); }
let serverGeneration = 0;
const serverPending = new Set();
let busy = false, snapshot = null, confirmation = null, allowedRead = true, allowedErase = true;
const buttons = [...document.querySelectorAll('button')].filter(button => !['eraseCancel', 'eraseProceed'].includes(button.id));
function updateButtons() {
  buttons.forEach(button => { button.disabled = busy || button.id === 'serverLoad' && !allowedRead || button.id === 'serverErase' && !allowedErase || ['serverExport', 'serverErase'].includes(button.id) && (!snapshot || !allowedRead); });
}
function download(text, name) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' })), link = document.createElement('a');
  link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
async function serverRequest(path, body = undefined) {
  const gen = serverGeneration, current = () => { if (gen !== serverGeneration) throw Object.assign(Error('cancelled'), { code: 'session_changed' }); };
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 15000);
  serverPending.add(ctl);
  try {
    const response = await fetch('api/library/' + path, { credentials: 'same-origin', redirect: 'error', signal: ctl.signal,
      ...(body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
    current();
    const limit = response.ok ? LIBRARY_LIMITS.totalBytes + 1_000_000 : 8192;
    if (+response.headers.get('content-length') > limit || !response.body) throw Error('response');
    const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true }); let text = '', bytes = 0;
    while (true) {
      const part = await reader.read(); current(); if (part.done) break; bytes += part.value.byteLength;
      if (bytes > limit) { await reader.cancel(); throw Error('response'); } text += decoder.decode(part.value, { stream: true });
    }
    const value = JSON.parse(text + decoder.decode()); current();
    if (!response.ok) throw Object.assign(Error('server'), { code: value?.error?.code });
    return validateLibrarySnapshot(value);
  } finally { clearTimeout(timer); serverPending.delete(ctl); }
}
const serverCounts = value => t('Saved games: {games} · references: {books}', { games: value.games.length, books: value.books.length });
async function run(area, action, erasing = false) {
  if (busy) return; busy = true; updateButtons();
  try { await action(); }
  catch (error) {
    if (area === 'server') {
      snapshot = null;
      $('#serverStatus').textContent = t(error.code === 'permission_unavailable' ? 'Server function permissions could not be confirmed.' : error.code === 'permission_denied' ? 'This function is disabled by the local operator.' : ['conflict', 'session_changed', 'no_session'].includes(error.code) ? 'The server library changed. Check it again before retrying.' : 'The server operation could not be confirmed. Check the library before retrying; no completion is claimed.');
    } else $('#browserStatus').textContent = t(erasing ? 'Browser erasure could not be completed. Data may be partly erased. Close other Kibitz tabs and retry.' : 'Browser data could not be read. No erasure was started.');
  } finally { busy = false; updateButtons(); }
}
function confirm(kind, value) {
  confirmation = { kind, value }; const browser = kind === 'browser';
  $('#eraseTitle').textContent = t(browser ? 'Erase data in this browser?' : 'Erase this server library?');
  $('#eraseDetails').textContent = t(browser ? 'Permanently erase Kibitz browser data and cached server libraries on this device. Server records remain. Download an export first if you want to keep a copy.'
    : 'Permanently erase the games and references in this cookie-scoped server library. Other owners and browser data remain. Download an export first if you want to keep a copy.');
  $('#eraseConfirm').showModal(); $('#eraseCancel').focus();
}
$('#browserExport').addEventListener('click', () => run('browser', async () => {
  download(exportBrowserData(storage), 'kibitz-browser-data.json'); $('#browserStatus').textContent = t('The browser export was prepared for download.');
}));
$('#browserErase').addEventListener('click', () => run('browser', async () => confirm('browser', browserData(storage))));
$('#serverLoad').addEventListener('click', () => run('server', async () => {
  snapshot = await serverRequest('records'); $('#serverStatus').textContent = serverCounts(snapshot);
}));
$('#serverExport').addEventListener('click', () => run('server', async () => {
  const scope = snapshot?.scope, next = await serverRequest('records');
  if (next.scope !== scope) throw Object.assign(Error('changed'), { code: 'session_changed' });
  snapshot = next; download(JSON.stringify({ format: 'kibitz-server-library', version: 1, exportedAt: new Date().toISOString(), library: next }, null, 2), 'kibitz-server-library.json');
  $('#serverStatus').textContent = t('The server export was prepared for download.') + ' ' + serverCounts(next);
}));
$('#serverErase').addEventListener('click', () => { if (!busy && snapshot) confirm('server', snapshot); });
$('#eraseCancel').addEventListener('click', () => { confirmation = null; $('#eraseConfirm').close(); });
$('#eraseConfirm').addEventListener('cancel', () => { confirmation = null; });
$('#eraseProceed').addEventListener('click', () => {
  const chosen = confirmation; if (!chosen || busy) return; confirmation = null; $('#eraseConfirm').close();
  if (chosen.kind === 'browser') run('browser', async () => {
    await eraseBrowserData(storage, chosen.value, async () => {
      await removeOfflineApp(navigator.serviceWorker, globalThis.caches, location.href);
      await eraseLibraryCache(globalThis.indexedDB);
    });
    $('#browserStatus').textContent = t('Kibitz data in this browser has been erased. Server records remain.');
  }, true);
  else run('server', async () => {
    const before = chosen.value, next = await serverRequest('erase', { scope: before.scope, revision: before.revision, confirm: true });
    if (next.scope !== before.scope || next.games.length || next.books.length || next.revision !== before.revision + 1) throw Error('response');
    snapshot = next;
    const cache = createLibraryCache();
    try { await cache.remove(next.scope); $('#serverStatus').textContent = t('This server library and its cache on this device have been erased. Browser data remains.'); }
    catch { $('#serverStatus').textContent = t('The server library was erased, but its browser cache could not be removed. Use browser erasure to remove cached copies.'); }
    finally { cache.close(); }
  });
});

createOperatorPanel($('#operatorSignIn'), { t, onEndSession: async () => {
  serverGeneration++; for (const ctl of serverPending) ctl.abort(); serverPending.clear();
  snapshot = null; confirmation = null; $('#eraseConfirm').close(); updateButtons();
  $('#serverStatus').textContent = t('The server library session changed. Reconnect before saving changes.');
  const cache = createLibraryCache();
  try { await cache.clear(); return true; } finally { cache.close(); }
}, onAccess: grants => { allowedRead = grants === null || grants.includes('library:read'); allowedErase = grants === null || grants.includes('library:erase') && allowedRead; updateButtons(); }, onChange: state => { snapshot = null; updateButtons(); $('#serverStatus').textContent = t(state.authenticated ? 'Sign-in complete. Check the server library before continuing.' : 'Signed out of the local server.'); } });
