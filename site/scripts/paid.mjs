// Runs that call a paid AI provider with the keys in .env (scripts/eval.mjs, scripts/flipbook.mjs)
// ask first: before the first call they print who answers, with which models, and how many calls the
// run makes, and they only go ahead with --yes. Ollama, the in-browser model and the mock cost nothing.

export const PAID = ['anthropic', 'openai', 'mistral'];

// uses: [{role: 'coach' | 'judge', provider, models: [model ids], calls}]. Returns the lines to print.
export function paidPlan(uses) {
  return uses.filter(u => u.calls > 0).map(u => {
    const models = [...new Set(u.models.filter(Boolean))].join(', ') || 'the default model';
    return `${u.role}: ${u.provider} (${models}), about ${u.calls} call${u.calls === 1 ? '' : 's'}${PAID.includes(u.provider) ? ', paid' : ', free'}`;
  });
}

// Whether the run may go ahead: yes when nothing is paid, or when --yes was given.
export function mayRun(uses, yes) {
  return !!yes || !uses.some(u => u.calls > 0 && PAID.includes(u.provider));
}

// The models the gateway uses, from its /api/ai/status: one per task (quick, chat, review), or the one model.
export const statusModels = st => (st?.models ? [st.models.quick, st.models.chat, st.models.review] : [st?.model]);
