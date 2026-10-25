import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createChromeModel, chromeLanguageModel, CHROME_LIMITS } from '../../src/coach/chrome-llm.js';

const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
function timers() {
  const pending = new Map(); let next = 0;
  return { pending, set(fn, ms) { const id = ++next; pending.set(id, { fn, ms }); return id; }, clear: id => pending.delete(id),
    fire(ms) { for (const [id, task] of [...pending]) if (task.ms === ms) { pending.delete(id); task.fn(); } } };
}

function fakeChrome({ words = ['Develop ', 'a piece.'], availability = 'available', contextWindow = 5000 } = {}) {
  const calls = { creates: [], probes: [], clones: [], prompts: [], measured: [], sessions: [], monitors: [] };
  function session(base = false) {
    const s = Object.assign(new EventTarget(), { base, destroyed: 0, contextWindow,
      clone(opts) { calls.clones.push(opts); return Promise.resolve(session()); },
      measureContextUsage(messages, opts) { calls.measured.push({ messages, opts }); return Promise.resolve(100); },
      promptStreaming(messages, opts) {
        assert.equal(base, false, 'the empty base must never receive application text');
        calls.prompts.push({ session: s, messages, opts });
        let index = 0;
        return new ReadableStream({ pull(controller) {
          if (index === words.length) controller.close(); else controller.enqueue(words[index++]);
        } });
      },
      destroy() { s.destroyed++; },
    });
    calls.sessions.push(s); return s;
  }
  const api = {
    availability(opts) { calls.probes.push(opts); return Promise.resolve(availability); },
    create(opts) {
      calls.creates.push(opts); const monitor = new EventTarget(); calls.monitors.push(monitor); opts.monitor?.(monitor);
      return Promise.resolve(session(true));
    },
  };
  return { api, calls, session };
}
function setup(options = {}, modelOptions = {}) {
  const fake = fakeChrome(options), t = timers(), states = [], busy = [];
  const m = createChromeModel({ api: fake.api, activated: () => true, setTimer: t.set, clearTimer: t.clear,
    onState: s => states.push(s), onBusy: value => busy.push(value), ...modelOptions });
  return { ...fake, m, t, states, busy };
}

test('only the Chrome implementation is selected; API absence/unavailability never creates or downloads', async () => {
  const api = {};
  assert.equal(chromeLanguageModel({ navigator: { userAgentData: { brands: [{ brand: 'Google Chrome' }] } }, LanguageModel: api }), api);
  for (const brand of ['Chromium', 'Microsoft Edge']) assert.equal(chromeLanguageModel({ navigator: { userAgentData: { brands: [{ brand }] } }, LanguageModel: api }), null);
  assert.equal(chromeLanguageModel({ navigator: { userAgent: 'Chrome/148' }, LanguageModel: api }), api);
  assert.equal(chromeLanguageModel({ navigator: { userAgent: 'Chrome/148 Edg/148' }, LanguageModel: api }), null);
  const missing = createChromeModel({ api: null, activated: () => true });
  await assert.rejects(missing.load(), e => e.code === 'browser_model' && /unavailable/.test(e.message));
  assert.equal(missing.status.state, 'error');
  for (const availability of ['unavailable', 'future-value']) {
    const { m, calls } = setup({ availability }); await m.checked;
    assert.equal(calls.creates.length, 0); await assert.rejects(m.load(), { code: 'browser_model' });
  }
});

test('Load needs activation, calls create synchronously, uses matching language options and reports progress', async () => {
  let active = false;
  const { m, calls } = setup({ availability: 'downloadable' }, { activated: () => active });
  await m.checked; await assert.rejects(m.sample('q'), { code: 'needs_consent' });
  await assert.rejects(m.load(), { code: 'needs_consent' }); assert.equal(calls.creates.length, 0);
  active = true; const loading = m.load(); active = false;
  assert.equal(calls.creates.length, 1, 'create ran within the click, before awaiting');
  const progress = new Event('downloadprogress'); progress.loaded = 0.5; calls.monitors[0].dispatchEvent(progress);
  assert.equal(m.status.progress, 0.5); await loading;
  assert.equal(m.status.state, 'ready');
  assert.deepEqual(calls.creates[0].expectedInputs, calls.probes[0].expectedInputs);
  assert.deepEqual(calls.creates[0].expectedOutputs, calls.probes[0].expectedOutputs);
  await m.load(); assert.equal(calls.creates.length, 1);
});

