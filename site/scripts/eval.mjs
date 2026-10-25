// Runs the tutor eval set (TODO 3.8, eval/positions.mjs) against a provider and writes a report.
//   node scripts/eval.mjs [--ai env|mock|anthropic|openai|mistral|ollama|browser] [--model ID]
//                         [--judge none|env|anthropic|openai|mistral|ollama] [--only id,id] [--port 8795] [--yes]
//                         [--lang en|de] [--plan] [--out DIR] [--env FILE]
// The answers come from the running app, driven headlessly with Playwright, so the coach sees exactly
// the prompt a player's question produces; the app's own answer check counts the wrong moves.
// --ai browser runs the in-browser model (`just offline` downloads it; --model picks which).
// --judge grades every answer with an LLM, called from here (Node), so keys stay on this machine.
// Model variables set in the shell (ANTHROPIC_MODEL, ..., EVAL_JUDGE_MODEL) take precedence over .env.
// With a paid provider (coach or judge) it prints the models and the number of calls and stops;
// --yes runs it (scripts/paid.mjs). It stops at the first error from the coach or the judge.
// Writes docs/eval/<provider>-<model>.json and .md, and regenerates docs/eval/README.md from all runs.
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseArgs } from 'util';
import { chromium } from '@playwright/test';
import { Chess } from 'chess.js';
import { evalPositions } from '../eval/positions-de.mjs';
import { scoreAnswer, summarise, judgePrompt, JUDGE_SCHEMA } from '../eval/score.mjs';
import { ask } from './coach-page.mjs';
import { mayRun, paidPlan, statusModels } from './paid.mjs';

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(site, '..');
const OUT = path.join(repo, 'docs', 'eval');
const CLOUD = ['anthropic', 'openai', 'mistral', 'ollama'];
const log = msg => process.stdout.write(`[eval] ${msg}\n`);

// The position as text for the app's "Load a position or PGN" box: a PGN, or a bare FEN.
export function loadTextFor(pos) {
  if (!pos.moves) return pos.fen;
  const c = new Chess(pos.fen);
  for (const m of pos.moves.split(' ')) c.move(m);
  return c.pgn();
}

