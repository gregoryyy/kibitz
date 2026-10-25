import { shape, isRepositoryPath, RELATIONS } from './types.mjs';
import { DETAIL_RELATIONS } from './detail-types.mjs';
import { CONFIDENCE_SCHEMA, edgeKey } from './confidence.mjs';
const implementation = ['artifact', 'object'], targets = ['todo'];
const all = ['artifact', 'object', 'todo', 'milestone', 'done', 'insight', 'deviation', 'reflection', 'section', 'doc_block', 'pull_request', 'pr_section', 'external'];
export const ASSESSMENT_RELATIONS = {
  ...RELATIONS, ...DETAIL_RELATIONS,
  implements: { from: implementation, to: targets },
  verifies: { from: implementation, to: targets },
  documents: { from: ['artifact', 'section', 'pr_section'], to: all },
  deviates_from: { from: ['deviation', 'reflection', 'done', ...implementation], to: all },
  supports: { from: all, to: all }, contradicts: { from: all, to: all },
};
const str = { type: 'string', minLength: 1 };
const record = properties => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });
export const ASSESSMENT_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema', title: 'Authored typed-link assessments, version 1',
  ...record({ schemaVersion: { const: 1 }, edges: { type: 'array', items: record({ type: { enum: Object.keys(ASSESSMENT_RELATIONS) }, from: str, to: str, confidence: CONFIDENCE_SCHEMA,
    evidence: record({ source: record({ path: str, line: { type: 'integer', minimum: 1 }, endLine: { type: 'integer', minimum: 1 } }), reference: str, resolution: { const: 'authored_assessment' } }),
  }) } }),
};
export function validateAssessments(assessments, layers) {
  shape(assessments, ASSESSMENT_SCHEMA);
  const nodes = new Map(layers.flatMap(l => l.nodes).map(n => [n.id, n])), seen = new Set();
  const extracted = new Set(layers.flatMap(l => l.edges).map(edgeKey));
  for (const edge of assessments.edges) {
    const rule = ASSESSMENT_RELATIONS[edge.type], from = nodes.get(edge.from), to = nodes.get(edge.to), s = edge.evidence.source;
    if (!rule.from.includes(from?.type) || !rule.to.includes(to?.type)) throw new Error('Invalid assessment endpoints');
    if ((Object.hasOwn(RELATIONS, edge.type) || Object.hasOwn(DETAIL_RELATIONS, edge.type)) && !extracted.has(edgeKey(edge))) throw new Error('Extracted relation types can only override an existing extracted link');
    if (seen.has(edgeKey(edge))) throw new Error('Duplicate assessment type for pair'); seen.add(edgeKey(edge));
    if (edge.confidence.method !== 'analyst' || !isRepositoryPath(s.path) || nodes.get(`file:${s.path}`)?.type !== 'artifact' || s.endLine < s.line) throw new Error('Assessment needs analyst confidence and a repository citation');
  }
  return assessments;
}

// Per-type overrides replace confidence without discarding extracted evidence.
// Distinct types on the same pair coexist and are never normalized to sum to one.
export function applyAssessments(layers, assessments) {
  const pending = new Map(assessments.edges.map(e => [edgeKey(e), e]));
  const effective = layers.map(layer => ({ ...layer, edges: layer.edges.map(edge => {
    const annotation = pending.get(edgeKey(edge)); if (!annotation) return edge;
    pending.delete(edgeKey(edge)); return { ...edge, confidence: annotation.confidence, assessmentEvidence: annotation.evidence };
  }) }));
  effective.push({ level: 'assessment', nodes: [], edges: [...pending.values()], unresolved: [] });
  return effective;
}
