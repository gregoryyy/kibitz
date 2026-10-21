// Renders docs/flipbook/: a happy path through the app, one screenshot per step of flipbook/tour.mjs.
//   node scripts/flipbook.mjs [--ai env|mock|anthropic|openai|mistral|ollama] [--port 8797] [--yes]
// Serves the build (site/dist, from `just build`) with the AI gateway, drives the page headlessly
// with Playwright, applies each step's acts, takes a whole-page screenshot and writes docs/flipbook/NN-<id>.png
// and README.md, which quotes the coach's answers with a count of the moves the engine backs.
// --ai env (the default) uses the provider configured in the repo's .env, as `just serve` does;
// --ai anthropic (or another provider) uses that provider, with its key and models from .env;
// --ai mock uses the mock provider, with keys from the shell blanked as in the e2e tests.
// Fails on uncaught page errors and Content-Security-Policy violations, like the e2e tests, and stops
// at the first answer that is an error. With a paid provider it prints the models and the number of
// calls and stops; --yes renders it (scripts/paid.mjs).
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseArgs } from 'util';
import { chromium } from '@playwright/test';
import { steps, meta } from '../flipbook/tour.mjs';
import { answer, ask, coachCount, count, quoteOf } from './coach-page.mjs';
import { mayRun, paidPlan, statusModels } from './paid.mjs';

const { values: opt } = parseArgs({ options: { ai: { type: 'string', default: 'env' }, port: { type: 'string', default: '8797' }, yes: { type: 'boolean', default: false } } });
const PROVIDERS = ['anthropic', 'openai', 'mistral', 'ollama'];
if (!['env', 'mock', ...PROVIDERS].includes(opt.ai)) { console.error(`usage: flipbook.mjs [--ai env|mock|${PROVIDERS.join('|')}] [--port N] [--yes]`); process.exit(2); }

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(site, '..');
const out = path.join(repo, 'docs', 'flipbook');
const BASE = `http://127.0.0.1:${opt.port}`;
const VIEWPORT = { width: 1360, height: 900 };
const log = msg => process.stdout.write(`[flipbook] ${msg}\n`);

