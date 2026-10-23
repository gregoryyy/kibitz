// Local lexical passage retrieval (TODO 8.3.1). No DOM, storage, providers or engine work.
/** @typedef {Awaited<ReturnType<typeof import('./library.js').compileLibraryGame>>} Snapshot */
/** @typedef {{format: string, start: number, end: number, unit: string, section?: string}} Locator */
/** @typedef {{id: string, sourceId: string, documentId: string, revision: string, kind: 'annotation'|'guide', language: string, title: string, sourceTitle: string, author: string, licence: string, text: string, locator: Locator, occurrenceId: string|null, annotationId: string|null, fen: string|null, ply: number|null, gameId: string|null, collection: string|null, guideId: string|null}} Passage */
export const TEXT_LIMITS = { query: 500, terms: 64, results: 20, chunk: 1600, overlap: 160 };
const STOP = new Set('a an and are as at be by for from how i in is it of on or that the this to was what when where which who why with you your aber als am an auch auf aus bei das dem den der des die ein eine einer eines er es für im in ist mit nach nicht oder sich sie sind um und von vor was wie wird zu zum zur'.normalize('NFD').replace(/\p{M}/gu, '').split(' '));
const WORDS = /[oO0]-[oO0](?:-[oO0])?|[\p{L}\p{N}]+(?:=[QRBNDTLS])?[+#]?/gu;
const GERMAN = { S: 'N', L: 'B', T: 'R', D: 'Q' };

/** Normalize search spelling without changing the stored text or its UTF-16 locations. */
function term(raw) {
  const san = raw.replace(/[+#]$/, '').replace(/^([SLTD])(?=[a-h1-8x]*[a-h][1-8])/, (_, p) => GERMAN[p]).replace(/=([SLTD])$/, (_, p) => '=' + GERMAN[p]);
  return san.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replaceAll('ß', 'ss').replace(/[+#]$/, '').replace(/^0-0(-0)?$/, (_, long) => long ? 'o-o-o' : 'o-o');
}

/** Unicode words, ECO codes and whole SAN/castling tokens; common English/German words add no signal. */
export function textTerms(text) {
  return [...String(text).normalize('NFKC').matchAll(WORDS)].map(m => term(m[0])).filter(t => !STOP.has(t));
}

/** Bounded overlapping source substrings; prefer whitespace boundaries and retain exact ranges. */
export function textChunks(text, size = TEXT_LIMITS.chunk, overlap = TEXT_LIMITS.overlap) {
  if (!Number.isSafeInteger(size) || size < 2 || !Number.isSafeInteger(overlap) || overlap < 0 || overlap >= size) throw new Error('Invalid text chunk bounds');
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + size, text.length);
    if (end < text.length) {
      const boundary = text.slice(start, end).search(/\s+\S*$/u);
      if (boundary > size / 2) end = start + boundary;
      if (/[\uD800-\uDBFF]/.test(text[end - 1])) end--;
    }
    if (text.slice(start, end).trim()) chunks.push({ text: text.slice(start, end), start, end });
    if (end === text.length) break;
    let next = Math.max(start + 1, end - overlap);
    const space = text.slice(next, end).search(/\s/u);
    if (space >= 0) next += space + 1;
    if (/[\uDC00-\uDFFF]/.test(text[next])) next++;
    start = Math.min(next, end);
  }
  return chunks;
}

/**
 * Original mainline comments become passages with the exact source revision, occurrence and
 * PGN offsets. NAGs and variation comments are not prose; no score/annotation becomes verified.
 * @param {Snapshot} snapshot Legal, source-aware record from the library compiler.
 * @returns {Passage[]}
 */
export function annotationPassages(snapshot) {
  const occurrences = new Map(snapshot.occurrences.map(o => [o.id, o]));
  return snapshot.annotations.filter(a => a.kind === 'comment' && a.locator).flatMap(a => {
    const o = occurrences.get(a.occurrenceId);
    if (!o) throw new Error('Annotation has no source occurrence');
    return textChunks(a.text).map(chunk => ({ id: `${a.id}/text/${chunk.start}-${chunk.end}`, sourceId: a.sourceId,
      documentId: snapshot.document.id, revision: snapshot.document.revision, kind: /** @type {const} */ ('annotation'), language: 'und',
      title: (snapshot.document.title || snapshot.document.localId).slice(0, 240), sourceTitle: snapshot.source.title, author: snapshot.source.author,
      licence: a.licence, text: chunk.text, locator: { ...a.locator, start: a.locator.start + chunk.start, end: a.locator.start + chunk.end },
      occurrenceId: o.id, annotationId: a.id, fen: o.fen, ply: o.ply, gameId: snapshot.document.localId, collection: snapshot.document.collection, guideId: null }));
  });
}

/**
 * Each authored lesson field is a passage, versioned by SHA-256 of that language's full guide.
 * Locators address the original field text; a guide is general background without a board FEN.
 * @param {ReturnType<typeof import('./opening-guides.js').authoredGuideTexts>} guides Detached lesson sources.
 * @returns {Promise<Passage[]>}
 */
export async function guidePassages(guides) {
  return (await Promise.all(guides.map(async g => {
    const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(g)));
    const revision = [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
    const documentId = `guide:${g.id}:${g.language}`;
    return ['idea', 'plans', 'structure'].flatMap(section => textChunks(g[section]).map(chunk => ({
      id: `${documentId}@${revision}/${section}/text/${chunk.start}-${chunk.end}`, sourceId: `source:guide:${g.id}`, documentId, revision,
      kind: /** @type {const} */ ('guide'), language: g.language, title: g.title, sourceTitle: 'Kibitz study notes', author: 'Kibitz contributors',
      licence: 'GPL-3.0-or-later', text: chunk.text, locator: { format: 'guide', section, start: chunk.start, end: chunk.end, unit: 'utf-16' },
      occurrenceId: null, annotationId: null, fen: null, ply: null, gameId: null, collection: null, guideId: g.id,
    })));
  }))).flat();
}

/**
 * Build an in-memory inverted index. Inputs are detached so later source edits cannot mutate
 * ranked passages; rebuilding replaces the whole account-local index, including deletions.
 * @param {Passage[]} passages Compiled annotation/guide passages.
 */
export function buildTextIndex(passages) {
  const ids = new Set(), postings = new Map();
  const documents = passages.map((p, i) => {
    if (!p.id || ids.has(p.id) || !p.text.trim()) throw new Error('Invalid or duplicate passage');
    ids.add(p.id);
    const counts = new Map();
    for (const t of textTerms(`${p.title} ${p.text}`)) counts.set(t, (counts.get(t) || 0) + 1);
    for (const [t, count] of counts) {
      if (!postings.has(t)) postings.set(t, new Map());
      postings.get(t).set(i, count);
    }
    return { passage: { ...p, locator: { ...p.locator } }, length: [...counts.values()].reduce((a, b) => a + b, 0) };
  });
  return { documents, postings };
}

/** Short literal excerpt centred on the first matching term. Never returns HTML or rewritten text. */
export function textExcerpt(text, query, size = 320) {
  const wanted = new Set(textTerms(query)), found = [...text.matchAll(WORDS)].find(m => wanted.has(term(m[0])));
  let start = Math.max(0, (found?.index || 0) - Math.floor(size / 3));
  if (/[\uDC00-\uDFFF]/.test(text[start])) start++;
  let end = Math.min(text.length, start + size);
  if (end < text.length && /[\uD800-\uDBFF]/.test(text[end - 1])) end--;
  return { text: text.slice(start, end), start, end };
}

/**
 * Okapi BM25 (k1=1.5, b=.75) with deterministic ID ties and no zero-score filler. Filters
 * run before statistics/scoring. Unknown annotation language remains searchable in either UI
 * language; guides use their declared language. This is keyword relevance, not chess evidence.
 * @param {ReturnType<typeof buildTextIndex>} index Local compiled corpus.
 * @param {string} query User keywords, bounded independently of the input element.
 * @param {{language?: string, kind?: string, collection?: string, limit?: number}} [options]
 */
export function searchText(index, query, { language = 'all', kind = 'all', collection = 'all', limit = 8 } = {}) {
  if (typeof query !== 'string' || query.length > TEXT_LIMITS.query || !['all', 'en', 'de'].includes(language) || !['all', 'annotation', 'guide'].includes(kind) || !['all', 'library', 'classic'].includes(collection) || !Number.isSafeInteger(limit) || limit < 1 || limit > TEXT_LIMITS.results) throw new Error('Invalid text search');
  const terms = [...new Set(textTerms(query))];
  if (!terms.length || terms.length > TEXT_LIMITS.terms) return [];
  const eligible = new Set();
  let totalLength = 0;
  index.documents.forEach(({ passage: p, length }, i) => {
    if (language !== 'all' && p.language !== 'und' && p.language !== language || kind !== 'all' && p.kind !== kind || collection !== 'all' && p.collection !== collection) return;
    eligible.add(i); totalLength += length;
  });
  if (!eligible.size) return [];
  const average = Math.max(1, totalLength / eligible.size), scores = new Map(), matched = new Map();
  for (const t of terms) {
    const posting = [...(index.postings.get(t) || [])].filter(([i]) => eligible.has(i));
    const idf = Math.log(1 + (eligible.size - posting.length + 0.5) / (posting.length + 0.5));
    for (const [i, count] of posting) {
      const norm = count + 1.5 * (0.25 + 0.75 * index.documents[i].length / average);
      scores.set(i, (scores.get(i) || 0) + idf * count * 2.5 / norm);
      matched.set(i, [...(matched.get(i) || []), t]);
    }
  }
  return [...scores].sort(([a, sa], [b, sb]) => sb - sa || (index.documents[a].passage.id < index.documents[b].passage.id ? -1 : 1))
    .slice(0, limit).map(([i, score]) => ({ passage: { ...index.documents[i].passage, locator: { ...index.documents[i].passage.locator } }, score,
      matched: matched.get(i), excerpt: textExcerpt(index.documents[i].passage.text, query) }));
}
