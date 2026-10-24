// Bounded download of a catalogue-selected model. Nothing is published before size/hash match.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import { pipeline, finished } from 'node:stream/promises';

export const MODEL_DOWNLOAD_TIMEOUT_MS = 30 * 60_000;

/**
 * @param {string} directory
 * @param {{file:string, bytes:number, sha256:string, source:string}} model
 * @param {{fetcher?:typeof fetch, timeoutMs?:number, signal?:AbortSignal, onProgress?:(bytes:number,total:number)=>void}} [options]
 */
export async function downloadModel(directory, model, { fetcher = fetch, timeoutMs = MODEL_DOWNLOAD_TIMEOUT_MS, signal, onProgress } = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2 ** 31 - 1) throw Error('Model download timeout must be a positive integer up to 2147483647 ms.');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.gguf$/.test(model.file) || !Number.isSafeInteger(model.bytes) || model.bytes < 1 || !/^[a-f0-9]{64}$/.test(model.sha256)) throw Error('Invalid pinned model descriptor.');
  const file = path.join(path.resolve(directory), model.file), suffix = randomUUID();
  const part = file + '.part-' + suffix, marker = file + '.sha256', markerPart = marker + '.part-' + suffix;
  const controller = new AbortController(), combined = signal ? AbortSignal.any([controller.signal, signal]) : controller.signal;
  const timer = setTimeout(() => controller.abort(Error(`Model download timed out after ${timeoutMs} ms.`)), timeoutMs);
  let received = 0, output;
  const hash = createHash('sha256');
  const bounded = new Transform({
    transform(chunk, encoding, callback) {
      if (received + chunk.length > model.bytes) return callback(Error(`Model download exceeds the pinned size (${model.bytes} bytes).`));
      received += chunk.length; hash.update(chunk);
      try { onProgress?.(received, model.bytes); callback(null, chunk); }
      catch (error) { callback(error); }
    },
  });
  try {
    combined.throwIfAborted();
    await fs.mkdir(path.dirname(file), { recursive: true });
    combined.throwIfAborted();
    const response = await fetcher(model.source, { signal: combined });
    if (!response.ok || !response.body) throw Error(`Model download failed: HTTP ${response.status}, ${response.body ? 'response rejected' : 'missing response body'}.`);
    output = await writable(part);
    await pipeline(Readable.fromWeb(/** @type {any} */ (response.body)), bounded, output, { signal: combined });
    if (received !== model.bytes) throw Error(`Model download size ${received}, expected ${model.bytes}.`);
    if (hash.digest('hex') !== model.sha256) throw Error('Model download SHA-256 does not match the pinned catalogue.');
    combined.throwIfAborted();
    // Use unique exclusive temporary files for both artifacts; never follow an old marker link.
    await fs.writeFile(markerPart, model.sha256 + '\n', { flag: 'wx', mode: 0o600 });
    combined.throwIfAborted();
    await fs.rename(part, file);
    await fs.rename(markerPart, marker);
    return { file, bytes: received, sha256: model.sha256 };
  } catch (error) {
    if (combined.aborted) throw combined.reason;
    throw error;
  } finally {
    clearTimeout(timer); controller.abort();
    if (output && !output.closed) { output.destroy(); await finished(output).catch(() => {}); }
    bounded.destroy();
    await Promise.all([fs.rm(part, { force: true }), fs.rm(markerPart, { force: true })]);
  }
}

async function writable(file) {
  const handle = await fs.open(file, 'wx', 0o600);
  return handle.createWriteStream(); // closes the same descriptor on success/error
}
