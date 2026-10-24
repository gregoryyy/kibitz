import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { Readable } from 'node:stream';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import crypto from 'node:crypto';
import { openPublicFile, servePublicFile } from './public-files.mjs';

function fixture(t) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kibitz-open-file-'))), root = path.join(dir, 'public');
  fs.mkdirSync(root); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return { root, dir, file: path.join(root, 'asset.js') };
}
async function server(t, root, options = {}) {
  const logs = [], handles = [];
  const io = { ...fs.promises, async open(...args) {
    const handle = await fs.promises.open(...args); handles.push(handle); options.opened?.(handle, args[0]); return handle;
  }, ...options.io };
  const s = http.createServer((req, res) => servePublicFile(req, res, { root, relative: req.url.slice(1), io, log: { error: line => logs.push(line) }, ...options.serve }));
  await new Promise(resolve => s.listen(0, '127.0.0.1', resolve));
  t.after(() => { s.closeAllConnections(); return new Promise(resolve => s.close(resolve)); });
  return { base: `http://127.0.0.1:${s.address().port}`, logs, handles };
}
async function closed(handles) {
  for (let i = 0; i < 200 && handles.some(handle => handle.fd !== -1); i++) await delay(10);
  assert.ok(handles.every(handle => handle.fd === -1), 'all request descriptors closed');
}

test('only regular non-hidden assets inside the canonical root are accepted; aliases are refused', async t => {
  const { root, dir, file } = fixture(t); fs.writeFileSync(file, 'public');
  fs.writeFileSync(path.join(dir, 'private'), 'PRIVATE_MARKER'); fs.writeFileSync(path.join(root, '.secret'), 'hidden');
  fs.mkdirSync(path.join(root, 'nested'));
  fs.symlinkSync(file, path.join(root, 'alias.js')); fs.symlinkSync(path.join(dir, 'private'), path.join(root, 'escape.js'));
  fs.symlinkSync(path.join(root, 'nested'), path.join(root, 'alias-dir'));
  fs.writeFileSync(path.join(root, 'nested', 'file.js'), 'nested');
  for (const relative of ['../private', '../public-other/file.js', '.secret', 'nested', 'alias.js', 'escape.js', 'alias-dir/file.js', 'absent', 'asset.js\0']) await assert.rejects(openPublicFile(root, relative));
  const opened = await openPublicFile(root, 'asset.js');
  assert.equal(await opened.handle.readFile('utf8'), 'public'); await opened.handle.close();
});

test('a leaf replaced with a symlink or FIFO before open is rejected without blocking/leaking', { skip: process.platform === 'win32' }, async t => {
  const { root, dir, file } = fixture(t); fs.writeFileSync(path.join(dir, 'private'), 'PRIVATE_MARKER');
  for (const kind of ['symlink', 'fifo']) {
    fs.writeFileSync(file, 'public'); const handles = [];
    const io = { ...fs.promises, async open(name, flags) {
      fs.unlinkSync(name);
      if (kind === 'symlink') fs.symlinkSync(path.join(dir, 'private'), name); else execFileSync('mkfifo', [name]);
      const handle = await fs.promises.open(name, flags); handles.push(handle); return handle;
    } };
    await assert.rejects(openPublicFile(root, 'asset.js', io)); await closed(handles); fs.unlinkSync(file);
  }
});

test('rename after descriptor validation cannot change HTML/CSP, static stream or model bytes', async t => {
  for (const [name, model] of [['index.html', false], ['asset.js', false], ['weights.gguf', true]]) {
    const { root } = fixture(t), file = path.join(root, name), body = name.endsWith('.html') ? '<script>console.log("PUBLIC")</script>' : 'PUBLIC';
    fs.writeFileSync(file, body);
    const g = await server(t, root, { serve: { model }, io: { async lstat(name) {
      const result = await fs.promises.lstat(name); fs.renameSync(file, file + '.old'); fs.writeFileSync(file, 'PRIVATE_REPLACEMENT'); return result;
    } } });
    const res = await fetch(g.base + '/' + name); assert.equal(res.status, 200); assert.equal(await res.text(), body);
    assert.equal(Number(res.headers.get('content-length')), Buffer.byteLength(body));
    if (name.endsWith('.html')) {
      const hash = crypto.createHash('sha256').update('console.log("PUBLIC")').digest('base64');
      assert.ok(res.headers.get('content-security-policy').includes(hash));
    }
    if (model) assert.match(res.headers.get('etag'), /^"[0-9a-f]+-[0-9a-f]+"$/);
    await closed(g.handles); assert.deepEqual(g.logs, []);
  }
});

