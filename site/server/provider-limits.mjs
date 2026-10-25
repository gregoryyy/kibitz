// Total operation bounds include headers, body consumption and SDK iteration/parsing.
export const PROVIDER_LIMITS = Object.freeze({ bytes: 8 * 1024 * 1024, decodedBytes: 128 * 1024, timeoutMs: 15 * 60_000 });
const ERRORS = {
  timeout: ['The AI provider timed out', 504],
  cancelled: ['Cancelled', 499],
  response_too_large: ['The AI provider returned too much data', 502],
};
export class ProviderLimitError extends Error {
  constructor(code) { super(ERRORS[code][0]); this.code = code; this.status = ERRORS[code][1]; }
}

/**
 * One call owns its controller, readers and counters; concurrent calls never share these.
 * @param {number} requestedMs
 * @param {AbortSignal} [signal]
 * @param {{fetcher?: typeof fetch, maxBytes?: number, maxDecodedBytes?: number}} [options] Embeddings need a larger decoded budget; transport injection is for tests.
 */
export function providerOperation(requestedMs, signal, { fetcher = fetch, maxBytes = PROVIDER_LIMITS.bytes, maxDecodedBytes = Math.min(maxBytes, PROVIDER_LIMITS.decodedBytes) } = {}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > PROVIDER_LIMITS.bytes || !Number.isSafeInteger(maxDecodedBytes) || maxDecodedBytes < 1 || maxDecodedBytes > maxBytes) throw new RangeError('Invalid provider response bound');
  const timeoutMs = Math.min(PROVIDER_LIMITS.timeoutMs, Math.max(1, Math.ceil(Number.isFinite(requestedMs) ? requestedMs : 60_000)));
  const expires = performance.now() + timeoutMs;
  const ctl = new AbortController(), readers = new Set();
  let error, closed = false, rawBytes = 0, decodedBytes = 0, reject;
  const stopped = new Promise((resolve, no) => { reject = no; });
  void stopped.catch(() => {}); // A synchronous constructor failure can precede the first wait.
  const cancelReaders = () => { for (const reader of readers) void reader.cancel().catch(() => {}); readers.clear(); };
  const fail = code => {
    if (!error) { error = new ProviderLimitError(code); ctl.abort(error); cancelReaders(); reject(error); }
    return error;
  };
  const abort = () => { fail('cancelled'); };
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => fail('timeout'), timeoutMs);
  if (signal?.aborted) abort();
  const check = () => {
    if (!closed && !error && performance.now() >= expires) fail('timeout');
    if (error) throw error;
    if (closed) throw new ProviderLimitError('cancelled');
  };
  async function wait(task) {
    check(); const result = await Promise.race([Promise.resolve().then(task), stopped]); check(); return result;
  }
  function count(value) {
    check();
    decodedBytes += Buffer.byteLength(typeof value === 'string' ? value : JSON.stringify(value) || '', 'utf8');
    check();
    if (decodedBytes > maxDecodedBytes) throw fail('response_too_large');
  }
  /** @type {typeof fetch} */
  const boundedFetch = async (url, init) => {
    const combined = init?.signal ? AbortSignal.any([ctl.signal, init.signal]) : ctl.signal;
    const response = await wait(async () => {
      const result = await fetcher(url, { ...init, signal: combined });
      if (closed || error) { void result.body?.cancel().catch(() => {}); check(); }
      return result;
    });
    if (!response.body) return response;
    const reader = response.body.getReader(); readers.add(reader);
    const release = () => { readers.delete(reader); };
    const body = new ReadableStream({
      async pull(controller) {
        try {
          const { done, value } = await wait(() => reader.read());
          if (done) { release(); controller.close(); return; }
          rawBytes += value.byteLength;
          if (rawBytes > maxBytes) throw fail('response_too_large');
          controller.enqueue(value);
        } catch (failure) { release(); void reader.cancel().catch(() => {}); controller.error(error || failure); }
      },
      cancel() { release(); return reader.cancel().catch(() => {}); },
    });
    return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
  };
  return {
    signal: ctl.signal, timeoutMs, fetch: boundedFetch, wait, count,
    get error() { return error; },
    async *read(iterator) {
      try {
        for (;;) {
          const step = await wait(() => iterator.next());
          count(step.value);
          if (step.done) return step.value;
          yield step.value;
        }
      } finally { void iterator.return?.().catch(() => {}); }
    },
    close() { closed = true; clearTimeout(timer); signal?.removeEventListener('abort', abort); ctl.abort(); cancelReaders(); },
  };
}