// Runs one position in an open page (the app at its URL, ?debug on): loads it, waits for Stockfish,
// asks, and returns the answer with the app's checks and the context the coach saw. `error` is set
// when the coach answered with an error message (the provider's code), which is not an answer to score.
export async function runPosition(page, pos) {
  await page.locator('[data-tab="game"]').click();
  const generation = await page.evaluate(() => /** @type {any} */ (window).__kibitz.S.gen);
  await page.locator('details:has(#loadText)').evaluate(d => { /** @type {HTMLDetailsElement} */ (d).open = true; });
  await page.fill('#loadText', loadTextFor(pos));
  await page.click('#btnLoad');
  await page.waitForFunction(previous => /** @type {any} */ (window).__kibitz.S.gen !== previous, generation, { timeout: 15_000 });
  if (await page.locator('#btnLast').isEnabled()) await page.click('#btnLast'); // a load may already end there
  // The coach's context includes Stockfish's lines: wait until the position is analysed.
  await page.waitForFunction(() => {
    const { S, ANA } = /** @type {any} */ (window).__kibitz, fen = S.nodes[S.cursor].fen;
    const a = ANA.get(fen.split(' ').slice(0, 4).join(' '));
    return !S.thinking && (!!a && (a.depth >= S.depth || a.capDepth >= S.depth) || /#$/.test(S.nodes[S.cursor].san || ''));
  }, null, { timeout: 60_000 });
  const context = await page.evaluate(() => { const k = /** @type {any} */ (window).__kibitz; return k.contextFor(k.S.cursor); });
  if (!(await page.locator('#coachChips .chip', { hasText: pos.chip }).count())) throw new Error(`${pos.id}: no quick-question chip "${pos.chip}"`);
  const t0 = Date.now();
  const a = await ask(page, pos.chip);
  return { id: pos.id, title: pos.title, question: a.question, answer: a.text, capture: a.capture, error: a.error, checks: a.checks, context, ms: Date.now() - t0 };
}

function serve({ ai, model, port, envFile }) {
  const env = { ...process.env };
  const args = ['scripts/serve.mjs', 'dist', '--api', '--http-dev', '--index', '_test.html', '--port', String(port), '--host', '127.0.0.1'];
  if (ai === 'mock') Object.assign(env, { AI_PROVIDER: 'mock', ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', MISTRAL_API_KEY: '', OLLAMA_MODEL: '', AI_LOCAL_ONLY: '' }), args.push('--env=');
  else if (ai === 'browser') Object.assign(env, { AI_PROVIDER: 'browser', AI_LOCAL_ONLY: '1' }), args.push('--env=', '--models', 'models', ...(model ? ['--model', model] : []));
  else { if (ai !== 'env') env.AI_PROVIDER = ai; args.push(`--env=${envFile}`); }
  env.AI_RATE_LIMIT_PER_MINUTE = '1000';
  const server = spawn(process.execPath, args, { cwd: site, env, stdio: ['ignore', 'pipe', 'inherit'] });
  const ready = new Promise((resolve, reject) => {
    let text = '';
    const timer = setTimeout(() => reject(new Error('the server did not start')), 15_000);
    server.stdout.on('data', d => { text += d; const m = text.match(/AI coach[^\n]*\n/); if (m) { clearTimeout(timer); resolve(m[0].trim()); } });
    server.on('exit', c => { clearTimeout(timer); reject(new Error(`the server exited (${c})`)); });
  });
  return { server, ready };
}

// The judge: a provider from .env, called here in Node. Returns null when judging is off.
async function makeJudge(name, envFile) {
  if (!name || name === 'none') return null;
  if (envFile) try { process.loadEnvFile(envFile); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const { loadConfig, createProvider } = await import('../server/ai.mjs');
  const { completeJson } = await import('../server/schema.mjs');
  const config = loadConfig({ ...process.env, ...(name !== 'env' ? { AI_PROVIDER: name } : {}) });
  if (!config.available) throw new Error(`no judge: ${config.reason}`);
  const model = process.env.EVAL_JUDGE_MODEL || config.models?.review || config.model;
  const provider = createProvider(config);
  return {
    label: `${config.provider} / ${model}`, provider: config.provider, model,
    grade: async r => (await completeJson(provider, judgePrompt({ context: r.context, question: r.question, answer: r.answer, keyPoints: evalPositions(r.language || 'en').find(p => p.id === r.id).keyPoints }), { name: 'eval_judge', schema: JUDGE_SCHEMA }, { model })).data,
  };
}

const pct = x => x === null || x === undefined ? '–' : `${Math.round(x * 100)}%`;
const slug = s => s.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, '');

export function report(run) {
  const s = run.summary;
  const positions = run.referencePositions || evalPositions(run.language || 'en');
  const capture = run.capture || 'rendered-message-v1';
  const source = run.language === 'de' ? 'positions-de.mjs' : 'positions.mjs';
  const lines = [
    `# Tutor eval: ${run.coach}`, '',
    `> Generated by \`just eval\` (site/scripts/eval.mjs) on ${run.date}; don't edit by hand. Positions and key points: [site/eval/${source}](../../site/eval/${source}).`, '',
    `Capture: ${capture}. ${capture === 'coach-prose-v2' ? 'Coach prose only; source passages, tool cards and interface controls are excluded.' : 'Legacy rendered message, including source passages, tool cards and interface controls. Cue scores can be inflated by supplied evidence; these are not model-only quality scores.'}`, '',
    `Language: ${run.language || 'en'}. Judge: ${run.judge || 'none'}. Overall ${pct(s.overall)}: key points ${pct(s.keys)}, move checks ${pct(s.moves)} (${s.wrongMoves} wrong move${s.wrongMoves === 1 ? '' : 's'}), judge ${pct(s.judge)}. ${s.secondsPerAnswer?.toFixed(1) ?? '–'} s per answer.`, '',
    '| Position | Key points | Wrong moves | Judge | Overall |', '|---|---|---|---|---|',
    ...run.results.map(r => `| ${r.title} | ${r.score.hits.filter(Boolean).length}/${r.score.hits.length} | ${r.checks?.invalid ?? '–'} | ${pct(r.score.judge)} | ${pct(r.score.overall)} |`), '',
  ];
  for (const r of run.results) {
    const pos = positions.find(p => p.id === r.id);
    lines.push(`## ${r.title}`, '', `**Question:** ${r.question}`, '', ...r.answer.split('\n').map(l => (l ? `> ${l}` : '>')), '',
      `Key points: ${pos.keyPoints.map((k, i) => `${r.score.hits[i] ? '✓' : '✗'} ${k.point}`).join('; ')}.`, '');
    if (r.checks) lines.push(`Moves named: ${r.checks.all}; not in Stockfish's lines: ${r.checks.unchecked}; wrong: ${r.checks.invalid}.`, '');
    if (r.judgement) lines.push(`Judge: accuracy ${r.judgement.accuracy}, insight ${r.judgement.insight}, clarity ${r.judgement.clarity}, level ${r.judgement.level}. ${r.judgement.comment} Missing: ${r.judgement.missing}`, '');
  }
  return lines.join('\n');
}

export async function index(directory = OUT) {
  const runs = [];
  for (const f of (await fs.readdir(directory)).filter(f => f.endsWith('.json'))) runs.push(JSON.parse(await fs.readFile(path.join(directory, f), 'utf8')));
  runs.sort((a, b) => (a.language || 'en').localeCompare(b.language || 'en') || (b.summary.overall ?? -1) - (a.summary.overall ?? -1));
  return [
    '# Tutor eval', '',
    '> Generated by `just eval`; grouped by language, then score. Lexical cue coverage is not semantic verification or a calibrated cross-language ranking. Legacy rendered-message-v1 captures include source/tool cards that can inflate cue coverage; compare capture versions separately. The set and scoring are described in [site/eval/](../../site/eval/).', '',
    '| Language | Coach | Capture | Judge | Overall | Key points | Move checks | Wrong moves | Judge score | s / answer | Date |', '|---|---|---|---|---|---|---|---|---|---|---|',
    ...runs.map(r => `| ${r.language || 'en'} | [${r.coach}](${r.file}) | ${r.capture || 'rendered-message-v1'} | ${r.judge || '–'} | ${pct(r.summary.overall)} | ${pct(r.summary.keys)} | ${pct(r.summary.moves)} | ${r.summary.wrongMoves} | ${pct(r.summary.judge)} | ${r.summary.secondsPerAnswer?.toFixed(1) ?? '–'} | ${r.date} |`), '',
  ].join('\n');
}

async function main() {
  const { values: opt } = parseArgs({ options: { ai: { type: 'string', default: 'env' }, model: { type: 'string', default: '' }, judge: { type: 'string', default: 'none' }, only: { type: 'string', default: '' }, port: { type: 'string', default: '8795' }, yes: { type: 'boolean', default: false }, lang: { type: 'string', default: 'en' }, plan: { type: 'boolean', default: false }, out: { type: 'string', default: OUT }, env: { type: 'string', default: path.join(repo, '.env') } } });
  if (!['env', 'mock', 'browser', ...CLOUD].includes(opt.ai) || !['none', 'env', ...CLOUD].includes(opt.judge)) { console.error('usage: eval.mjs [--ai env|mock|browser|anthropic|openai|mistral|ollama] [--model ID] [--judge none|env|anthropic|...] [--only id,id] [--lang en|de] [--plan] [--out DIR] [--env FILE] [--yes]'); process.exit(2); }
  await fs.access(path.join(site, 'dist', '_test.html')).catch(() => { throw new Error('no build in site/dist: run `just build` first'); });
  const positions = evalPositions(opt.lang, opt.only), directory = path.resolve(opt.out);
  const envFile = opt.env ? path.resolve(opt.env) : '';
  const judge = await makeJudge(opt.judge, envFile);
  const { server, ready } = serve({ ai: opt.ai, model: opt.model, port: opt.port, envFile });
  let browser;
  try {
    const status = await ready;
    log(`${status}${judge ? `; judge ${judge.label}` : ''}`);
    // Who answers and what it costs, before the first call.
    const gw = await (await fetch(`http://127.0.0.1:${opt.port}/api/ai/status`)).json();
    const uses = [
      { role: 'coach', provider: gw.provider, models: gw.provider === 'browser' ? [gw.browser?.name || gw.model] : statusModels(gw), calls: positions.length },
      ...(judge ? [{ role: 'judge', provider: judge.provider, models: [judge.model], calls: positions.length }] : []),
    ];
    for (const line of paidPlan(uses)) log(line);
    log('Counts above are answer/judge counts. Tool follow-ups and rate-limit retries can add provider requests; this is not a hard cost cap.');
    log(`language: ${opt.lang}; ${positions.length} fixed positions; provider available: ${gw.available}${!gw.available ? '; ' + gw.reason : ''}`);
    if (opt.plan) { log('Plan only: no coach or judge requests sent, no report written.'); return; }
    if (!mayRun(uses, opt.yes)) { log('Paid calls, so nothing was sent. Check the models above, then run again with --yes (just eval … yes=1).'); process.exitCode = 3; return; }
    if (!gw.available) throw Error('Coach unavailable: ' + gw.reason);
    browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true });
    const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
    await page.addInitScript(language => { localStorage.setItem('kibitz.lang', JSON.stringify(language)); localStorage.setItem('kibitz.browserModelOk', 'true'); }, opt.lang); // explicit --ai browser selects this local resource
    await page.goto(`http://127.0.0.1:${opt.port}/?debug`);
    await page.waitForSelector('#engineDot.ok', { timeout: 30_000 });
    await page.click('#btnSettings'); await page.click('#optLevel button[data-v="2"]');
    // The operator selected this provider for fixed public benchmark questions. This runs only
    // after the paid-run guard above, grants coach purpose only and uses the actual privacy UI.
    const consent = page.locator(`[data-consent-provider="${gw.provider}"][data-consent-purpose="coach"]`);
    if (await consent.count()) await consent.check();
    await page.click('#btnSettingsClose'); // a club player
    const st = await page.evaluate(() => fetch('api/ai/status').then(r => r.json()));
    const coach = st.provider === 'browser' ? `in-browser / ${st.browser?.name || st.model}` : `${st.provider} / ${st.models?.quick || st.model}`;
    const results = [];
    for (const pos of positions) {
      let r = await runPosition(page, pos);
      // An error is not an answer: wait out a provider's rate limit, stop on anything else, so a
      // bad key or an empty quota never turns into a report (or into the judge's bill).
      for (let tries = 1; r.error === 'rate_limited' && tries <= 3; tries++) {
        log(`${pos.id}: rate limited by the provider; waiting a minute (${tries}/3)`);
        await page.waitForTimeout(65_000);
        r = await runPosition(page, pos);
      }
      if (r.error) throw new Error(`${pos.id}: the coach answered with an error (${r.error}): ${r.answer}. No report written.`);
      // A failing judge fails every call after it too (a bad key, a used-up budget): stop.
      r.judgement = judge ? await judge.grade({ ...r, language: opt.lang }).catch(e => { throw new Error(`${pos.id}: the judge failed: ${e.message}. No report written.`); }) : null;
      r.score = scoreAnswer({ text: r.answer, keyPoints: pos.keyPoints, checks: r.checks, judge: r.judgement });
      log(`${pos.id}: key points ${r.score.hits.filter(Boolean).length}/${pos.keyPoints.length}, wrong moves ${r.checks.invalid}${r.judgement ? `, judge ${pct(r.score.judge)}` : ''}, ${(r.ms / 1000).toFixed(1)} s`);
      results.push(r);
    }
    const name = slug(coach) + (opt.lang === 'en' ? '' : '-' + opt.lang), date = new Date().toISOString().slice(0, 10);
    const run = { coach, judge: judge?.label || null, language: opt.lang, capture: results[0]?.capture, date, file: `${name}.md`, referencePositions: positions, summary: summarise(results), results };
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, `${name}.json`), JSON.stringify(run, null, 2) + '\n');
    await fs.writeFile(path.join(directory, `${name}.md`), report(run));
    await fs.writeFile(path.join(directory, 'README.md'), await index(directory));
    log(`overall ${pct(run.summary.overall)}; wrote ${path.join(directory, name + '.md')}`);
  } finally {
    await browser?.close();
    server.kill();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch(e => { console.error('[eval] failed:', e.message); process.exit(1); });
