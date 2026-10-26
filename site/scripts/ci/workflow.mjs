// The jobs of a GitHub Actions workflow, read for the local CI (docs/CI.md, TODO 0.18). The workflow
// file stays the one definition of CI: `run:` steps run as written, and each `uses:` step maps to a
// local equivalent below. An action without one, an expression in a `run:` step or a YAML feature
// beyond the small subset the workflow uses is an error, so the two can't drift apart silently.
// Pure. Ported from propeller's utils/ci/workflow.ts, as is lakeshore's local CI.

/** @typedef {string | YamlList | YamlMap} Yaml A YAML value as far as workflows need it: scalars stay strings. */
/** @typedef {Yaml[]} YamlList */
/** @typedef {{ [key: string]: Yaml }} YamlMap */
/** @typedef {{ n: number, indent: number, text: string }} Line */

/** The content of a line without its comment: `#` at the start or after a space, outside quotes. */
function stripComment(text) {
  let quote = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote) quote = '';
    } else if ((c === '"' || c === "'") && (i === 0 || /[\s:[,-]/.test(text[i - 1]))) quote = c;
    else if (c === '#' && (i === 0 || /\s/.test(text[i - 1]))) return text.slice(0, i).trimEnd();
  }
  return text.trimEnd();
}

/** @param {string} raw @param {Line} line @returns {Yaml} */
function scalar(raw, line) {
  const s = raw.trim();
  if (/^[|>][-+]?$/.test(s)) throw new Error(`line ${line.n}: block scalars aren't supported; keep the command on one line`);
  if (/^[&*!]/.test(s)) throw new Error(`line ${line.n}: anchors, aliases and tags aren't supported`);
  if (s.startsWith('[') && s.endsWith(']')) return s.slice(1, -1).split(',').map(x => /** @type {string} */ (scalar(x, line))).filter(x => x !== '');
  if (s.length >= 2 && (s[0] === '"' || s[0] === "'") && s.at(-1) === s[0]) return s.slice(1, -1);
  return s;
}

const KEY = /^([A-Za-z0-9_.-]+):(?:\s+(.*))?$/;

/** Block mappings, block sequences and plain, quoted or flow-list scalars: what a workflow uses. @param {string} text @returns {Yaml} */
export function parseYaml(text) {
  /** @type {Line[]} */
  const lines = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    if (raw.includes('\t')) throw new Error(`line ${i + 1}: tabs aren't allowed in YAML indentation`);
    const content = stripComment(raw.trimStart());
    if (content) lines.push({ n: i + 1, indent: raw.length - raw.trimStart().length, text: content });
  });
  let at = 0;
  const isItem = (/** @type {Line} */ l) => l.text === '-' || l.text.startsWith('- ');

  /** @param {number} indent @returns {Yaml} */
  const block = indent => isItem(lines[at]) ? sequence(indent) : mapping(indent);

  /** @param {string | undefined} rest @param {Line} line @param {number} indent @returns {Yaml} */
  function value(rest, line, indent) {
    if (rest) return scalar(rest, line);
    const next = lines[at];
    if (next && (next.indent > indent || (next.indent === indent && isItem(next)))) return block(next.indent);
    return '';
  }

  /** @param {number} indent @returns {YamlMap} */
  function mapping(indent) {
    /** @type {YamlMap} */
    const result = {};
    while (at < lines.length && lines[at].indent === indent && !isItem(lines[at])) {
      const line = lines[at++];
      const m = KEY.exec(line.text);
      if (!m) throw new Error(`line ${line.n}: expected "key: value", got "${line.text}"`);
      if (Object.hasOwn(result, m[1])) throw new Error(`line ${line.n}: duplicate key "${m[1]}"`);
      result[m[1]] = value(m[2], line, indent);
    }
    if (at < lines.length && lines[at].indent > indent) throw new Error(`line ${lines[at].n}: unexpected indentation`);
    return result;
  }

  /** @param {number} indent @returns {YamlList} */
  function sequence(indent) {
    /** @type {YamlList} */
    const result = [];
    while (at < lines.length && lines[at].indent === indent && isItem(lines[at])) {
      const line = lines[at];
      const after = line.text.slice(1).trimStart();
      if (!after) {
        at++;
        result.push(value(undefined, line, indent));
      } else if (KEY.test(after)) {
        // `- key: value` opens a mapping whose keys line up with `key`.
        lines[at] = { n: line.n, indent: indent + line.text.length - after.length, text: after };
        result.push(mapping(lines[at].indent));
      } else {
        at++;
        result.push(scalar(after, line));
      }
    }
    return result;
  }

  if (!lines.length) return {};
  const doc = block(lines[0].indent);
  if (at < lines.length) throw new Error(`line ${lines[at].n}: unexpected indentation`);
  return doc;
}

