// Minimal static server for local development, no dependencies.
//   node scripts/serve.mjs <dir> [--port 8765] [--host 127.0.0.1] [--index index.html] [--api [--env .env]]
// --api also mounts the AI gateway (server/api.mjs) under /api/, configured from the env file
// (--env= loads none); that part needs the npm dependencies. Every response carries security
// headers, HTML pages a hash-based Content Security Policy (server/static.mjs).
// Text responses carry an explicit charset=utf-8; without it, a page that lacks
// <meta charset> (such as site/dist/index.html, the bare artifact body) is
// decoded as Windows-1252 and every non-ASCII character comes out garbled.
import http from 'http';
import fs from 'fs';
import path from 'path';
import { parseArgs } from 'util';
import { BASE_HEADERS, cspFor, isHiddenPath } from '../server/static.mjs';

const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    port: { type: 'string', default: '8765' },
    host: { type: 'string', default: '127.0.0.1' },
    index: { type: 'string', default: 'index.html' },
    api: { type: 'boolean', default: false },
    env: { type: 'string', default: '.env' },
  },
});
if (positionals.length !== 1) { console.error('usage: serve.mjs <dir> [--port N] [--host H] [--index FILE] [--api [--env FILE]]'); process.exit(2); }
const root = fs.realpathSync(positionals[0]);

let api = null, apiStatus = '';
if (opt.api) {
  if (opt.env) try { process.loadEnvFile(opt.env); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const { loadConfig } = await import('../server/ai.mjs');
  const { createApi } = await import('../server/api.mjs');
  const config = loadConfig();
  api = createApi({ config });
  apiStatus = config.available ? `AI coach: ${config.provider} / ${config.model}` : `AI coach off: ${config.reason}`;
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const send = (res, code, msg) => { res.writeHead(code, { ...BASE_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' }); res.end(msg + '\n'); };

http.createServer(async (req, res) => {
  res.on('finish', () => console.log(res.statusCode, req.method, req.url));
  if (api && await api(req, res)) return;
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { return send(res, 400, 'Bad request'); }
  if (rel.endsWith('/')) rel += opt.index;
  if (isHiddenPath(rel)) return send(res, 404, 'Not found');
  const file = path.join(root, rel);
  // Refuse anything that resolves outside root, including through symlinks.
  let real;
  try { real = fs.realpathSync(file); } catch { return send(res, 404, 'Not found'); }
  if (real !== root && !real.startsWith(root + path.sep)) return send(res, 404, 'Not found');
  fs.stat(real, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Not found');
    const ext = path.extname(real).toLowerCase();
    const headers = { ...BASE_HEADERS, 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-cache' };
    if (ext === '.html') {
      const body = fs.readFileSync(real);
      res.writeHead(200, { ...headers, 'Content-Security-Policy': cspFor(body.toString('utf8')) });
      return res.end(req.method === 'HEAD' ? undefined : body);
    }
    res.writeHead(200, headers);
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(real).pipe(res);
  });
}).on('error', e => {
  console.error(e.code === 'EADDRINUSE' ? `Port ${opt.port} on ${opt.host} is already in use; stop the other server or pick another port.` : e.message);
  process.exit(1);
}).listen(Number(opt.port), opt.host, () => {
  console.log(`Serving ${path.relative(process.cwd(), root) || '.'} at http://${opt.host}:${opt.port}/`);
  if (apiStatus) console.log(apiStatus);
});
