// Source-aware library records (TODO 7.1). No storage, DOM, providers or engine work.
import { epd, pawnSignature } from '../chess/knowledge.js';
import { mainlineComments, mainlineNags } from '../chess/pgn.js';
import { checkPosition } from '../chess/play.js';
import { boardSignatures } from '../chess/signatures.js';
import { quote } from '../coach/prompt.js';

export const LIBRARY_VERSION = 1;
const ORIGINS = ['imported', 'played', 'board', 'builtin', 'legacy'];
const text = (s, limit) => typeof s === 'string' && s.length <= limit && !s.includes(String.fromCharCode(0));
/** @typedef {{version: number, origin: string, source: {title: string, author: string, url: string}, rights: {score: string, annotations: string}}} Provenance */
/** @typedef {{id: string, sourceId: string, licence: string, documentId: string, revision: string, positionId: string, ply: number, fen: string, epd: string, pawns: string, signatures: ReturnType<typeof boardSignatures>, san: string, uci: string, label: string}} Occurrence */
/** @typedef {{id: string, sourceId: string, licence: string, occurrenceId: string, kind: string, text: string, nags: number[], locator: {format: string, start: number, end: number, unit: string}|null, verification: string}} Annotation */

/** Only explicit HTTP(S) links without credentials may become clickable source URLs. No fetching. */
function sourceUrl(value) {
  if (!value) return '';
  try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password ? u.href : null; } catch { return null; }
}

/**
 * Create bounded provenance from explicit input; blank licences mean not supplied, never public domain.
 * These are source assertions, not an access grant or a verification of a publisher's rights.
 * @param {string} origin Where this record entered Kibitz.
 * @param {{title?: string, author?: string, url?: string, score?: string, annotations?: string}} input User/project metadata.
 * @returns {Provenance}
 */
export function makeProvenance(origin, input = {}) {
  if (!ORIGINS.includes(origin)) throw new Error('Unknown library origin.');
  const { title = '', author = '', url = '', score = '', annotations = '' } = input;
  if (!text(title, 240) || !text(author, 160) || !text(url, 2048) || !text(score, 160) || !text(annotations, 160) || sourceUrl(url.trim()) === null) throw new Error('Check the source fields and use an HTTP or HTTPS URL without credentials.');
  return { version: LIBRARY_VERSION, origin, source: { title: title.trim(), author: author.trim(), url: sourceUrl(url.trim()) }, rights: { score: score.trim(), annotations: annotations.trim() } };
}

/**
 * Read old records without rewriting storage. Unknown/future metadata is retained by the caller;
 * it must not be silently replaced with defaults or included in retrieval as verified provenance.
 * @param {{provenance?: any}} game Existing flat library game.
 * @returns {{status: string, value: Provenance|null}}
 */
export function readProvenance(game) {
  if (game.provenance === undefined) return { status: 'legacy', value: makeProvenance('legacy') };
  const p = game.provenance;
  if (!p || typeof p !== 'object' || Array.isArray(p)) return { status: 'invalid', value: null };
  if (p.version !== LIBRARY_VERSION) return { status: 'unsupported', value: null };
  try {
    if (!p.source || !p.rights || Object.keys(p).some(k => !['version', 'origin', 'source', 'rights'].includes(k)) || Object.keys(p.source).some(k => !['title', 'author', 'url'].includes(k)) || Object.keys(p.rights).some(k => !['score', 'annotations'].includes(k)) || ['title', 'author', 'url'].some(k => typeof p.source[k] !== 'string') || ['score', 'annotations'].some(k => typeof p.rights[k] !== 'string')) throw new Error();
    return { status: 'known', value: makeProvenance(p.origin, { ...p.source, ...p.rights }) };
  } catch { return { status: 'invalid', value: null }; }
}

/** Collection-scoped logical IDs survive metadata changes and keep built-ins distinct from user games. */
export function libraryGameId(id, collection = 'library') {
  if (!['library', 'classic'].includes(collection) || !text(id, 160) || !id.trim()) throw new Error('Invalid library identity.');
  return `game:${collection}:${encodeURIComponent(id)}`;
}

/** SHA-256 binds occurrences/passages to exact source text, rather than a mutable update timestamp. */
async function revisionOf(pgn) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(pgn));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Build a versioned snapshot of a legal PGN and its evidence locations. Position identity ignores
 * counters; each occurrence retains full FEN, source revision and ply. Comments retain original
 * source ranges and never acquire engine verification. FEN studies expose a recorded legal line,
 * not a proof that the result or solution is correct. No new corpus/deduplication is implied.
 * @param {import('../coach/tutor.js').ChessConstructor} Chess Injected chess.js constructor.
 * @param {{id: string, pgn: string, kind?: string, provenance?: any}} game Flat persisted game.
 * @param {'library'|'classic'} collection Account-local user records or the built-in collection.
 */