/**
 * One step of a job, as written.
 * @typedef {{ name?: string, run?: string, uses?: string, with: Record<string, string>, env: Record<string, string>, if?: string, workdir?: string }} Step
 */
/**
 * One job, as written. `env` is the workflow's, then the job's; `workdir` is
 * `defaults.run.working-directory`, the job's or else the workflow's.
 * @typedef {{ id: string, name: string, timeoutMinutes?: number, env: Record<string, string>, workdir?: string, steps: Step[] }} Job
 */

// The keys the local run understands. `on`, `permissions`, `concurrency` and `runs-on` concern
// GitHub's triggers, token and runners only; anything else (services, matrix, a `shell` default,
// continue-on-error) stops the run rather than being skipped.
const WORKFLOW_KEYS = new Set(['name', 'on', 'permissions', 'concurrency', 'defaults', 'env', 'jobs']);
const JOB_KEYS = new Set(['name', 'runs-on', 'timeout-minutes', 'permissions', 'defaults', 'env', 'steps']);
const STEP_KEYS = new Set(['name', 'run', 'uses', 'with', 'env', 'if', 'working-directory']);

/** @param {YamlMap} y @param {Set<string>} allowed @param {string} where */
function known(y, allowed, where) {
  const unknown = Object.keys(y).filter(k => !allowed.has(k));
  if (unknown.length) throw new Error(`${where}: ${unknown.join(', ')} not supported locally`);
}

/** @param {Record<string, string>} env @param {string} where */
function noExpressions(env, where) {
  for (const [k, v] of Object.entries(env)) if (v.includes('${{')) throw new Error(`${where}.${k}: expressions aren't supported locally`);
}

/** @param {Yaml | undefined} y @returns {y is YamlMap} */
const isMap = y => typeof y === 'object' && y !== null && !Array.isArray(y);

/** @param {Yaml | undefined} y @param {string} where @returns {Record<string, string>} */
function strings(y, where) {
  if (y === undefined || y === '') return {};
  if (!isMap(y)) throw new Error(`${where}: expected a mapping`);
  return Object.fromEntries(Object.entries(y).map(([k, v]) => {
    if (typeof v !== 'string') throw new Error(`${where}.${k}: expected a string`);
    return [k, v];
  }));
}

/** @param {Yaml | undefined} y @param {string} where @returns {string | undefined} */
function str(y, where) {
  if (y === undefined) return undefined;
  if (typeof y !== 'string') throw new Error(`${where}: expected a string`);
  return y;
}

/** The jobs of a parsed workflow, in file order. @param {Yaml} workflow @returns {Job[]} */
export function jobsOf(workflow) {
  if (!isMap(workflow) || !isMap(workflow.jobs)) throw new Error('the workflow has no jobs');
  known(workflow, WORKFLOW_KEYS, 'workflow');
  const workflowEnv = strings(workflow.env, 'env');
  noExpressions(workflowEnv, 'env');
  return Object.entries(workflow.jobs).map(([id, j]) => {
    if (!isMap(j)) throw new Error(`jobs.${id}: expected a mapping`);
    known(j, JOB_KEYS, `jobs.${id}`);
    /** @type {[string, Yaml | undefined][]} */
    const levels = [['defaults', workflow.defaults], [`jobs.${id}.defaults`, j.defaults]];
    for (const [where, d] of levels) {
      if (d === undefined) continue;
      if (!isMap(d)) throw new Error(`${where}: expected a mapping`);
      known(d, new Set(['run']), where);
      if (isMap(d.run)) known(d.run, new Set(['working-directory']), `${where}.run`);
    }
    const defaults = isMap(j.defaults) && isMap(j.defaults.run) ? j.defaults.run
      : isMap(workflow.defaults) && isMap(workflow.defaults.run) ? workflow.defaults.run : {};
    const env = { ...workflowEnv, ...strings(j.env, `jobs.${id}.env`) };
    noExpressions(env, `jobs.${id}.env`);
    if (!Array.isArray(j.steps)) throw new Error(`jobs.${id}.steps: expected a list`);
    const timeout = str(j['timeout-minutes'], `jobs.${id}.timeout-minutes`);
    const workdir = str(defaults['working-directory'], `jobs.${id}.defaults`);
    return {
      id,
      name: str(j.name, `jobs.${id}.name`) ?? id,
      ...(timeout ? { timeoutMinutes: Number(timeout) } : {}),
      env,
      ...(workdir ? { workdir } : {}),
      steps: j.steps.map((s, i) => {
        const where = `jobs.${id}.steps[${i}]`;
        if (!isMap(s)) throw new Error(`${where}: expected a mapping`);
        known(s, STEP_KEYS, where);
        /** @type {Step} */
        const step = { with: strings(s.with, `${where}.with`), env: strings(s.env, `${where}.env`) };
        for (const [key, field] of [['name', 'name'], ['run', 'run'], ['uses', 'uses'], ['if', 'if'], ['working-directory', 'workdir']]) {
          const v = str(s[key], `${where}.${key}`);
          if (v !== undefined) step[field] = v;
        }
        if (!step.run === !step.uses) throw new Error(`${where}: needs exactly one of run and uses`);
        // An action's env (such as a token for the hosted action) has no local use; a command's env does.
        if (step.run) noExpressions(step.env, `${where}.env`);
        return step;
      }),
    };
  });
}

