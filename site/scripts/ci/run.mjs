// Local CI (docs/CI.md, TODO 0.18): runs the jobs of .github/workflows/ci.yml on this machine, while
// GitHub Actions doesn't start jobs and to check a branch before pushing it. The run takes the
// workflow from the commit itself and runs it in a clean worktree of that commit, so uncommitted
// changes can neither make it pass nor break it. Jobs run one after another in the same worktree (an
// `npm ci` already done in this run is skipped), and one run at a time (Playwright's port is fixed).
// Steps see a reduced environment, so tokens and API keys in the shell (and .env) stay out, and
// `claude` and `codex` fail: CI never calls a live model. Logs and the summary go to
// .ci/<date>-<commit>/. The design follows propeller's and lakeshore's local CI.
//
//   node site/scripts/ci/run.mjs [rev] [--job check,e2e] [--post] [--keep]
//
// --post sets a commit status per job on GitHub, `local / <job name>`, so the PR shows the result
// next to (not in place of) the Actions checks. Statuses use the GitHub API, not Actions; the token
// stays with `gh`. --keep keeps the worktree. Exits 1 if a job fails.

import { execFileSync, spawn } from 'node:child_process';
import { chmodSync, closeSync, cpSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, statfsSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { adapt, jobsOf, localSteps, parseYaml } from './workflow.mjs';

/** @typedef {import('./workflow.mjs').Job} Job */
/** @typedef {import('./workflow.mjs').LocalStep} LocalStep */

const WORKFLOW = '.github/workflows/ci.yml';
/** Free space a run needs for the worktree, `node_modules`, the build and test output. */
const MIN_FREE_GB = 2;
/** The environment steps see; everything else (tokens, API keys) stays out, as on a hosted runner. */
const KEEP_ENV = ['PATH', 'HOME', 'USER', 'LOGNAME', 'LANG', 'LC_ALL', 'TMPDIR'];
/** Model CLIs shadowed by commands that fail. */
const NO_MODELS = ['claude', 'codex'];

/** @param {string} cwd @param {...string} args */
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const root = git(import.meta.dirname, 'rev-parse', '--show-toplevel');

/** @param {string[]} argv */
function parseArgs(argv) {
  /** @type {{ rev: string, jobs?: string[], post: boolean, keep: boolean }} */
  const options = { rev: 'HEAD', post: false, keep: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--post') options.post = true;
    else if (a === '--keep') options.keep = true;
    else if (a === '--job') options.jobs = (argv[++i] ?? '').split(',').filter(Boolean);
    else if (a.startsWith('--job=')) options.jobs = a.slice(6).split(',').filter(Boolean);
    else if (a.startsWith('-')) throw new Error(`unknown option ${a}`);
    else options.rev = a;
  }
  return options;
}

const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');
/** Local time to the minute: `2026-10-26 01:09`; with `sep = '-'`, `2026-10-26-0109` for a folder name. @param {Date} d */
function stamp(d, sep = ' ') {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}${sep}${pad(d.getHours())}${sep === ' ' ? ':' : ''}${pad(d.getMinutes())}`;
}
/** @param {number} ms */
function duration(ms) {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${pad(s % 60)} s`;
}

/**
 * Sets the commit status `local / <job name>` on GitHub through `gh`, which holds the token.
 * @param {string} sha @param {string} job @param {'pending' | 'success' | 'failure' | 'error'} state @param {string} description
 */
function post(sha, job, state, description) {
  execFileSync('gh', ['api', '--method', 'POST', `repos/{owner}/{repo}/statuses/${sha}`, '-f', `state=${state}`, '-f', `context=local / ${job}`, '-f', `description=${description.slice(0, 140)}`], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
}

/** @type {{ pid: number } | undefined} */
let current;

/**
 * Runs a command as GitHub runs `run:` steps (bash, -e, pipefail), its output appended to the log.
 * The command gets its own process group, so a timeout or Ctrl-C stops everything it started.
 * @param {string} command @param {string} cwd @param {NodeJS.ProcessEnv} env @param {string} log @param {number} deadline
 * @returns {Promise<{ ok: boolean, timedOut: boolean }>}
 */
function shell(command, cwd, env, log, deadline) {
  return new Promise(resolve => {
    const fd = openSync(log, 'a');
    const child = spawn('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', command], { cwd, env, detached: true, stdio: ['ignore', fd, fd] });
    current = { pid: child.pid };
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      writeFileSync(log, '\n[local CI] timeout-minutes reached\n', { flag: 'a' });
      kill(child.pid);
    }, Math.max(0, deadline - Date.now()));
    child.on('close', code => {
      clearTimeout(timer);
      closeSync(fd);
      current = undefined;
      resolve({ ok: code === 0 && !timedOut, timedOut });
    });
  });
}

