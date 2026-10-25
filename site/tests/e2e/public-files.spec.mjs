// Real CLI, synthetic files only. The preload exercises old path-stat/read race boundaries
// and injects an HTML read error in both implementations; production has no test switches.
import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../../scripts/serve.mjs', import.meta.url));
const model = 'qwen2.5-0.5b-instruct-q4_k_m.gguf';
const privateText = 'PRIVATE_FILE_MARKER sk-synthetic-key COOKIE_PRIVATE';
const preload = `
import fs from 'node:fs';
const stat = fs.stat.bind(fs), open = fs.promises.open.bind(fs.promises), read = fs.readFileSync.bind(fs);
fs.stat = (file, ...args) => {
  const callback = args.pop();
  return stat(file, ...args, (error, value) => {
    if (!error && String(file) === process.env.RACE_FILE) { fs.unlinkSync(file); fs.symlinkSync(process.env.PRIVATE_FILE, file); }
    callback(error, value);
  });
};
const failure = () => Object.assign(new Error('PRIVATE_ERROR sk-synthetic-key COOKIE_PRIVATE'), { code: 'EIO', path: process.env.FAULT_FILE });
fs.readFileSync = (file, ...args) => { if (String(file) === process.env.FAULT_FILE) throw failure(); return read(file, ...args); };
fs.promises.open = async (...args) => {
  const handle = await open(...args);
  if (String(args[0]) === process.env.FAULT_FILE) handle.readFile = async () => { throw failure(); };
  return handle;
};
`;

function fixture() {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kibitz-public-files-'))), root = path.join(dir, 'public'), models = path.join(dir, 'models');
  fs.mkdirSync(root); fs.mkdirSync(models);
  fs.writeFileSync(path.join(root, 'index.html'), '<p>PUBLIC</p>');
  const secret = path.join(dir, 'private.txt'); fs.writeFileSync(secret, privateText);
  const hook = path.join(dir, 'preload.mjs'); fs.writeFileSync(hook, preload);
  return { dir, root, models, secret, hook, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}
async function launch(f, env = {}, root = f.root) {
  const child = spawn(process.execPath, ['--import', f.hook, script, root, '--models', f.models, '--port', '0'], {
    stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, RACE_FILE: '', FAULT_FILE: '', PRIVATE_FILE: f.secret, ...env },
  });
  let output = '', errors = '';
  const exited = new Promise(resolve => child.once('exit', resolve));
  const base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(Error('Public-files fixture startup timeout')); }, 15_000);
    child.stdout.on('data', chunk => { output += chunk; const hit = output.match(/at (http:\/\/127\.0\.0\.1:\d+)\//); if (hit) { clearTimeout(timer); resolve(hit[1]); } });
    child.stderr.on('data', chunk => { errors += chunk; });
    child.once('exit', code => { clearTimeout(timer); reject(Error(`Public-files fixture exited (${code})`)); });
    child.once('error', error => { clearTimeout(timer); reject(error); });
  });
  return { base, output: () => output + errors, stop: async () => { if (child.exitCode === null && child.signalCode === null) child.kill(); await exited; } };
}

test('static/model aliases cannot disclose an outside file; canonical startup aliases and regular models work', async () => {
  const f = fixture(), alias = path.join(f.dir, 'public-alias'); fs.symlinkSync(f.root, alias);
  fs.symlinkSync(f.secret, path.join(f.models, model)); fs.symlinkSync(f.secret, path.join(f.root, 'escape.txt'));
  fs.symlinkSync(path.join(f.root, 'index.html'), path.join(f.root, 'inside.html'));
  const s = await launch(f, {}, alias);
  try {
    for (const url of ['/models/' + model, '/escape.txt', '/inside.html']) for (const method of ['GET', 'HEAD']) {
      const response = await fetch(s.base + url, { method }); expect(response.status, url).toBe(404); expect(await response.text()).not.toContain(privateText);
    }
    fs.unlinkSync(path.join(f.models, model)); fs.writeFileSync(path.join(f.models, model), 'PUBLIC_WEIGHTS');
    const response = await fetch(s.base + '/models/' + model); expect(response.status).toBe(200); expect(await response.text()).toBe('PUBLIC_WEIGHTS');
    expect(response.headers.get('etag')).toMatch(/^"[0-9a-f]+-[0-9a-f]+"$/);
    expect((await fetch(s.base + '/')).status).toBe(200); expect(s.output()).not.toContain(privateText);
  } finally { await s.stop(); f.cleanup(); }
});

for (const kind of ['html', 'static', 'model']) test(`a ${kind} path replacement at the old stat/read boundary cannot change served bytes`, async () => {
  const f = fixture(), name = kind === 'html' ? 'race.html' : kind === 'static' ? 'race.js' : model;
  const file = path.join(kind === 'model' ? f.models : f.root, name), body = kind === 'html' ? '<script>console.log("PUBLIC")</script>' : 'PUBLIC';
  fs.writeFileSync(file, body); const s = await launch(f, { RACE_FILE: file });
  try {
    const response = await fetch(s.base + (kind === 'model' ? '/models/' : '/') + name);
    expect(response.status).toBe(200); expect(await response.text()).toBe(body);
    expect((await fetch(s.base + '/')).status).toBe(200); expect(s.output()).not.toContain(privateText);
  } finally { await s.stop(); f.cleanup(); }
});

test('an HTML read failure returns 500 without killing the CLI or printing raw filesystem details', async () => {
  const f = fixture(), file = path.join(f.root, 'fault.html'); fs.writeFileSync(file, 'PUBLIC');
  const s = await launch(f, { FAULT_FILE: file });
  try {
    const response = await fetch(s.base + '/fault.html'); expect(response.status).toBe(500); expect(await response.text()).toBe('File unavailable\n');
    expect((await fetch(s.base + '/')).status).toBe(200);
    await expect.poll(() => s.output().includes('file_error')).toBe(true);
    for (const token of ['PRIVATE_ERROR', 'sk-synthetic-key', 'COOKIE_PRIVATE', file]) expect(s.output()).not.toContain(token);
    const events = s.output().split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line));
    expect(events).toContainEqual(expect.objectContaining({ event: 'file_error', resource: 'static', code: 'EIO' }));
  } finally { await s.stop(); f.cleanup(); }
});
