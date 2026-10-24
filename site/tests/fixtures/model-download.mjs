// Test-subprocess preload only: replace the catalogue and every fetch with tiny synthetic data.
// Production code has no fixture mode, alternate catalogue path or network bypass.
import crypto from 'node:crypto';
import { BROWSER_MODELS } from '../../server/models.mjs';
const bytes = Buffer.from('synthetic verified weights\n'), source = 'https://model.example.invalid/synthetic.gguf';
BROWSER_MODELS[0] = { ...BROWSER_MODELS[0], bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), source };
globalThis.fetch = async (url, options = {}) => {
  if (url !== source) throw Error('Unexpected fixture request');
  options.signal?.throwIfAborted();
  const scenario = process.env.KIBITZ_DOWNLOAD_SCENARIO || 'valid';
  if (scenario === 'headers-hang') return await new Promise((resolve, reject) => {
    options.signal?.addEventListener('abort', () => reject(options.signal.reason), { once: true });
  });
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };
  const clear = () => { for (const id of timers) clearTimeout(id); timers.clear(); };
  const stream = new ReadableStream({
    start(controller) {
      options.signal?.addEventListener('abort', () => { clear(); controller.error(options.signal.reason); }, { once: true });
      if (scenario === 'oversize') {
        controller.enqueue(bytes);
        later(() => { controller.enqueue(Buffer.alloc(65536, 120)); later(() => controller.close(), 400); }, 25);
      } else if (scenario === 'body-hang') controller.enqueue(bytes);
      else if (scenario === 'wrong-hash') { controller.enqueue(Buffer.alloc(bytes.length, 120)); controller.close(); }
      else if (scenario === 'truncated') { controller.enqueue(bytes.subarray(0, bytes.length - 1)); controller.close(); }
      else { controller.enqueue(bytes); controller.close(); }
    },
    cancel: clear,
  });
  return new Response(stream);
};
