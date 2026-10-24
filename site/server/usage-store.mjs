// Current-day numeric counters only: no prompts, model responses, API keys or raw cookies.
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { GatewayError } from './ai.mjs';

export const usageKey = uid => 'user:' + crypto.createHash('sha256').update(uid).digest('hex');
export const usageDay = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const unavailable = error => error instanceof GatewayError ? error : new GatewayError('usage_unavailable', 'Usage accounting is unavailable; check private server storage before retrying.', 503);
export const freshUsage = () => ({ requests: 0, input: 0, output: 0, cost: 0, unpriced: 0, paidTokens: 0, paidCost: 0, hits: [] });

function validate(value) {
  const fields = Object.keys(freshUsage()).filter(key => key !== 'hits');
  const integers = ['requests', 'input', 'output', 'unpriced', 'paidTokens'];
  if (!value || fields.some(key => !Number.isFinite(value[key]) || value[key] < 0) || integers.some(key => !Number.isSafeInteger(value[key]))
    || !Array.isArray(value.hits) || value.hits.length > 100_000 || value.hits.some(t => !Number.isSafeInteger(t) || t < 0)
    || Object.keys(value).length !== fields.length + 1) throw new Error('Invalid stored usage counters');
  return value;
}

export function memoryUsageStore(maxEntries = 10_001) {
  let day = '', rows = new Map();
  function roll(next) { if (day !== next) { day = next; rows.clear(); } }
  return {
    transaction: operation => operation(),
    read(key, next) { roll(next); return rows.has(key) ? structuredClone(rows.get(key)) : freshUsage(); },
    write(key, next, value) {
      roll(next); validate(value);
      if (!rows.has(key) && rows.size >= maxEntries) rows.delete([...rows.keys()].find(scope => scope !== 'server'));
      rows.set(key, structuredClone(value));
    },
  };
}

/** Caller creates a private file outside the served tree (or uses :memory: in tests). */
export function sqliteUsageStore(filename = ':memory:', { maxUsers = 10_000 } = {}) {
  const db = new DatabaseSync(filename, { timeout: 1000 });
  try {
    const version = Number(db.prepare('PRAGMA user_version').get().user_version);
    if (![0, 1].includes(version)) throw new Error('Unsupported usage schema');
    if (!version) {
      if (db.prepare("SELECT name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").all().length) throw new Error('Unknown usage schema');
      db.exec(`BEGIN IMMEDIATE;
        CREATE TABLE counters (scope TEXT PRIMARY KEY, day TEXT NOT NULL, body TEXT NOT NULL);
        PRAGMA user_version=1;
        COMMIT;`);
    }
    const get = db.prepare('SELECT day,body FROM counters WHERE scope=?');
    const put = db.prepare('INSERT INTO counters(scope,day,body) VALUES(?,?,?) ON CONFLICT(scope) DO UPDATE SET day=excluded.day,body=excluded.body');
    const prune = db.prepare('DELETE FROM counters WHERE day<>?');
    const size = db.prepare("SELECT count(*) AS count FROM counters WHERE scope<>'server' AND day=?");
    db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
    let inside = false;
    const transaction = operation => {
      if (inside) return operation();
      try {
        db.exec('BEGIN IMMEDIATE'); inside = true;
        const result = operation(); db.exec('COMMIT'); return result;
      } catch (error) {
        if (inside) try { db.exec('ROLLBACK'); } catch { /* Preserve the original failure. */ }
        throw unavailable(error);
      } finally { inside = false; }
    };
    return {
      close: () => db.close(), transaction,
      read(key, day) {
        try {
          const row = get.get(key);
          return row?.day === day ? validate(JSON.parse(String(row.body))) : freshUsage();
        } catch (error) { throw unavailable(error); }
      },
      write(key, day, value) {
        validate(value); prune.run(day);
        if (key !== 'server' && !get.get(key) && Number(size.get(day).count) >= maxUsers) throw new GatewayError('usage_unavailable', 'Usage storage is full; try again after local midnight.', 503);
        put.run(key, day, JSON.stringify(value));
      },
    };
  } catch (error) { db.close(); throw error; }
}
