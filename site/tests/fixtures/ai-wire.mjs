// Synthetic wire data. No recorded private/provider data.
export const annotations = { text: 'Defend e5.', arrows: [{ from: 'b8', to: 'c6', kind: 'best' }], highlights: [] };
export function wire(provider, parts = ['Control the centre.'], finish = 'stop') {
  const data = value => `data: ${JSON.stringify(value)}\n\n`;
  if (provider === 'anthropic') return [
    { type: 'message_start', message: { id: 'msg_fixture', type: 'message', role: 'assistant', model: 'fixture-model', content: [], stop_reason: null, usage: { input_tokens: 1, output_tokens: 0 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    ...parts.map(text => ({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } })),
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: finish === 'stop' ? 'end_turn' : 'max_tokens', stop_sequence: null }, usage: { output_tokens: 5 } },
    { type: 'message_stop' },
  ].map(event => `event: ${event.type}\n` + data(event)).join('');
  return parts.map(content => data({ id: 'fixture', choices: [{ index: 0, delta: { content }, finish_reason: null }] })).join('') +
    data({ id: 'fixture', choices: [{ index: 0, delta: {}, finish_reason: finish }] }) + 'data: [DONE]\n\n';
}
