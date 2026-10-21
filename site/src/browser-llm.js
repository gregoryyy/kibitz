// The in-browser model (TODO 2.16.3-2.16.4): a small GGUF model the page runs itself with wllama,
// on WebGPU when the browser has it and on the CPU in WebAssembly otherwise. sample() has the same
// shape as the gateway client's, so the coach code doesn't care where the model runs.
// The runtime is passed in (createRuntime), so tests use a fake; no DOM, no globals.

// CPU threads for the model when there's no GPU: half the cores, so Stockfish keeps the rest.
export const cpuThreads = cores => Math.max(1, Math.floor((cores || 2) / 2));

// Whether the model fits: weights plus context need about 1.5 times the file size, and the
// model shouldn't take more than half the device's memory. navigator.deviceMemory is rounded
// (and capped at 8 GB) where it exists; without it the load is simply tried.
export function memoryCheck({ bytes, deviceMemoryGB }) {
  if (!deviceMemoryGB || !bytes) return { ok: true, reason: '' };
  const need = bytes * 1.5, have = deviceMemoryGB * 1e9 / 2;
  return need <= have ? { ok: true, reason: '' } : { ok: false, reason: `The in-browser model needs about ${(need / 1e9).toFixed(1)} GB of memory; this device reports ${deviceMemoryGB} GB. Use a smaller model (just offline model=qwen2.5-0.5b) or a provider in .env.` };
}

// Chat templates expect user and assistant turns to alternate; the coach sends its rules and the
// question as two user messages, so consecutive messages of one role are joined.
export function mergeTurns(input) {
  const msgs = typeof input === 'string' ? [{ role: 'user', content: input }] : input;
  const out = [];
  for (const m of msgs) {
    const prev = out.at(-1);
    if (prev && prev.role === m.role) prev.content += '\n\n' + m.content;
    else out.push({ role: m.role, content: m.content });
  }
  return out;
}

// The model file as a Blob, with download progress (0..1).
async function fetchAsBlob(url, onProgress) {
  const r = await fetch(url);
  if (!r.ok || !r.body) throw new Error(`HTTP ${r.status} for ${url}`);
  const total = Number(r.headers.get('content-length')) || 0, parts = [], reader = r.body.getReader();
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value); got += value.length;
    if (total) onProgress(got / total);
  }
  return new Blob(parts);
}

// The idle timer mustn't keep Node alive (tests); browsers have no unref.
const idleTimer = (f, ms) => { const t = setTimeout(f, ms); /** @type {any} */ (t)?.unref?.(); return t; };

/**
 * @param {object} o
 * @param {() => Promise<any>} o.createRuntime  makes a wllama instance (or a fake)
 * @param {{ url: string, name: string, bytes: number }} o.model  from the gateway's status
 * @param {number} [o.cores]  navigator.hardwareConcurrency
 * @param {number} [o.deviceMemoryGB]  navigator.deviceMemory
 * @param {() => Promise<number|undefined>} [o.storageFree]  free browser storage in bytes (navigator.storage.estimate)
 * @param {(url: string, onProgress: (p: number) => void) => Promise<Blob>} [o.fetchBlob]  for loading without the storage
 * @param {number} [o.idleMs]  unload after this long without a request
 * @param {(s: { state: string, progress: number, error: string, gpu: boolean }) => void} [o.onState]
 * @param {(busy: boolean, info: { gpu: boolean }) => void} [o.onBusy]  while it generates (the page gives Stockfish fewer threads)
 * @param {(f: () => void, ms: number) => any} [o.setTimer]
 * @param {(t: any) => void} [o.clearTimer]
 */
