import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine, stockfishAttempts } from '../../src/engine.js';

// Speaks just enough UCI: answers the handshake, and answers `go` with one info line and a bestmove.
class FakeWorker {
  constructor({ silent = false, best = 'e2e4', autoAnswer = true } = {}) {
    Object.assign(this, { silent, best, autoAnswer, sent: [], terminated: false, onmessage: null, onerror: null });
  }
  emit(line) { queueMicrotask(() => this.onmessage?.({ data: line })); }
  postMessage(cmd) {
    this.sent.push(cmd);
    if (this.silent) return;
    if (cmd === 'uci') { this.emit('id name Fakefish'); this.emit('uciok'); }
    if (cmd.startsWith('go') && this.autoAnswer) this.answer();
    if (cmd === 'stop') this.emit(`bestmove ${this.best}`);
  }
  answer() { this.emit('info depth 5 multipv 1 score cp 31 pv e2e4 e7e5'); this.emit(`bestmove ${this.best}`); }
  crash() { this.onerror?.({ message: 'boom', preventDefault() {} }); }
  terminate() { this.terminated = true; }
}
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const withTimeout = (p, ms = 500) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`still pending after ${ms} ms`)), ms))]);

test('handshake, then a search resolves with the best move and lines', async () => {
  const w = new FakeWorker();
  const e = new Engine([['WASM', () => w]]);
  const res = await e.go(START, { depth: 5 });
  assert.equal(e.name, 'Fakefish');
  assert.equal(e.flavor, 'WASM');
  assert.equal(res.best, 'e2e4');
  assert.equal(res.lines[0].score.cp, 31);
  assert.ok(w.sent.includes(`position fen ${START}`));
  assert.ok(w.sent.includes('go depth 5'));
});

test('jobs run one at a time, in order', async () => {
  const w = new FakeWorker();
  const e = new Engine([['WASM', () => w]]);
  const [a, b] = await Promise.all([e.go(START, { depth: 3 }), e.go(START, { movetime: 100 })]);
  assert.equal(a.best, 'e2e4'); assert.equal(b.best, 'e2e4');
  const gos = w.sent.filter(c => c.startsWith('go'));
  assert.deepEqual(gos, ['go depth 3', 'go movetime 100']);
});

test('cancel(tag) resolves queued and running jobs with null and leaves other tags alone', async () => {
  const w = new FakeWorker({ autoAnswer: false });
  const e = new Engine([['WASM', () => w]]);
  await e.ready;
  const running = e.go(START, { tag: 'live' });
  const queuedLive = e.go(START, { tag: 'live' });
  const queuedMove = e.go(START, { tag: 'move' });
  await new Promise(r => setTimeout(r, 0));
  e.cancel('live');
  assert.equal(await running, null);
  assert.equal(await queuedLive, null);
  w.answer();
  assert.equal((await withTimeout(queuedMove)).best, 'e2e4');
});

test('falls back to the next way to start when one fails', async () => {
  const good = new FakeWorker();
  const e = new Engine([['WASM', () => { throw new Error('blocked'); }], ['ASM.js', () => good]]);
  await e.ready;
  assert.equal(e.flavor, 'ASM.js');
});

test('a silent worker times out and the next one is tried', async () => {
  const silent = new FakeWorker({ silent: true });
  const e = new Engine([['WASM', () => silent], ['ASM.js', () => new FakeWorker()]], { handshakeMs: 20 });
  await e.ready;
  assert.equal(silent.terminated, true);
  assert.equal(e.flavor, 'ASM.js');
});

test('if the engine never starts, waiting jobs reject instead of hanging, and onFail runs once', async () => {
  let failures = 0;
  const e = new Engine([['WASM', () => { throw new Error('no wasm'); }]], { onFail: () => failures++ });
  const job = e.go(START, { depth: 5 }); // queued before boot has failed
  await assert.rejects(withTimeout(job), /could not start/);
  await assert.rejects(withTimeout(e.go(START)), /could not start/);
  assert.equal(failures, 1);
});

test('a crash mid-search rejects the running and queued jobs, and later jobs fail fast', async () => {
  const w = new FakeWorker({ autoAnswer: false });
  let failed = null;
  const e = new Engine([['WASM', () => w]], { onFail: err => { failed = err; } });
  await e.ready;
  const running = e.go(START, { tag: 'move' });
  const queued = e.go(START, { tag: 'live' });
  await new Promise(r => setTimeout(r, 0));
  w.crash();
  await assert.rejects(withTimeout(running), /stopped unexpectedly/);
  await assert.rejects(withTimeout(queued), /stopped unexpectedly/);
  await assert.rejects(withTimeout(e.go(START)), /stopped unexpectedly/);
  assert.match(failed.message, /stopped unexpectedly/);
  assert.equal(w.terminated, true);
});

test('cross-origin isolated: the multi-threaded build comes first and gets its threads', async () => {
  const made = [];
  globalThis.Worker = class { constructor(url) { made.push(url); } };
  try {
    const base = 'http://127.0.0.1/app/';
    const iso = stockfishAttempts(base, { threads: 3, isolated: true });
    assert.deepEqual(iso.map(a => a[2] || 1), [3, 1, 1, 1]);
    iso[0][1](); iso[1][1]();
    assert.deepEqual(made, [base + 'sf-mt.js', base + 'sf.js']);
    assert.equal(stockfishAttempts(base, { threads: 3, isolated: false }).length, 3, 'no multi-threaded attempt without isolation');
  } finally { delete globalThis.Worker; }

  const w = new FakeWorker();
  const e = new Engine([['WASM', () => w, 3]]);
  await e.ready;
  assert.equal(e.threads, 3);
  assert.ok(w.sent.includes('setoption name Threads value 3'));
});

test('if the multi-threaded build fails, the single-threaded one takes over with one thread', async () => {
  const single = new FakeWorker();
  const e = new Engine([['WASM', () => { throw new Error('no SharedArrayBuffer'); }, 4], ['WASM', () => single]]);
  await e.ready;
  assert.equal(e.threads, 1);
  assert.ok(!single.sent.some(c => c.startsWith('setoption name Threads')));
});

test('a depth search can be capped in time', async () => {
  const w = new FakeWorker();
  const e = new Engine([['WASM', () => w]]);
  await e.go(START, { depth: 16, maxMs: 5000 });
  await e.go(START, { movetime: 300, maxMs: 5000 });
  assert.deepEqual(w.sent.filter(c => c.startsWith('go')), ['go depth 16 movetime 5000', 'go movetime 300']);
});
