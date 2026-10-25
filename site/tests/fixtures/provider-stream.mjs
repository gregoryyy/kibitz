// Test subprocess only; never delegates a fetch to a network/provider.
import { wire } from './ai-wire.mjs';
const kind = process.env.KIBITZ_STREAM_KIND;
if (!['headers-hang', 'body-hang', 'oversize', 'error-oversize', 'tool-oversize', 'text-oversize'].includes(kind)) throw Error('Unknown synthetic stream case');
let calls = 0;
const event = name => console.log(JSON.stringify({ fixture: 'provider-stream', event: name, calls }));
globalThis.fetch = async (url, init) => {
  if (!String(url).startsWith('https://fixture.invalid/')) throw Error('Unexpected synthetic endpoint');
  calls++; event('request');
  if (kind === 'text-oversize') return new Response(wire('mistral', ['x'.repeat(256 * 1024)]), { headers: { 'content-type': 'text/event-stream' } });
  if (kind === 'headers-hang') return new Promise((resolve, reject) => {
    init.signal.addEventListener('abort', () => { event('cancelled'); reject(init.signal.reason); }, { once: true });
  });
  const prefix = wire('mistral', ['Partial response.']).split('\n\n')[0] + '\n\n';
  let finished = false, step = 0;
  const stop = () => { if (!finished) { finished = true; event('cancelled'); } };
  const stream = new ReadableStream({
    start(controller) {
      init.signal.addEventListener('abort', () => { if (!finished) { stop(); controller.error(init.signal.reason); } }, { once: true });
    },
    pull(controller) {
      if (finished) return;
      if (kind === 'body-hang') { if (!step++) controller.enqueue(Buffer.from(prefix)); return; }
      if (kind === 'error-oversize' || kind === 'tool-oversize') {
        if (!step++) {
          const value = 'x'.repeat(9 * 1024 * 1024);
          const body = kind === 'error-oversize' ? JSON.stringify({ error: { message: process.env.MISTRAL_API_KEY + value } }) :
            `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'call', function: { name: 'analyse', arguments: JSON.stringify({ private: value }) } }] }, finish_reason: 'tool_calls' }] })}\n\ndata: [DONE]\n\n`;
          controller.enqueue(Buffer.from(body));
        } else { finished = true; controller.close(); }
        return;
      }
      if (!step++) controller.enqueue(Buffer.from(prefix));
      else if (step < 145) controller.enqueue(Buffer.from(': ' + 'x'.repeat(65536) + '\n\n'));
      else { finished = true; controller.enqueue(Buffer.from(wire('mistral'))); controller.close(); }
    },
    cancel: stop,
  });
  return new Response(stream, { status: kind === 'error-oversize' ? 400 : 200, headers: { 'content-type': kind === 'error-oversize' ? 'application/json' : 'text/event-stream' } });
};
