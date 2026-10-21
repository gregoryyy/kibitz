// Token usage per day, daily budgets, and a cost estimate from prices you set. Kept in memory: it
// starts at zero when the server restarts.
// - usageLedger: the whole server, with an optional token budget (AI_TOKEN_BUDGET_PER_DAY).
// - userLedger: each user, with budgets in tokens and in US dollars for paid models (TODO 2.11).
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

// What one request cost in US dollars, or null when the model has no price.
export function costOf(prices, model, usage) {
  const p = prices.get(model);
  return p ? ((usage?.input || 0) * p.input + (usage?.output || 0) * p.output) / 1e6 : null;
}

const round6 = x => Math.round(x * 1e6) / 1e6;
const fmtTokens = n => n.toLocaleString('en');

// Usage per user and day, and the per-user limits. The limits apply to paid models only (the cloud
// providers): a token budget and a cost budget in US dollars, 0 meaning none. Local models (Ollama,
// mock) are counted but never limited. Until there are accounts (TODO 10.1, 10.2), users are told
// apart by a random cookie (api.mjs), so someone who clears it starts the day again; the
// server-wide budget still caps the total. At most maxUsers are kept; past that, the oldest go.
export function userLedger({ tokensPerDay = 0, costPerDay = 0, prices = new Map(), now = () => Date.now(), maxUsers = 10_000 } = {}) {
  let day = dayOf(now());
  const users = new Map();
  const roll = () => { const d = dayOf(now()); if (d !== day) { day = d; users.clear(); } };
  const fresh = () => ({ requests: 0, input: 0, output: 0, cost: 0, unpriced: 0, paidTokens: 0, paidCost: 0 });
  return {
    // Throws once the user has reached a budget for paid models today.
    check(uid) {
      roll();
      const u = users.get(uid); if (!u) return;
      const until = 'It resets at midnight; local models (Ollama, the in-browser model) still work.';
      if (tokensPerDay && u.paidTokens >= tokensPerDay) throw new GatewayError('budget_exceeded', `You've used today's budget of ${fmtTokens(tokensPerDay)} tokens on paid models. ${until}`, 429);
      if (costPerDay && u.paidCost >= costPerDay) throw new GatewayError('budget_exceeded', `You've used today's budget of $${costPerDay.toFixed(2)} on paid models. ${until}`, 429);
    },
    // Counts a request; returns its cost in US dollars, or null when the model has no price.
    add(uid, model, usage, { paid = true } = {}) {
      roll();
      let u = users.get(uid);
      if (!u) {
        if (users.size >= maxUsers) users.delete(users.keys().next().value);
        users.set(uid, u = fresh());
      }
      const input = usage?.input || 0, output = usage?.output || 0, cost = costOf(prices, model, usage);
      u.requests++; u.input += input; u.output += output;
      if (cost === null) u.unpriced += input + output; else u.cost += cost;
      if (paid) { u.paidTokens += input + output; u.paidCost += cost || 0; }
      return cost === null ? null : round6(cost);
    },
    // The user's totals today. cost is null when nothing they used has a price; budget and left
    // are null where no budget is set.
    today(uid) {
      roll();
      const u = users.get(uid) || fresh(), tokens = u.input + u.output;
      return {
        day, requests: u.requests, input: u.input, output: u.output,
        cost: tokens && u.unpriced === tokens ? null : round6(u.cost), unpricedTokens: u.unpriced,
        paid: { tokens: u.paidTokens, cost: round6(u.paidCost) },
        budget: { tokens: tokensPerDay || null, cost: costPerDay || null },
        left: { tokens: tokensPerDay ? Math.max(0, tokensPerDay - u.paidTokens) : null, cost: costPerDay ? round6(Math.max(0, costPerDay - u.paidCost)) : null },
      };
    },
  };
}
