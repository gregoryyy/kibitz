import { test, expect } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { steps } from '../../flipbook/tour.mjs';
const execute = promisify(execFile), site = fileURLToPath(new URL('../..', import.meta.url));
async function run(args) {
  const probe = net.createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  return await execute(process.execPath, ['scripts/flipbook.mjs', '--ai', 'mock', '--port', String(port), ...args], {
    cwd: site, timeout: 240_000, maxBuffer: 2_000_000,
    env: { ...process.env, AI_PROVIDER: 'mock', EMBEDDING_PROVIDER: 'mock', ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', MISTRAL_API_KEY: '', OLLAMA_MODEL: '' },
  });
}

// The CLI deliberately refuses output inside site/. Default Playwright output lives there,
// so use an actual temporary destination and attach the evidence before removing it.
async function withOutput(check) {
  const out = await fs.mkdtemp(path.join(os.tmpdir(), 'kibitz-flipbook-test-'));
  try { await check(out); } finally { await fs.rm(out, { recursive: true, force: true }); }
}

test('a no-call flipbook plan leaves existing output intact', async () => withOutput(async out => {
  await fs.writeFile(path.join(out, 'readme.md'), 'retain this output');
  const result = await run(['--plan', '--out', out]); expect(result.stdout).toContain('about 9 calls'); expect(result.stdout).toContain('no model requests, browser or output changes');
  expect(await fs.readFile(path.join(out, 'readme.md'), 'utf8')).toBe('retain this output'); expect(await fs.readdir(out)).toEqual(['readme.md']);
}));

test('the complete current flipbook renders desktop and German phone screenshots with mock coaching', async ({ baseURL }, info) => {
  test.setTimeout(300_000); await withOutput(async out => {
  const result = await run(['--out', out]); expect(result.stdout).toContain(`${steps.length} steps`);
  const capture = JSON.parse(await fs.readFile(path.join(out, 'run.json'), 'utf8'));
  expect(capture.provider).toBe('mock'); expect(capture.capture).toBe('coach-prose-v2');
  expect(capture.shots.map(shot => shot.id)).toEqual(steps.map(step => step.id)); expect(capture.shots.flatMap(shot => shot.quotes)).toHaveLength(9);
  expect(capture.shots.find(shot => shot.id === 'load').mainBoardVisible).toBe(true);
  for (const shot of capture.shots) {
    const image = await fs.readFile(path.join(out, shot.file)); expect(image.subarray(1, 4).toString()).toBe('PNG');
    expect(image.readUInt32BE(16)).toBe(shot.image.width); expect(image.readUInt32BE(20)).toBe(shot.image.height);
    if (shot.region) { expect(shot.image.width).toBeLessThanOrEqual(shot.viewport.width); expect(shot.image.height).toBeGreaterThan(0); }
    else expect(shot.image).toEqual(shot.viewport);
  }
  expect(capture.shots.at(-1).viewport).toEqual({ width: 390, height: 844 });
  const readme = await fs.readFile(path.join(out, 'readme.md'), 'utf8'); expect(readme).toContain('UI preview, not coaching evidence');
  expect(readme).toContain('spaced practice'); expect(readme).toContain('German'); expect(readme).not.toContain('which the app strikes through');
  expect((await fs.readdir(out)).length).toBe(steps.length + 2);
  for (const name of ['run.json', '01-load.png', '19-german-opening-guide.png']) await info.attach(name, { path: path.join(out, name) });
  });
});
