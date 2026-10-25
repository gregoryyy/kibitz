// The operator proof stays in this form/request only; sessions use an HttpOnly cookie.
export function createOperatorPanel(root, { t = text => text, onChange = _state => {}, onEndSession = async () => true, onAccess = _grants => {}, fetcher = fetch, enabled = true } = {}) {
  if (!enabled) { root.hidden = true; return { probe() {}, clear() {} }; }
  const doc = root.ownerDocument;
  const element = (tag, text = '') => { const node = doc.createElement(tag); node.textContent = t(text); return node; };
  root.setAttribute('translate', 'no'); root.setAttribute('data-raw', '');
  const heading = element('h3', 'Local server sign-in'), status = element('p'), access = element('p'), form = element('form');
  status.setAttribute('role', 'status'); status.dataset.operatorStatus = '';
  const label = element('label', 'Operator key'), secret = element('input'); secret.type = 'password'; secret.autocomplete = 'off'; secret.maxLength = 43; secret.required = true; secret.dataset.operatorSecret = ''; label.append(secret);
  const migration = element('label', 'Keep this browser’s existing server collection'), check = element('input'); check.type = 'checkbox'; check.checked = true; check.dataset.operatorMigrate = ''; migration.prepend(check); migration.className = 'row'; label.className = 'field';
  const submit = element('button', 'Sign in'); submit.type = 'submit'; submit.className = 'btn small'; submit.dataset.operatorSubmit = '';
  form.append(element('p', 'Use the key from your private operator setup file. The key is sent only to this local server. Provider sharing permission remains separate.'), label, migration, submit);
  const logout = element('button', 'Sign out'); logout.type = 'button'; logout.className = 'btn small'; logout.dataset.operatorLogout = ''; logout.hidden = true;
  access.dataset.operatorPermissions = ''; access.hidden = true;
  root.append(heading, status, access, form, logout); root.hidden = true;
  let generation = 0, pending = null, submitting = false, cleanupFailed = false, logoutConfirmed = false;
  const clear = () => { secret.value = ''; pending?.abort(); pending = null; generation++; submitting = false; submit.disabled = false; logout.disabled = false; };
  async function request(path, body = undefined) {
    const ac = new AbortController(); pending = ac; const timer = setTimeout(() => ac.abort(), 10000);
    try {
      const response = await fetcher(path, { credentials: 'same-origin', redirect: 'error', signal: ac.signal,
        ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
      if (Number(response.headers.get('content-length')) > 8192 || !response.body) throw Error('response');
      const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true }); let text = '', bytes = 0;
      while (true) {
        const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength;
        if (bytes > 8192) { await reader.cancel(); throw Error('response'); }
        text += decoder.decode(part.value, { stream: true });
      }
      const value = JSON.parse(text + decoder.decode()); if (!response.ok) throw Object.assign(Error('session'), { code: value?.error?.code }); if (typeof value?.required !== 'boolean' || typeof value?.authenticated !== 'boolean') throw Error('response'); return value;
    } finally { clearTimeout(timer); if (pending === ac) pending = null; }
  }
  function showAccess(value) {
    const labels = { 'ai:read': 'Server status', 'ai:coach': 'Server coaching', 'ai:configure': 'Provider configuration', 'ai:test': 'Connection tests', 'ai:embed': 'Server embeddings', 'library:read': 'Read server library', 'library:write': 'Save server library', 'library:erase': 'Erase server library' };
    access.hidden = value.authenticated !== true;
    onAccess(value.required !== true ? null : value.authenticated !== true ? [] : Array.isArray(value.permissions) ? value.permissions : []);
    if (!Array.isArray(value.permissions)) { access.textContent = t('Server function permissions could not be confirmed.'); return; }
    const grants = Array.isArray(value.permissions) ? Object.keys(labels).filter(scope => value.permissions.includes(scope)).map(scope => t(labels[scope])) : [];
    access.textContent = grants.length ? t('Enabled server functions:') + ' ' + grants.join(' · ') : t('No server functions are enabled. Enable access in the local operator configuration.');
  }
  const cleanupMessage = 'The library view was cleared, but its browser cache could not be erased. Close other Kibitz tabs and retry sign-out.';
  const endSession = async () => {
    try { cleanupFailed = await onEndSession() === false; } catch { cleanupFailed = true; }
    return !cleanupFailed;
  };
  async function probe() {
    if (submitting) return;
    pending?.abort(); const gen = ++generation;
    try {
      const value = await request('api/session/status'); if (gen !== generation) return;
      showAccess(value); if (value.authenticated) logoutConfirmed = false;
      root.hidden = value.required !== true; form.hidden = value.authenticated === true; logout.hidden = !form.hidden && !cleanupFailed;
      status.textContent = t(value.authenticated ? 'Signed in to the local server.' : 'Sign in to use the local gateway and server library.');
      if (cleanupFailed) status.textContent += ' ' + t(cleanupMessage);
    } catch { if (gen === generation && !root.hidden) status.textContent = t('Sign-in could not be confirmed. Check the operator key and try again.'); }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (submit.disabled || submitting) return;
    pending?.abort(); submitting = true;
    const gen = ++generation, value = secret.value; secret.value = ''; submit.disabled = true;
    try {
      if (!await endSession()) throw Object.assign(Error('cleanup'), { code: 'library_cache_cleanup' });
      if (gen !== generation) return;
      const result = await request('api/library/session', { secret: value, migrate: check.checked }); if (gen !== generation) return; logoutConfirmed = false; showAccess(result);
      form.hidden = true; logout.hidden = false; status.textContent = t('Signed in to the local server.'); await onChange({ authenticated: true, permissions: result.permissions });
    } catch (error) {
      if (gen === generation && cleanupFailed) logout.hidden = false;
      if (gen === generation) status.textContent = t(error.code === 'library_cache_cleanup' ? cleanupMessage : error.code === 'session_conflict' ? 'This collection belongs to another operator. Restore the intended setup file before migrating.' : error.code === 'rate_limited' ? 'Too many sign-in attempts. Try again in a minute.' : 'Sign-in could not be confirmed. Check the operator key and try again.');
    } finally { if (gen === generation) { submitting = false; submit.disabled = false; } }
  });
  logout.addEventListener('click', async () => {
    if (submitting) return; pending?.abort(); submitting = true; logout.disabled = true; submit.disabled = true;
    const gen = ++generation; secret.value = '';
    const cleanup = endSession();
    try {
      if (!logoutConfirmed) await request('api/session/logout', {});
      if (gen !== generation) return; logoutConfirmed = true;
      form.hidden = false; logout.hidden = true; showAccess({ required: true, authenticated: false }); status.textContent = t('Signed out of the local server.');
      await onChange({ authenticated: false });
    } catch { if (gen === generation) status.textContent = t('Sign-out could not be confirmed. Check the connection and try again.'); }
    finally {
      const cleaned = await cleanup;
      if (gen === generation) {
        if (!cleaned) { status.textContent += ' ' + t(cleanupMessage); logout.hidden = false; }
        submitting = false; logout.disabled = false; submit.disabled = false;
      }
    }
  });
  doc.defaultView?.addEventListener('pagehide', clear); probe();
  return { probe, clear };
}
