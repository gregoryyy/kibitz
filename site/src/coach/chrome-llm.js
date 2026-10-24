// Optional Chrome Prompt API (TODO 2.16). Inject the API; tests never download a model.
// The empty base is only cloned, never prompted: application messages remain the sole history.
import { mergeTurns } from './browser-llm.js';

export const CHROME_LIMITS = Object.freeze({ input: 100_000, output: 12_000, loadMs: 300_000, requestMs: 120_000, idleMs: 600_000 });
const OPTIONS = () => ({ expectedInputs: [{ type: 'text', languages: ['en', 'de'] }], expectedOutputs: [{ type: 'text', languages: ['en', 'de'] }] });
const UNAVAILABLE = "Chrome's built-in model is unavailable here. Choose another coach provider.";
const INPUT = "This question is too large for Chrome's model. Ask about a specific position.";
const failure = message => ({ code: 'browser_model', message });
const cancelled = () => ({ code: 'cancelled', text: '' });
const destroy = session => { try { session?.destroy(); } catch { /* already destroyed */ } };
const timer = (fn, ms) => { const id = setTimeout(fn, ms); /** @type {any} */ (id)?.unref?.(); return id; };

// Even a runtime ignoring AbortSignal cannot apply a late result or leak a late-created session.
/** @param {(value:any) => void} [dispose] */
function guarded(promise, signal, dispose = () => {}) {
  return new Promise((resolve, reject) => {
    const stop = () => reject(cancelled());
    signal.addEventListener('abort', stop, { once: true });
    if (signal.aborted) stop();
    Promise.resolve(promise).then(value => {
      signal.removeEventListener('abort', stop);
      if (signal.aborted) { dispose(value); reject(cancelled()); } else resolve(value);
    }, error => { signal.removeEventListener('abort', stop); reject(error); });
  });
}

/** Scope the optional backend to Chrome's documented on-device implementation, not arbitrary Prompt API implementations. */
export function chromeLanguageModel(browser) {
  const brands = browser.navigator?.userAgentData?.brands;
  const chrome = Array.isArray(brands) ? brands.some(b => b.brand === 'Google Chrome')
    : /\b(?:Chrome|HeadlessChrome)\//.test(browser.navigator?.userAgent || '') && !/\b(?:Edg|OPR|SamsungBrowser)\//.test(browser.navigator?.userAgent || '');
  return chrome ? browser.LanguageModel : null;
}

/**
 * @param {object} options
 * @param {any} options.api Chrome's window.LanguageModel (or a fake); never an implicit polyfill.
 * @param {() => boolean} options.activated navigator.userActivation.isActive, checked before create.
 * @param {(state: {state:string, progress:number, error:string, gpu:boolean, availability:string}) => void} [options.onState]
 * @param {(busy:boolean, info:{gpu:boolean}) => void} [options.onBusy] CPU/GPU is opaque; reserve CPU conservatively.
 * @param {{input:number, output:number, loadMs:number, requestMs:number, idleMs:number}} [options.limits]
 * @param {(fn:() => void, ms:number) => any} [options.setTimer]
 * @param {(id:any) => void} [options.clearTimer]
 */
