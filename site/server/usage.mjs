// Token usage per day, an optional daily token budget, and a cost estimate from prices you set.
// Kept in memory: it starts at zero when the server restarts. There are no user accounts yet
// (TODO 10.1), so the budget is for the whole server.
import { GatewayError } from './ai.mjs';

// AI_PRICES="claude-haiku-5-5=1/5,claude-sonnet-5-5=3/15": US dollars per million input/output
// tokens, per model. No built-in prices: they change, so the estimate only covers what you set.
export function parsePrices(spec) {
  const prices = new Map();
  for (const part of String(spec || '').split(',').map(s => s.trim()).filter(Boolean)) {
    const m = /^([^=\s]+)\s*=\s*([\d.]+)\s*\/\s*([\d.]+)$/.exec(part);
    if (m && Number.isFinite(+m[2]) && Number.isFinite(+m[3])) prices.set(m[1], { input: +m[2], output: +m[3] });
  }
  return prices;
}

const dayOf = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export function usageLedger({ tokensPerDay = 0, prices = new Map(), now = () => Date.now() } = {}) {
  let day = dayOf(now()), totals = fresh();
  function fresh() { return { requests: 0, input: 0, output: 0, cost: 0, unpriced: 0 }; }
  const roll = () => { const d = dayOf(now()); if (d !== day) { day = d; totals = fresh(); } };
  return {
    // Throws once today's tokens have reached the budget (0 = no budget).
    check() {
      roll();
      if (tokensPerDay && totals.input + totals.output >= tokensPerDay) {
        throw new GatewayError('budget_exceeded', `Today's AI budget of ${tokensPerDay} tokens is used up; it resets at midnight (AI_TOKEN_BUDGET_PER_DAY)`, 429);
      }
    },
    add(model, usage) {
      roll();
      const input = usage?.input || 0, output = usage?.output || 0, p = prices.get(model);
      totals.requests++; totals.input += input; totals.output += output;
      if (p) totals.cost += (input * p.input + output * p.output) / 1e6;
      else totals.unpriced += input + output;
    },
    // Today's totals; cost is null when nothing used today has a price.
    today() {
      roll();
      const tokens = totals.input + totals.output;
      return {
        day, requests: totals.requests, input: totals.input, output: totals.output,
        cost: tokens && totals.unpriced === tokens ? null : Math.round(totals.cost * 1e6) / 1e6, unpricedTokens: totals.unpriced,
        budget: tokensPerDay || null, left: tokensPerDay ? Math.max(0, tokensPerDay - tokens) : null,
      };
    },
  };
}