/** @typedef {'success' | 'failure' | 'always'} Condition */

/** When a step runs: GitHub's status functions, the only conditions the workflow uses. @param {string | undefined} expr @returns {Condition} */
export function condition(expr) {
  if (expr === undefined) return 'success';
  const m = /^(?:\$\{\{\s*)?(success|failure|always)\(\)(?:\s*\}\})?$/.exec(expr.trim());
  if (!m) throw new Error(`if: "${expr}": only success(), failure() and always() are supported locally`);
  return /** @type {Condition} */ (m[1]);
}

/**
 * A step as it runs locally; paths are relative to the checkout.
 * - shell: a `run:` step, with its command, directory and env.
 * - checkout (actions/checkout): the run's clean worktree of the commit already is the checkout.
 * - node (actions/setup-node): the machine's Node, compared with the version the workflow asks for.
 * - secrets (gitleaks/gitleaks-action): the gitleaks binary over the history up to the commit.
 * - artifact (actions/upload-artifact): copied next to the run's logs.
 * @typedef {{ label: string, when: Condition, kind: 'shell' | 'checkout' | 'node' | 'secrets' | 'artifact',
 *   command?: string, cwd?: string, env?: Record<string, string>, file?: string, version?: string, name?: string, path?: string }} LocalStep
 */

/** @param {...(string | undefined)} parts */
const joinPath = (...parts) => parts.filter(p => p && p !== '.').join('/') || '.';

/** The local equivalent of every step of a job; throws for an action without one. @param {Job} job @returns {LocalStep[]} */
export function localSteps(job) {
  return job.steps.map(s => {
    const when = condition(s.if);
    if (s.run !== undefined) {
      if (s.run.includes('${{')) throw new Error(`jobs.${job.id}: "${s.run}": expressions in run steps aren't supported locally`);
      return { kind: 'shell', label: s.name ?? s.run, when, command: s.run, cwd: joinPath(s.workdir ?? job.workdir), env: s.env };
    }
    const action = s.uses.split('@')[0];
    const label = s.name ?? action;
    switch (action) {
      case 'actions/checkout':
        return { kind: 'checkout', label, when };
      case 'actions/setup-node':
        return { kind: 'node', label, when, file: s.with['node-version-file'], version: s.with['node-version'] };
      case 'gitleaks/gitleaks-action':
        return { kind: 'secrets', label, when };
      case 'actions/upload-artifact':
        return { kind: 'artifact', label, when, name: s.with.name ?? 'artifact', path: s.with.path ?? '.' };
      default:
        throw new Error(`jobs.${job.id}: no local equivalent for ${action}; add one in site/scripts/ci/workflow.mjs`);
    }
  });
}

/**
 * A command adapted to this machine. `--with-deps` installs a browser's system libraries with apt,
 * which only exists on the Linux runners; elsewhere the browser alone is installed.
 * @param {string} command @param {string} platform
 */
export function adapt(command, platform) {
  return platform === 'linux' ? command : command.replace(/\s--with-deps\b/, '');
}
