// Synthetic provider policy, never a fallback to network or a claim of live API success.
import { wire, annotations } from './ai-wire.mjs';
const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
globalThis.fetch = async (url, init) => {
  if (!String(url).startsWith('https://luna-fixture.invalid/')) throw Error('Unexpected synthetic endpoint');
  const body = JSON.parse(init.body);
  if (body.model !== 'gpt-6-luna' || body.reasoning_effort !== 'none') return new Response(JSON.stringify({ error: { message: 'Synthetic policy: GPT-6 Luna requires reasoning_effort none.' } }), { status: 400, headers: { 'content-type': 'application/json' } });
  let output;
  if (body.response_format) output = wire('openai', [JSON.stringify(annotations)]);
  else if (body.tools?.length && !body.messages.some(message => message.role === 'tool')) {
    const data = value => `data: ${JSON.stringify(value)}\n\n`;
    output = data({ id: 'luna-fixture', choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: 'analyse1', type: 'function', function: { name: 'analyse', arguments: JSON.stringify({ fen, depth: 6, lines: 1 }) } }] }, finish_reason: null }] })
      + data({ id: 'luna-fixture', choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] }) + 'data: [DONE]\n\n';
  } else output = wire('openai', [body.max_completion_tokens === 256 ? 'OK' : 'Stockfish returned an analysis.']);
  return new Response(output, { headers: { 'content-type': 'text/event-stream' } });
};
