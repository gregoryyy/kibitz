// Passage embeddings (TODO 8.3.2). No DOM, persistent storage or implicit provider requests.
import { textExcerpt, TEXT_LIMITS } from './text-search.js';

/** @typedef {import('./text-search.js').Passage} Passage */
/** @typedef {{provider: string, model: string, revision: string, fingerprint: string, scope: string, inputVersion: string}} EmbeddingIdentity */
/** @typedef {EmbeddingIdentity & {providerModel: string|null, dimensions: number}} EmbeddingMetadata */
/** @typedef {{vectors: number[][], metadata: EmbeddingMetadata}} EmbeddingBatch */
/** @typedef {{passages: Passage[], vectors: number[][], metadata: EmbeddingMetadata}} DenseIndex */
/** @typedef {(texts: string[], identity: EmbeddingIdentity, signal: AbortSignal) => Promise<EmbeddingBatch>} Embed */
export const DENSE_LIMITS = { passages: 512, batch: 16, dimensions: 8192 };
export const EMBEDDING_INPUT_VERSION = 'title-text-v1';

/** Apply source/language restrictions before any text is sent to an embedding provider. */
export function selectPassages(/** @type {Passage[]} */ passages, { language = 'all', kind = 'all', collection = 'all' } = {}) {
  if (!['all', 'en', 'de'].includes(language) || !['all', 'annotation', 'guide'].includes(kind) || !['all', 'library', 'classic'].includes(collection)) throw new Error('Invalid passage scope');
  return passages.filter(p => (language === 'all' || p.language === 'und' || p.language === language)
    && (kind === 'all' || p.kind === kind) && (collection === 'all' || p.collection === collection));
}

/** Versioned literal input, without source IDs, licences, unrelated notes or chat instructions. */
export function passageEmbeddingText(/** @type {Passage} */ p) { return `${p.title.slice(0, 240)}\n${p.text}`; }

/** Validate and normalise finite nonzero vectors without overflowing on large coordinates. */
export function normaliseVector(/** @type {number[]} */ vector, dimensions = vector?.length) {
  if (!Array.isArray(vector) || !Number.isSafeInteger(dimensions) || dimensions < 1 || dimensions > DENSE_LIMITS.dimensions || vector.length !== dimensions
    || !vector.every(n => typeof n === 'number' && Number.isFinite(n))) throw new Error('Invalid embedding vector');
  const scale = Math.max(...vector.map(Math.abs));
  if (!scale) throw new Error('Empty embedding direction');
  const scaled = vector.map(n => n / scale), length = Math.sqrt(scaled.reduce((s, n) => s + n * n, 0));
  return scaled.map(n => n / length);
}

/** Identity excludes vector dimension until observed; endpoint and account scopes are opaque. */
export function embeddingIdentity(/** @type {EmbeddingIdentity} */ metadata) {
  const values = ['provider', 'model', 'fingerprint', 'scope', 'inputVersion'].map(k => metadata?.[k]);
  if (values.some(v => typeof v !== 'string' || !v) || typeof metadata?.revision !== 'string' || metadata.inputVersion !== EMBEDDING_INPUT_VERSION) throw new Error('Invalid embedding identity');
  return JSON.stringify([...values, metadata.revision]);
}

/** Build an immutable-by-convention, detached index; partial batches are never published. */
export function buildDenseIndex(/** @type {Passage[]} */ passages, /** @type {number[][]} */ vectors, /** @type {EmbeddingMetadata} */ metadata) {
  embeddingIdentity(metadata);
  if (!passages.length || passages.length > DENSE_LIMITS.passages || passages.length !== vectors.length || new Set(passages.map(p => p.id)).size !== passages.length
    || metadata.providerModel !== null && typeof metadata.providerModel !== 'string') throw new Error('Invalid embedding index');
  return { passages: structuredClone(passages), vectors: vectors.map(v => normaliseVector(v, metadata.dimensions)), metadata: { ...metadata } };
}

/**
 * Cosine ranking over eligible passages. Positive similarity is a retrieval score, not confidence
 * or chess evidence; no-answer behaviour must be measured. Ties use stable passage IDs.
 * @param {DenseIndex} index Current in-memory index.
 * @param {number[]} vector Query embedding from the identical provider/model/revision/dimension.
 * @param {{language?: string, kind?: string, collection?: string, limit?: number, query?: string}} [options]
 */
