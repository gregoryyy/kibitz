// Confidence concerns the declared relation type, never endpoint truth or approval.
export const CONFIDENCE_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['value', 'method', 'policy', 'rationale'],
  properties: { value: { type: 'number', minimum: 0, maximum: 1 }, method: { enum: ['observed', 'rule', 'analyst'] }, policy: { const: 'typed-links-1' }, rationale: { type: 'string', minLength: 1 } },
};
export function confidence(value, method, rationale) {
  return { value, method, policy: 'typed-links-1', rationale };
}
export function classifyLink(type, evidence) {
  const rows = Array.isArray(evidence) ? evidence : [evidence];
  if (type === 'mentions_object') return confidence(0.85, 'rule', 'Exact name in an explicitly cited file; semantic attribution remains a heuristic.');
  if (rows.every(e => e.resolution === 'unique_suffix')) return confidence(0.8, 'rule', 'A unique current path suffix resolves the token; historical intent is uncertain.');
  return confidence(1, 'observed', 'Direct syntactic/structural evidence for this narrowly defined relation; no satisfaction or runtime claim.');
}
export const edgeKey = edge => JSON.stringify([edge.type, edge.from, edge.to]);
export const pathConfidence = edges => edges.length ? Math.min(...edges.map(e => e.confidence.value)) : 0;
