import { createHash } from 'node:crypto';
import { createEmbedder, loadEmbeddingConfig, LOCAL_PROVIDERS } from '../../server/ai.mjs';
import { DenseSession, EMBEDDING_INPUT_VERSION } from '../../src/dense-search.js';
import { runTextBenchmark } from './text-benchmark.mjs';

/**
 * Opt-in dense evaluation over the authored benchmark only, never a saved player library.
 * The same ingestion/search implementation serves the page and this evaluation. Tests inject
 * a fake client; CLI cloud calls additionally require --allow-cloud. No .env file is loaded.
 */
export async function runDenseBenchmark({ config = loadEmbeddingConfig(), embedder = null, allowCloud = false } = {}) {
  if (!config.available) throw new Error('Configure EMBEDDING_PROVIDER and EMBEDDING_MODEL for dense evaluation');
  if (!LOCAL_PROVIDERS.includes(config.provider) && !allowCloud) throw new Error('Cloud evaluation requires --allow-cloud; the authored corpus and queries will be sent to that provider');
  const provider = embedder || createEmbedder(config);
  const identity = { provider: config.provider, model: config.model, revision: config.revision || '', inputVersion: EMBEDDING_INPUT_VERSION, scope: 'authored-retrieval-benchmark',
    fingerprint: createHash('sha256').update(JSON.stringify([config.provider, config.model, config.revision || '', config.baseURL || '', EMBEDDING_INPUT_VERSION])).digest('hex') };
  const session = new DenseSession(async (texts, id, signal) => {
    const r = await provider.embedBatch(texts, { signal });
    return { vectors: r.vectors, metadata: { ...identity, providerModel: r.providerModel, dimensions: r.vectors[0]?.length } };
  });
  const report = await runTextBenchmark({ retriever: 'passage-cosine-v1', retrieve: async (passages, query, options) => {
    if (!session.index) await session.build(passages, identity);
    return session.search(query, identity, options);
  } });
  const baseline = await runTextBenchmark();
  if (report.corpusHash !== baseline.corpusHash || report.casesHash !== baseline.casesHash) throw new Error('Comparison corpus changed');
  return { ...report, embedding: { ...session.index.metadata }, baseline: { retriever: baseline.retriever, summary: baseline.summary } };
}
