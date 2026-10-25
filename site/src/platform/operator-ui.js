// The operator proof stays in this form/request only; sessions use an HttpOnly cookie.
export function createOperatorPanel(root, { t = text => text, onChange = _state => {}, fetcher = fetch, enabled = true } = {}) {
  if (!enabled) { root.hidden = true; return { probe() {}, clear() {} }; }
  const doc = root.ownerDocument;
  const element = (tag, text = '') => { const node = doc.createElement(tag); node.textContent = t(text); return node; };
  root.setAttribute('translate', 'no'); root.setAttribute('data-raw', '');
  const heading = element('h3', 'Local server sign-in'), status = element('p'), form = element('form');
  status.setAttribute('role', 'status'); status.dataset.operatorStatus = '';
  const label = element('label', 'Operator key'), secret = element('input'); secret.type = 'password'; secret.autocomplete = 'off'; secret.maxLength = 43; secret.required = true; secret.dataset.operatorSecret = ''; label.append(secret);
  const migration = element('label', 'Keep this browser’s existing server collection'), check = element('input'); check.type = 'checkbox'; check.checked = true; check.dataset.operatorMigrate = ''; migration.prepend(check); migration.className = 'row'; label.className = 'field';
  const submit = element('button', 'Sign in'); submit.type = 'submit'; submit.className = 'btn small'; submit.dataset.operatorSubmit = '';
  form.append(element('p', 'Use the key from your private operator setup file. The key is sent only to this local server. Provider sharing permission remains separate.'), label, migration, submit);
  const logout = element('button', 'Sign out'); logout.type = 'button'; logout.className = 'btn small'; logout.dataset.operatorLogout = ''; logout.hidden = true;
  root.append(heading, status, form, logout); root.hidden = true;
  let generation = 0, pending = null, submitting = false;
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
  async function probe() {
    if (submitting) return;
    pending?.abort(); const gen = ++generation;
    try {
      const value = await request('api/session/status'); if (gen !== generation) return;
      root.hidden = value.required !== true; form.hidden = value.authenticated === true; logout.hidden = !form.hidden;
      status.textContent = t(value.authenticated ? 'Signed in to the local server.' : 'Sign in to use the local gateway and server library.');
    } catch { if (gen === generation && !root.hidden) status.textContent = t('Sign-in could not be confirmed. Check the operator key and try again.'); }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (submit.disabled) return;
    pending?.abort(); submitting = true;
    const gen = ++generation, value = secret.value; secret.value = ''; submit.disabled = true;
    try {
      await request('api/library/session', { secret: value, migrate: check.checked }); if (gen !== generation) return;
      form.hidden = true; logout.hidden = false; status.textContent = t('Signed in to the local server.'); await onChange({ authenticated: true });
    } catch (error) {
      if (gen === generation) status.textContent = t(error.code === 'session_conflict' ? 'This collection belongs to another operator. Restore the intended setup file before migrating.' : error.code === 'rate_limited' ? 'Too many sign-in attempts. Try again in a minute.' : 'Sign-in could not be confirmed. Check the operator key and try again.');
    } finally { if (gen === generation) { submitting = false; submit.disabled = false; } }
  });
  logout.addEventListener('click', async () => {
    if (submitting) return; pending?.abort(); submitting = true; logout.disabled = true;
    const gen = ++generation; secret.value = '';
    try {
      await request('api/session/logout', {}); if (gen !== generation) return;
      form.hidden = false; logout.hidden = true; status.textContent = t('Signed out of the local server.');
      await onChange({ authenticated: false });
    } catch { if (gen === generation) status.textContent = t('Sign-out could not be confirmed. Check the connection and try again.'); }
    finally { if (gen === generation) { submitting = false; logout.disabled = false; } }
  });
  doc.defaultView?.addEventListener('pagehide', clear); probe();
  return { probe, clear };
}
