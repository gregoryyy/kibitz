import test from 'node:test';
import assert from 'node:assert/strict';
import { confidence, classifyLink, pathConfidence } from '../../../docs/assure/confidence.mjs';
import { shape } from '../../../docs/assure/types.mjs';
import { CONFIDENCE_SCHEMA } from '../../../docs/assure/confidence.mjs';
import { applyAssessments, validateAssessments } from '../../../docs/assure/assessment-types.mjs';
import { inferFindings, findingReport } from '../../../utils/assure-infer.mjs';
import { indexGraph, walk } from '../../../utils/assure-browser/model.mjs';
const s = { path: 'docs/DONE.md', line: 10, endLine: 10 };
const c = (value = 1) => confidence(value, 'observed', 'Fixture direct relation.');
const edge = (type, from, to, value = 1) => ({ type, from, to, confidence: c(value), evidence: [{ ...s, syntax: 'section', reference: type, resolution: 'fixture' }] });
const assessment = (type, from, to, value = 0.9) => ({ type, from, to, confidence: confidence(value, 'analyst', 'Fixture interpretation, not independent verification.'), evidence: { source: { ...s }, reference: 'Fixture citation', resolution: 'authored_assessment' } });
function fixture() {
  const nodes = [
    ...['docs/DONE.md', 'site/src/a.js', 'site/src/b.js', 'site/src/c.js', 'site/tests/a.test.mjs'].map(path => ({ id: `file:${path}`, type: 'artifact', path })),
    { id: 'todo:0.1', type: 'todo', number: '0.1', status: 'done', source: { ...s, line: 1, endLine: 1 } },
    { id: 'todo:0.2', type: 'todo', number: '0.2', status: 'open', source: { ...s, line: 2, endLine: 2 } },
    { id: 'done:partial', type: 'done', source: { ...s, line: 5, endLine: 15 } },
    { id: 'deviation:one', type: 'deviation', text: 'A recorded limitation, not a diagnosed cause.', source: s },
    { id: 'reflection:one', type: 'reflection', text: 'Combined rationale stays separate.', source: s },
  ];
  const edges = [edge('has_deviation', 'done:partial', 'deviation:one'), edge('references_todo', 'done:partial', 'todo:0.1'), edge('mentions', 'deviation:one', 'file:site/src/a.js'), edge('imports', 'file:site/src/b.js', 'file:site/src/a.js', 0.85), edge('imports', 'file:site/src/c.js', 'file:site/src/b.js', 0.8)];
  const layers = [{ nodes, edges, unresolved: [] }], assessments = { schemaVersion: 1, edges: [] };
  return { layers, assessments };
}
test('confidence is finite, bounded, typed and explained; extraction weights state their narrow meaning', () => {
  for (const value of [0, 0.8, 1]) assert.doesNotThrow(() => shape(c(value), CONFIDENCE_SCHEMA));
  for (const value of [-0.1, 1.1, NaN, Infinity, -Infinity, '0.8', null]) assert.throws(() => shape(c(value), CONFIDENCE_SCHEMA));
  const malformed = c(); delete malformed.rationale; assert.throws(() => shape(malformed, CONFIDENCE_SCHEMA));
  assert.equal(classifyLink('contains_object', [{ resolution: 'AST containment' }]).value, 1);
  assert.equal(classifyLink('mentions', [{ resolution: 'unique_suffix' }]).value, 0.8);
  assert.equal(classifyLink('mentions_object', [{ resolution: 'exact_name' }]).value, 0.85);
  assert.equal(pathConfidence([edge('calls', 'a', 'b', 0.8), edge('calls', 'b', 'c', 0.9)]), 0.8);
});
test('different types coexist; per-type confidence overrides preserve original evidence and actually filter walks', () => {
  const { layers, assessments } = fixture();
  assessments.edges.push(assessment('imports', 'file:site/src/b.js', 'file:site/src/a.js', 0.2), assessment('supports', 'file:site/src/b.js', 'file:site/src/a.js', 0.9));
  validateAssessments(assessments, layers);
  const effective = applyAssessments(layers, assessments), imports = effective.flatMap(l => l.edges).filter(e => e.type === 'imports' && e.from === 'file:site/src/b.js');
  assert.equal(imports.length, 1); assert.equal(imports[0].confidence.value, 0.2); assert(imports[0].assessmentEvidence); assert.deepEqual(imports[0].evidence, layers[0].edges[3].evidence);
  assert.equal(layers[0].edges[3].confidence.value, 0.85);
  const graph = indexGraph(effective);
  assert.equal(walk(graph, 'file:site/src/b.js', { direction: 'out', relation: 'imports', minConfidence: 0.8 }).nodes.length, 1);
  assert.equal(walk(graph, 'file:site/src/b.js', { direction: 'out', relation: 'supports', minConfidence: 0.8 }).nodes.length, 2);
  assert.throws(() => walk(graph, 'file:site/src/b.js', { minConfidence: 2 }));
});
test('assessment contracts reject unknown endpoints, wrong types, duplicates and missing source/analyst rationale', () => {
  for (const mutate of [
    e => { e.to = 'absent'; }, e => { e.type = 'proves_everything'; }, e => { e.confidence.value = NaN; }, e => { e.confidence.method = 'observed'; }, e => { e.evidence.source.path = '../.env'; },
  ]) {
    const { layers } = fixture(), e = assessment('implements', 'file:site/src/a.js', 'todo:0.1'); mutate(e); assert.throws(() => validateAssessments({ schemaVersion: 1, edges: [e] }, layers));
  }
  const { layers } = fixture(), e = assessment('implements', 'file:site/src/a.js', 'todo:0.1');
  assert.throws(() => validateAssessments({ schemaVersion: 1, edges: [e, e] }, layers));
  assert.throws(() => validateAssessments({ schemaVersion: 1, edges: [assessment('imports', 'file:site/src/a.js', 'file:site/src/b.js')] }, layers), /only override/);
});
test('mentions and checked status cannot become implementation or verification; recorded deviations retain their author context', () => {
  const { layers, assessments } = fixture();
  layers[0].edges.push(edge('mentions', 'done:partial', 'file:site/src/a.js'));
  const result = inferFindings(layers, assessments);
  for (const rule of ['implements_unassessed', 'verifies_unassessed']) assert(result.findings.some(f => f.rule === rule && f.subject === 'todo:0.1' && f.status === 'candidate'));
  assert(!result.findings.some(f => f.subject === 'todo:0.2' && f.rule.endsWith('_unassessed')));
  const deviation = result.findings.find(f => f.rule === 'recorded_deviation'); assert(deviation.related.includes('todo:0.1')); assert(deviation.related.includes('file:site/src/a.js')); assert(deviation.paths.flat().some(e => e.type === 'has_deviation'));
  assert(!result.findings.some(f => f.rule === 'recorded_deviation' && f.subject === 'reflection:one'));
  assert(!result.findings.some(f => f.rule === 'possible_deviation_impact'));
});
test('explicit assessments close only the corresponding evidence gap at the chosen threshold', () => {
  const { layers, assessments } = fixture(); assessments.edges.push(assessment('implements', 'file:site/src/a.js', 'todo:0.1', 0.9), assessment('verifies', 'file:site/tests/a.test.mjs', 'todo:0.1', 0.5));
  const low = inferFindings(layers, assessments), high = inferFindings(layers, assessments, { threshold: 0.95 });
  assert(!low.findings.some(f => f.rule === 'implements_unassessed')); assert(low.findings.some(f => f.rule === 'verifies_unassessed'));
  assert(high.findings.some(f => f.rule === 'implements_unassessed'));
  assert.equal(layers[0].nodes.find(n => n.id === 'todo:0.1').status, 'done');
});
test('missing annotations and unresolved references produce scoped extraction gaps, with source locations', () => {
  const { layers, assessments } = fixture(); layers[0].edges = layers[0].edges.filter(e => e.type !== 'references_todo');
  layers[0].unresolved.push({ source: s, reference: 'historical.js', reason: 'missing', candidates: [] });
  const result = inferFindings(layers, assessments);
  assert(result.findings.some(f => f.rule === 'missing_done_reference' && f.confidence.value === 1));
  const unresolved = result.findings.find(f => f.rule === 'unresolved_reference'); assert.equal(unresolved.status, 'gap'); assert.deepEqual(unresolved.source, s); assert.equal(unresolved.subject, 'deviation:one');
});
test('deviation impact follows only explicit typed paths, takes the bottleneck and reports bounds', () => {
  const { layers, assessments } = fixture(); assessments.edges.push(assessment('implements', 'file:site/src/a.js', 'todo:0.1', 0.9));
  const result = inferFindings(layers, assessments), impact = result.findings.find(f => f.rule === 'possible_deviation_impact' && f.subject === 'file:site/src/c.js');
  assert.equal(impact.status, 'candidate'); assert.equal(impact.confidence.value, 0.8); assert.deepEqual(impact.paths[0].map(e => e.type), ['has_deviation', 'references_todo', 'implements', 'imports', 'imports']);
  assert(inferFindings(layers, assessments, { maxImpact: 1 }).truncatedContexts > 0);
  assert(!inferFindings(layers, assessments, { depth: 0 }).findings.some(f => f.rule === 'possible_deviation_impact' && f.subject === 'file:site/src/c.js'));
});
test('cycles and repeated evidence cannot inflate support; stronger alternate paths remain usable', () => {
  const { layers, assessments } = fixture(); assessments.edges.push(assessment('implements', 'file:site/src/a.js', 'todo:0.1', 0.95));
  layers[0].edges.push(edge('imports', 'file:site/src/c.js', 'file:site/src/a.js', 0.92), edge('imports', 'file:site/src/a.js', 'file:site/src/c.js', 0.99));
  const result = inferFindings(layers, assessments), impacts = result.findings.filter(f => f.rule === 'possible_deviation_impact');
  assert.equal(impacts.find(f => f.subject === 'file:site/src/c.js').confidence.value, 0.92); assert.equal(impacts.length, 3);
  const duplicate = structuredClone(layers); duplicate[0].edges.push(duplicate[0].edges[0]);
  assert.deepEqual(inferFindings(duplicate, assessments), result);
});
test('competing support/contradiction hypotheses remain review candidates with inspectable typed evidence', () => {
  const { layers, assessments } = fixture(); assessments.edges.push(assessment('supports', 'file:site/src/a.js', 'todo:0.1', 0.9), assessment('contradicts', 'file:site/src/a.js', 'todo:0.1', 0.85));
  const result = inferFindings(layers, assessments), conflict = result.findings.find(f => f.rule === 'conflicting_assessments');
  assert.equal(conflict.status, 'candidate'); assert.equal(conflict.confidence.value, 0.85); assert.equal(conflict.paths[0].length, 2);
  assert.throws(() => inferFindings(layers, assessments, { threshold: Infinity }));
});

test('findings reports preserve authored text without introducing HTML or active Markdown links', () => {
  const { layers, assessments } = fixture(); layers[0].nodes.find(n => n.type === 'deviation').text = '<img src=x> [click](javascript:alert(1))';
  const report = findingReport(inferFindings(layers, assessments));
  assert(!report.includes('<img')); assert(report.includes('&lt;img')); assert(report.includes('\\[click\\]\\('));
});
