// Retrieval metrics, independent of chess, providers and the retrieval algorithm.
/** @typedef {{id: string, grade: number}} Judgement */

/**
 * Score the first k slots. Short lists still divide precision by k; duplicates consume
 * slots and earn credit once. No-answer cases have null relevance metrics and a separate
 * false-positive outcome. Graded nDCG uses (2^grade - 1) / log2(rank + 1).
 * @param {string[]} rankedIds Ordered document or occurrence IDs.
 * @param {Judgement[]} expected Exhaustive positive judgements for this query/corpus.
 * @param {number} k Positive integer cutoff.
 */
export function scoreRanking(rankedIds, expected, k) {
  if (!Number.isSafeInteger(k) || k < 1) throw new Error('k must be a positive integer');
  const grades = new Map();
  for (const { id, grade } of expected) {
    if (!id || grades.has(id) || !Number.isSafeInteger(grade) || grade < 1 || grade > 2) throw new Error('Invalid or duplicate relevance judgement');
    grades.set(id, grade);
  }
  const top = rankedIds.slice(0, k), seen = new Set();
  let relevant = 0, reciprocalRank = 0, dcg = 0;
  top.forEach((id, i) => {
    const grade = seen.has(id) ? 0 : grades.get(id) || 0;
    seen.add(id);
    if (!grade) return;
    relevant++;
    if (!reciprocalRank) reciprocalRank = 1 / (i + 1);
    dcg += (2 ** grade - 1) / Math.log2(i + 2);
  });
  const ideal = [...grades.values()].sort((a, b) => b - a).slice(0, k)
    .reduce((sum, grade, i) => sum + (2 ** grade - 1) / Math.log2(i + 2), 0);
  return { k, returned: top.length, relevant, precision: grades.size ? relevant / k : null,
    recall: grades.size ? relevant / grades.size : null, reciprocalRank: grades.size ? reciprocalRank : null,
    ndcg: grades.size ? dcg / ideal : null, falsePositive: grades.size ? null : top.length > 0 };
}

/**
 * Macro means over answerable queries only. No-answer false-positive rate uses its own
 * denominator, so adding empty queries cannot inflate precision or recall.
 * @param {ReturnType<typeof scoreRanking>[]} scores Scores at a single cutoff.
 */
export function summariseRankings(scores) {
  const mean = field => {
    const values = scores.map(s => s[field]).filter(x => x !== null);
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  };
  const unanswerable = scores.filter(s => s.falsePositive !== null);
  return { queries: scores.length, answerable: scores.length - unanswerable.length, unanswerable: unanswerable.length,
    precision: mean('precision'), recall: mean('recall'), mrr: mean('reciprocalRank'), ndcg: mean('ndcg'),
    falsePositiveRate: unanswerable.length ? unanswerable.filter(s => s.falsePositive).length / unanswerable.length : null };
}