test('stream deltas accumulate; every request uses a fresh clone and destroys its private history', async () => {
  const { m, calls, busy } = setup(); await m.load(); const chunks = [];
  const first = await m.sample([{ role: 'user', content: 'rules' }, { role: 'user', content: 'private question' }], { onText: r => chunks.push(r.text) });
  assert.deepEqual(first, { text: 'Develop a piece.', truncated: false });
  assert.deepEqual(chunks, ['Develop ', 'Develop a piece.']);
  await m.sample('unrelated question');
  assert.deepEqual(calls.prompts[0].messages, [{ role: 'user', content: 'rules\n\nprivate question' }]);
  assert.deepEqual(calls.prompts[1].messages, [{ role: 'user', content: 'unrelated question' }]);
  assert.notEqual(calls.prompts[0].session, calls.prompts[1].session);
  assert.equal(calls.sessions[0].destroyed, 0);
  assert.ok(calls.sessions.slice(1).every(s => s.destroyed === 1)); assert.deepEqual(busy, [true, false, true, false]);
  m.unload(); assert.equal(calls.sessions[0].destroyed, 1);
});

test('Unloading during load rejects immediately, destroys late sessions and cannot overwrite a replacement', async () => {
  const { m, api, session } = setup(), held = deferred(); const create = api.create;
  api.create = () => held.promise;
  const loading = m.load(); const rejected = assert.rejects(loading, { code: 'cancelled' });
  m.unload(); await rejected; assert.equal(m.status.state, 'off');
  api.create = create; await m.load(); const late = session(true); held.resolve(late); await tick();
  assert.equal(late.destroyed, 1); assert.equal(m.status.state, 'ready');
});

test('load deadline covers a hanging create; late completion is destroyed and retry is explicit', async () => {
  const { m, api, t, session } = setup(), held = deferred(); const create = api.create;
  api.create = () => held.promise;
  const result = m.load(), rejected = assert.rejects(result, e => e.code === 'browser_model' && /timed out/.test(e.message));
  t.fire(CHROME_LIMITS.loadMs); await rejected; assert.equal(m.status.state, 'error');
  const late = session(true); held.resolve(late); await tick(); assert.equal(late.destroyed, 1);
  api.create = create; await m.load(); assert.equal(m.status.state, 'ready');
});

test('synchronous and asynchronous create failures leave explicit retries usable', async () => {
  const { m, api } = setup(); const create = api.create;
  for (const asynchronous of [false, true]) {
    api.create = () => { if (asynchronous) return Promise.reject(new Error('private runtime detail')); throw new Error('private runtime detail'); };
    await assert.rejects(m.load(), e => e.code === 'browser_model' && !e.message.includes('private runtime detail'));
    api.create = create; await m.load(); assert.equal(m.status.state, 'ready'); m.unload();
  }
});

test('output is bounded by characters; oversized input and context are refused before prompting; schema reaches both checks', async () => {
  const { m, calls } = setup({ words: ['abcdef', 'later'] }, { limits: { ...CHROME_LIMITS, input: 10, output: 5 } }); await m.load();
  await assert.rejects(m.sample('x'.repeat(11)), e => e.code === 'browser_model' && /too large/.test(e.message));
  await assert.rejects(m.sample([{ role: 'user', content: '12345' }, { role: 'user', content: '67890' }]), { code: 'browser_model' });
  assert.equal(calls.clones.length, 0);
  const schema = { name: 'result', schema: { type: 'object' } };
  assert.deepEqual(await m.sample('q', { schema }), { text: 'abcde', truncated: true });
  assert.deepEqual(calls.measured[0].opts.responseConstraint, schema.schema);
  assert.deepEqual(calls.prompts[0].opts.responseConstraint, schema.schema);
  const small = setup({ contextWindow: 50 }); await small.m.load();
  await assert.rejects(small.m.sample('q'), e => /too large/.test(e.message)); assert.equal(small.calls.prompts.length, 0);
  small.calls.sessions[0].clone = async () => { const s = small.session(); s.measureContextUsage = async () => -1; return s; };
  await assert.rejects(small.m.sample('q'), e => /too large/.test(e.message)); assert.equal(small.calls.prompts.length, 0);
  await assert.rejects(m.sample([{ role: 'system', content: 'x' }]), { code: 'browser_model' });
});

