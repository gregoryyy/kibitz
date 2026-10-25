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
  // SharedArrayBuffer. All bundled fonts/resources are served from the same origin.
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

// Policy for trusted, operator-owned HTML, never an HTML sanitizer for model/user text.
// Only actual complete script/style nodes grant hashes; attributes grant no authority.
// Workers need blob: (Stockfish/wllama), WebAssembly needs 'wasm-unsafe-eval'.
export function cspFor(html, { offline = false } = {}) {
  const hashes = new Set(), styles = new Set();
  for (const node of nodes(parse(offline ? offlineHtml(html) : html, { scriptingEnabled: true, sourceCodeLocationInfo: true }))) {
    if (!('tagName' in node) || !['script', 'style'].includes(node.tagName) || !node.sourceCodeLocation?.endTag) continue;
    const svg = node.namespaceURI === 'http://www.w3.org/2000/svg';
    if (!svg && node.namespaceURI !== 'http://www.w3.org/1999/xhtml') continue;
    if (node.tagName === 'script') {
      if (!hasScriptType(node)) continue;
      if (node.attrs.some(attr => attr.name === (svg ? 'href' : 'src'))) continue;
    } else {
      const type = node.attrs.find(attr => attr.name === 'type')?.value;
      if (type && asciiLower(asciiTrim(type)) !== 'text/css') continue;
    }
    let text = '';
    for (const child of nodes(node)) if (child.nodeName === '#text' && 'value' in child) text += child.value;
    if (text.trim()) (node.tagName === 'style' ? styles : hashes).add(`'sha256-${crypto.createHash('sha256').update(text, 'utf8').digest('base64')}'`);
  }
  return [
    "default-src 'self'",
    `script-src 'self' 'wasm-unsafe-eval' blob: ${[...hashes].join(' ')}`.trim(),
    "worker-src 'self' blob:",
    `style-src 'self' ${[...styles].join(' ')}`.trim(),
    "style-src-attr 'none'",
    "font-src 'self'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

// Compatibility for older trusted pages: discard legacy external Google Fonts links offline.
// The current app bundles its original fonts and uses the same strict policy in both modes.
export const offlineHtml = html => html.replace(/^[ \t]*<link\b[^>]*\bhref="https:\/\/fonts\.(?:googleapis|gstatic)\.com[^>]*>[ \t]*\r?\n?/gim, '');

// Paths with a dot-segment (".env", ".git/config", ...) are never served, even if the server
// is pointed at a folder that contains them.
export const isHiddenPath = rel => rel.split(/[\\/]/).some(s => s.startsWith('.') && s !== '.');
