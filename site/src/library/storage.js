// Shared wire/cache bounds. Records remain opaque source data; validation grants no chess proof.
export const LIBRARY_LIMITS = { changes: 500, records: 1000, recordBytes: 1_000_000, batchBytes: 10_000_000, totalBytes: 20_000_000 };
export const libraryScope = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export const libraryRecordId = value => typeof value === 'string' && value.length > 0 && value.length <= 100 && [...value].every(c => {
  const code = c.codePointAt(0);
  return code >= 32 && code !== 127 && (code < 0xd800 || code > 0xdfff); // Reject unpaired UTF-16 surrogates, preserving real Unicode IDs.
});
const encoder = new TextEncoder();
const invalid = () => { throw Object.assign(new Error('Invalid server library snapshot.'), { code: 'library_snapshot_invalid' }); };
/** Check a server/cache snapshot without rewriting unknown record fields or provenance. */
export function validateLibrarySnapshot(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1 || !libraryScope(value.scope) || !Number.isSafeInteger(value.revision) || value.revision < 0
    || !Array.isArray(value.games) || !Array.isArray(value.books) || value.games.length + value.books.length > LIBRARY_LIMITS.records) invalid();
  let bytes = 0;
  for (const collection of [value.games, value.books]) {
    const ids = new Set();
    for (const record of collection) {
      if (!record || typeof record !== 'object' || Array.isArray(record) || !libraryRecordId(record.id) || ids.has(record.id)) invalid();
      ids.add(record.id);
      let text;
      try { text = JSON.stringify(record); } catch { invalid(); }
      if (typeof text !== 'string') invalid();
      if (text.length > LIBRARY_LIMITS.recordBytes) invalid();
      const size = encoder.encode(text).byteLength;
      if (size > LIBRARY_LIMITS.recordBytes) invalid();
      bytes += size;
      if (bytes > LIBRARY_LIMITS.totalBytes) invalid();
    }
  }
  return value;
}
