// Calibrates the weakened mode below Stockfish's lowest UCI_Elo (TODO 1.4).
//   node scripts/calibrate.mjs [--levels 600,800,1000,1200] [--anchor 1320] [--games 20] [--jobs 6] [--seed 1]
// Plays a round robin between the app's weakened levels (play.js: opponentSearch + pickWeak)
// and Stockfish limited to UCI_Elo `anchor`, with the same search settings the page uses, then
// fits Elo ratings by maximum likelihood with the anchor fixed at its UCI_Elo. Stockfish's
// UCI_Elo is itself calibrated against engine rating lists, not human ratings, so this aligns
// the weakened levels with Stockfish's scale; it does not tie them to human ratings.
import { spawn } from 'child_process';
import { createRequire } from 'module';
import os from 'os';
import { parseArgs } from 'util';
import { Chess } from 'chess.js';
import { opponentSearch, pickWeak, gameEnd, MIN_UCI_ELO } from '../src/chess/play.js';
import { parseInfo } from '../src/chess/knowledge.js';

const { values: opt } = parseArgs({ options: {
  levels: { type: 'string', default: '600,800,1000,1200' },
  anchor: { type: 'string', default: String(MIN_UCI_ELO) },
  games: { type: 'string', default: '20' }, // per pairing, colours alternate
  jobs: { type: 'string', default: String(Math.max(1, os.availableParallelism() - 2)) },
  seed: { type: 'string', default: '1' },
} });
const LEVELS = opt.levels.split(',').map(Number), ANCHOR = Number(opt.anchor);
const GAMES = Number(opt.games), JOBS = Number(opt.jobs);
const OPENINGS = ['e4 e5', 'e4 c5', 'e4 e6', 'e4 c6', 'd4 d5', 'd4 Nf6', 'c4 e5', 'Nf3 d5'];

