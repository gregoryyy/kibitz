// Stockfish in a Web Worker: UCI handshake with fallbacks, a job queue, cancellation by tag.
// If the engine can't start or crashes, every waiting job is rejected (never left hanging)
// and later jobs fail immediately, so callers can reset their UI.
import { parseInfo } from './knowledge.js';

// Ways to start Stockfish, best first: the multi-threaded WASM build when the page is
// cross-origin isolated (SharedArrayBuffer needs it), the single-threaded WASM worker, the same
// script via a blob URL (for hosts that block worker URLs), then the slower pure-JS asm.js build.
// Each attempt is [flavor, make, threads].
export function stockfishAttempts(base = location.href, { threads = 1, isolated = globalThis.crossOriginIsolated === true && typeof SharedArrayBuffer === 'function' } = {}) {
  const wasm = new URL('sf.js', base).href, asm = new URL('sf-asm.js', base).href, mt = new URL('sf-mt.js', base).href;
  const blobWorker = (src, hash = '') => new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })) + hash);
  return [
    ...(isolated ? [['WASM', () => new Worker(mt), threads]] : []),
    ['WASM', () => new Worker(wasm)],
    ['WASM', async () => blobWorker(await (await fetch(wasm)).text(), '#' + encodeURIComponent(wasm.replace(/\.js$/, '.wasm')))],
    ['ASM.js', async () => { try { return new Worker(asm); } catch { return blobWorker(await (await fetch(asm)).text()); } }],
  ];
}

export class Engine {
  // attempts: [[flavor, () => Worker | Promise<Worker>]]; onFail(error) runs once if the engine dies.
  constructor(attempts, /** @type {{ handshakeMs?: number, onFail?: (err: Error) => void }} */ { handshakeMs = 12000, onFail = () => {} } = {}) {
    this.queue = []; this.cur = null; this.flavor = ''; this.name = ''; this.threads = 1; this.dead = null;
    this.handshakeMs = handshakeMs; this.onFail = onFail;
    this.ready = this.boot(attempts);
    this.ready.catch(e => this.fail(e));
  }
  async boot(attempts) {
    for (const [flavor, make, threads = 1] of attempts) {
      try {
        this.w = await this.handshake(await make()); this.flavor = flavor; this.threads = threads; this.applied = threads;
        if (threads > 1) this.send(`setoption name Threads value ${threads}`);
        return true;
      } catch { /* try the next way */ }
    }
    throw new Error('Stockfish could not start in this browser');
  }
  handshake(w) {
    return new Promise((res, rej) => {
      const t = setTimeout(() => { w.terminate(); rej(new Error('timeout')); }, this.handshakeMs);
      w.onerror = e => { clearTimeout(t); w.terminate(); rej(e); };
      w.onmessage = e => {
        const line = String(e.data);
        if (line.startsWith('id name')) this.name = line.slice(8);
        if (line === 'uciok') {
          clearTimeout(t);
          w.onmessage = ev => this.onLine(String(ev.data));
          w.onerror = e => { e?.preventDefault?.(); this.fail(new Error('Stockfish stopped unexpectedly')); };
          w.postMessage('setoption name Hash value 32');
          res(w);
        }
      };
      w.postMessage('uci');
    });
  }
  // Rejects the running job and everything queued, and marks the engine dead.
  fail(err) {
    if (this.dead) return;
    this.dead = err;
    const jobs = [...(this.cur ? [this.cur] : []), ...this.queue];
    this.cur = null; this.queue = [];
    try { this.w?.terminate(); } catch { /* already gone */ }
    jobs.forEach(j => j.reject(err));
    this.onFail(err);
  }
  send(c) { this.w.postMessage(c); }
  // opts: {depth|movetime, maxMs, multipv, setup:[], tag, onInfo}. Resolves null when cancelled.
  // maxMs caps a depth search in time: with MultiPV, some positions (a mate in one with losing
  // alternatives) make the search explode, and more threads make it worse.
  go(fen, opts = {}) {
    if (this.dead) return Promise.reject(this.dead);
    return new Promise((resolve, reject) => { this.queue.push({ fen, opts, resolve, reject, lines: [] }); this.pump(); });
  }
  // At most n threads for the next searches (null: all it started with), e.g. while the in-browser
  // model needs the CPU. Applied between searches, never during one. Single-threaded builds ignore it.
  limitThreads(n) { this.limit = n; }
  cancel(tag) {
    this.queue = this.queue.filter(j => { if (!tag || j.opts.tag === tag) { j.resolve(null); return false; } return true; });
    if (this.cur && (!tag || this.cur.opts.tag === tag)) { this.cur.cancelled = true; this.send('stop'); }
  }
  async pump() {
    if (this.cur || !this.queue.length || this.dead) return;
    try { await this.ready; } catch { return; } // fail() has already rejected the queue
    if (this.cur || !this.queue.length || this.dead) return;
    const j = this.cur = this.queue.shift();
    const o = j.opts;
    const t = Math.max(1, Math.min(this.threads, this.limit || this.threads));
    if (this.threads > 1 && t !== this.applied) { this.send(`setoption name Threads value ${t}`); this.applied = t; }
    this.send(`setoption name MultiPV value ${o.multipv || 1}`);
    (o.setup || []).forEach(c => this.send(c));
    this.send('position fen ' + j.fen);
    this.send(o.movetime ? `go movetime ${o.movetime}` : `go depth ${o.depth || 12}${o.maxMs ? ` movetime ${o.maxMs}` : ''}`);
  }
  onLine(line) {
    const j = this.cur; if (!j) return;
    if (line.startsWith('info') && line.includes(' pv ') && line.includes(' score ')) {
      const inf = parseInfo(line);
      if (inf.bound) return;
      const k = (inf.multipv || 1) - 1;
      j.lines[k] = { score: inf.score, pv: inf.pv, depth: inf.depth };
      j.depth = Math.max(j.depth || 0, inf.depth);
      if (k === 0 && j.opts.onInfo && !j.cancelled) j.opts.onInfo(j);
    } else if (line.startsWith('bestmove')) {
      const best = line.split(' ')[1];
      this.cur = null;
      j.resolve(j.cancelled ? null : { best: best === '(none)' ? null : best, lines: j.lines.filter(Boolean), depth: j.depth || 0 });
      this.pump();
    }
  }
}