export async function compileLibraryGame(Chess, game, collection = 'library') {
  const documentId = libraryGameId(game.id, collection), provenance = readProvenance(game);
  if (!provenance.value) throw new Error('Source metadata is unsupported or invalid; stored data has been kept.');
  if (!text(game.pgn, 200_000) || !game.pgn.trim()) throw new Error('The PGN is missing or too large.');
  const c = new Chess(); c.loadPgn(game.pgn);
  const headers = c.getHeaders(), replay = new Chess(headers.FEN), moves = c.history();
  if (moves.length > 4000 || checkPosition(Chess, replay.fen()).error) throw new Error('Invalid library position.');
  const comments = mainlineComments(game.pgn), nags = mainlineNags(game.pgn);
  if (comments.some(a => a.ply > moves.length)) throw new Error('Annotation location does not match the legal mainline.');
  const revision = await revisionOf(game.pgn), sourceId = `source:${collection}:${encodeURIComponent(game.id)}`;
  const { source: metadata, ...provenanceFields } = provenance.value;
  const source = { id: sourceId, ...provenanceFields, ...metadata };
  const document = { id: documentId, localId: game.id, collection, sourceId, licence: source.rights.score, revision, format: 'pgn', title: headers.Event || '', kind: game.kind || 'study', customStart: !!headers.FEN };
  const positions = new Map();
  /** @type {Occurrence[]} */
  const occurrences = [];
  const append = (san = '', uci = '', label = 'Start position') => {
    const fen = replay.fen(), key = epd(fen), positionId = `position:${encodeURIComponent(key)}`;
    const signatures = boardSignatures(fen);
    positions.set(positionId, { id: positionId, epd: key, signatures });
    occurrences.push({ id: `${documentId}@${revision}/ply/${occurrences.length}`, sourceId, licence: source.rights.score, documentId, revision, positionId, ply: occurrences.length, fen, epd: key, pawns: pawnSignature(fen), signatures, san, uci, label });
  };
  append();
  for (const san of moves) {
    const label = `${replay.moveNumber()}${replay.turn() === 'w' ? '.' : '…'} ${san}`, m = replay.move(san);
    append(m.san, m.from + m.to + (m.promotion || ''), label);
  }
  /** @type {Annotation[]} */
  const annotations = comments.map((a, i) => ({ id: `${occurrences[a.ply].id}/comment/${i}`, sourceId, licence: source.rights.annotations, occurrenceId: occurrences[a.ply].id, kind: 'comment', text: a.text, nags: [], locator: { format: 'pgn', start: a.start, end: a.end, unit: 'utf-16' }, verification: 'unverified' }));
  // Numeric glyphs are source judgements too; keep them distinct from computed engine verdicts.
  nags.forEach((values, ply) => { if (values.length && occurrences[ply]) annotations.push({ id: `${occurrences[ply].id}/nags`, sourceId, licence: source.rights.annotations, occurrenceId: occurrences[ply].id, kind: 'nags', text: '', nags: [...values], locator: null, verification: 'unverified' }); });
  const problem = headers.FEN && game.kind !== 'played' ? { id: `problem:${collection}:${encodeURIComponent(game.id)}@${revision}`, sourceId, licence: source.rights.score, documentId, occurrenceId: occurrences[0].id, kind: 'study', statedResult: headers.Result || '*', line: occurrences.slice(1).map(o => o.uci), verification: 'legal-replay-only' } : null;
  return { version: LIBRARY_VERSION, source, document, positions: [...positions.values()], occurrences, annotations, problem };
}

/**
 * Adapt the source-aware snapshot to exact/pawn retrieval without losing occurrence identity.
 * @param {Awaited<ReturnType<typeof compileLibraryGame>>} snapshot Legal source snapshot.
 * @param {unknown} [classes] Optional legacy engine classes, separate from source annotations.
 */
export function indexedLibraryPositions(snapshot, classes = []) {
  const ratings = Array.isArray(classes) ? classes : [];
  const byOccurrence = new Map();
  for (const a of snapshot.annotations) if (a.kind === 'comment') byOccurrence.set(a.occurrenceId, [...(byOccurrence.get(a.occurrenceId) || []), a]);
  return snapshot.occurrences.filter(o => o.ply > 0 || snapshot.document.customStart).map(o => ({ ...o, occurrenceId: o.id, comment: (byOccurrence.get(o.id) || []).map(a => a.text).join('\n'), annotationIds: (byOccurrence.get(o.id) || []).map(a => a.id), cls: ratings[o.ply] }));
}

/**
 * Quote source assertions as metadata; no licence, attribution or comment verifies chess strength.
 * @param {Awaited<ReturnType<typeof compileLibraryGame>>} snapshot Legal source snapshot.
 */
export function librarySourceContext(snapshot) {
  const { source } = snapshot;
  return `Source: ${quote(source.title || source.origin, 240)}${source.author ? ` by ${quote(source.author, 160)}` : ''}. Score licence as supplied: ${quote(source.rights.score || 'not supplied', 160)}. Annotation licence as supplied: ${quote(source.rights.annotations || 'not supplied', 160)}.`;
}
