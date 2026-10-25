import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { downloadModel } from '../../scripts/download-model.mjs';
const bytes = Buffer.from('small pinned model'), digest = data => createHash('sha256').update(data).digest('hex');
const model = { file: 'fixture.gguf', bytes: bytes.length, sha256: digest(bytes), source: 'https://model.example.invalid/fixture.gguf' };
const directory = () => fs.mkdtemp(path.join(os.tmpdir(), 'kibitz-bounded-unit-'));
const response = body => async () => new Response(body);
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test('invalid size/hash/path/deadline is refused before creating a directory or fetching', async () => {
  const dir = await directory(), absent = path.join(dir, 'absent'); let calls = 0;
  const fetcher = async () => { calls++; return new Response(bytes); };
  try {
    for (const patch of [{ bytes: 0 }, { bytes: 1.5 }, { sha256: 'bad' }, { file: '../escape.gguf' }, { file: '.hidden.gguf' }]) {
      await assert.rejects(downloadModel(absent, { ...model, ...patch }, { fetcher }), /Invalid pinned/);
    }
    for (const timeoutMs of [0, NaN, Infinity, 1.5, 2 ** 31]) await assert.rejects(downloadModel(absent, model, { fetcher, timeoutMs }), /timeout/);
    assert.equal(calls, 0); await assert.rejects(fs.access(absent), /ENOENT/);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('a partial transfer cannot replace previous weights/marker; verified completion publishes exact bytes', async () => {
  const dir = await directory(), file = path.join(dir, model.file), old = Buffer.from('previous verified version');
  const progress = deferred(); let finish, released = false;
  await fs.writeFile(file, old); await fs.writeFile(file + '.sha256', digest(old) + '\n');
  const stream = new ReadableStream({ start(controller) {
    controller.enqueue(bytes.subarray(0, 3)); finish = () => { if (released) return; released = true; controller.enqueue(bytes.subarray(3)); controller.close(); };
  } });
  const running = downloadModel(dir, model, { fetcher: response(stream), onProgress: () => progress.resolve() });
  try {
    await progress.promise;
    assert.deepEqual(await fs.readFile(file), old); assert.equal((await fs.readFile(file + '.sha256', 'utf8')).trim(), digest(old));
    assert.ok((await fs.readdir(dir)).some(name => name.startsWith(model.file + '.part-')));
    finish(); await running;
    assert.deepEqual(await fs.readFile(file), bytes); assert.equal((await fs.readFile(file + '.sha256', 'utf8')).trim(), model.sha256);
    assert.deepEqual((await fs.readdir(dir)).sort(), [model.file, model.file + '.sha256'].sort());
  } finally { finish?.(); await running.catch(() => {}); await fs.rm(dir, { recursive: true, force: true }); }
});

test('oversize, wrong hash, truncation, HTTP and transport errors preserve previous files and remove partials', async () => {
  const old = Buffer.from('previous verified version');
  const scenarios = [
    { fetcher: response(Buffer.concat([bytes, Buffer.from('extra')])), error: /exceeds/ },
    { fetcher: response(Buffer.alloc(bytes.length, 120)), error: /SHA-256/ },
    { fetcher: response(bytes.subarray(1)), error: /size/ },
    { fetcher: async () => new Response('unavailable', { status: 503 }), error: /HTTP 503/ },
    { fetcher: async () => new Response(null, { status: 204 }), error: /missing response body/ },
    { fetcher: async () => { throw Error('synthetic transport failure'); }, error: /transport failure/ },
  ];
  for (const scenario of scenarios) {
    const dir = await directory(), file = path.join(dir, model.file);
    try {
      await fs.writeFile(file, old); await fs.writeFile(file + '.sha256', digest(old) + '\n');
      await assert.rejects(downloadModel(dir, model, { fetcher: scenario.fetcher }), scenario.error);
      assert.deepEqual(await fs.readFile(file), old); assert.equal((await fs.readFile(file + '.sha256', 'utf8')).trim(), digest(old));
      assert.deepEqual((await fs.readdir(dir)).sort(), [model.file, model.file + '.sha256'].sort());
    } finally { await fs.rm(dir, { recursive: true, force: true }); }
  }
});

test('one total deadline bounds stalled headers or a stalled response body', async () => {
  const waiting = async (url, { signal }) => await new Promise((resolve, reject) => {
    signal.throwIfAborted(); signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
  for (const fetcher of [waiting, response(new ReadableStream())]) {
    const dir = await directory();
    try { await assert.rejects(downloadModel(dir, model, { fetcher, timeoutMs: 30 }), /timed out/); assert.deepEqual(await fs.readdir(dir), []); }
    finally { await fs.rm(dir, { recursive: true, force: true }); }
  }
});

test('caller cancellation stops the response and removes partial output', async () => {
  const dir = await directory(), controller = new AbortController(), progress = deferred(); let cancelled = false;
  const stream = new ReadableStream({ start(c) { c.enqueue(bytes.subarray(0, 3)); }, cancel() { cancelled = true; } });
  const running = downloadModel(dir, model, { fetcher: response(stream), signal: controller.signal, onProgress: () => progress.resolve() });
  try {
    await progress.promise; controller.abort(Error('synthetic cancellation'));
    await assert.rejects(running, /synthetic cancellation/); assert.equal(cancelled, true); assert.deepEqual(await fs.readdir(dir), []);
  } finally { controller.abort(); await running.catch(() => {}); await fs.rm(dir, { recursive: true, force: true }); }
});

test('an already cancelled request creates no output directory and sends no fetch', async () => {
  const dir = await directory(), absent = path.join(dir, 'absent'), controller = new AbortController(); let calls = 0;
  controller.abort(Error('cancelled before start'));
  try {
    await assert.rejects(downloadModel(absent, model, { signal: controller.signal, fetcher: async () => { calls++; return new Response(bytes); } }), /cancelled before start/);
    assert.equal(calls, 0); await assert.rejects(fs.access(absent), /ENOENT/);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('concurrent verified downloads use independent temporary files and leave a valid final pair', async () => {
  const dir = await directory();
  try {
    await Promise.all([downloadModel(dir, model, { fetcher: response(bytes) }), downloadModel(dir, model, { fetcher: response(bytes) })]);
    assert.deepEqual(await fs.readFile(path.join(dir, model.file)), bytes);
    assert.equal((await fs.readFile(path.join(dir, model.file + '.sha256'), 'utf8')).trim(), model.sha256);
    assert.deepEqual((await fs.readdir(dir)).sort(), [model.file, model.file + '.sha256'].sort());
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('publication failure removes temporary files; a successful marker never follows a prior symlink', async () => {
  const dir = await directory(), file = path.join(dir, model.file), target = path.join(dir, 'operator-file');
  try {
    await fs.mkdir(file); await assert.rejects(downloadModel(dir, model, { fetcher: response(bytes) }));
    assert.deepEqual(await fs.readdir(dir), [model.file]); await fs.rmdir(file);
    await fs.writeFile(target, 'preserve operator file'); await fs.symlink(target, file + '.sha256');
    await downloadModel(dir, model, { fetcher: response(bytes) });
    assert.equal(await fs.readFile(target, 'utf8'), 'preserve operator file'); assert.equal((await fs.lstat(file + '.sha256')).isSymbolicLink(), false);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});


test('plaintext and URL credentials fail before filesystem creation; insecure redirects cannot publish weights', async () => {
  const dir = await directory(), absent = path.join(dir, 'absent'); let calls = 0;
  try {
    for (const source of ['http://127.0.0.1/fixture.gguf', 'https://user:PRIVATE_SENTINEL@localhost/model']) {
      await assert.rejects(downloadModel(absent, { ...model, source }, { fetcher: async () => { calls++; return new Response(bytes); } }), /HTTPS transport policy/);
    }
    assert.equal(calls, 0); await assert.rejects(fs.access(absent), /ENOENT/);
    await assert.rejects(downloadModel(dir, model, { fetcher: async () => { calls++; return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/leak?PRIVATE_SENTINEL' } }); } }), error => !error.message.includes('PRIVATE_SENTINEL'));
    assert.equal(calls, 1); assert.deepEqual(await fs.readdir(dir), []);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
