// Exercise the real download command with a subprocess-only synthetic catalogue/fetch preload.
import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { BROWSER_MODELS } from '../../server/models.mjs';
const script = fileURLToPath(new URL('../../scripts/fetch-model.mjs', import.meta.url));
const preload = new URL('../fixtures/model-download.mjs', import.meta.url).href;
const bytes = Buffer.from('synthetic verified weights\n'), filename = 'qwen2.5-1.5b-instruct-q4_k_m.gguf';

async function download(dir, scenario, args = []) {
  const child = spawn(process.execPath, ['--import', preload, script, '--dir', dir, ...args], {
    stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, KIBITZ_DOWNLOAD_SCENARIO: scenario, BROWSER_MODEL: 'qwen2.5-1.5b',
      ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', MISTRAL_API_KEY: '', AI_PROVIDER: 'mock' },
  });
  let stdout = '', stderr = '', maxPartBytes = 0;
  const sample = () => {
    for (const name of fs.readdirSync(dir)) {
      if (!name.includes('.part')) continue;
      try { maxPartBytes = Math.max(maxPartBytes, fs.statSync(path.join(dir, name)).size); } catch { /* a completed/aborted file was removed */ }
    }
  };
  const poll = setInterval(sample, 5);
  try {
    const code = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { child.kill(); reject(Error('Synthetic download process did not stop')); }, 10_000);
      child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
      child.once('exit', code => { clearTimeout(timer); resolve(code); }); child.once('error', error => { clearTimeout(timer); reject(error); });
    });
    return { code, stdout, stderr, maxPartBytes };
  } finally {
    clearInterval(poll);
    if (child.exitCode === null && child.signalCode === null) { const stopped = new Promise(resolve => child.once('exit', resolve)); child.kill(); await stopped; }
  }
}

test('model download never writes beyond its pinned size before rejecting an oversized response', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kibitz-download-overflow-'));
  try {
    const result = await download(dir, 'oversize'); expect(result.code).not.toBe(0);
    expect(result.maxPartBytes).toBeLessThanOrEqual(bytes.length);
    expect(fs.existsSync(path.join(dir, filename))).toBe(false); expect(fs.readdirSync(dir)).toEqual([]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('verified synthetic download publishes the exact file and marker without leftover partials', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kibitz-download-valid-'));
  try {
    const result = await download(dir, 'valid'); expect(result.code, result.stderr).toBe(0); expect(result.stdout).toContain('SHA-256 checked');
    expect(fs.readFileSync(path.join(dir, filename))).toEqual(bytes);
    expect(fs.readFileSync(path.join(dir, filename + '.sha256'), 'utf8').trim()).toBe(crypto.createHash('sha256').update(bytes).digest('hex'));
    expect(fs.readdirSync(dir).sort()).toEqual([filename, filename + '.sha256'].sort());
    const again = await download(dir, 'oversize'); expect(again.code, again.stderr).toBe(0); expect(again.stdout).toContain('already downloaded and checked');
    expect(fs.readFileSync(path.join(dir, filename))).toEqual(bytes);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('both catalogue models request immutable upstream revisions through the real CLI', async () => {
  for (const model of BROWSER_MODELS) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kibitz-download-revision-'));
    try {
      const result = await download(dir, 'valid', ['--model', model.id]);
      expect(result.code, result.stderr).toBe(0);
      expect(result.stdout).toContain(`from ${model.source}`);
      expect(fs.readFileSync(path.join(dir, model.file))).toEqual(bytes);
      expect(fs.readFileSync(path.join(dir, model.file + '.sha256'), 'utf8').trim()).toBe(crypto.createHash('sha256').update(bytes).digest('hex'));
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
});

test('wrong hashes, truncation and stalled headers/body leave no published or partial download', async () => {
  for (const scenario of ['wrong-hash', 'truncated', 'headers-hang', 'body-hang']) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kibitz-download-failure-'));
    try {
      const result = await download(dir, scenario, ['--timeout-ms', '250']); expect(result.code, scenario).not.toBe(0);
      if (scenario.endsWith('hang')) expect(result.stderr).toContain('timed out');
      expect(fs.readdirSync(dir), scenario).toEqual([]);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
});
