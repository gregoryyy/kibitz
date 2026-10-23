// Tool availability for gateway models (TODO 4.11). Pure policy, separate from engine execution.

/**
 * Identify the actual provider/model for a task, not the task label itself.
 * A quick model can lack tools while the chat model supports them; equal model routes
 * share capability knowledge. Only public configuration is used, never credentials.
 * @param {{provider?: string, model?: string, models?: Record<string, string>}|null} gateway Public gateway status.
 * @param {string} [task='chat']
 * @returns {string} Stable key for a page-local capability cache.
 */
export function toolModelKey(gateway, task = 'chat') {
  return JSON.stringify([gateway?.provider || '', gateway?.models?.[task] || gateway?.model || '']);
}

/**
 * Recognise only an explicit lack of tool/function calling in a rejected request.
 * A timeout, generic provider error, invalid schema/parameter or authentication error
 * must stay visible and must not disable Stockfish tools for later questions.
 * @param {{code?: string, message?: string}|null} error Gateway error with a sanitised reason.
 * @returns {boolean}
 */
export function toolsUnsupported(error) {
  if (error?.code !== 'provider_rejected') return false;
  const message = String(error.message || '');
  return /\b(?:does not|doesn't|cannot|can't)\s+support\s+(?:tools?|tool[_ -](?:calling|use)|functions?|function[_ -]calling)\b/i.test(message)
    || /\b(?:tools?|tool[_ -](?:calling|use)|functions?|function[_ -]calling)\b["']?\s+(?:is|are)\s+(?:not supported|unsupported)\b/i.test(message);
}

/** Text for both the model and a visible notice; never claim a fresh search in context-only mode. */
export const TOOL_FALLBACK = 'This model cannot call tools. This answer uses the supplied context and any engine analysis already provided; the model did not request an additional Stockfish search.';

/**
 * Append trusted runtime instructions to the existing standing rules. Preserve the first
 * message's quoting/security rules and the order of all question, call and result turns.
 * Rebuild from the original turns each time so instructions do not accumulate across rounds.
 * @template {{role: string, content: string}} T
 * @param {readonly T[]} turns Standing rules first, followed by the dialogue.
 * @param {string} instructions Trusted application instructions.
 * @returns {T[]} New array; input turns are not mutated.
 */
export function withToolInstructions(turns, instructions) {
  return turns.map((turn, i) => i ? turn : { ...turn, content: `${turn.content}\n\n${instructions}` });
}

/**
 * Tell the model what it can actually request on this turn. Provider schemas alone can
 * leave a model repeating generic claims that it has no engine access. Keep this separate
 * from the dialogue so each round reflects its current permissions and remaining budget.
 * @param {string[]} names Tools actually offered to the provider.
 * @param {boolean} offer Whether the tool-call budget permits another call.
 * @returns {string} Trusted application instructions, not user/imported text.
 */
export function toolInstructions(names, offer) {
  if (!offer) return 'The tool-call budget is exhausted. Answer using the supplied context and the tool results already returned. Do not claim to run another engine search.';
  if (names.includes('analyse')) return 'Stockfish evaluation tools are available in this request. You can request fresh analysis with analyse(fen, depth, lines), check a candidate with try_move(fen, move), or compare candidates with compare(fen, moves). Use the offered tools when the question needs more engine evidence. Do not say you cannot request Stockfish evaluations while these tools are offered. Report a new evaluation only after receiving its tool result; a failed call is not analysis evidence.';
  return 'No Stockfish evaluation tools are offered in this request. Follow the supplied General chess or live-help context; do not claim to run a fresh engine search. Use only the offered library/board tools and any permitted context.';
}