// Starts scripts/serve.mjs and resolves with its status line ("AI coach: provider / model", or why it is off).
function serve() {
  const mock = opt.ai === 'mock';
  const env = mock
    ? { ...process.env, AI_PROVIDER: 'mock', ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', MISTRAL_API_KEY: '', OLLAMA_MODEL: '', AI_LOCAL_ONLY: '' }
    : { ...process.env, ...(PROVIDERS.includes(opt.ai) ? { AI_PROVIDER: opt.ai } : {}) }; // .env doesn't override what's set here
  const args = ['scripts/serve.mjs', 'dist', '--api', `--env=${mock ? '' : path.join(repo, '.env')}`, '--index', '_test.html', '--port', opt.port, '--host', '127.0.0.1'];
  const server = spawn(process.execPath, args, { cwd: site, env, stdio: ['ignore', 'pipe', 'inherit'] });
  const ready = new Promise((resolve, reject) => {
    let text = '';
    server.stdout.on('data', d => { text += d; if (/AI coach[^\n]*\n/.test(text) && text.includes(String(opt.port))) resolve(text.match(/AI coach[^\n]*/)[0].trim()); });
    server.on('exit', code => reject(new Error(`the server exited (${code})`)));
    setTimeout(() => reject(new Error(`the server didn't start on ${BASE}`)), 15_000);
  });
  return { server, ready };
}


// Types the first legal move of the list, then waits for Stockfish's reply (or the end of the game).
async function play(page, sans) {
  const before = await count(page, '#moves button');
  for (const san of sans) {
    await page.fill('#moveInput', san);
    await page.press('#moveInput', 'Enter');
    await page.waitForTimeout(300);
    if (await count(page, '#moves button') === before) continue; // not legal here; try the next
    await page.waitForFunction(n => document.querySelectorAll('#moves button').length >= n + 2 || /Game over/.test(document.querySelector('#flagSlot')?.textContent || ''), before, { timeout: 60_000 });
    await page.waitForFunction(() => !(/** @type {any} */ (window)).__kibitz.S.thinking, null, { timeout: 60_000 });
    return;
  }
  throw new Error(`none of ${sans.join(', ')} is legal here`);
}

// Applies one act; returns a quote for the flipbook when the act asked the coach something.
async function act(page, a) {
  if (a.tab) { await page.click(`[data-tab="${a.tab}"]`); await page.waitForTimeout(300); }
  else if (a.ply !== undefined) await (a.ply ? page.click(`#moves button >> nth=${a.ply - 1}`) : page.click('#btnFirst'));
  else if (a.range) await page.locator(a.range).evaluate((el, v) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, a.value);
  else if (a.fill) await page.fill(a.fill, a.value);
  else if (a.click) await page.click(a.click);
  else if (a.move) {
    const before = await coachCount(page);
    await play(page, a.move);
    if (a.comment) return answer(page, before);
  }
  else if (a.ask) return ask(page, a.ask);
  else if (a.askBy) {
    const before = await coachCount(page);
    await page.click(a.askBy);
    const q = await answer(page, before);
    return { question: (await page.locator('#chat .msg.user').last().textContent()).trim(), ...q };
  }
  else if (a.capture) {
    await page.click(a.button);
    await page.waitForSelector(a.done, { timeout: 180_000 });
    return { who: a.label, ...(await page.locator(a.capture).evaluate(quoteOf)) };
  }
  else if (a.hover) {
    const el = page.locator(a.hover).first();
    if (await el.count()) await el.hover(); else log(`nothing to hover: ${a.hover}`);
  }
  else if (a.confirm) await page.click('#confirmSlot .btn.primary');
  else if (a.waitFor) await page.waitForSelector(a.waitFor, { state: 'visible', timeout: 180_000 });
  else if (a.wait) await page.waitForTimeout(a.wait);
  else if (a.scroll) await page.locator(a.scroll).scrollIntoViewIfNeeded();
  else if (a.viewport) await page.setViewportSize(a.viewport);
  else if (a.scheme) await page.emulateMedia({ colorScheme: a.scheme });
  else if (a.js) await page.evaluate(a.js);
  else throw new Error(`unknown act: ${JSON.stringify(a)}`);
}

// "3 moves backed by Stockfish or the game, 1 legal but not in its lines, 1 wrong (struck through)."
function checkLine({ all, invalid, unchecked }) {
  if (!all) return '';
  const backed = all - invalid - unchecked;
  const parts = [`${backed} ${backed === 1 ? 'move' : 'moves'} backed by Stockfish or the game`];
  if (unchecked) parts.push(`${unchecked} legal but not in its lines`);
  parts.push(invalid ? `${invalid} wrong (struck through)` : 'none wrong');
  return `_Moves named: ${parts.join(', ')}._`;
}

function quoteLines(q) {
  const out = [];
  if (q.question) out.push(`**Question:** ${q.question}`, '');
  out.push(`**${q.who || 'Coach'}:**`, '', ...q.text.split('\n').map(l => (l ? `> ${l}` : '>')), '');
  const c = checkLine(q.checks);
  if (c) out.push(c, '');
  return out;
}

// "The coach is Claude: `claude-opus-5-5` for quick questions, chat and reviews", from the gateway's status.
async function coachLine() {
  const st = await (await fetch(`${BASE}/api/ai/status`)).json();
  const name = { anthropic: 'Claude', openai: 'OpenAI', mistral: 'Mistral', ollama: 'Ollama' }[st.provider] || st.provider;
  const byModel = new Map();
  for (const [task, label] of [['quick', 'quick questions'], ['chat', 'chat'], ['review', 'reviews']]) {
    const m = st.models?.[task] || st.model; byModel.set(m, [...(byModel.get(m) || []), label]);
  }
  return `The coach is ${name}: ${[...byModel].map(([m, tasks]) => `\`${m}\` for ${tasks.join(', ').replace(/, ([^,]*)$/, ' and $1')}`).join('; ')}`;
}

function markdown(shots, ai) {
  const lines = [
    `# ${meta.title}`, '',
    '> Generated by `just flipbook` from [site/flipbook/tour.mjs](../../site/flipbook/tour.mjs); don\'t edit it by hand. ' +
      'To change the walkthrough, edit the tour and run `just flipbook` again (`just flipbook mock` needs no API keys).', '',
    meta.intro, '',
    `_${shots.length} steps, captured as whole pages from the running app, ${VIEWPORT.width} pixels wide. ${ai}. Stockfish's replies differ between runs, and so do the coach's answers._`, '',
    '## Contents', '',
    ...shots.map((s, i) => `${i + 1}. [${s.title}](#${i + 1}-${s.title.toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/ /g, '-')})`), '',
  ];
  shots.forEach((s, i) => lines.push(`## ${i + 1}. ${s.title}`, '', `![${s.title}](${s.file})`, '', s.caption, '', ...s.quotes.flatMap(quoteLines)));
  return lines.join('\n');
}

