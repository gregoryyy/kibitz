// Real CLI + real SDKs, with every fetch replaced in the subprocess. Never reads operator .env.
import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const site = fileURLToPath(new URL('../..', import.meta.url));
const preload = new URL('../fixtures/fixture-recording.mjs', import.meta.url).href;
const secret = 'synthetic-cli-credential-32-characters';
function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kibitz-fixture-cli-')), app = path.join(dir, 'site');
  fs.mkdirSync(path.join(app, 'scripts'), { recursive: true });
  // Copy fixtures as well: running the prior recorder must never overwrite repository fixtures.
  fs.cpSync(path.join(site, 'server'), path.join(app, 'server'), { recursive: true });
  fs.symlinkSync(path.join(site, 'src'), path.join(app, 'src'), 'dir');
  fs.symlinkSync(fs.realpathSync(path.join(site, 'node_modules')), path.join(app, 'node_modules'), 'dir');
  for (const name of ['record-ai-fixtures.mjs', 'fixture-recording.mjs'])
    fs.copyFileSync(name === 'record-ai-fixtures.mjs' && process.env.KIBITZ_FIXTURE_OLD_SCRIPT || path.join(site, 'scripts', name), path.join(app, 'scripts', name));
  const envFile = path.join(dir, 'empty.env'); fs.writeFileSync(envFile, '');
  return { dir, app, envFile, count: path.join(dir, 'requests'), output: path.join(dir, '.kibitz-data', 'ai-fixtures') };
}
async function run(box, args = [], scenario = 'valid', extraEnv = {}) {
  const child = spawn(process.execPath, ['--import', preload, path.join(box.app, 'scripts/record-ai-fixtures.mjs'), '--env', box.envFile, ...args], {
    stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env,
      AI_LOCAL_ONLY: '', AI_TIMEOUT_MS: '5000', ANTHROPIC_API_KEY: '', OPENAI_API_KEY: secret, MISTRAL_API_KEY: '',
      OPENAI_BASE_URL: 'https://fixture.invalid/v1', OPENAI_MODEL: 'fixture-model', OLLAMA_MODEL: '',
      KIBITZ_FIXTURE_COUNT: box.count, KIBITZ_FIXTURE_SCENARIO: scenario, KIBITZ_FIXTURE_PROVIDER: 'openai', OPENAI_LOG: 'debug', ...extraEnv },
  });
  let stdout = '', stderr = '';
  const timer = setTimeout(() => child.kill(), 10_000);
  child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
  try {
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
    const requests = fs.existsSync(box.count) ? fs.readFileSync(box.count, 'utf8').trim().split('\n').length : 0;
    return { code, stdout, stderr, requests };
  } finally { clearTimeout(timer); }
}

test('fixture recording requires explicit confirmation before inference or overwriting any file', async () => {
  const box = sandbox(), target = path.join(box.dir, 'operator-file'), fixture = path.join(box.app, 'server/fixtures/openai-chat.json');
  try {
    fs.writeFileSync(target, 'preserve'); fs.unlinkSync(fixture); fs.symlinkSync(target, fixture);
    const result = await run(box, ['openai']);
    expect(result.requests, result.stdout + result.stderr).toBe(0); expect(result.code).toBe(2);
    expect(fs.readFileSync(target, 'utf8')).toBe('preserve'); expect(fs.lstatSync(fixture).isSymbolicLink()).toBe(true);
    expect(fs.existsSync(box.output)).toBe(false);
  } finally { fs.rmSync(box.dir, { recursive: true, force: true }); }
});

test('plan and invalid selections/configuration leave output absent and make no requests', async () => {
  const variants = [
    { args: ['openai', '--plan', '--yes'], code: 0 },
    { args: ['openai', '--env=', '--plan'], code: 0 },
    { args: ['openai', '--plan', '--out', 'dist'], code: 1 },
    { args: ['openai', 'openai', '--yes'], code: 1 },
    { args: ['../escape', '--yes'], code: 1 },
    { args: ['openai', '--yes'], env: { AI_LOCAL_ONLY: '1', OLLAMA_MODEL: 'fixture-local' }, code: 1 },
    { args: ['openai', '--yes'], env: { OPENAI_API_KEY: '' }, code: 1 },
    { args: ['ollama'], env: { OLLAMA_MODEL: 'fixture-local' }, code: 2 },
  ];
  for (const variant of variants) {
    const box = sandbox();
    try {
      const result = await run(box, variant.args, 'valid', variant.env);
      expect(result.requests).toBe(0); expect(result.code, result.stderr).toBe(variant.code); expect(fs.existsSync(box.output)).toBe(false);
      expect(result.stdout + result.stderr).not.toContain(secret);
    } finally { fs.rmSync(box.dir, { recursive: true, force: true }); }
  }
});

test('approved synthetic capture stages two successful private fixtures and preserves tracked copies', async () => {
  const box = sandbox(), original = fs.readFileSync(path.join(box.app, 'server/fixtures/openai-chat.json'));
  try {
    const result = await run(box, ['openai', '--yes']);
    expect(result.code, result.stderr).toBe(0); expect(result.requests).toBe(2);
    expect(result.stdout + result.stderr).not.toContain('sending request'); expect(result.stdout + result.stderr).not.toContain('fixture.invalid');
    expect(fs.readdirSync(box.output).sort()).toEqual(['openai-chat.json', 'openai-json.json']);
    for (const name of fs.readdirSync(box.output)) {
      const file = path.join(box.output, name), saved = JSON.parse(fs.readFileSync(file, 'utf8'));
      expect(saved.status).toBe(200); expect(saved.source).toMatch(/^recorded /); expect(saved.body).toContain('[DONE]');
      expect(JSON.stringify(saved)).not.toContain('do-not-store'); expect(JSON.stringify(saved)).not.toContain(secret);
      if (process.platform !== 'win32') expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    }
    expect(fs.readFileSync(path.join(box.app, 'server/fixtures/openai-chat.json'))).toEqual(original);
  } finally { fs.rmSync(box.dir, { recursive: true, force: true }); }
});

test('failed, reflected, oversized and truncated captures preserve previous files and keep diagnostics private', async () => {
  for (const scenario of ['http-error', 'throw', 'secret', 'oversize', 'truncated']) {
    const box = sandbox();
    try {
      fs.mkdirSync(box.output, { recursive: true }); fs.writeFileSync(path.join(box.output, 'openai-chat.json'), 'preserve');
      const result = await run(box, ['openai', '--yes'], scenario);
      expect(result.code, scenario).toBe(1); expect(result.requests, scenario).toBe(1);
      expect(result.stdout + result.stderr).not.toContain(secret);
      expect(result.stdout + result.stderr).not.toContain('sending request'); expect(result.stdout + result.stderr).not.toContain('fixture.invalid');
      expect(fs.readFileSync(path.join(box.output, 'openai-chat.json'), 'utf8')).toBe('preserve');
      expect(fs.readdirSync(box.output)).toEqual(['openai-chat.json']);
    } finally { fs.rmSync(box.dir, { recursive: true, force: true }); }
  }
});
