import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { sqliteUsageStore, usageKey, usageDay } from './usage-store.mjs';
import { usageAccounting } from './usage.mjs';
import { privateDatabaseFile } from './private-files.mjs';

const config = { ratePerMinute: 4, userRatePerMinute: 2, tokensPerDay: 200, userTokensPerDay: 100, userCostPerDay: 0.1, prices: 'paid=1000/1000' };
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'kibitz-usage-'));

test('private usage persists daily ledgers and cookie rates through restart; users and local usage remain distinct', () => {
  const dir = temp(), root = path.join(dir, 'dist'); fs.mkdirSync(root);
  const file = privateDatabaseFile(path.join(dir, 'data', 'usage.sqlite'), root);
  let store, t = new Date(2026, 9, 24, 12).getTime();
  try {
    store = sqliteUsageStore(file); let accounting = usageAccounting(config, { store, now: () => t });
    assert.equal(accounting.allow('a'), true); assert.equal(accounting.allow('a'), true); assert.equal(accounting.allow('a'), false);
    accounting.countUsage('a', 'paid', { input: 80, output: 20 }, { paid: true });
    accounting.countUsage('b', 'local', { input: 20, output: 5 }, { paid: false });
    const prior = accounting.users.today('a'); store.close();
    store = sqliteUsageStore(file); accounting = usageAccounting(config, { store, now: () => t });
    assert.deepEqual(accounting.users.today('a'), prior);
    assert.equal(accounting.ledger.today().requests, 2); assert.equal(accounting.ledger.today().input, 100);
    assert.throws(() => accounting.users.check('a'), { code: 'budget_exceeded' }); accounting.users.check('b');
    assert.deepEqual(accounting.users.today('b').paid, { tokens: 0, cost: 0 });
    assert.equal(accounting.allow('a'), false); assert.equal(accounting.allow('b'), true);
    t += 60_000; assert.equal(accounting.allow('a'), true); assert.throws(() => accounting.users.check('a'));
    t += 24 * 3600_000; assert.equal(accounting.users.today('a').requests, 0); accounting.users.check('a');
    accounting.countUsage('b', 'paid', { input: 1 }, { paid: true });
    assert.equal(accounting.ledger.today().requests, 1);
    const db = new DatabaseSync(file); const days = db.prepare('SELECT DISTINCT day FROM counters').all(); db.close();
    assert.deepEqual(days.map(row => row.day), [usageDay(t)]);
    assert.equal(fs.statSync(file).mode & 0o777, 0o600); assert.equal(fs.statSync(path.dirname(file)).mode & 0o777, 0o700);
    assert.match(usageKey('raw-secret-cookie'), /^user:[a-f0-9]{64}$/);
  } finally { store?.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('shared database handles see committed budgets and rates; rollback keeps server and user counts together', () => {
  const dir = temp(), file = path.join(dir, 'usage.sqlite'); const a = sqliteUsageStore(file), b = sqliteUsageStore(file);
  try {
    const first = usageAccounting(config, { store: a }), second = usageAccounting(config, { store: b });
    first.countUsage('a', 'paid', { input: 100 }, { paid: true }); assert.throws(() => second.users.check('a'));
    assert.equal(first.allow('a'), true); assert.equal(second.allow('a'), true); assert.equal(first.allow('a'), false);
    const before = first.ledger.today();
    assert.throws(() => a.transaction(() => { first.ledger.add('paid', { input: 20 }); throw Error('disk write failed'); }));
    assert.deepEqual(second.ledger.today(), before);
    assert.throws(() => first.countUsage('b', 'paid', { input: -100 }, { paid: true }), /invalid token usage/);
    assert.deepEqual(second.ledger.today(), before); assert.equal(second.users.today('b').requests, 0);
    first.countUsage('b', 'paid', { input: 100 }, { paid: true }); assert.throws(() => second.ledger.check());
  } finally { a.close(); b.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('unknown/corrupt schemas and unsafe paths are preserved and rejected; capacity cannot evict a spent budget', () => {
  const dir = temp(), root = path.join(dir, 'dist'); fs.mkdirSync(root);
  try {
    const file = path.join(dir, 'future.sqlite'), db = new DatabaseSync(file); db.exec('PRAGMA user_version=99'); db.close();
    const original = fs.readFileSync(file); assert.throws(() => sqliteUsageStore(file), /Unsupported usage schema/); assert.deepEqual(fs.readFileSync(file), original);
    const malformed = path.join(dir, 'malformed.sqlite'); fs.writeFileSync(malformed, 'retain me'); assert.throws(() => sqliteUsageStore(malformed)); assert.equal(fs.readFileSync(malformed, 'utf8'), 'retain me');
    assert.throws(() => privateDatabaseFile(path.join(root, 'usage.sqlite'), root), /outside/);
    const alias = path.join(dir, 'alias'); fs.symlinkSync(root, alias); assert.throws(() => privateDatabaseFile(path.join(alias, 'usage.sqlite'), root), /outside/);
    const link = path.join(dir, 'link.sqlite'); fs.symlinkSync(file, link); assert.throws(() => privateDatabaseFile(link, root), /private regular file/);
    const publicFile = path.join(dir, 'public.sqlite'); fs.writeFileSync(publicFile, 'keep'); fs.chmodSync(publicFile, 0o644); assert.throws(() => privateDatabaseFile(publicFile, root), /private regular file/);
    const store = sqliteUsageStore(':memory:', { maxUsers: 1 });
    try {
      const accounting = usageAccounting(config, { store }); accounting.countUsage('a', 'paid', { input: 100 }, { paid: true });
      const before = accounting.ledger.today(); assert.throws(() => accounting.countUsage('b', 'paid', { input: 50 }), { code: 'usage_unavailable' });
      assert.deepEqual(accounting.ledger.today(), before); assert.throws(() => accounting.users.check('a'));
      assert.throws(() => accounting.allow('b'), { code: 'usage_unavailable' });
    } finally { store.close(); }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('corrupt current counters fail closed and preserve the stored bytes for operator repair', () => {
  const dir = temp(), file = path.join(dir, 'usage.sqlite'); let store = sqliteUsageStore(file);
  try {
    const accounting = usageAccounting(config, { store }); accounting.countUsage('a', 'paid', { input: 5 }); store.close(); store = null;
    const db = new DatabaseSync(file), body = '{"requests":-1}'; db.prepare('UPDATE counters SET body=? WHERE scope=?').run(body, 'server'); db.close();
    store = sqliteUsageStore(file); const broken = usageAccounting(config, { store });
    assert.throws(() => broken.ledger.check(), { code: 'usage_unavailable', status: 503 });
    assert.throws(() => broken.allow('b'), { code: 'usage_unavailable' });
    const check = new DatabaseSync(file); assert.equal(check.prepare('SELECT body FROM counters WHERE scope=?').get('server').body, body); check.close();
  } finally { store?.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});
