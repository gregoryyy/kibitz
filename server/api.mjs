// HTTP routes for the AI gateway, mounted by scripts/serve.mjs --api.
//   GET  /api/ai/status  -> {provider, model, available, reason}
//   POST /api/ai/sample  -> NDJSON stream: {"text":"..."} lines, then {"done":true,"truncated":false}
//                           or {"error":{"code":"...","message":"..."}}
import net from 'net';
import { createProvider, GatewayError, publicStatus, rateLimiter, toGatewayError, validateMessages } from './ai.mjs';

const MAX_BODY = 1_000_000;
const SECURITY_HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

export function createApi({ config, provider = config.available ? createProvider(config) : null, log = console }) {
  const allow = rateLimiter(config.ratePerMinute);
  return async function handle(req, res) {
    const { pathname } = new URL(req.url, 'http://x');
    if (!pathname.startsWith('/api/')) return false;
    try {
      checkHost(req);
      if (pathname === '/api/ai/status' && req.method === 'GET') return json(res, 200, publicStatus(config));
      if (pathname === '/api/ai/sample' && req.method === 'POST') return await sample(req, res);
      throw new GatewayError('not_found', 'Not found', 404);
    } catch (e) {
      const g = toGatewayError(e);
      if (!res.headersSent) json(res, g.status, { error: { code: g.code, message: g.message } });
      else res.end();
    }
    return true;
  };

  async function sample(req, res) {
    checkOrigin(req);
    if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) throw new GatewayError('bad_request', 'Content-Type must be application/json', 415);
    if (!provider) throw new GatewayError('unavailable', config.reason || 'No AI provider configured', 503);
    const messages = validateMessages(await readJson(req));
    if (!allow()) throw new GatewayError('rate_limited', 'Too many requests; try again in a minute', 429);

    res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', ...SECURITY_HEADERS });
    const ac = new AbortController();
    res.on('close', () => { if (!res.writableEnded) ac.abort(); });
    const write = obj => res.write(JSON.stringify(obj) + '\n');
    try {
      const it = provider.stream(messages, { signal: ac.signal });
      let r;
      while (!(r = await it.next()).done) write({ text: r.value });
      write({ done: true, truncated: !!r.value?.truncated });
    } catch (e) {
      const g = toGatewayError(e, ac.signal);
      // Log the code and the provider's message, never the prompt.
      if (g.code !== 'cancelled') { log.error(`AI ${config.provider}/${config.model}: ${g.code} (${e?.status ?? '-'}) ${e?.message ?? ''}`); write({ error: { code: g.code, message: g.message } }); }
    }
    res.end();
    return true;
  }
}

// DNS-rebinding guard: a rebinding attack reaches us under an attacker-controlled host name,
// so only accept requests addressed to localhost or to an IP literal.
function checkHost(req) {
  let host;
  try { host = new URL(`http://${req.headers.host}`).hostname.replace(/^\[|\]$/g, ''); } catch { host = ''; }
  if (host !== 'localhost' && !net.isIP(host)) throw new GatewayError('forbidden', 'Host not allowed', 403);
}

// CSRF guard: browsers send Origin on cross-site POSTs, so a page on another site can't spend
// the API credits. Non-browser clients (no Origin) are allowed; they could reach the server anyway.
function checkOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return;
  let originHost;
  try { originHost = new URL(origin).host; } catch { originHost = null; }
  if (originHost !== req.headers.host) throw new GatewayError('forbidden', 'Cross-origin requests are not allowed', 403);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    // Past the limit, keep draining but drop the data, so the 413 reaches the client
    // instead of a reset connection.
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size <= MAX_BODY) chunks.push(c); });
    req.on('end', () => {
      if (size > MAX_BODY) return reject(new GatewayError('prompt_too_large', 'Request body too large', 413));
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new GatewayError('bad_request', 'Body is not valid JSON', 400)); }
    });
    req.on('error', reject);
  });
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...SECURITY_HEADERS });
  res.end(JSON.stringify(body));
  return true;
}