async function main() {
  await fs.access(path.join(site, 'dist', '_test.html')).catch(() => { throw new Error('no build in site/dist: run `just build` first'); });
  const { server, ready } = serve();
  let browser;
  try {
    const status = await ready;
    log(`serving on ${BASE}; ${status}`);
    if (PROVIDERS.includes(opt.ai) && !status.startsWith(`AI coach: ${opt.ai} `)) throw new Error(`asked for ${opt.ai}, but the gateway says: ${status}`);
    // Who answers and what it costs, before the first call: one call per question, comment and capture.
    const gw = await (await fetch(`${BASE}/api/ai/status`)).json();
    const calls = steps.reduce((n, s) => n + s.acts.filter(a => /** @type {any} */ (a).ask || /** @type {any} */ (a).comment || /** @type {any} */ (a).capture).length, 0);
    const uses = [{ role: 'coach', provider: gw.provider, models: statusModels(gw), calls }];
    for (const line of paidPlan(uses)) log(line);
    if (!mayRun(uses, opt.yes)) { log('Paid calls, so nothing was sent. Check the models above, then run again with --yes (just flipbook … yes=1).'); process.exitCode = 3; return; }
    const ai = opt.ai === 'mock' ? 'The coach is the mock provider, which answers with a placeholder' : await coachLine();
    browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true });
    const context = await browser.newContext({ viewport: VIEWPORT, reducedMotion: 'reduce', colorScheme: 'light' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await page.addInitScript(() => document.addEventListener('securitypolicyviolation', e => console.error(`csp: ${e.violatedDirective} ${e.blockedURI}`)));
    page.on('console', m => { if (m.type() === 'error' && m.text().startsWith('csp: ')) errors.push(m.text()); });
    await page.goto(`${BASE}/?debug`);
    await page.waitForSelector('#engineDot.ok', { timeout: 30_000 });

    await fs.rm(out, { recursive: true, force: true });
    await fs.mkdir(out, { recursive: true });
    const shots = [];
    for (const [i, step] of steps.entries()) {
      const quotes = [];
      for (const a of step.acts) {
        const q = await act(page, a);
        if (q?.error) throw new Error(`step ${step.id}: the coach answered with an error (${q.error}): ${q.text}`);
        if (q) quotes.push(q);
      }
      if (step.settle) await page.waitForSelector(step.settle, { state: 'visible', timeout: 60_000 });
      await page.waitForTimeout(400); // let the board and the eval bar settle
      const file = `${String(i + 1).padStart(2, '0')}-${step.id}.png`;
      await page.screenshot({ path: path.join(out, file), fullPage: true });
      shots.push({ ...step, file, quotes });
      log(`${file}`);
    }
    if (errors.length) throw new Error(`the page reported errors:\n${errors.join('\n')}`);
    await fs.writeFile(path.join(out, 'README.md'), markdown(shots, ai));
    log(`wrote docs/flipbook/README.md (${shots.length} steps)`);
  } finally {
    await browser?.close();
    server.kill();
  }
}

main().catch(e => { console.error('[flipbook] failed:', e.message); process.exit(1); });