// Seeded random numbers (mulberry32), so a run can be repeated.
function rng(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// Stockfish (lite, single-threaded: the page's default engine) as a child process speaking UCI.
const enginePath = createRequire(import.meta.url)('stockfish').findEngine('lite-single');
class UciEngine {
  constructor() {
    this.p = spawn(process.execPath, [enginePath], { stdio: ['pipe', 'pipe', 'ignore'] });
    this.buf = ''; this.waiters = [];
    this.p.stdout.on('data', d => {
      this.buf += d;
      let nl;
      while ((nl = this.buf.indexOf('\n')) >= 0) { const line = this.buf.slice(0, nl).trim(); this.buf = this.buf.slice(nl + 1); this.waiters.forEach(w => w(line)); }
    });
  }
  send(c) { this.p.stdin.write(c + '\n'); }
  until(pred) { return new Promise(res => { const w = line => { if (pred(line)) { this.waiters = this.waiters.filter(x => x !== w); res(line); } }; this.waiters.push(w); }); }
  async init() { const ok = this.until(l => l === 'uciok'); this.send('uci'); await ok; this.send('setoption name Hash value 32'); }
  async newGame() { const ok = this.until(l => l === 'readyok'); this.send('ucinewgame'); this.send('isready'); await ok; }
  async go(fen, o) {
    const lines = [];
    const collect = line => { if (line.startsWith('info') && line.includes(' pv ') && line.includes(' score ')) { const i = parseInfo(line); if (!i.bound) lines[(i.multipv || 1) - 1] = { score: i.score, pv: i.pv }; } };
    this.waiters.push(collect);
    const done = this.until(l => l.startsWith('bestmove'));
    this.send(`setoption name MultiPV value ${o.multipv || 1}`);
    o.setup.forEach(c => this.send(c));
    this.send('position fen ' + fen);
    this.send(o.movetime ? `go movetime ${o.movetime}` : `go depth ${o.depth}`);
    const best = (await done).split(' ')[1];
    this.waiters = this.waiters.filter(x => x !== collect);
    return { best: best === '(none)' ? null : best, lines: lines.filter(Boolean) };
  }
  quit() { this.send('quit'); this.p.stdin.end(); }
}

// A player picks a move the way the page does for that Elo.
async function moveFor(engine, elo, fen, rand) {
  const res = await engine.go(fen, opponentSearch(elo, null));
  return elo >= MIN_UCI_ELO ? res.best : pickWeak(Chess, fen, res, elo, rand);
}

async function playGame(engines, white, black, opening, rand) {
  const c = new Chess();
  for (const m of opening.split(' ')) c.move(m);
  await Promise.all(engines.map(e => e.newGame()));
  while (c.history().length < 300) {
    const end = gameEnd(c);
    if (end) return end.result === '1-0' ? 1 : end.result === '0-1' ? 0 : 0.5;
    const side = c.turn() === 'w' ? 0 : 1;
    const uci = await moveFor(engines[side], side ? black : white, c.fen(), rand);
    c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q' });
  }
  return 0.5; // unusually long: adjudicated as a draw
}

// Every pairing, GAMES games each, colours and openings alternating.
const players = [...LEVELS, ANCHOR];
const jobs = [];
for (let a = 0; a < players.length; a++) for (let b = a + 1; b < players.length; b++) {
  for (let g = 0; g < GAMES; g++) jobs.push({ p: g % 2 ? [players[b], players[a]] : [players[a], players[b]], opening: OPENINGS[Math.floor(g / 2) % OPENINGS.length], seed: Number(opt.seed) * 100_000 + jobs.length });
}
const results = []; let next = 0, finished = 0;
const t0 = Date.now();
async function worker() {
  const engines = [new UciEngine(), new UciEngine()];
  await Promise.all(engines.map(e => e.init()));
  while (next < jobs.length) {
    const j = jobs[next++];
    const score = await playGame(engines, j.p[0], j.p[1], j.opening, rng(j.seed));
    results.push({ white: j.p[0], black: j.p[1], score });
    if (++finished % 10 === 0) process.stderr.write(`${finished}/${jobs.length} games, ${Math.round((Date.now() - t0) / 1000)} s\n`);
  }
  engines.forEach(e => e.quit());
}
await Promise.all(Array.from({ length: Math.min(JOBS, jobs.length) }, worker));

// Maximum-likelihood ratings (logistic model, draws as half points), anchor fixed.
const R = Object.fromEntries(players.map(p => [p, p]));
const expected = (a, b) => 1 / (1 + 10 ** ((R[b] - R[a]) / 400));
for (let it = 0; it < 5000; it++) {
  for (const p of LEVELS) {
    let grad = 0, n = 0;
    for (const r of results) {
      if (r.white === p) { grad += r.score - expected(p, r.black); n++; }
      else if (r.black === p) { grad += (1 - r.score) - expected(p, r.white); n++; }
    }
    if (n) R[p] = Math.max(0, Math.min(3200, R[p] + 40 * grad / n)); // clamped: a level that loses every game has no finite rating
  }
}
const table = players.map(p => {
  const mine = results.filter(r => r.white === p || r.black === p);
  const pts = mine.reduce((s, r) => s + (r.white === p ? r.score : 1 - r.score), 0);
  return { setting: p, games: mine.length, score: `${pts}/${mine.length}`, fitted: Math.round(R[p]) };
});
console.table(table);
console.log('Pairings (score of the first player):');
for (let a = 0; a < players.length; a++) for (let b = a + 1; b < players.length; b++) {
  const g = results.filter(r => (r.white === players[a] && r.black === players[b]) || (r.white === players[b] && r.black === players[a]));
  const s = g.reduce((t, r) => t + (r.white === players[a] ? r.score : 1 - r.score), 0);
  console.log(`  ${players[a]} v ${players[b]}: ${s}/${g.length}`);
}
console.log(`${results.length} games in ${Math.round((Date.now() - t0) / 1000)} s`);