test('cancelled streaming preserves only observed text, destroys the clone and leaves the empty base usable', async () => {
  const { m, calls } = setup({ words: ['one ', 'two'] }); await m.load(); const ac = new AbortController();
  await assert.rejects(m.sample('q', { signal: ac.signal, onText: () => ac.abort() }), e => e.code === 'cancelled' && e.text === 'one ');
  assert.equal(calls.sessions[1].destroyed, 1); assert.equal(calls.sessions[0].destroyed, 0);
  assert.equal((await m.sample('next')).text, 'one two');
  const aborted = new AbortController(); aborted.abort(); const clones = calls.clones.length;
  await assert.rejects(m.sample('never sent', { signal: aborted.signal }), { code: 'cancelled' }); assert.equal(calls.clones.length, clones);
});

test('a request deadline covers a hanging clone or reader; late clones are destroyed', async () => {
  const { m, calls, t, session } = setup(); await m.load(); const held = deferred();
  calls.sessions[0].clone = () => held.promise;
  const cloning = m.sample('q'), rejected = assert.rejects(cloning, e => /too long/.test(e.message)); await tick();
  t.fire(CHROME_LIMITS.requestMs); await rejected; const late = session(); held.resolve(late); await tick(); assert.equal(late.destroyed, 1);
  calls.sessions[0].clone = async () => { const s = session(); s.promptStreaming = () => new ReadableStream({}); return s; };
  const reading = m.sample('q'), stopped = assert.rejects(reading, e => /too long/.test(e.message)); await tick();
  t.fire(CHROME_LIMITS.requestMs); await stopped; assert.equal(calls.sessions.at(-1).destroyed, 1);
});

test('queued requests serialize; unload cancels active and queued work; idle unloading needs Load again', async () => {
  const { m, calls, t, session } = setup(); await m.load(); const held = deferred();
  calls.sessions[0].clone = () => held.promise;
  const first = m.sample('one'), second = m.sample('two');
  const failures = [assert.rejects(first, { code: 'cancelled' }), assert.rejects(second, { code: 'cancelled' })]; await tick();
  m.unload(); await Promise.all(failures); const late = session(); held.resolve(late); await tick(); assert.equal(late.destroyed, 1);
  assert.equal(calls.prompts.length, 0); await m.load(); await Promise.all([m.sample('one'), m.sample('two')]);
  assert.equal(calls.prompts.length, 2);
  assert.equal(t.pending.size, 1); t.fire(CHROME_LIMITS.idleMs); assert.equal(m.status.state, 'off');
  const creates = calls.creates.length; await assert.rejects(m.sample('q'), { code: 'needs_consent' }); assert.equal(calls.creates.length, creates);
});

test('context overflow and runtime exceptions never fall back or include the raw private error', async () => {
  const { m, calls, session } = setup(); await m.load();
  calls.sessions[0].clone = async () => { const s = session(); s.promptStreaming = () => { s.dispatchEvent(new Event('contextoverflow')); return new ReadableStream({}); }; return s; };
  await assert.rejects(m.sample('q'), e => e.code === 'browser_model' && /too large/.test(e.message));
  calls.sessions[0].clone = () => { throw new Error('private prompt reflected by runtime'); };
  await assert.rejects(m.sample('q'), e => e.code === 'browser_model' && !e.message.includes('private prompt'));
});
