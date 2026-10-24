import { test } from 'node:test';
import assert from 'node:assert/strict';
import { providerOperation, PROVIDER_LIMITS } from './provider-limits.mjs';
import { complete, createEmbedder, createProvider, loadConfig, loadEmbeddingConfig, toGatewayError } from './ai.mjs';

test('raw byte caps include non-text/error data, preserve status/headers and cancel overflow', async () => {
  for (const status of [200, 400]) {
    let cancelled = false;
    const stream = new ReadableStream({ start(c) { c.enqueue(Buffer.from('😀😀')); c.enqueue(Buffer.from('x'.repeat(9))); }, cancel() { cancelled = true; } });
    const op = providerOperation(1000, undefined, { maxBytes: 16, fetcher: async () => new Response(stream, { status, headers: { 'content-type': 'application/json', 'x-fixture': 'preserved' } }) });
    try {
      const response = await op.fetch('https://fixture.invalid'); assert.equal(response.status, status); assert.equal(response.headers.get('x-fixture'), 'preserved');
      await assert.rejects(response.text(), { code: 'response_too_large' }); assert.equal(cancelled, true);
    } finally { op.close(); }
  }
});

test('one deadline stops stalled headers, body reads and SDK parsing, including ignored signals', async () => {
  for (const phase of ['headers', 'body', 'parsing']) {
    let cancelled = false;
    const stream = new ReadableStream({ start(c) { c.enqueue(Buffer.from('partial')); }, cancel() { cancelled = true; } });
    const op = providerOperation(35, undefined, { fetcher: phase === 'headers' ? async () => new Promise(() => {}) : async () => new Response(stream) });
    try {
      const started = Date.now();
      const work = phase === 'parsing' ? op.wait(() => new Promise(() => {})) : op.fetch('https://fixture.invalid').then(r => r.text());
      await assert.rejects(work, { code: 'timeout' }); assert.ok(Date.now() - started < 2000);
      if (phase === 'body') assert.equal(cancelled, true);
    } finally { op.close(); }
  }
});

test('caller cancellation prevents work, reaches active readers and discards late header responses', async () => {
  const before = new AbortController(); before.abort(); let calls = 0;
  const pre = providerOperation(1000, before.signal, { fetcher: async () => { calls++; return new Response('unused'); } });
  try { await assert.rejects(pre.fetch('https://fixture.invalid'), { code: 'cancelled' }); assert.equal(calls, 0); } finally { pre.close(); }
  const ctl = new AbortController(); let release, cancelled = false;
  const op = providerOperation(1000, ctl.signal, { fetcher: async () => new Promise(resolve => { release = resolve; }) });
  const pending = op.fetch('https://fixture.invalid'); await Promise.resolve(); ctl.abort();
  await assert.rejects(pending, { code: 'cancelled' });
  release(new Response(new ReadableStream({ cancel() { cancelled = true; } })));
  await new Promise(resolve => setImmediate(resolve)); assert.equal(cancelled, true); op.close();
  const active = new AbortController(); let bodyCancelled = false;
  const bodyOp = providerOperation(1000, active.signal, { fetcher: async () => new Response(new ReadableStream({ cancel() { bodyCancelled = true; } })) });
  try {
    const response = await bodyOp.fetch('https://fixture.invalid'), reading = response.text(); active.abort();
    await assert.rejects(reading, { code: 'cancelled' }); assert.equal(bodyCancelled, true);
  } finally { bodyOp.close(); }
});

test('separate operations have independent counters, signal lifetime and timeout normalization', async () => {
  const a = providerOperation(Infinity, undefined, { maxBytes: 4 }), b = providerOperation(2 ** 40, undefined, { maxBytes: 4 });
  try {
    assert.equal(a.timeoutMs, 60_000); assert.equal(b.timeoutMs, PROVIDER_LIMITS.timeoutMs);
    a.count('😀'); assert.throws(() => a.count('x'), { code: 'response_too_large' });
    assert.equal(b.signal.aborted, false); b.count('safe'); assert.equal(await b.wait(() => 'ok'), 'ok');
  } finally { a.close(); b.close(); }
  for (const maxBytes of [0, NaN, Infinity, 1.5, PROVIDER_LIMITS.bytes + 1]) assert.throws(() => providerOperation(100, undefined, { maxBytes }), RangeError);
  for (const maxDecodedBytes of [0, NaN, 1.5, 17]) assert.throws(() => providerOperation(100, undefined, { maxBytes: 16, maxDecodedBytes }), RangeError);
});