/** @param {number} pid */
function kill(pid) {
  try {
    process.kill(-pid, 'SIGTERM');
    setTimeout(() => {
      try {
        process.kill(-pid, 'SIGKILL');
      } catch {}
    }, 5000).unref();
  } catch {}
}

/** Waits until no other local CI run holds `.ci/lock`; returns the release. A lock whose process is gone is taken over. */
async function oneRunAtATime() {
  const lock = join(root, '.ci', 'lock');
  const alive = (/** @type {number} */ pid) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch (e) {
      return e.code === 'EPERM';
    }
  };
  for (let told = false; ;) {
    try {
      writeFileSync(lock, String(process.pid), { flag: 'wx' });
      return () => rmSync(lock, { force: true });
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      const pid = Number(readFileSync(lock, 'utf8'));
      if (!pid || !alive(pid)) {
        rmSync(lock, { force: true });
        continue;
      }
      if (!told) console.log(`Another local CI run (process ${pid}) is going on; waiting for it.`);
      told = true;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

/** A directory with a failing command for each model CLI, to put first on the steps' PATH. @param {string} tmp */
function modelShims(tmp) {
  const dir = join(tmp, 'shims');
  mkdirSync(dir, { recursive: true });
  for (const name of NO_MODELS) {
    writeFileSync(join(dir, name), `#!/bin/sh\necho 'local CI: no live model calls (${name})' >&2\nexit 1\n`);
    chmodSync(join(dir, name), 0o755);
  }
  return dir;
}

/** The last `n` lines a step wrote to the log, from byte `from` on. @param {string} file @param {number} from @param {number} n */
const tail = (file, from, n) => readFileSync(file).subarray(from).toString('utf8').trimEnd().split('\n').slice(-n).join('\n');

/**
 * @typedef {{ sha: string, worktree: string, tmp: string, out: string, installed: Set<string> }} Context
 * `tmp` is the run's temporary directory: the worktree, the model shims and each job's RUNNER_TEMP.
 */
/**
 * @typedef {{ label: string, result: 'pass' | 'fail' | 'skip', note?: string, ms: number }} StepOutcome
 * @typedef {{ job: Job, ok: boolean, ms: number, steps: StepOutcome[] }} Outcome
 */

/** @param {Job} job @param {Context} ctx @returns {Promise<Outcome>} */
async function runJob(job, ctx) {
  const started = Date.now();
  const deadline = started + (job.timeoutMinutes ?? 360) * 60_000;
  const log = join(ctx.out, `${job.id}.log`);
  const summary = join(ctx.out, `${job.id}.summary.md`);
  writeFileSync(log, `# ${job.name}\n# commit ${ctx.sha}\n`);
  /** @type {NodeJS.ProcessEnv} */
  const env = Object.fromEntries(KEEP_ENV.filter(k => process.env[k] !== undefined).map(k => [k, process.env[k]]));
  Object.assign(env, {
    PATH: `${modelShims(ctx.tmp)}:${env.PATH ?? ''}`,
    CI: 'true',
    RUNNER_TEMP: mkdtempSync(join(ctx.tmp, `${job.id}-`)),
    RUNNER_OS: process.platform,
    GITHUB_WORKSPACE: ctx.worktree,
    GITHUB_SHA: ctx.sha,
    GITHUB_STEP_SUMMARY: summary,
    ...job.env,
  });
  /** @type {StepOutcome[]} */
  const steps = [];
  let failed = false;
  for (const step of localSteps(job)) {
    if ((step.when === 'success' && failed) || (step.when === 'failure' && !failed)) {
      steps.push({ label: step.label, result: 'skip', ms: 0 });
      continue;
    }
    const t = Date.now();
    const from = statSync(log).size;
    writeFileSync(log, `\n## ${step.label}\n`, { flag: 'a' });
    const { ok, note } = await runStep(step, ctx, env, log, deadline);
    /** @type {StepOutcome} */
    const line = { label: step.label, result: ok ? (note?.startsWith('skipped') ? 'skip' : 'pass') : 'fail', ...(note ? { note } : {}), ms: Date.now() - t };
    steps.push(line);
    console.log(`  ${line.result.padEnd(4)}  ${line.label}${note ? `  (${note})` : ''}  ${duration(line.ms)}`);
    if (!ok) {
      failed = true;
      console.log(`${tail(log, from, 30).replace(/^/gm, '        ')}\n        … full log: ${relative(root, log)}`);
    }
  }
  return { job, ok: !failed, ms: Date.now() - started, steps };
}

/**
 * @param {LocalStep} step @param {Context} ctx @param {NodeJS.ProcessEnv} env @param {string} log @param {number} deadline
 * @returns {Promise<{ ok: boolean, note?: string }>}
 */
async function runStep(step, ctx, env, log, deadline) {
  const note = (/** @type {string} */ text) => writeFileSync(log, `${text}\n`, { flag: 'a' });
  switch (step.kind) {
    case 'checkout':
      note(`worktree of ${ctx.sha} at ${ctx.worktree}`);
      return { ok: true };
    case 'node': {
      const want = step.version ?? (step.file ? readFileSync(join(ctx.worktree, step.file), 'utf8').trim() : undefined);
      const have = process.versions.node;
      const same = !want || have.split('.')[0] === want.replace(/^v/, '').split('.')[0];
      note(`Node ${have}; the workflow asks for ${want ?? 'any'}`);
      return { ok: true, ...(same ? {} : { note: `Node ${have}, CI uses ${want}` }) };
    }
    case 'secrets': {
      try {
        execFileSync('gitleaks', ['version'], { stdio: 'ignore' });
      } catch {
        note('gitleaks is not installed: brew install gitleaks');
        return { ok: false, note: 'gitleaks missing' };
      }
      // The whole history up to the commit: more than the action scans on a PR, and still fast.
      const r = await shell(`gitleaks git --no-banner --redact --log-opts=${ctx.sha} .`, ctx.worktree, env, log, deadline);
      return { ok: r.ok, ...(r.timedOut ? { note: 'timed out' } : {}) };
    }
    case 'artifact': {
      const from = join(ctx.worktree, step.path);
      if (!existsSync(from)) return { ok: true, note: 'nothing to keep' };
      const to = join(ctx.out, 'artifacts', step.name);
      cpSync(from, to, { recursive: true });
      return { ok: true, note: `kept in ${relative(root, to)}` };
    }
    case 'shell': {
      const cwd = join(ctx.worktree, step.cwd);
      if (step.command === 'npm ci' && ctx.installed.has(cwd)) return { ok: true, note: 'skipped: installed earlier in this run' };
      const command = adapt(step.command, process.platform);
      note(`$ ${command}   (in ${step.cwd})`);
      const r = await shell(command, cwd, { ...env, ...step.env }, log, deadline);
      if (r.ok && step.command === 'npm ci') ctx.installed.add(cwd);
      return { ok: r.ok, ...(r.timedOut ? { note: 'timed out' } : command !== step.command ? { note: 'without --with-deps' } : {}) };
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const sha = git(root, 'rev-parse', '--verify', `${options.rev}^{commit}`);
  const short = sha.slice(0, 7);
  const all = jobsOf(parseYaml(git(root, 'show', `${sha}:${WORKFLOW}`)));
  const unknown = (options.jobs ?? []).filter(id => !all.some(j => j.id === id));
  if (unknown.length) throw new Error(`no job ${unknown.join(', ')}; the jobs are ${all.map(j => j.id).join(', ')}`);
  const jobs = options.jobs ? all.filter(j => options.jobs.includes(j.id)) : all;
  for (const job of jobs) localSteps(job); // every step must have a local equivalent before anything runs

  const { bavail, bsize } = statfsSync(tmpdir());
  const free = (bavail * bsize) / 2 ** 30;
  if (free < MIN_FREE_GB) throw new Error(`${free.toFixed(1)} GB free on the disk of ${tmpdir()}; a run needs about ${MIN_FREE_GB} GB`);
  if (sha === git(root, 'rev-parse', 'HEAD') && git(root, 'status', '--porcelain', '--untracked-files=no')) console.log('Note: uncommitted changes are not part of this run; it checks the commit.');
  if (options.post && !git(root, 'branch', '-r', '--contains', sha)) throw new Error(`--post: ${short} is not on GitHub yet; push it first`);

  mkdirSync(join(root, '.ci'), { recursive: true });
  const release = await oneRunAtATime();
  if (options.post) for (const job of jobs) post(sha, job.name, 'pending', 'Local CI (just ci) running');
  const out = join(root, '.ci', `${stamp(new Date(), '-')}-${short}`);
  mkdirSync(out, { recursive: true });
  const tmp = mkdtempSync(join(tmpdir(), `kibitz-ci-${short}-`));
  const worktree = join(tmp, 'worktree');
  git(root, 'worktree', 'add', '--detach', '--quiet', worktree, sha);
  const cleanup = () => {
    release();
    if (options.keep) return console.log(`Kept the worktree: ${worktree}`);
    try {
      git(root, 'worktree', 'remove', '--force', worktree);
    } catch {}
    rmSync(tmp, { recursive: true, force: true });
  };
  /** @type {Outcome[]} */
  const outcomes = [];
  /** A run that stops early leaves no status pending: the jobs it didn't finish get `error`. @param {string} reason */
  const abandon = reason => {
    if (!options.post) return;
    for (const job of jobs.filter(j => !outcomes.some(o => o.job === j))) {
      try {
        post(sha, job.name, 'error', `Local CI stopped: ${reason}`);
      } catch {}
    }
  };
  // Ctrl-C and a kill stop the run the same way: the step and everything it started, the worktree removed.
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      if (current) kill(current.pid);
      abandon('interrupted');
      cleanup();
      process.exit(130);
    });
  }

  console.log(`Local CI for ${short} (${git(root, 'log', '-1', '--format=%s', sha)}), ${jobs.length} job(s), logs in ${relative(root, out)}`);
  /** @type {Context} */
  const ctx = { sha, worktree, tmp, out, installed: new Set() };
  let postFailed = false;
  try {
    for (const job of jobs) {
      console.log(`\n${job.name}`);
      const o = await runJob(job, ctx);
      outcomes.push(o);
      console.log(`  → ${o.ok ? 'pass' : 'fail'} in ${duration(o.ms)}`);
      if (options.post) {
        try {
          post(sha, job.name, o.ok ? 'success' : 'failure', `Local CI (just ci): ${o.ok ? 'passed' : 'failed'} in ${duration(o.ms)} on Node ${process.versions.node}`);
        } catch (e) {
          postFailed = true;
          console.error(`  could not post the status: ${e.message}`);
        }
      }
    }
  } catch (e) {
    abandon(e.message);
    throw e;
  } finally {
    cleanup();
  }

  const lines = [
    `# Local CI: ${short}`,
    '',
    `Commit ${sha}, run ${stamp(new Date())} on ${process.platform} ${process.arch}, Node ${process.versions.node}. Workflow: ${WORKFLOW} at that commit.`,
    '',
    '| Job | Result | Time |',
    '| --- | --- | --- |',
    ...outcomes.map(o => `| ${o.job.name} | ${o.ok ? 'pass' : 'fail'} | ${duration(o.ms)} |`),
    '',
    ...outcomes.flatMap(o => [`## ${o.job.name}`, '', ...o.steps.map(s => `- ${s.result}: ${s.label}${s.note ? ` (${s.note})` : ''}`), '']),
  ];
  for (const o of outcomes) {
    const s = join(out, `${o.job.id}.summary.md`);
    if (existsSync(s)) lines.push(`## Summary of ${o.job.name}`, '', readFileSync(s, 'utf8'), '');
  }
  writeFileSync(join(out, 'summary.md'), `${lines.join('\n')}\n`);
  console.log('');
  for (const o of outcomes) console.log(`${o.job.name}: ${o.ok ? 'pass' : 'fail'}`);
  console.log(`Summary: ${relative(root, join(out, 'summary.md'))}${options.post ? (postFailed ? '; posting a status failed' : '; statuses posted') : ''}`);
  process.exitCode = outcomes.every(o => o.ok) && !postFailed ? 0 : 1;
}

main().catch(e => {
  console.error(`ci: ${e.message}`);
  process.exitCode = 1;
});
