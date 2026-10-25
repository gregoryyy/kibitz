// Security headers for the static files served by scripts/serve.mjs.
import crypto from 'crypto';
import { parse } from 'parse5';

// Sent with every static response.
export const BASE_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  // With COOP, makes the page cross-origin isolated, so the multi-threaded Stockfish can use
  // SharedArrayBuffer. Cross-origin resources must opt in (Google Fonts sends CORP: cross-origin).
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
};

// Walk the parsed document, keeping template contents inert. Iteration avoids a call-stack
// limit for deeply nested build-owned HTML; comments/raw-text elements aren't script nodes.
/** @param {import('parse5').DefaultTreeAdapterTypes.Node} root */
function* nodes(root) {
  const pending = [root];
  while (pending.length) {
    const node = pending.pop(); yield node;
    if ('childNodes' in node) for (let i = node.childNodes.length - 1; i >= 0; i--) pending.push(node.childNodes[i]);
  }
}

// HTML's script-type selection, including legacy JavaScript MIME essences. Data blocks
// (JSON, text/plain or unknown types) must not authorize a later executable script.
const JS_TYPES = new Set(['application/ecmascript', 'application/javascript', 'application/x-ecmascript', 'application/x-javascript',
  'text/ecmascript', 'text/javascript', 'text/javascript1.0', 'text/javascript1.1', 'text/javascript1.2', 'text/javascript1.3',
  'text/javascript1.4', 'text/javascript1.5', 'text/jscript', 'text/livescript', 'text/x-ecmascript', 'text/x-javascript']);
const asciiLower = text => text.replace(/[A-Z]/g, ch => ch.toLowerCase());
const ASCII_SPACE = new Set('\t\n\f\r ');
const asciiTrim = text => {
  let start = 0, end = text.length;
  while (start < end && ASCII_SPACE.has(text[start])) start++;
  while (end > start && ASCII_SPACE.has(text[end - 1])) end--;
  return text.slice(start, end);
};
/** @param {import('parse5').DefaultTreeAdapterTypes.Element} node */
function hasScriptType(node) {
  const type = node.attrs.find(attr => attr.name === 'type')?.value;
  const language = node.namespaceURI === 'http://www.w3.org/1999/xhtml' ? node.attrs.find(attr => attr.name === 'language')?.value : '';
  const raw = type === undefined ? (language ? `text/${language}` : '') : type;
  if (!raw || JS_TYPES.has(asciiLower(raw)) || (type !== undefined && JS_TYPES.has(asciiLower(asciiTrim(type))))) return true;
  return ['module', 'importmap', 'speculationrules'].includes(asciiLower(raw));
}

// Content Security Policy for trusted, operator-owned HTML. Every supplied inline script
// can receive a hash: this is policy generation, not an HTML sanitizer for model/user text.
// Workers may come from blob: (the Stockfish fallback and
// wllama), WebAssembly needs 'wasm-unsafe-eval', and the page loads its fonts from Google Fonts,
// except offline (just offline, TODO 2.16): then nothing may come from another host.
export function cspFor(html, { offline = false } = {}) {
  const hashes = new Set();
  for (const node of nodes(parse(html, { scriptingEnabled: true, sourceCodeLocationInfo: true }))) {
    if (!('tagName' in node) || node.tagName !== 'script' || !node.sourceCodeLocation?.endTag) continue;
    const svg = node.namespaceURI === 'http://www.w3.org/2000/svg';
    if (!svg && node.namespaceURI !== 'http://www.w3.org/1999/xhtml') continue;
    if (!hasScriptType(node)) continue;
    if (node.attrs.some(attr => attr.name === (svg ? 'href' : 'src'))) continue;
    let text = '';
    for (const child of nodes(node)) if (child.nodeName === '#text' && 'value' in child) text += child.value;
    if (text.trim()) hashes.add(`'sha256-${crypto.createHash('sha256').update(text, 'utf8').digest('base64')}'`);
  }
  return [
    "default-src 'self'",
    `script-src 'self' 'wasm-unsafe-eval' blob: ${[...hashes].join(' ')}`.trim(),
    "worker-src 'self' blob:",
    offline ? "style-src 'self' 'unsafe-inline'" : "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    offline ? "font-src 'self'" : "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

// The page as served offline: without the Google Fonts links (the CSS falls back to system fonts),
// so it requests nothing from another host and the stricter CSP isn't violated.
export const offlineHtml = html => html.replace(/^[ \t]*<link\b[^>]*\bhref="https:\/\/fonts\.(?:googleapis|gstatic)\.com[^>]*>[ \t]*\r?\n?/gim, '');

// Paths with a dot-segment (".env", ".git/config", ...) are never served, even if the server
// is pointed at a folder that contains them.
export const isHiddenPath = rel => rel.split(/[\\/]/).some(s => s.startsWith('.') && s !== '.');
