// Public vocabulary shared by the graph builder, schema and integrity checks.
export const NODE_TYPES = ['artifact', 'milestone', 'todo', 'done', 'insight', 'deviation', 'reflection'];
const notes = ['insight', 'deviation', 'reflection'];
export const isRepositoryPath = p => typeof p === 'string' && !!p && !p.startsWith('/') && !p.split('/').some(s => s === '..' || s === '.' || s === '') && ![...p].some(c => c.codePointAt(0) < 32 || c === '\\');
export const RELATIONS = {
  part_of: { from: ['todo', 'milestone'], to: ['todo', 'milestone'], meaning: 'Numeric planning hierarchy.' },
  recorded_in: { from: NODE_TYPES.filter(t => t !== 'artifact'), to: ['artifact'], meaning: 'The file containing the item or note.' },
  references_todo: { from: ['done'], to: ['todo', 'milestone'], meaning: 'A TODO identifier or range in the DONE annotation references this item; completion is not inferred.' },
  has_insight: { from: ['done'], to: ['insight'], meaning: 'A note under the entry’s Insights heading.' },
  has_deviation: { from: ['done'], to: ['deviation'], meaning: 'A note under the entry’s Deviations heading.' },
  has_reflection: { from: ['done'], to: ['reflection'], meaning: 'A note under a combined insight/deviation heading, without guessing its category.' },
  mentions: { from: NODE_TYPES, to: ['artifact'], meaning: 'A resolvable file reference in a Markdown code span.' },
  links_to: { from: NODE_TYPES, to: ['artifact'], meaning: 'A local Markdown hyperlink to a tracked file.' },
  imports: { from: ['artifact'], to: ['artifact'], meaning: 'A literal local JavaScript import, export-from or require; no module is executed.' },
};
const string = { type: 'string', minLength: 1 };
const location = {
  type: 'object', additionalProperties: false, required: ['path', 'line', 'endLine'],
  properties: { path: string, line: { type: 'integer', minimum: 1 }, endLine: { type: 'integer', minimum: 1 } },
};
const fields = {
  artifact: { path: string, kind: { enum: ['documentation', 'test', 'source', 'data', 'configuration', 'asset'] }, mode: { enum: ['100644', '100755', '120000', '160000'] } },
  milestone: { number: { type: 'string', pattern: '^\\d+$' }, title: string, source: location },
  todo: { number: { type: 'string', pattern: '^\\d+(?:\\.\\d+)+$' }, text: string, status: { enum: ['open', 'done'] }, source: location },
  done: { title: string, date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }, annotation: { type: 'string' }, source: location },
  insight: { text: string, heading: string, source: location },
  deviation: { text: string, heading: string, source: location },
  reflection: { text: string, heading: string, source: location },
};
export const SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'Kibitz file-level assurance lineage, version 1',
  type: 'object', additionalProperties: false,
  required: ['schemaVersion', 'inventorySha256', 'inputs', 'nodes', 'edges', 'unresolved'],
  properties: {
    schemaVersion: { const: 1 }, inventorySha256: { type: 'string', pattern: '^[a-f0-9]{64}$' },
    inputs: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['path', 'sha256'], properties: { path: string, sha256: { type: 'string', pattern: '^[a-f0-9]{64}$' } } } },
    nodes: { type: 'array', items: { oneOf: NODE_TYPES.map(type => ({
      type: 'object', additionalProperties: false, required: ['id', 'type', ...Object.keys(fields[type])],
      properties: { id: string, type: { const: type }, ...fields[type] },
    })) } },
    edges: { type: 'array', items: {
      type: 'object', additionalProperties: false, required: ['type', 'from', 'to', 'evidence'],
      properties: { type: { enum: Object.keys(RELATIONS) }, from: string, to: string, evidence: { type: 'array', minItems: 1, items: {
        ...location, required: [...location.required, 'syntax', 'reference', 'resolution'],
        properties: { ...location.properties, syntax: { enum: ['heading', 'section', 'todo_annotation', 'code_span', 'markdown_link', 'js_import'] }, reference: { type: 'string' }, resolution: { type: 'string' } },
      } } },
    } },
    unresolved: { type: 'array', items: {
      type: 'object', additionalProperties: false, required: ['source', 'reference', 'reason', 'candidates'],
      properties: { source: location, reference: string, reason: { enum: ['missing', 'ambiguous', 'directory', 'outside_repository', 'unknown_todo', 'unsupported_range', 'parse_error'] }, candidates: { type: 'array', items: string } },
    } },
  },
};

