// Test-subprocess fetch replacement: every SDK request is intercepted, with no network fallback.
import { wire } from './ai-wire.mjs';
globalThis.fetch = async (url, init) => {
  if (!String(url).startsWith('https://fixture.invalid/')) throw Error('Unexpected synthetic endpoint');
  const body = JSON.parse(init.body), tools = process.env.KIBITZ_REJECTION_KIND === 'tools';
  if (tools && !body.tools) return new Response(wire('mistral', ['A safe explanation using the supplied context.']), { headers: { 'content-type': 'text/event-stream' } });
  const privateText = process.env.MISTRAL_API_KEY + ' PROMPT_PRIVATE https://private.invalid/path?account=ACCOUNT_PRIVATE\nFORGED_EVENT';
  return new Response(JSON.stringify({ error: { message: (tools ? 'Model does not support tools. ' : '') + privateText } }), { status: 400, headers: { 'content-type': 'application/json' } });
};
