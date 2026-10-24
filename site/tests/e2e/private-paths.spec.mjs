// Real CLI regressions for private databases colliding with a separately served model tree.
// Only synthetic files and a mock provider are used; no model download or inference.
import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
const script = fileURLToPath(new URL('../../scripts/serve.mjs', import.meta.url));
const modelFile = 'qwen2.5-0.5b-instruct-q4_k_m.gguf';

async function launch(root, models, args, api = true) {
  const probe = net.createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const child = spawn(process.execPath, [script, root, '--models', models, '--port', String(port), ...(api ? ['--api', '--env='] : []), ...args], {
    stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, AI_PROVIDER: 'mock', EMBEDDING_PROVIDER: 'mock', AI_LOCAL_ONLY: '',
      ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', MISTRAL_API_KEY: '', OLLAMA_MODEL: '', BROWSER_MODEL: 'qwen2.5-0.5b' },
  });
  let output = '', errors = '';
  const state = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(Error('Private-path fixture startup timeout')); }, 15_000);
    child.stdout.on('data', chunk => { output += chunk; if (output.includes('Serving ')) { clearTimeout(timer); resolve({ started: true, code: null }); } });
    child.stderr.on('data', chunk => { errors += chunk; });
    child.once('exit', code => { clearTimeout(timer); resolve({ started: false, code }); });
    child.once('error', error => { clearTimeout(timer); reject(error); });
  });
  return { ...state, errors, base: `http://127.0.0.1:${port}`, stop: async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const stopped = new Promise(resolve => child.once('exit', resolve)); child.kill(); await stopped;
  } };
}

test('library and usage databases cannot be published as model weights through real or aliased roots', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kibitz-private-model-root-'));
  const root = path.join(dir, 'public'), models = path.join(dir, 'weights'), alias = path.join(dir, 'alias');
  fs.mkdirSync(root); fs.mkdirSync(models); fs.symlinkSync(models, alias);
  try {
    for (const [flag, api] of [['--usage', true], ['--library', true], ['--library', false]]) {
      for (const aliased of [false, true]) {
        const file = path.join(aliased ? alias : models, modelFile), server = await launch(root, aliased ? models : alias, [flag, file], api);
        try {
          expect(server.started, `${flag}, alias=${aliased}: ${server.errors}`).toBe(false);
          expect(server.code).not.toBe(0); expect(server.errors).toContain('outside');
          expect(fs.existsSync(file)).toBe(false);
        } finally { await server.stop(); }
      }
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('an absent model directory is rejected before a private database or its parents are created', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kibitz-absent-model-root-')), root = path.join(dir, 'public'); fs.mkdirSync(root);
  const models = path.join(dir, 'absent-models'), file = path.join(dir, 'private', 'library.sqlite');
  const server = await launch(root, models, ['--library', file]);
  try {
    expect(server.started).toBe(false); expect(server.errors).toContain('model directory');
    expect(fs.existsSync(path.dirname(file))).toBe(false); expect(fs.existsSync(models)).toBe(false);
  } finally { await server.stop(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('valid private paths work beside a model directory and expose only the synthetic model file', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kibitz-private-model-valid-'));
  const root = path.join(dir, 'public'), models = path.join(dir, 'models'), library = path.join(dir, 'private', 'library.sqlite'), usage = path.join(dir, 'private', 'usage.sqlite');
  fs.mkdirSync(root); fs.mkdirSync(models); fs.writeFileSync(path.join(models, modelFile), 'synthetic public weights');
  const server = await launch(root, models, ['--library', library, '--usage', usage]);
  try {
    expect(server.started, server.errors).toBe(true);
    expect((await (await fetch(server.base + '/api/library/status')).json()).available).toBe(true);
    expect((await fetch(server.base + '/api/ai/status')).status).toBe(200);
    const response = await fetch(server.base + '/models/' + modelFile); expect(response.status).toBe(200); expect(await response.text()).toBe('synthetic public weights');
    for (const name of ['library.sqlite', 'usage.sqlite']) {
      expect(fs.statSync(path.join(dir, 'private', name)).mode & 0o777).toBe(0o600);
      expect((await fetch(server.base + '/models/' + name)).status).toBe(404);
      expect((await fetch(server.base + '/private/' + name)).status).toBe(404);
    }
  } finally { await server.stop(); fs.rmSync(dir, { recursive: true, force: true }); }
});