test('a path changed between open and identity validation is refused and its descriptor closes', async t => {
  const { root, file } = fixture(t); fs.writeFileSync(file, 'public');
  const g = await server(t, root, { opened(handle) {
    const stat = handle.stat.bind(handle);
    handle.stat = async () => { const result = await stat(); fs.renameSync(file, file + '.old'); fs.writeFileSync(file, 'REPLACEMENT'); return result; };
  } });
  const response = await fetch(g.base + '/asset.js'); assert.equal(response.status, 404); assert.equal(await response.text(), 'Not found\n');
  await closed(g.handles); assert.deepEqual(g.logs, []);
});

test('HEAD and empty files close their descriptors with correct content headers and no body', async t => {
  const { root, file } = fixture(t); fs.writeFileSync(file, 'public'); fs.writeFileSync(path.join(root, 'empty'), '');
  fs.writeFileSync(path.join(root, 'index.html'), '<p>public</p>'); const g = await server(t, root);
  for (const [name, size] of [['asset.js', 6], ['empty', 0], ['index.html', 13]]) {
    const res = await fetch(g.base + '/' + name, { method: 'HEAD' });
    assert.equal(res.status, 200); assert.equal(await res.text(), ''); assert.equal(Number(res.headers.get('content-length')), size);
  }
  const empty = await fetch(g.base + '/empty'); assert.equal(await empty.text(), ''); await closed(g.handles);
});

test('open and HTML read failures return bounded errors and retain no private diagnostics', async t => {
  const { root } = fixture(t); fs.writeFileSync(path.join(root, 'index.html'), 'public');
  const secret = 'PRIVATE_PATH sk-synthetic-secret\nFORGED_EVENT';
  for (const stage of ['open', 'html']) {
    const g = await server(t, root, stage === 'open' ? { io: { ...fs.promises, async open() { throw Object.assign(new Error(secret), { code: 'EIO', path: secret }); } } }
      : { opened(handle) { handle.readFile = async () => { throw Object.assign(new Error(secret), { code: 'EIO', path: secret }); }; } });
    const res = await fetch(g.base + '/index.html'); assert.equal(res.status, 500); assert.equal(await res.text(), 'File unavailable\n');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff'); await closed(g.handles);
    assert.equal(g.logs.length, 1); const event = JSON.parse(g.logs[0]); assert.deepEqual({ ...event, at: '' }, { at: '', event: 'file_error', resource: 'static', code: 'EIO' });
    assert.ok(!g.logs[0].includes('PRIVATE') && !g.logs[0].includes('sk-synthetic') && !g.logs[0].includes('FORGED'));
  }
});

test('stream failures terminate the response and release the file without an uncaught exception', async t => {
  const { root, file } = fixture(t); fs.writeFileSync(file, 'public content');
  const g = await server(t, root, { opened(handle) {
    handle.createReadStream = () => Readable.from((async function* () { yield Buffer.from('pub'); await delay(5); throw Object.assign(new Error('PRIVATE_ERROR'), { code: 'EIO' }); })());
  } });
  await assert.rejects(async () => { const res = await fetch(g.base + '/asset.js'); await res.text(); });
  await closed(g.handles); assert.equal(JSON.parse(g.logs[0]).code, 'EIO'); assert.ok(!g.logs.join('').includes('PRIVATE_ERROR'));
  assert.equal((await fetch(g.base + '/absent')).status, 404, 'listener remains healthy');
});

test('client disconnect releases an active stream and is not logged as a file fault', async t => {
  const { root, file } = fixture(t); fs.writeFileSync(file, Buffer.alloc(4 * 1024 * 1024));
  const g = await server(t, root, { opened(handle) {
    const read = handle.createReadStream.bind(handle); handle.createReadStream = options => read({ ...options, highWaterMark: 1024 });
  } });
  await new Promise((resolve, reject) => {
    const req = http.get(g.base + '/asset.js', res => { res.once('data', () => { res.destroy(); resolve(); }); res.on('error', () => {}); });
    req.on('error', reject);
  });
  await closed(g.handles); assert.deepEqual(g.logs, []);
});

test('appending cannot exceed captured length; truncating aborts with a bounded file-change event', async t => {
  for (const change of ['append', 'truncate']) {
    const { root, file } = fixture(t); fs.writeFileSync(file, 'public content');
    const g = await server(t, root, { opened(handle) {
      const stat = handle.stat.bind(handle); handle.stat = async () => {
        const result = await stat(); if (change === 'append') fs.appendFileSync(file, 'PRIVATE_APPEND'); else fs.truncateSync(file, 3); return result;
      };
    } });
    const read = async () => { const res = await fetch(g.base + '/asset.js'); return res.text(); };
    if (change === 'append') assert.equal(await read(), 'public content'); else await assert.rejects(read);
    await closed(g.handles); assert.equal(g.logs.length, change === 'append' ? 0 : 1);
    if (change === 'truncate') assert.equal(JSON.parse(g.logs[0]).code, 'ESTALE');
  }
});
