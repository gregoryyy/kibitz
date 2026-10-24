// SQLite persistence for the opt-in server library (TODO 7.6).
// HTTP identity/PGN validation belongs to library-api.mjs. SQL never accepts a caller's owner field.
import { DatabaseSync } from 'node:sqlite';
import { LIBRARY_LIMITS, libraryRecordId as recordId } from '../src/library/storage.js';
export { LIBRARY_LIMITS } from '../src/library/storage.js';
/** @returns {never} */
const fail = code => { throw Object.assign(new Error(code), { code }); };
const ownerKey = value => { if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) fail('invalid_owner'); };

/**
 * Opens a versioned database. Unknown schemas are preserved and rejected; all writes are atomic.
 * The caller must create a private file outside the static root before opening a disk database.
 * @param {string} [filename]
 * @param {typeof LIBRARY_LIMITS} [limits] Smaller test limits exercise rollback after SQL writes.
 */
export function createLibraryStore(filename = ':memory:', limits = LIBRARY_LIMITS) {
  const db = new DatabaseSync(filename, { timeout: 1000 });
  try {
    const version = Number(db.prepare('PRAGMA user_version').get().user_version);
    if (![0, 1].includes(version)) fail('unsupported_schema');
    if (!version) {
      if (db.prepare("SELECT name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").all().length) fail('unknown_schema');
      db.exec(`BEGIN IMMEDIATE;
        CREATE TABLE owners (owner TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0));
        CREATE TABLE records (owner TEXT NOT NULL REFERENCES owners(owner), collection TEXT NOT NULL CHECK(collection IN ('games','books')),
          id TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(owner,collection,id));
        PRAGMA user_version=1;
        COMMIT;`);
    }
    // Preparing the statements also rejects incomplete/malformed version-one schemas.
    const getRevision = db.prepare('SELECT revision FROM owners WHERE owner=?');
    const getRecords = db.prepare('SELECT collection,id,body FROM records WHERE owner=? ORDER BY collection,id');
    const ensure = db.prepare('INSERT OR IGNORE INTO owners(owner) VALUES(?)');
    const put = db.prepare('INSERT INTO records(owner,collection,id,body) VALUES(?,?,?,?) ON CONFLICT(owner,collection,id) DO UPDATE SET body=excluded.body');
    const remove = db.prepare('DELETE FROM records WHERE owner=? AND collection=? AND id=?');
    const erase = db.prepare('DELETE FROM records WHERE owner=?');
    const advance = db.prepare('UPDATE owners SET revision=revision+1 WHERE owner=?');
    const usage = db.prepare('SELECT count(*) AS count,coalesce(sum(length(CAST(body AS BLOB))),0) AS bytes FROM records WHERE owner=?');
    db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');

    const snapshot = key => {
      const revision = Number(getRevision.get(key)?.revision || 0), rows = getRecords.all(key);
      if (!Number.isSafeInteger(revision) || revision < 0 || rows.length > limits.records) fail('invalid_stored_data');
      const games = [], books = [];
      let bytes = 0;
      for (const row of rows) {
        const body = /** @type {string} */ (row.body);
        if (typeof body !== 'string' || Buffer.byteLength(body) > limits.recordBytes) fail('invalid_stored_data');
        bytes += Buffer.byteLength(body);
        const record = JSON.parse(body);
        if (!record || typeof record !== 'object' || Array.isArray(record) || !recordId(row.id) || record.id !== row.id) fail('invalid_stored_data');
        if (row.collection === 'games') games.push(record);
        else if (row.collection === 'books') books.push(record);
        else fail('invalid_stored_data');
      }
      if (bytes > limits.totalBytes) fail('invalid_stored_data');
      return { version: 1, scope: key, revision, games, books };
    };

    return {
      close: () => db.close(),
      read(key) {
        ownerKey(key); db.exec('BEGIN');
        try { const result = snapshot(key); db.exec('COMMIT'); return result; }
        catch (error) { db.exec('ROLLBACK'); throw error; }
      },
      erase(key, revision) {
        ownerKey(key);
        if (!Number.isSafeInteger(revision) || revision < 0) fail('invalid_changes');
        db.exec('BEGIN IMMEDIATE');
        try {
          ensure.run(key);
          if (Number(getRevision.get(key).revision) !== revision) fail('conflict');
          erase.run(key); advance.run(key);
          // Keep the advanced revision, so an older in-flight write cannot resurrect records.
          const result = snapshot(key); db.exec('COMMIT'); return result;
        } catch (error) { db.exec('ROLLBACK'); throw error; }
      },
      change(key, revision, changes) {
        ownerKey(key);
        if (!Number.isSafeInteger(revision) || revision < 0 || !Array.isArray(changes) || changes.length > limits.changes) fail('invalid_changes');
        let bytes = 0;
        const prepared = changes.map(change => {
          if (!change || Object.keys(change).some(k => !['collection', 'id', 'record'].includes(k)) || !['games', 'books'].includes(change.collection) || !recordId(change.id)
            || change.record !== null && (!change.record || typeof change.record !== 'object' || Array.isArray(change.record) || !Object.hasOwn(change.record, 'id') || change.record.id !== change.id)) fail('invalid_record');
          const body = change.record === null ? null : JSON.stringify(change.record);
          if (body && Buffer.byteLength(body) > limits.recordBytes) fail('record_too_large');
          bytes += body ? Buffer.byteLength(body) : 0;
          return { collection: change.collection, id: change.id, body };
        });
        if (bytes > limits.batchBytes || new Set(prepared.map(c => JSON.stringify([c.collection, c.id]))).size !== prepared.length) fail('invalid_changes');
        db.exec('BEGIN IMMEDIATE');
        try {
          ensure.run(key);
          if (Number(getRevision.get(key).revision) !== revision) fail('conflict');
          for (const change of prepared) change.body === null ? remove.run(key, change.collection, change.id) : put.run(key, change.collection, change.id, change.body);
          const bounds = usage.get(key);
          if (Number(bounds.count) > limits.records || Number(bounds.bytes) > limits.totalBytes) fail('quota');
          if (prepared.length) advance.run(key);
          const result = snapshot(key); db.exec('COMMIT'); return result;
        } catch (error) { db.exec('ROLLBACK'); throw error; }
      },
    };
  } catch (error) { db.close(); throw error; }
}
