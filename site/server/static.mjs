// Security headers for the static files served by scripts/serve.mjs.
import crypto from 'crypto';

// Sent with every static response.
export const BASE_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
};

// Content Security Policy for an HTML page. Inline <script> blocks are allowed by hash only,
// so injected markup can't run script. Workers may come from blob: (the Stockfish fallback),
// WebAssembly needs 'wasm-unsafe-eval', and the page loads its fonts from Google Fonts.
export function cspFor(html) {
  const hashes = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
    .filter(m => !/\bsrc\s*=/i.test(m[0].slice(0, m[0].indexOf('>'))) && m[1].trim())
    .map(m => `'sha256-${crypto.createHash('sha256').update(m[1], 'utf8').digest('base64')}'`);
  return [
    "default-src 'self'",
    `script-src 'self' 'wasm-unsafe-eval' blob: ${hashes.join(' ')}`.trim(),
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

// Paths with a dot-segment (".env", ".git/config", ...) are never served, even if the server
// is pointed at a folder that contains them.
export const isHiddenPath = rel => rel.split(/[\\/]/).some(s => s.startsWith('.') && s !== '.');
