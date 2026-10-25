// Subprocess-only network replacement. Every request is intercepted; no real fetch fallback.
import fs from 'node:fs';
import { annotations, wire } from './ai-wire.mjs';
globalThis.fetch = async (url, init) => {
  fs.appendFileSync(process.env.KIBITZ_FIXTURE_COUNT, 'request\n');
  if (!String(url).startsWith('https://fixture.invalid/')) throw Error('Unexpected synthetic endpoint');
  const scenario = process.env.KIBITZ_FIXTURE_SCENARIO || 'valid', params = JSON.parse(init.body);
  if (params.fallbacks || params.tools) throw Error('Unexpected fallback/tool');
  if (scenario === 'throw') throw Error(process.env.OPENAI_API_KEY);
  if (scenario === 'http-error') return new Response(process.env.OPENAI_API_KEY, { status: 401 });
  if (scenario === 'oversize') return new Response('x'.repeat(1_048_577), { headers: { 'content-type': 'text/event-stream' } });
  const json = !!(params.response_format || params.output_config?.format);
  const key = process.env.OPENAI_API_KEY;
  const parts = scenario === 'secret' ? [key.slice(0, 12), key.slice(12)] : [json ? JSON.stringify(annotations) : 'Control the centre.'];
  return new Response(wire(process.env.KIBITZ_FIXTURE_PROVIDER || 'openai', parts, scenario === 'truncated' ? 'length' : 'stop'),
    { headers: { 'content-type': 'text/event-stream', 'x-private-account': 'do-not-store' } });
};
