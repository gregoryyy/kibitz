// Both static assets and catalogued model weights use the same validated open file.
// The operator owns the public roots/parents; this is not a sandbox against their writer.
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { BASE_HEADERS, cspFor, isHiddenPath, offlineHtml } from './static.mjs';
import { fileErrorEvent } from './logging.mjs';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.wasm': 'application/wasm',
  '.png': 'image/png', '.ico': 'image/x-icon',
};
const MISSING = new Set(['ENOENT', 'ENOTDIR', 'ELOOP', 'EACCES', 'EPERM', 'EINVAL', 'ERR_INVALID_ARG_VALUE']);
const missing = () => Object.assign(new Error('Not found'), { code: 'ENOENT' });
export const sendStaticError = (res, status) => {
  res.writeHead(status, { ...BASE_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(status === 404 ? 'Not found\n' : 'File unavailable\n');
};

/**
 * Reject aliases/non-regular files, then inspect the descriptor that will supply bytes.
 * `root` must be an existing canonical public directory (resolved once at startup).
 */
export async function openPublicFile(root, relative, io = fs.promises) {
  const file = path.resolve(root, relative);
  if (file === root || !file.startsWith(root + path.sep) || isHiddenPath(relative)) throw missing();
  // Alias policy is stricter than containment: no symlinked asset or child directory,
  // including aliases within the public tree. Parent-tree writers remain trusted.
  if (await io.realpath(file) !== file) throw missing();
  const entry = await io.lstat(file);
  if (!entry.isFile()) throw missing();
  let handle;
  try {
    handle = await io.open(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0) | (fs.constants.O_NONBLOCK ?? 0));
    const stat = await handle.stat();
    // Identity comparison also fails closed if no-follow flags are unavailable. Only
    // the opened descriptor's metadata is used for response headers and all reads.
    if (!stat.isFile() || stat.dev !== entry.dev || stat.ino !== entry.ino || !Number.isSafeInteger(stat.size) || stat.size < 0) throw missing();
    return { handle, stat, ext: path.extname(file).toLowerCase() };
  } catch (error) { if (handle) await handle.close(); throw error; }
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {{root: string, relative: string, model?: boolean, offline?: boolean, log?: Pick<Console, 'error'>, io?: typeof fs.promises}} options
 */
export async function servePublicFile(req, res, { root, relative, model = false, offline = false, log = console, io = fs.promises }) {
  let handle;
  const report = error => log.error(fileErrorEvent(model ? 'model' : 'static', error?.code));
  try {
    const opened = await openPublicFile(root, relative, io), { stat, ext } = opened;
    handle = opened.handle;
    if (res.destroyed) return;
    const headers = { ...BASE_HEADERS, 'Content-Type': model ? 'application/octet-stream' : TYPES[ext] || 'application/octet-stream',
      'Content-Length': stat.size, 'Cache-Control': 'no-cache' };
    if (model) headers['ETag'] = `"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
    if (!model && ext === '.html') {
      const text = await handle.readFile({ encoding: 'utf8' }), html = offline ? offlineHtml(text) : text, body = Buffer.from(html, 'utf8');
      if (res.destroyed) return;
      res.writeHead(200, { ...headers, 'Content-Length': body.length, 'Content-Security-Policy': cspFor(html, { offline }) });
      res.end(req.method === 'HEAD' ? undefined : body); return;
    }
    res.writeHead(200, headers);
    if (req.method === 'HEAD' || !stat.size) { res.end(); return; }
    // The descriptor stays with this request, including after a rename/unlink. Bound
    // reads to the captured size; a truncation fails the stream rather than silently
    // completing a shorter Content-Length response. This does not lock in-place writes.
    let bytes = 0;
    const exactSize = new Transform({
      transform(chunk, encoding, done) { bytes += chunk.length; done(null, chunk); },
      flush(done) { done(bytes === stat.size ? null : Object.assign(new Error('File changed'), { code: 'ESTALE' })); },
    });
    await pipeline(handle.createReadStream({ start: 0, end: stat.size - 1, autoClose: false }), exactSize, res);
  } catch (error) {
    if (res.destroyed && error?.code === 'ERR_STREAM_PREMATURE_CLOSE') return; // caller disconnected
    if (!res.headersSent && !res.destroyed) {
      if (MISSING.has(error?.code)) sendStaticError(res, 404);
      else { report(error); sendStaticError(res, 500); }
    } else { report(error); if (!res.destroyed) res.destroy(); }
  } finally {
    if (handle) try { await handle.close(); } catch (error) { report(error); }
  }
}
