// Structured (JSON) replies: the formats the page may ask for, a small JSON Schema validator,
// and fallback parsing for providers or models without native JSON-schema output.
// Model output is untrusted: whatever comes back is validated here, and the page still checks
// every square against the position before drawing anything (TODO 4.4).
import { complete, GatewayError } from './ai.mjs';

const SQUARE = { type: 'string', pattern: '^[a-h][1-8]$' };
// Board annotations (first version; TODO 4.2 extends it): a short explanation, arrows and highlighted squares.
export const ANNOTATION_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['text', 'arrows', 'highlights'],
  properties: {
    text: { type: 'string', maxLength: 2000 },
    arrows: {
      type: 'array', maxItems: 8,
      items: { type: 'object', additionalProperties: false, required: ['from', 'to', 'kind'], properties: { from: SQUARE, to: SQUARE, kind: { type: 'string', enum: ['best', 'threat', 'plan', 'mistake'] } } },
    },
    highlights: {
      type: 'array', maxItems: 16,
      items: { type: 'object', additionalProperties: false, required: ['square', 'kind'], properties: { square: SQUARE, kind: { type: 'string', enum: ['weak', 'strong', 'target', 'key'] } } },
    },
  },
};

// Named formats: the page picks one by name and can't send a schema of its own.
export const FORMATS = {
  annotations: { name: 'board_annotations', schema: ANNOTATION_SCHEMA },
};

// Errors for `value` against `schema` (a subset of JSON Schema: type, properties, required,
// additionalProperties: false, items, enum, min/maxLength, pattern, min/maxItems, minimum,
// maximum). An empty list means valid.
export function validate(schema, value, path = '$') {
  const errs = [];
  const type = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
  const want = schema.type;
  const typeOk = !want || want === type || (want === 'integer' && Number.isInteger(value)) || (want === 'number' && type === 'number' && Number.isFinite(value));
  if (!typeOk) return [`${path}: expected ${want}, got ${type}`];
  if (schema.enum && !schema.enum.includes(value)) errs.push(`${path}: not one of ${schema.enum.join(', ')}`);
  if (type === 'string') {
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errs.push(`${path}: longer than ${schema.maxLength}`);
    if (schema.minLength !== undefined && value.length < schema.minLength) errs.push(`${path}: shorter than ${schema.minLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errs.push(`${path}: doesn't match ${schema.pattern}`);
  }
  if (type === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errs.push(`${path}: below ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errs.push(`${path}: above ${schema.maximum}`);
  }
  if (type === 'array') {
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errs.push(`${path}: more than ${schema.maxItems} items`);
    if (schema.minItems !== undefined && value.length < schema.minItems) errs.push(`${path}: fewer than ${schema.minItems} items`);
    if (schema.items) value.forEach((v, i) => errs.push(...validate(schema.items, v, `${path}[${i}]`)));
  }
  if (type === 'object') {
    for (const k of schema.required || []) if (!(k in value)) errs.push(`${path}.${k}: missing`);
    for (const [k, v] of Object.entries(value)) {
      if (schema.properties?.[k]) errs.push(...validate(schema.properties[k], v, `${path}.${k}`));
      else if (schema.additionalProperties === false) errs.push(`${path}.${k}: not allowed`);
    }
  }
  return errs;
}

// The schema as sent to providers: strict JSON-schema modes reject some keywords (string length,
// patterns, numeric bounds, item counts), so those are left out there and enforced by validate().
const LOOSE = new Set(['maxLength', 'minLength', 'pattern', 'minimum', 'maximum', 'maxItems', 'minItems', 'format']);
export function providerSchema(schema) {
  if (Array.isArray(schema)) return schema.map(providerSchema);
  if (!schema || typeof schema !== 'object') return schema;
  return Object.fromEntries(Object.entries(schema).filter(([k]) => !LOOSE.has(k)).map(([k, v]) => [k, k === 'enum' ? v : providerSchema(v)]));
}

// The JSON object in a reply that may wrap it in prose or a code fence.
export function parseJsonReply(text) {
  const t = String(text ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  for (const candidate of [t, t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)]) {
    if (!candidate) continue;
    try { const v = JSON.parse(candidate); if (v && typeof v === 'object' && !Array.isArray(v)) return v; } catch { /* try the next form */ }
  }
  throw new GatewayError('bad_output', 'The model did not return JSON', 502);
}

// A small valid instance of `schema` (for the mock provider).
export function exampleFor(schema) {
  if (schema.enum) return schema.enum[0];
  switch (schema.type) {
    case 'object': return Object.fromEntries((schema.required || []).map(k => [k, exampleFor(schema.properties[k])]));
    case 'array': return [];
    case 'string': return schema.pattern === SQUARE.pattern ? 'e4' : 'Mock coach (AI_PROVIDER=mock).';
    case 'integer': case 'number': return schema.minimum ?? 0;
    case 'boolean': return false;
    default: return null;
  }
}

// Instructions for the fallback, when the provider can't be held to the schema natively.
export const jsonInstructions = format => `Reply with one JSON object and nothing else: no prose, no code fence. It must match this JSON Schema:\n${JSON.stringify(format.schema)}`;

// A reply as validated JSON: {data, truncated, usage, mode}. First the provider's native JSON-schema
// output; if the provider rejects that (400/422) or the reply doesn't validate, once more with the
// schema in the instructions, parsing the JSON out of the text.
export async function completeJson(provider, messages, format, opts = {}) {
  const usage = { input: 0, output: 0 };
  const add = u => { usage.input += u?.input || 0; usage.output += u?.output || 0; };
  const check = text => {
    const data = parseJsonReply(text);
    const errs = validate(format.schema, data);
    if (errs.length) throw new GatewayError('bad_output', `The model's JSON didn't match the format: ${errs.slice(0, 3).join('; ')}`, 502);
    return data;
  };
  try {
    const r = await complete(provider, messages, { ...opts, schema: format });
    add(r.usage);
    return { data: check(r.text), truncated: r.truncated, usage, mode: 'native' };
  } catch (e) {
    if (!(e?.code === 'bad_output' || e?.status === 400 || e?.status === 422)) throw e;
  }
  const r = await complete(provider, messages, { ...opts, system: [opts.system, jsonInstructions(format)].filter(Boolean).join('\n\n') });
  add(r.usage);
  return { data: check(r.text), truncated: r.truncated, usage, mode: 'fallback' };
}