test('clean EOF, empty bodies, stream faults and explicit close clean up without new work', async () => {
  for (const status of [200, 204]) {
    const op = providerOperation(1000, undefined, { fetcher: async () => new Response(status === 204 ? null : 'ok', { status }) });
    try { const response = await op.fetch('https://fixture.invalid'); assert.equal(await response.text(), status === 204 ? '' : 'ok'); }
    finally { op.close(); }
    await assert.rejects(op.wait(() => assert.fail('Must not run after close')), { code: 'cancelled' });
  }
  let cancel = false;
  const op = providerOperation(1000, undefined, { fetcher: async () => new Response(new ReadableStream({ cancel() { cancel = true; } })) });
  const response = await op.fetch('https://fixture.invalid'); await response.body.cancel(); op.close(); assert.equal(cancel, true);
  const broken = providerOperation(1000, undefined, { fetcher: async () => new Response(new ReadableStream({ start(c) { c.error(Error('synthetic read fault')); } })) });
  try { const response = await broken.fetch('https://fixture.invalid'); await assert.rejects(response.text(), /synthetic read fault/); }
  finally { broken.close(); }
});

test('a parsing callback that blocks timer delivery still cannot apply a result past the deadline', async () => {
  const op = providerOperation(10);
  try {
    await assert.rejects(op.wait(() => { const until = performance.now() + 20; while (performance.now() < until) { /* bounded synthetic synchronous work */ } return 'late'; }), { code: 'timeout' });
  } finally { op.close(); }
});

for (const name of ['anthropic', 'openai']) test(`${name}: a stalled injected SDK iterator is bounded and aborted independently`, async () => {
  let signal;
  const stream = { async *[Symbol.asyncIterator]() { yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'partial' } }; await new Promise(() => {}); }, finalMessage: async () => ({ stop_reason: 'end_turn' }) };
  const client = name === 'anthropic' ? { beta: { messages: { stream(params, opts) { signal = opts.signal; return stream; } } } } :
    { chat: { completions: { async create(params, opts) { signal = opts.signal; return (async function* () { yield { choices: [{ delta: { content: 'partial' } }] }; await new Promise(() => {}); })(); } } } };
  const cfg = loadConfig({ AI_PROVIDER: name, [`${name.toUpperCase()}_API_KEY`]: 'synthetic-key', AI_TIMEOUT_MS: '40' });
  await assert.rejects(complete(createProvider(cfg, { client }), [{ role: 'user', content: 'question' }]), error => { const mapped = toGatewayError(error); assert.equal(mapped.code, 'timeout'); assert.equal(mapped.status, 504); return true; });
  assert.equal(signal.aborted, true);
});

test('decoded text/tool metadata and embedding JSON remain bounded for injected clients', async () => {
  const oversized = 'x'.repeat(PROVIDER_LIMITS.bytes + 1);
  const cfg = loadConfig({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'synthetic-key' });
  for (const metadata of [false, true]) {
    const client = { chat: { completions: { async create() { return (async function* () {
      yield { choices: [{ delta: metadata ? { tool_calls: [{ index: 0, id: 'call', function: { name: oversized, arguments: '{}' } }] } : { content: oversized }, finish_reason: metadata ? 'tool_calls' : 'stop' }] };
    })(); } } } };
    await assert.rejects(complete(createProvider(cfg, { client }), [{ role: 'user', content: 'question' }]), { code: 'response_too_large' });
  }
  const embed = createEmbedder(loadEmbeddingConfig({ EMBEDDING_PROVIDER: 'openai', OPENAI_API_KEY: 'synthetic-key' }), { client: { post: async () => ({ private: oversized }) } });
  await assert.rejects(embed.embed(['note']), { code: 'response_too_large' });
});

test('embedding SDK and Ollama metadata inspection share an independent total deadline', async () => {
  for (const provider of ['openai', 'ollama']) {
    let signal;
    const cfg = loadEmbeddingConfig({ EMBEDDING_PROVIDER: provider, OPENAI_API_KEY: 'synthetic-key', EMBEDDING_MODEL: 'fixture', AI_TIMEOUT_MS: '35' });
    const embed = createEmbedder(cfg, { client: { async post(p, opts) { signal = opts.signal; return new Promise(() => {}); } },
      inspectModel: async (model, supplied) => { signal = supplied; return new Promise(() => {}); } });
    await assert.rejects(embed.embed(['note']), { code: 'timeout' }); assert.equal(signal.aborted, true);
  }
});
