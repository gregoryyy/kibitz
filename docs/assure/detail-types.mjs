// Levels 2 and 3 share a contract, but remain separate snapshots from level 1.
import { createHash } from 'node:crypto';
import { shape, isRepositoryPath } from './types.mjs';
export const DETAIL_RELATIONS = {
  contains_object: { from: ['artifact', 'object'], to: ['object'] },
  calls: { from: ['artifact', 'object'], to: ['object'] },
  references_binding: { from: ['artifact', 'object'], to: ['object'] },
  imports_binding: { from: ['artifact', 'object'], to: ['object'] },
  contains_section: { from: ['artifact', 'section'], to: ['section'] },
  contains_block: { from: ['artifact', 'section'], to: ['doc_block'] },
  locates_item: { from: ['artifact', 'section'], to: ['milestone', 'todo', 'done', 'insight', 'deviation', 'reflection'] },
  mentions_object: { from: ['artifact', 'section', 'pr_section', 'todo', 'done', 'insight', 'deviation', 'reflection'], to: ['object'] },
  documents_link: { from: ['artifact', 'section', 'pr_section'], to: ['artifact', 'section', 'object', 'external', 'pull_request', 'pr_section'] },
  has_description: { from: ['pull_request'], to: ['pr_section'] },
  changes_file: { from: ['pull_request'], to: ['artifact'] },
  references_item: { from: ['pr_section'], to: ['todo', 'milestone'] },
  mentions_file: { from: ['pr_section'], to: ['artifact'] },
};
const str = { type: 'string', minLength: 1 }, text = { type: 'string' };
const sha = { type: 'string', pattern: '^[a-f0-9]{64}$' };
const integer = { type: 'integer', minimum: 0 };
const record = properties => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });
const source = record({ path: str, line: { type: 'integer', minimum: 1 }, endLine: { type: 'integer', minimum: 1 } });
const locator = record({ start: integer, end: integer, sha256: sha, selector: str, parser: str });
const nodeFields = {
  object: { name: str, kind: str, source, locator },
  section: { name: str, anchor: text, source, locator },
  doc_block: { name: str, language: text, source, locator },
  pull_request: { name: str, number: { type: 'integer', minimum: 1 }, url: str, state: { enum: ['OPEN', 'CLOSED', 'MERGED'] }, head: str, base: str, filesComplete: { enum: [true, false] } },
  pr_section: { name: str, number: { type: 'integer', minimum: 1 }, anchor: text, text, source, locator },
  external: { name: str, url: str },
};
export const DETAIL_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema', title: 'Kibitz detailed reference lineage, version 1',
  ...record({ schemaVersion: { const: 1 }, level: { enum: [2, 3] }, extractor: { const: 'kibitz-detail-1' }, baseSha256: sha,
    exclusions: record({ externalImportCalls: integer, memberOrDynamicCalls: integer }),
    inputs: { type: 'array', items: record({ path: str, sha256: sha }) },
    nodes: { type: 'array', items: { oneOf: Object.entries(nodeFields).map(([type, fields]) => record({ id: str, type: { const: type }, ...fields })) } },
    edges: { type: 'array', items: record({ type: { enum: Object.keys(DETAIL_RELATIONS) }, from: str, to: str,
      evidence: record({ source, reference: text, resolution: str }) }) },
    unresolved: { type: 'array', items: record({ source, reference: text, reason: str, candidates: { type: 'array', items: str } }) },
  }),
};
export const snapshotDigest = graph => {
  const text = '{\n' + Object.entries(graph).map(([key, value]) => `  ${JSON.stringify(key)}: ` + (Array.isArray(value) ? '[\n' + value.map(v => '    ' + JSON.stringify(v)).join(',\n') + '\n  ]' : JSON.stringify(value))).join(',\n') + '\n}\n';
  return createHash('sha256').update(text).digest('hex');
};
export function validateLayers(base, layers) {
  const digest = snapshotDigest(base);
  const nodes = new Map(base.nodes.map(n => [n.id, n]));
  for (const layer of layers) {
    shape(layer, DETAIL_SCHEMA);
    if (layer.baseSha256 !== digest) throw new Error('Detailed graph has stale level-1 identity');
    for (const node of layer.nodes) {
      if (nodes.has(node.id)) throw new Error(`Duplicate detailed identity: ${node.id}`);
      if (layer.level === 2 && ['section', 'doc_block', 'external'].includes(node.type) || layer.level === 3 && !['section', 'doc_block', 'external'].includes(node.type)) throw new Error('Node in incorrect assurance level');
      nodes.set(node.id, node);
    }
  }
  const checkSource = s => {
    if (s.endLine < s.line || !(isRepositoryPath(s.path) && nodes.get(`file:${s.path}`)?.type === 'artifact' || /^pr:[1-9]\d*$/.test(s.path) && nodes.has(s.path))) throw new Error('Invalid detailed source');
  };
  const seen = new Set(), parents = new Map();
  for (const layer of layers) {
    for (const node of layer.nodes) {
      if (node.source) checkSource(node.source);
      if (node.locator && node.locator.end < node.locator.start) throw new Error('Invalid locator range');
      if (node.url && !/^https?:\/\//.test(node.url)) throw new Error('Unsafe link scheme');
    }
    for (const edge of layer.edges) {
      const key = JSON.stringify([edge.type, edge.from, edge.to]);
      if (seen.has(key)) throw new Error('Duplicate detailed edge'); seen.add(key);
      const rule = DETAIL_RELATIONS[edge.type], from = nodes.get(edge.from), to = nodes.get(edge.to);
      if (!rule.from.includes(from?.type) || !rule.to.includes(to?.type)) throw new Error(`Invalid detailed endpoints: ${edge.type}`);
      checkSource(edge.evidence.source);
      if (['contains_object', 'contains_section', 'contains_block', 'has_description'].includes(edge.type)) {
        parents.set(to.id, (parents.get(to.id) || 0) + 1);
        if (from.source && (from.source.path !== to.source.path || from.source.line > to.source.line || from.source.endLine < to.source.endLine)) throw new Error('Child outside owner');
        if (from.type === 'artifact' && from.path !== to.source.path || from.type === 'pull_request' && from.id !== to.source.path) throw new Error('Incorrect detailed owner');
      }
    }
    for (const issue of layer.unresolved) checkSource(issue.source);
    for (const input of layer.inputs) if (!isRepositoryPath(input.path) || !nodes.has(`file:${input.path}`)) throw new Error('Invalid detailed input');
  }
  for (const layer of layers) for (const node of layer.nodes) if (node.locator && parents.get(node.id) !== 1) throw new Error(`Object/section needs one owner: ${node.id}`);
  return layers;
}
