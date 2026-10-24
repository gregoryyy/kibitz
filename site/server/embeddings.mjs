// Stateless embedding gateway. Text and vectors are never cached, persisted or logged here.
import crypto from 'node:crypto';
import { createEmbedder, GatewayError, LOCAL_PROVIDERS, loadEmbeddingConfig } from './ai.mjs';
import { DENSE_LIMITS, EMBEDDING_INPUT_VERSION } from '../src/library/dense-search.js';

/**
 * Account-scoped response identities and shared AI budgets, independent of the chat provider.
 * The page owns its library and vectors; the cookie scope is a cache boundary, not authentication.
 */
export function createEmbeddingApi({ config = loadEmbeddingConfig(), embedder = config.available ? createEmbedder(config) : null,
  localOnly, allow, ledger, users }) {
  const salt = crypto.randomBytes(32), active = new Map();
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify([config.provider, config.model, config.revision, config.baseURL, EMBEDDING_INPUT_VERSION])).digest('hex');
  const local = LOCAL_PROVIDERS.includes(config.provider);
  const status = uid => ({ provider: config.provider, model: config.model, revision: config.revision || '', fingerprint,
    scope: crypto.createHmac('sha256', salt).update(uid).digest('hex'), inputVersion: EMBEDDING_INPUT_VERSION, local,
    localOnly: !!localOnly(), available: !!embedder && (!localOnly() || local), reason: localOnly() && !local ? 'Local-only mode blocks this embedding provider.' : config.reason || '' });
  return {
    status,
    /** An opt-in to local-only mode also aborts cloud requests that were already accepted. */
    policyChanged() { if (localOnly() && !local) for (const ctl of active.values()) ctl.abort(); },
    async embed(uid, body, res) {
      const identity = status(uid);
      if (!identity.available) throw new GatewayError('unavailable', identity.reason || 'No embedding provider configured', 503);
      if (!body || Object.keys(body).some(k => !['texts', 'fingerprint', 'scope'].includes(k)) || body.fingerprint !== identity.fingerprint || body.scope !== identity.scope) throw new GatewayError('stale_embeddings', 'Embedding service changed; rebuild the index', 409);
      const texts = body.texts;
      if (!Array.isArray(texts) || !texts.length || texts.some(t => typeof t !== 'string' || !t.trim())) throw new GatewayError('bad_request', 'Expected non-empty text strings', 400);
      if (texts.length > DENSE_LIMITS.batch || texts.some(t => t.length > 8000)) throw new GatewayError('prompt_too_large', 'At most 16 texts of 8000 characters', 413);
      ledger.check(); if (!local) users.check(uid);
      if (active.has(uid) || active.size >= 4 || !allow()) throw new GatewayError('rate_limited', 'Embedding service is busy; try again shortly', 429);
      const ctl = new AbortController(); active.set(uid, ctl);
      const abort = () => { if (!res.writableEnded) ctl.abort(); };
      res.on('close', abort);
      try {
        const batch = await embedder.embedBatch(texts, { signal: ctl.signal });
        // Count completed work even if its caller/policy changed during the request.
        ledger.add(config.model, batch.usage); const cost = users.add(uid, config.model, batch.usage, { paid: !local });
        if (ctl.signal.aborted || !status(uid).available) throw new GatewayError('cancelled', 'Cancelled', 499);
        return { vectors: batch.vectors, metadata: { provider: identity.provider, model: identity.model, revision: identity.revision,
          fingerprint, scope: identity.scope, inputVersion: EMBEDDING_INPUT_VERSION, providerModel: batch.providerModel, dimensions: batch.vectors[0].length },
        usage: { ...batch.usage, cost }, user: users.today(uid) };
      } finally { res.off('close', abort); if (active.get(uid) === ctl) active.delete(uid); }
    },
  };
}
