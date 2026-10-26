import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { newOperator, validateOperator, operatorProof, readOperator, initializeOperator } from './operator.mjs';
import { sessionStore, sessionToken, SESSION_COOKIE, SESSION_AGE } from './sessions.mjs';

const operator = () => validateOperator(newOperator());
const code = expected => error => error.code === expected;
const temp = t => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kibitz-sessions-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true })); return dir; };

test('only issued 256-bit session tokens verify; duplicate/forged cookies and another operator fail', t => {
  const store = sessionStore(); t.after(store.close); const a = operator(), b = operator(), issued = store.issue(a);
  assert.match(issued.value, /^[A-Za-z0-9_-]{43}$/); assert.match(store.verify(a, issued.value).usage, /^[A-Za-z0-9_-]{22}$/);
  for (const value of ['', 'x'.repeat(43), issued.value + 'x']) assert.throws(() => store.verify(a, value), code('session_expired'));
  assert.throws(() => store.verify(b, issued.value), code('session_expired'));
  for (const cookie of ['', SESSION_COOKIE + '=x', `${SESSION_COOKIE}=${issued.value}; ${SESSION_COOKIE}=${issued.value}`]) assert.throws(() => sessionToken({ headers: { cookie } }), code('session_expired'));
  assert.equal(sessionToken({ headers: { cookie: `${SESSION_COOKIE}=${issued.value}; irrelevant=1` } }), issued.value);
});

test('expiry and changed operator credentials deny access across restart; fresh proof can recover the same collection', t => {
  const filename = path.join(temp(t), 'sessions.sqlite'); let now = 1000, store = sessionStore(filename, { now: () => now });
  t.after(() => store.close()); const a = operator(), issued = store.issue(a), scope = store.verify(a, issued.value);
  store.close(); store = sessionStore(filename, { now: () => now }); assert.deepEqual(store.verify(a, issued.value), scope);
  now += SESSION_AGE; assert.throws(() => store.verify(a, issued.value), code('session_expired'));
  const rotated = validateOperator({ version: 1, id: a.id, secret: newOperator().secret });
  assert.throws(() => store.verify(rotated, issued.value), code('session_expired'));
  assert.deepEqual(store.recover(rotated, issued.value), { usage: scope.usage, library: scope.library });
  assert.throws(() => store.recover(operator(), issued.value), code('session_expired'));
  const renewed = store.issue(rotated, store.recover(rotated, issued.value)); assert.equal(store.verify(rotated, renewed.value).library, scope.library);
  const bytes = fs.readFileSync(filename); assert(!bytes.includes(Buffer.from(issued.value))); assert(!bytes.includes(Buffer.from(a.secret)));
});

test('collection ownership is transactional, persistent and never reassigned; bounded registry never evicts identities', t => {
  const filename = path.join(temp(t), 'sessions.sqlite'), a = operator(), b = operator(); let store = sessionStore(filename, { limit: 3 });
  t.after(() => store.close()); const first = store.issue(a), claims = store.verify(a, first.value);
  const untouched = 'z'.repeat(22);
  assert.throws(() => store.issue(b, { usage: untouched, library: claims.library }), code('session_conflict'));
  const adopted = store.issue(a, { usage: untouched }); assert.equal(store.verify(a, adopted.value).usage, untouched); // preceding failed transaction did not claim it
  store.close(); store = sessionStore(filename, { limit: 3 });
  assert.throws(() => store.issue(b, claims), code('session_conflict'));
  store.issue(a, claims); assert.throws(() => store.issue(a), code('unavailable')); assert.equal(store.verify(a, first.value).library, claims.library);
});

test('unknown or unrelated registry schemas fail closed without replacing their contents', t => {
  for (const version of [0, 9]) {
    const filename = path.join(temp(t), 'existing.sqlite'), db = new DatabaseSync(filename);
    db.exec(`CREATE TABLE unrelated (value TEXT); INSERT INTO unrelated VALUES ('preserve'); PRAGMA user_version=${version};`); db.close();
    assert.throws(() => sessionStore(filename), code('unavailable'));
    const check = new DatabaseSync(filename); assert.equal(check.prepare('SELECT value FROM unrelated').get().value, 'preserve'); check.close();
  }
});

test('operator setup is private, explicit, bounded and never overwrites an existing identity', t => {
  const dir = temp(t), filename = path.join(dir, 'private', 'operator.json'); initializeOperator(filename);
  const a = readOperator(filename, [path.join(dir, 'public')]); assert(operatorProof(a, a.secret)); assert(!operatorProof(a, 'x'.repeat(43)));
  assert.equal(fs.statSync(filename).mode & 0o777, 0o600); assert.throws(() => initializeOperator(filename), code('ERR_KIBITZ_OPERATOR_CONFIG')); assert.equal(readOperator(filename, []).secret, a.secret);
  assert.throws(() => readOperator(filename, [fs.realpathSync(path.dirname(filename))]), code('ERR_KIBITZ_OPERATOR_CONFIG'));
  const link = path.join(dir, 'linked'); fs.symlinkSync(filename, link); assert.throws(() => readOperator(link, []), code('ERR_KIBITZ_OPERATOR_CONFIG'));
  fs.chmodSync(filename, 0o644); assert.throws(() => readOperator(filename, []), code('ERR_KIBITZ_OPERATOR_CONFIG')); fs.chmodSync(filename, 0o600);
  for (const [index, text] of ['x'.repeat(4097), '{bad', JSON.stringify({ ...newOperator(), extra: 'private-marker' })].entries()) {
    const malformed = path.join(dir, `invalid-${index}.json`);
    fs.writeFileSync(malformed, text, { flag: 'wx', mode: 0o600 }); assert.throws(() => readOperator(malformed, []), error => error.code === 'ERR_KIBITZ_OPERATOR_CONFIG' && !error.message.includes('private-marker'));
  }
});

test('setup CLI never prints its generated key or private path and refuses repeated initialization', t => {
  const filename = path.join(temp(t), 'private-marker', 'operator.json'), script = fileURLToPath(new URL('../scripts/operator.mjs', import.meta.url));
  const first = spawnSync(process.execPath, [script, filename], { encoding: 'utf8', timeout: 5000 }); assert.equal(first.status, 0);
  const secret = readOperator(filename, []).secret; assert(!first.stdout.includes(secret)); assert(!first.stdout.includes('private-marker'));
  const again = spawnSync(process.execPath, [script, filename], { encoding: 'utf8', timeout: 5000 }); assert.equal(again.status, 1);
  assert.equal(JSON.parse(again.stderr).code, 'ERR_KIBITZ_OPERATOR_CONFIG'); assert(!again.stderr.includes(secret)); assert(!again.stderr.includes('private-marker'));
});

test('reauthentication replaces only the presenting operator’s token in the issuance transaction', t => {
  const store = sessionStore(':memory:', { limit: 2 }); t.after(store.close); const a = operator(), b = operator();
  const first = store.issue(a), owned = store.verify(a, first.value), second = store.issue(b);
  const renewed = store.issue(a, owned, first.value); assert.throws(() => store.verify(a, first.value), code('session_expired')); assert.equal(store.verify(a, renewed.value).library, owned.library);
  assert.throws(() => store.issue(a, {}, second.value), code('unavailable')); assert(store.verify(b, second.value)); // cannot delete another operator's token to make space
});