export function createBrowserModel({ createRuntime, model, cores = 4, deviceMemoryGB = 0, storageFree = async () => undefined, fetchBlob = fetchAsBlob, idleMs = 10 * 60_000, onState = () => {}, onBusy = () => {}, setTimer = idleTimer, clearTimer = clearTimeout }) {
  const st = { state: 'off', progress: 0, error: '', gpu: false };
  let rt = null, loading = null, idle = null;
  /** @type {Promise<any>} */ let queue = Promise.resolve();
  const set = patch => { Object.assign(st, patch); onState({ ...st }); };
  const keepAlive = () => { if (idle) clearTimer(idle); idle = setTimer(() => { unload(); }, idleMs); };

  async function load() {
    if (st.state === 'ready') return;
    if (loading) return loading;
    const mem = memoryCheck({ bytes: model.bytes, deviceMemoryGB });
    if (!mem.ok) { set({ state: 'error', error: mem.reason }); throw { code: 'browser_model', message: mem.reason }; }
    set({ state: 'loading', progress: 0, error: '' });
    loading = (async () => {
      try {
        rt = await createRuntime();
        const gpu = !!rt.isSupportWebGPU?.();
        const opts = { n_ctx: 4096, ...(gpu ? {} : { n_threads: cpuThreads(cores) }) };
        // wllama keeps the weights in the browser's storage (OPFS), so the next load is quick. Where
        // that's too small (private windows, a full disk) the page fetches them itself and hands them
        // over in memory; they come from this server again next time.
        const inMemory = async () => rt.loadModel([await fetchBlob(model.url, p => set({ progress: p }))], opts);
        const free = await storageFree().catch(() => undefined);
        if (free !== undefined && free < model.bytes * 1.1) await inMemory();
        else {
          try { await rt.loadModelFromUrl(model.url, { ...opts, progressCallback: ({ loaded, total }) => set({ progress: total ? loaded / total : 0 }) }); } catch (e) {
            if (!/quota/i.test(String(e?.message || e))) throw e;
            set({ progress: 0 });
            await inMemory();
          }
        }
        set({ state: 'ready', progress: 1, gpu });
        keepAlive();
      } catch (e) {
        rt = null;
        const message = `The in-browser model didn't load: ${e?.message || e}`;
        set({ state: 'error', error: message });
        throw { code: 'browser_model', message };
      } finally { loading = null; }
    })();
    return loading;
  }

  async function unload() {
    if (idle) { clearTimer(idle); idle = null; }
    const r = rt; rt = null;
    if (st.state !== 'error') set({ state: 'off', progress: 0 });
    try { await r?.exit(); } catch { /* already gone */ }
  }

  // input: a string or [{role, content}]. opts: {signal, onText, maxTokens, schema: {name, schema}}.
  // Resolves {text, truncated}; rejects {code: 'cancelled', text} or {code: 'browser_model', message}.
  function sample(input, /** @type {{ signal?: AbortSignal, onText?: (t: { text: string }) => void, maxTokens?: number, schema?: { name: string, schema: object } }} */ { signal, onText, maxTokens = 700, schema } = {}) {
    const run = async () => {
      if (signal?.aborted) throw { code: 'cancelled', text: '' };
      await load();
      if (signal?.aborted) throw { code: 'cancelled', text: '' };
      let text = '', truncated = false;
      onBusy(true, { gpu: st.gpu });
      try {
        const stream = await rt.createChatCompletion({
          messages: mergeTurns(input), stream: true, max_tokens: maxTokens, temperature: 0.3, abortSignal: signal,
          ...(schema ? { response_format: { type: 'json_schema', json_schema: { name: schema.name, schema: schema.schema, strict: true } } } : {}),
        });
        for await (const chunk of stream) {
          const c = chunk?.choices?.[0];
          if (c?.delta?.content) { text += c.delta.content; onText?.({ text }); }
          if (c?.finish_reason === 'length') truncated = true;
        }
      } catch (e) {
        if (signal?.aborted) throw { code: 'cancelled', text };
        throw { code: 'browser_model', message: `The in-browser model failed: ${e?.message || e}`, text };
      } finally { onBusy(false, { gpu: st.gpu }); keepAlive(); }
      if (signal?.aborted) throw { code: 'cancelled', text };
      return { text, truncated };
    };
    // One request at a time: the model has one context.
    const p = queue.then(run, run);
    queue = p.catch(() => {});
    return p;
  }

  return { load, unload, sample, get status() { return { ...st }; } };
}