export function searchDense(index, vector, { limit = 8, query = '', ...filters } = {}) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > TEXT_LIMITS.results || typeof query !== 'string' || query.length > TEXT_LIMITS.query) throw new Error('Invalid dense search');
  const q = normaliseVector(vector, index.metadata.dimensions), eligible = new Set(selectPassages(index.passages, filters).map(p => p.id));
  return index.passages.map((p, i) => ({ p, score: index.vectors[i].reduce((s, n, k) => s + n * q[k], 0) }))
    .filter(h => eligible.has(h.p.id) && h.score > 0).sort((a, b) => b.score - a.score || (a.p.id < b.p.id ? -1 : 1)).slice(0, limit)
    .map(h => ({ passage: structuredClone(h.p), score: Math.min(1, h.score), matched: [], excerpt: textExcerpt(h.p.text, query) }));
}

/** One account/source selection's ephemeral vectors; cancellation invalidates even a late provider. */
export class DenseSession {
  /** @param {Embed} embed Explicit transport; tests supply a fake, the page uses its gateway. */
  constructor(embed) { this.embed = embed; this.generation = 0; this.ctl = null; /** @type {DenseIndex|null} */ this.index = null; }
  /** Cancel a query without dropping vectors, or erase all state on source/account/policy changes. */
  cancel(clear = true) { this.generation++; this.ctl?.abort(); this.ctl = null; if (clear) this.index = null; }
  /** @returns {{signal: AbortSignal, current: () => void}} */
  operation(clear) {
    this.cancel(clear);
    const generation = this.generation, ctl = this.ctl = new AbortController();
    return { signal: ctl.signal, current: () => { if (ctl.signal.aborted || generation !== this.generation) throw new DOMException('Cancelled', 'AbortError'); } };
  }
  /** Index only the caller's already-filtered snapshot, in bounded batches and as one atomic change. */
  async build(/** @type {Passage[]} */ passages, /** @type {EmbeddingIdentity} */ identity, progress = (done, total) => {}) {
    const op = this.operation(true), selected = structuredClone(passages), vectors = [];
    if (!selected.length || selected.length > DENSE_LIMITS.passages || new Set(selected.map(p => p.id)).size !== selected.length) throw new Error('Select 1–512 distinct passages');
    let metadata;
    for (let i = 0; i < selected.length; i += DENSE_LIMITS.batch) {
      op.current();
      const texts = selected.slice(i, i + DENSE_LIMITS.batch).map(passageEmbeddingText);
      const batch = await this.embed(texts, identity, op.signal); op.current();
      if (embeddingIdentity(batch.metadata) !== embeddingIdentity(identity) || batch.vectors.length !== texts.length
        || metadata && (metadata.dimensions !== batch.metadata.dimensions || metadata.providerModel !== batch.metadata.providerModel)) throw new Error('Embedding service changed; rebuild the index');
      metadata = { ...batch.metadata }; vectors.push(...batch.vectors.map(v => normaliseVector(v, metadata.dimensions)));
      progress(vectors.length, selected.length);
    }
    op.current(); this.index = buildDenseIndex(selected, vectors, metadata); return this.index;
  }
  /** Explicit search only; edits/typing never send queries automatically. */
  async search(query, identity, options = {}) {
    const op = this.operation(false), index = this.index;
    if (!index || embeddingIdentity(index.metadata) !== embeddingIdentity(identity)) { this.index = null; throw new Error('Build the semantic index first'); }
    if (typeof query !== 'string' || !query.trim() || query.length > TEXT_LIMITS.query) throw new Error('Invalid dense query');
    const batch = await this.embed([query], identity, op.signal); op.current();
    if (batch.vectors.length !== 1 || embeddingIdentity(batch.metadata) !== embeddingIdentity(index.metadata) || batch.metadata.dimensions !== index.metadata.dimensions || batch.metadata.providerModel !== index.metadata.providerModel) {
      this.index = null; throw new Error('Embedding service changed; rebuild the index');
    }
    return searchDense(index, batch.vectors[0], { ...options, query });
  }
}