// Validate this contract's small schema vocabulary offline; this is not a general
// JSON Schema implementation. Endpoint and ownership checks go beyond the schema.
export function shape(value, schema, at = 'graph') {
  const fail = () => { throw new Error(`Invalid assurance shape at ${at}`); };
  if (schema.oneOf) {
    const matches = schema.oneOf.filter(s => { try { shape(value, s, at); return true; } catch { return false; } });
    if (matches.length !== 1) fail();
    return;
  }
  if ('const' in schema && value !== schema.const || schema.enum && !schema.enum.includes(value)) fail();
  if (schema.type === 'string' && (typeof value !== 'string' || value.length < (schema.minLength || 0) || schema.pattern && !new RegExp(schema.pattern).test(value))) fail();
  if (schema.type === 'integer' && (!Number.isSafeInteger(value) || value < (schema.minimum ?? -Infinity))) fail();
  if (schema.type === 'array') {
    if (!Array.isArray(value) || value.length < (schema.minItems || 0)) fail();
    value.forEach((v, i) => shape(v, schema.items, `${at}[${i}]`));
  }
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail();
    if (schema.required.some(k => !Object.hasOwn(value, k)) || Object.keys(value).some(k => !Object.hasOwn(schema.properties, k))) fail();
    for (const [k, v] of Object.entries(value)) shape(v, schema.properties[k], `${at}.${k}`);
  }
}
export function validateGraph(graph) {
  shape(graph, SCHEMA);
  const nodes = new Map();
  for (const node of graph.nodes) {
    if (nodes.has(node.id)) throw new Error(`Duplicate node: ${node.id}`);
    nodes.set(node.id, node);
    if (node.type === 'artifact' && (!isRepositoryPath(node.path) || node.id !== `file:${node.path}`)) throw new Error(`Invalid artifact: ${node.id}`);
    if (['todo', 'milestone'].includes(node.type) && node.id !== `${node.type}:${node.number}`) throw new Error('Incorrect planning identity');
  }
  const checkSource = source => {
    if (!isRepositoryPath(source.path) || source.endLine < source.line || nodes.get(`file:${source.path}`)?.type !== 'artifact') throw new Error('Invalid source location');
  };
  for (const node of graph.nodes) if (node.type !== 'artifact') checkSource(node.source);
  const seen = new Set(), owners = new Map(), containers = new Map();
  for (const edge of graph.edges) {
    const key = JSON.stringify([edge.type, edge.from, edge.to]);
    if (seen.has(key)) throw new Error('Duplicate edge');
    seen.add(key);
    const relation = RELATIONS[edge.type], from = nodes.get(edge.from), to = nodes.get(edge.to);
    if (!from || !to || !relation.from.includes(from.type) || !relation.to.includes(to.type)) throw new Error(`Invalid endpoints: ${edge.type}`);
    edge.evidence.forEach(checkSource);
    if (edge.type.startsWith('has_')) owners.set(edge.to, (owners.get(edge.to) || 0) + 1);
    if (edge.type === 'recorded_in') {
      if (from.source.path !== to.path) throw new Error('Incorrect containing artifact');
      containers.set(from.id, (containers.get(from.id) || 0) + 1);
    }
    if (edge.type === 'part_of' && !from.number.startsWith(to.number + '.')) throw new Error('Incorrect planning hierarchy');
    if (edge.type.startsWith('has_') && (from.source.path !== to.source.path || from.source.line > to.source.line || from.source.endLine < to.source.endLine)) throw new Error('Note lies outside its DONE owner');
  }
  for (const node of graph.nodes) if (notes.includes(node.type) && owners.get(node.id) !== 1) throw new Error(`Note needs exactly one DONE owner: ${node.id}`);
  for (const node of graph.nodes) if (node.type !== 'artifact' && containers.get(node.id) !== 1) throw new Error(`Item needs exactly one containing file: ${node.id}`);
  for (const item of graph.unresolved) item.source && checkSource(item.source);
  for (const item of graph.inputs) if (!isRepositoryPath(item.path) || !nodes.has(`file:${item.path}`)) throw new Error('Invalid input path');
  return graph;
}
