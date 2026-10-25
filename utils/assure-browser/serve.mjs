// Read-only loopback server with a fixed asset map and graph-ID source access.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { applyAssessments } from '../../docs/assure/assessment-types.mjs';
import { readAssurance, inferFindings } from '../assure-infer.mjs';
import { readText } from '../assure.mjs';
import { sha256, validatePullRequests } from '../assure-detail.mjs';
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export function createBrowser(root = ROOT) {
  const { layers, assessments } = readAssurance(root);
  const findings = inferFindings(layers, assessments);
  const nodes = new Map(layers.flatMap(l => l.nodes).map(n => [n.id, n]));
  const prs = validatePullRequests(JSON.parse(readText(root, 'docs/assure/pull-requests.json')));
  const data = JSON.stringify({ layers: applyAssessments(layers, assessments), findings });
  const assets = new Map([
    ['/', ['utils/assure-browser/index.html', 'text/html']], ['/style.css', ['utils/assure-browser/style.css', 'text/css']],
    ['/app.mjs', ['utils/assure-browser/app.mjs', 'text/javascript']], ['/model.mjs', ['utils/assure-browser/model.mjs', 'text/javascript']],
    ['/vendor/LICENSE', ['site/node_modules/cytoscape/LICENSE', 'text/plain']],
    ['/vendor/cytoscape.mjs', ['site/node_modules/cytoscape/dist/cytoscape.esm.min.mjs', 'text/javascript']],
  ]);
  return http.createServer((req, res) => {
    const expected = new Set([`127.0.0.1:${serverPort(res)}`, `localhost:${serverPort(res)}`]);
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer');
    const send = (code, type, body) => { res.writeHead(code, { 'Content-Type': `${type}; charset=utf-8` }); res.end(body); };
    if (!expected.has(req.headers.host) || req.method !== 'GET') { send(403, 'text/plain', 'Read-only loopback access'); return; }
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname === '/data' && !url.search) send(200, 'application/json', data);
      else if (url.pathname === '/source') {
        const node = nodes.get(url.searchParams.get('id'));
        if (!node?.locator) { send(404, 'text/plain', 'Unknown captured source'); return; }
        const text = node.source.path.startsWith('pr:') ? prs.pulls.find(p => `pr:${p.number}` === node.source.path)?.body : readText(root, node.source.path);
        const selected = text.slice(node.locator.start, node.locator.end);
        if (sha256(selected) !== node.locator.sha256) { send(409, 'text/plain', 'Source drift: rebuild and review the snapshots'); return; }
        send(200, 'text/plain', selected);
      } else if (assets.has(url.pathname) && !url.search) {
        const [file, type] = assets.get(url.pathname); send(200, type, fs.readFileSync(path.join(root, file)));
      } else send(404, 'text/plain', 'Not found');
    } catch { send(500, 'text/plain', 'Unable to read captured assurance artifact'); }
  });
}
const serverPort = res => res.socket.localPort;
const isMain = () => { try { return !!process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } };
if (isMain()) {
  const args = process.argv.slice(2), port = args.length === 0 ? 8788 : args.length === 2 && args[0] === '--port' ? Number(args[1]) : NaN;
  if (!Number.isSafeInteger(port) || port < 0 || port > 65535) { console.error('Usage: node utils/assure-browser/serve.mjs [--port 8788]'); process.exitCode = 1; }
  else {
    const server = createBrowser(); server.on('error', error => { console.error(error.message); process.exitCode = 1; });
    server.listen(port, '127.0.0.1', () => console.log(`Assurance browser: http://127.0.0.1:${server.address().port}`));
  }
}