export function createChromeModel({ api, activated, onState = () => {}, onBusy = () => {}, limits = CHROME_LIMITS, setTimer = timer, clearTimer = clearTimeout }) {
  const st = { state: 'off', progress: 0, error: '', gpu: false, availability: 'unknown' };
  let base = null, loading = null, loadController = null, active = null, idle = null, gen = 0;
  /** @type {Promise<any>} */ let queue = Promise.resolve();
  const set = patch => { Object.assign(st, patch); onState({ ...st }); };
  const clearIdle = () => { if (idle !== null) clearTimer(idle); idle = null; };
  const keepAlive = () => { clearIdle(); if (base) idle = setTimer(unload, limits.idleMs); };
  const supported = !!api && typeof api.availability === 'function' && typeof api.create === 'function';
  // A probe never creates a session or starts a download. Keep identical text/language options.
  const checked = supported ? Promise.resolve().then(() => api.availability(OPTIONS())).then(value => {
    const availability = ['available', 'downloadable', 'downloading', 'unavailable'].includes(value) ? value : 'unavailable';
    set({ availability, ...(!base && !loading && availability === 'unavailable' ? { state: 'error', error: UNAVAILABLE } : {}) });
    return availability;
  }).catch(() => { set({ availability: 'unavailable', ...(!base && !loading ? { state: 'error', error: UNAVAILABLE } : {}) }); return 'unavailable'; })
    : Promise.resolve('unavailable');
  if (!supported) Object.assign(st, { availability: 'unavailable', state: 'error', error: UNAVAILABLE });

  function load() {
    if (base) { keepAlive(); return Promise.resolve(); }
    if (loading) return loading;
    if (!supported || st.availability === 'unavailable') return Promise.reject(failure(UNAVAILABLE));
    if (!activated()) return Promise.reject({ code: 'needs_consent' });
    const epoch = ++gen, ac = new AbortController(); loadController = ac;
    let timedOut = false;
    const deadline = setTimer(() => { timedOut = true; ac.abort(); }, limits.loadMs);
    set({ state: 'loading', progress: 0, error: '' });
    let creation;
    // Invoke create before any await: the Load click's activation must still be present.
    try { creation = api.create({ ...OPTIONS(), signal: ac.signal, monitor(m) {
      m.addEventListener('downloadprogress', event => {
        if (epoch === gen && !ac.signal.aborted && Number.isFinite(event.loaded)) set({ progress: Math.max(0, Math.min(1, event.loaded)) });
      });
    } }); } catch (error) { creation = Promise.reject(error); }
    loading = (async () => {
      try {
        const session = await guarded(creation, ac.signal, destroy);
        if (epoch !== gen) { destroy(session); throw cancelled(); }
        if (typeof session?.clone !== 'function' || typeof session?.destroy !== 'function') { destroy(session); throw failure(UNAVAILABLE); }
        base = session; set({ state: 'ready', progress: 1, error: '' }); keepAlive();
      } catch (error) {
        ac.abort();
        if (epoch !== gen) throw cancelled();
        const message = timedOut ? "Loading Chrome's model timed out. Try Load again." : "Chrome's built-in model could not load. Check Chrome's model availability and try Load again.";
        set({ state: 'error', progress: 0, error: message });
        throw error?.code === 'needs_consent' ? error : failure(message);
      } finally {
        clearTimer(deadline);
        if (loadController === ac) { loadController = null; loading = null; }
      }
    })();
    return loading;
  }

  function unload() {
    ++gen; clearIdle(); loadController?.abort(); loadController = null; loading = null;
    active?.ac.abort(); destroy(active?.session);
    const session = base; base = null; destroy(session);
    set({ state: 'off', progress: 0, error: '' });
  }

  function sample(input, /** @type {{signal?:AbortSignal, onText?:(value:{text:string}) => void, schema?:{name:string, schema:object}}} */ { signal, onText, schema } = {}) {
    const epoch = gen;
    const run = async () => {
      if (signal?.aborted || epoch !== gen) throw cancelled();
      if (!base) throw { code: 'needs_consent' }; // Explicit Load is required again after unload/reload.
      const raw = typeof input === 'string' ? [{ role: 'user', content: input }] : input;
      if (!Array.isArray(raw) || !raw.length || raw.length > 100 || raw.some(m => !m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string')
        || raw.reduce((n, m) => n + m.content.length, 0) > limits.input) throw failure(INPUT);
      const messages = mergeTurns(raw), ac = new AbortController(), current = { ac, session: null };
      if (messages.reduce((n, m) => n + m.content.length, 0) > limits.input) throw failure(INPUT);
      let text = '', reader = null, timedOut = false, overflow = false;
      const stop = () => ac.abort(); signal?.addEventListener('abort', stop, { once: true });
      const deadline = setTimer(() => { timedOut = true; ac.abort(); }, limits.requestMs);
      clearIdle(); active = current; onBusy(true, { gpu: false });
      try {
        if (signal?.aborted) ac.abort();
        current.session = await guarded(base.clone({ signal: ac.signal }), ac.signal, destroy);
        const session = current.session, opts = { signal: ac.signal, ...(schema ? { responseConstraint: schema.schema } : {}) };
        if (typeof session.promptStreaming !== 'function' || typeof session.measureContextUsage !== 'function'
          || !Number.isFinite(session.contextWindow) || session.contextWindow <= 0) throw failure(UNAVAILABLE);
        const size = await guarded(session.measureContextUsage(messages, opts), ac.signal);
        if (!Number.isFinite(size) || size < 0 || size > session.contextWindow) throw failure(INPUT);
        session.addEventListener?.('contextoverflow', () => { overflow = true; ac.abort(); }, { once: true });
        const stream = await guarded(session.promptStreaming(messages, opts), ac.signal);
        reader = stream.getReader();
        for (;;) {
          const { value, done } = await guarded(reader.read(), ac.signal);
          if (epoch !== gen || signal?.aborted) throw cancelled();
          if (done) return { text, truncated: false };
          if (typeof value !== 'string') throw failure(UNAVAILABLE);
          text += value.slice(0, limits.output - text.length); onText?.({ text });
          if (text.length === limits.output) return { text, truncated: true };
        }
      } catch (error) {
        if (epoch !== gen || signal?.aborted) throw { code: 'cancelled', text };
        if (overflow) throw failure(INPUT);
        if (timedOut) throw failure("Chrome's model took too long. Ask a shorter question.");
        throw error?.code === 'browser_model' ? error : failure("Chrome's model could not answer. Try again or choose another provider.");
      } finally {
        clearTimer(deadline); signal?.removeEventListener('abort', stop);
        ac.abort(); destroy(current.session);
        try { reader?.cancel()?.catch(() => {}); reader?.releaseLock(); } catch { /* aborted reader */ }
        if (active === current) active = null;
        onBusy(false, { gpu: false }); if (epoch === gen) keepAlive();
      }
    };
    const next = queue.then(run, run); queue = next.catch(() => {}); return next;
  }

  return { load, unload, sample, checked, get status() { return { ...st }; } };
}
