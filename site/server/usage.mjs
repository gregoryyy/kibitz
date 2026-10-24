// Token usage per day, daily budgets and operator-supplied cost estimates. The local
// serve recipes use private SQLite persistence; direct API tests default to memory.
// - usageLedger: the whole server, with an optional token budget (AI_TOKEN_BUDGET_PER_DAY).
// - userLedger: each user, with budgets in tokens and in US dollars for paid models (TODO 2.11).
import { GatewayError } from './ai.mjs';
import { memoryUsageStore, usageDay as dayOf, usageKey } from './usage-store.mjs';

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

export function usageLedger({ tokensPerDay = 0, prices = new Map(), now = () => Date.now(), store = memoryUsageStore() } = {}) {
  return {
    // Throws once today's tokens have reached the budget (0 = no budget).
    check() {
      const totals = store.read('server', dayOf(now()));
      if (tokensPerDay && totals.input + totals.output >= tokensPerDay) {
        throw new GatewayError('budget_exceeded', `Today's AI budget of ${tokensPerDay} tokens is used up; it resets at midnight (AI_TOKEN_BUDGET_PER_DAY)`, 429);
      }
    },
    add(model, usage) {
      store.transaction(() => {
        const day = dayOf(now()), totals = store.read('server', day);
        addUsage(totals, prices, model, usage, false);
        store.write('server', day, totals);
      });
    },
    // Today's totals; cost is null when nothing used today has a price.
    today() {
      const day = dayOf(now()), totals = store.read('server', day);
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
// providers): a token budget and a cost budget in US dollars, 0 meaning none. Local gateway models (Ollama,
// mock) are counted outside these paid budgets; global budgets and rates still apply. Users are told
// apart by a random cookie (api.mjs), so someone who clears it starts the day again; the
// server-wide admission thresholds still apply. Memory ledgers keep maxUsers; persistent
// accounting rejects capacity exhaustion instead of evicting a spent budget.
export function userLedger({ tokensPerDay = 0, costPerDay = 0, prices = new Map(), now = () => Date.now(), maxUsers = 10_000, store = memoryUsageStore(maxUsers) } = {}) {
  return {
    // Throws once the user has reached a budget for paid models today.
    check(uid) {
      const u = store.read(usageKey(uid), dayOf(now()));
      const until = 'It resets at midnight; local models (Ollama, the in-browser model) still work.';
      if (tokensPerDay && u.paidTokens >= tokensPerDay) throw new GatewayError('budget_exceeded', `You've used today's budget of ${fmtTokens(tokensPerDay)} tokens on paid models. ${until}`, 429);
      if (costPerDay && u.paidCost >= costPerDay) throw new GatewayError('budget_exceeded', `You've used today's budget of $${costPerDay.toFixed(2)} on paid models. ${until}`, 429);
    },
    // Counts a request; returns its cost in US dollars, or null when the model has no price.
    add(uid, model, usage, { paid = true } = {}) {
      return store.transaction(() => {
        const day = dayOf(now()), key = usageKey(uid), u = store.read(key, day);
        const cost = addUsage(u, prices, model, usage, paid);
        store.write(key, day, u);
        return cost === null ? null : round6(cost);
      });
    },
    // The user's totals today. cost is null when nothing they used has a price; budget and left
    // are null where no budget is set.
    today(uid) {
      const day = dayOf(now()), u = store.read(usageKey(uid), day), tokens = u.input + u.output;
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

// Reject malformed provider usage rather than corrupting counters or reducing a budget.
function addUsage(totals, prices, model, usage, paid) {
  const input = usage?.input ?? 0, output = usage?.output ?? 0;
  if (![input, output].every(n => Number.isSafeInteger(n) && n >= 0)) throw new GatewayError('provider_error', 'The provider returned invalid token usage', 502);
  const cost = costOf(prices, model, { input, output });
  totals.requests++; totals.input += input; totals.output += output;
  if (cost === null) totals.unpriced += input + output; else totals.cost += cost;
  if (paid) { totals.paidTokens += input + output; totals.paidCost += cost || 0; }
  return cost;
}

/** Shared counters and atomic server/user recording, including cookie-scoped rolling rates. */
export function usageAccounting(config, { store = memoryUsageStore(), now = () => Date.now() } = {}) {
  const prices = parsePrices(config.prices);
  const ledger = usageLedger({ tokensPerDay: config.tokensPerDay, prices, now, store });
  const users = userLedger({ tokensPerDay: config.userTokensPerDay, costPerDay: config.userCostPerDay, prices, now, store });
  return {
    ledger, users,
    countUsage: (uid, model, usage, { paid = true } = {}) => store.transaction(() => {
      const day = dayOf(now()), key = usageKey(uid), server = store.read('server', day), user = store.read(key, day);
      addUsage(server, prices, model, usage, false);
      const cost = addUsage(user, prices, model, usage, paid);
      store.write('server', day, server); store.write(key, day, user);
      return cost === null ? null : round6(cost);
    }),
    allow: uid => store.transaction(() => {
      const t = now(), day = dayOf(t), key = usageKey(uid);
      const server = store.read('server', day), user = store.read(key, day);
      for (const row of [server, user]) row.hits = row.hits.filter(hit => t - hit < 60_000);
      if (server.hits.length >= config.ratePerMinute || user.hits.length >= (config.userRatePerMinute ?? config.ratePerMinute)) return false;
      server.hits.push(t); user.hits.push(t);
      store.write('server', day, server); store.write(key, day, user); return true;
    }),
  };
}
