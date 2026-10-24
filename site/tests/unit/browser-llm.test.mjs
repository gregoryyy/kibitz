import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserModel, cpuThreads, memoryCheck, mergeTurns } from '../../src/coach/browser-llm.js';

const MODEL = { url: 'models/m.gguf', name: 'Tiny', bytes: 1_000_000_000 };

// Speaks just enough of wllama's API: load with progress, a streamed chat completion, exit.
function fakeRuntime({ gpu = false, words = ['Develop ', 'your ', 'knights.'], finish = 'stop', failLoad = false } = {}) {
  const rt = {
    loads: [], requests: [], exited: 0,
    isSupportWebGPU: () => gpu,
    async loadModel(blobs, opts) { rt.loads.push({ blobs, opts }); if (failLoad) throw new Error('out of memory'); },
    async loadModelFromUrl(url, opts) {
      rt.loads.push({ url, opts });
      if (failLoad) throw new Error('out of memory');
      opts.progressCallback?.({ loaded: 50, total: 100 });
      opts.progressCallback?.({ loaded: 100, total: 100 });
    },
    async createChatCompletion(params) {
      rt.requests.push(params);
      return (async function* () {
        for (const w of words) {
          if (params.abortSignal?.aborted) throw new Error('aborted');
          await new Promise(r => setTimeout(r, 1));
          yield { choices: [{ delta: { content: w }, finish_reason: null }] };
        }
        yield { choices: [{ delta: {}, finish_reason: finish }] };
      })();
    },
    async exit() { rt.exited++; },
  };
  return rt;
}
// Timers the test controls.
function timers() {
  const t = { pending: new Map(), next: 1 };
  t.set = (f, ms) => { const id = t.next++; t.pending.set(id, { f, ms }); return id; };
  t.clear = id => t.pending.delete(id);
  t.fire = () => { const all = [...t.pending.values()]; t.pending.clear(); all.forEach(x => x.f()); };
  return t;
}

test('threads: half the cores for the model, at least one', () => {
  assert.equal(cpuThreads(8), 4);
  assert.equal(cpuThreads(3), 1);
  assert.equal(cpuThreads(1), 1);
  assert.equal(cpuThreads(undefined), 1);
});

test('memory check: about 1.5x the file within half the device memory; unknown memory is tried', () => {
  assert.equal(memoryCheck({ bytes: 1.1e9, deviceMemoryGB: 4 }).ok, true);
  const no = memoryCheck({ bytes: 1.2e9, deviceMemoryGB: 2 });
  assert.equal(no.ok, false); assert.match(no.reason, /needs about 1\.8 GB.*reports 2 GB/);
  assert.equal(memoryCheck({ bytes: 1.1e9, deviceMemoryGB: undefined }).ok, true);
});

test('turns: consecutive messages of one role are joined; a string becomes one user turn', () => {
  assert.deepEqual(mergeTurns('hi'), [{ role: 'user', content: 'hi' }]);
  assert.deepEqual(mergeTurns([{ role: 'user', content: 'rules' }, { role: 'user', content: 'q1' }, { role: 'assistant', content: 'a1' }, { role: 'user', content: 'q2' }]),
    [{ role: 'user', content: 'rules\n\nq1' }, { role: 'assistant', content: 'a1' }, { role: 'user', content: 'q2' }]);
});

test('loads once on first use, streams the answer, reports state and busy time; CPU gets half the cores', async () => {
  const rt = fakeRuntime(), states = [], busy = [], t = timers();
  const m = createBrowserModel({ createRuntime: async () => rt, model: MODEL, cores: 8, onState: s => states.push(s.state + ':' + s.progress), onBusy: (b, i) => busy.push([b, i.gpu]), setTimer: t.set, clearTimer: t.clear });
  const chunks = [];
  const r = await m.sample([{ role: 'user', content: 'rules' }, { role: 'user', content: 'Plan?' }], { onText: ({ text }) => chunks.push(text) });
  assert.deepEqual(r, { text: 'Develop your knights.', truncated: false });
  assert.deepEqual(chunks, ['Develop ', 'Develop your ', 'Develop your knights.']);
  assert.equal(rt.loads.length, 1);
  assert.equal(rt.loads[0].url, 'models/m.gguf');
  assert.equal(rt.loads[0].opts.n_threads, 4);
  assert.equal(rt.loads[0].opts.n_ctx, 4096);
  assert.deepEqual(rt.requests[0].messages, [{ role: 'user', content: 'rules\n\nPlan?' }]);
  assert.equal(rt.requests[0].stream, true);
  assert.deepEqual(states, ['loading:0', 'loading:0.5', 'loading:1', 'ready:1']);
  assert.deepEqual(busy, [[true, false], [false, false]]);
  await m.sample('again');
  assert.equal(rt.loads.length, 1, 'loaded once');
  assert.equal(m.status.state, 'ready');
});

test('on WebGPU the thread count is left to wllama', async () => {
  const rt = fakeRuntime({ gpu: true });
  const m = createBrowserModel({ createRuntime: async () => rt, model: MODEL, cores: 8 });
  await m.sample('x');
  assert.equal('n_threads' in rt.loads[0].opts, false);
  assert.equal(m.status.gpu, true);
});

test('a JSON schema becomes response_format; a cut-off answer is marked truncated', async () => {
  const rt = fakeRuntime({ finish: 'length' });
  const m = createBrowserModel({ createRuntime: async () => rt, model: MODEL });
  const r = await m.sample('x', { schema: { name: 'board_annotations', schema: { type: 'object' } } });
  assert.equal(r.truncated, true);
  assert.deepEqual(rt.requests[0].response_format, { type: 'json_schema', json_schema: { name: 'board_annotations', schema: { type: 'object' }, strict: true } });
});

test('cancelling rejects with code cancelled and the text so far', async () => {
  const rt = fakeRuntime({ words: ['a ', 'b ', 'c ', 'd '] });
  const m = createBrowserModel({ createRuntime: async () => rt, model: MODEL });
  const ctl = new AbortController();
  const p = m.sample('x', { signal: ctl.signal, onText: ({ text }) => { if (text === 'a b ') ctl.abort(); } });
  await assert.rejects(p, e => e.code === 'cancelled' && e.text === 'a b ');
  const pre = new AbortController(); pre.abort();
  await assert.rejects(m.sample('x', { signal: pre.signal }), { code: 'cancelled' });
});

test('requests run one at a time', async () => {
  const rt = fakeRuntime({ words: ['x'] });
  let running = 0, most = 0;
  const create = rt.createChatCompletion;
  rt.createChatCompletion = async p => { running++; most = Math.max(most, running); const s = await create(p); return (async function* () { try { yield* s; } finally { running--; } })(); };
  const m = createBrowserModel({ createRuntime: async () => rt, model: MODEL });
  await Promise.all([m.sample('1'), m.sample('2'), m.sample('3')]);
  assert.equal(most, 1);
  assert.equal(rt.requests.length, 3);
});

test('unloads after the idle time and loads again on the next request', async () => {
  const rt = fakeRuntime(), t = timers();
  const m = createBrowserModel({ createRuntime: async () => rt, model: MODEL, idleMs: 1000, setTimer: t.set, clearTimer: t.clear });
  await m.sample('x');
  assert.equal([...t.pending.values()][0].ms, 1000);
  t.fire();
  await new Promise(r => setTimeout(r, 0));
  assert.equal(rt.exited, 1);
  assert.equal(m.status.state, 'off');
  await m.sample('y');
  assert.equal(rt.loads.length, 2);
});

test('a failed load or too little memory reports why and can be retried', async () => {
  const bad = createBrowserModel({ createRuntime: async () => fakeRuntime({ failLoad: true }), model: MODEL });
  await assert.rejects(bad.sample('x'), e => e.code === 'browser_model' && /didn't load: out of memory/.test(e.message));
  assert.equal(bad.status.state, 'error');
  const small = createBrowserModel({ createRuntime: async () => fakeRuntime(), model: MODEL, deviceMemoryGB: 1 });
  await assert.rejects(small.sample('x'), e => e.code === 'browser_model' && /needs about/.test(e.message));
  let n = 0;
  const flaky = createBrowserModel({ createRuntime: async () => fakeRuntime({ failLoad: n++ === 0 }), model: MODEL });
  await assert.rejects(flaky.sample('x'));
  assert.equal((await flaky.sample('x')).text, 'Develop your knights.');
});

test('storage: cached when it fits; fetched into memory when it doesn\'t, or when caching hits the quota', async () => {
  const blob = { size: 3 };
  const fetches = [];
  const fetchBlob = async (url, onProgress) => { fetches.push(url); onProgress(0.5); return blob; };
  const fits = fakeRuntime();
  await createBrowserModel({ createRuntime: async () => fits, model: MODEL, storageFree: async () => 5e9, fetchBlob }).sample('x');
  assert.equal(fits.loads[0].url, 'models/m.gguf'); // through wllama's cache
  assert.equal(fetches.length, 0);
  const small = fakeRuntime();
  await createBrowserModel({ createRuntime: async () => small, model: MODEL, storageFree: async () => 5e8, fetchBlob }).sample('x');
  assert.deepEqual(small.loads.map(l => l.blobs), [[blob]]);
  assert.equal(small.loads[0].opts.n_ctx, 4096);
  const quota = fakeRuntime();
  quota.loadModelFromUrl = async (url, opts) => { quota.loads.push({ url, opts }); throw new Error('The operation failed because it would cause the application to exceed its storage quota.'); };
  const r = await createBrowserModel({ createRuntime: async () => quota, model: MODEL, fetchBlob }).sample('x');
  assert.equal(r.text, 'Develop your knights.');
  assert.deepEqual(quota.loads.map(l => l.url ? 'cache' : 'memory'), ['cache', 'memory']);
  assert.deepEqual(fetches, ['models/m.gguf', 'models/m.gguf']);
});
