import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tlsMaterial } from '../tests/helpers/tls-material.mjs';
import { newOperator } from './operator.mjs';
import { PERMISSIONS, validatePermissions, readPermissions, initializePermissions, permissionGranted } from './permissions.mjs';

const invalid = error => error.code === 'ERR_KIBITZ_PERMISSIONS_CONFIG';
test('explicit grants bind to the operator, reject wildcards/duplicates/unknown fields, and copy immutable policy data', t => {
  const operator = newOperator(), source = { version: 1, operator: operator.id, allow: ['library:read'] }, value = validatePermissions(source, operator);
  source.allow.push('library:erase'); assert.deepEqual(value.allow, ['library:read']); assert(Object.isFrozen(value.allow));
  assert.deepEqual(validatePermissions({ ...source, allow: [] }, operator).allow, []);
  for (const bad of [null, {}, { ...source, operator: newOperator().id }, { ...source, version: 2 }, { ...source, allow: ['*'] },
    { ...source, allow: ['ai:read', 'ai:read'] }, { ...source, allow: ['ai:unknown'] }, { ...source, allow: 'ai:read' }, { ...source, admin: true }]) assert.throws(() => validatePermissions(bad, operator), invalid);
  const writeOnly = validatePermissions({ ...source, allow: ['library:write', 'library:erase'] }, operator);
  assert(!permissionGranted(writeOnly, 'library:write')); assert(!permissionGranted(writeOnly, 'library:erase'));
  const complete = validatePermissions({ ...source, allow: [...PERMISSIONS] }, operator); assert(permissionGranted(complete, 'library:erase'));
  t.assert.equal(permissionGranted(complete, 'unknown'), false);
});

test('private policy loading is bounded and refuses public trees, permissive modes, links, malformed JSON and another operator', t => {
  const identity = tlsMaterial(); t.after(identity.close); const operator = { id: identity.operatorId };
  assert.equal(readPermissions(identity.policy, [], operator).allow.length, PERMISSIONS.length);
  assert.throws(() => readPermissions(undefined, [], operator), invalid);
  assert.throws(() => readPermissions(identity.policy, [identity.dir], operator), invalid);
  assert.throws(() => readPermissions(identity.policy, [], newOperator()), invalid);
  const link = path.join(identity.dir, 'link.json'); fs.symlinkSync(identity.policy, link); assert.throws(() => readPermissions(link, [], operator), invalid);
  for (const [index, contents] of ['x'.repeat(4097), '{bad', JSON.stringify({ version: 1, operator: operator.id, allow: ['PRIVATE_POLICY_MARKER'] })].entries()) {
    const file = path.join(identity.dir, `malformed-${index}.json`); fs.writeFileSync(file, contents, { flag: 'wx', mode: 0o600 });
    assert.throws(() => readPermissions(file, [], operator), error => invalid(error) && !error.message.includes('PRIVATE_POLICY_MARKER'));
  }
  const exposed = path.join(identity.dir, 'exposed.json'); fs.writeFileSync(exposed, JSON.stringify({ version: 1, operator: operator.id, allow: [] }), { flag: 'wx', mode: 0o644 });
  assert.throws(() => readPermissions(exposed, [], operator), invalid);
});

test('offline setup writes only explicitly selected permissions privately without replacing existing identity or policy', t => {
  const identity = tlsMaterial(); t.after(identity.close); const operator = { id: identity.operatorId }, file = path.join(identity.dir, 'new', 'policy.json');
  initializePermissions(file, operator, ['ai:read']); assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.throws(() => initializePermissions(file, operator, [...PERMISSIONS]), invalid); assert.deepEqual(readPermissions(file, [], operator).allow, ['ai:read']);
  const cli = fileURLToPath(new URL('../scripts/permissions.mjs', import.meta.url)), explicit = path.join(identity.dir, 'explicit.json');
  const result = spawnSync(process.execPath, [cli, identity.operator, explicit, '--none'], { encoding: 'utf8', timeout: 5000, env: { ...process.env, NODE_NO_WARNINGS: '1' } });
  assert.equal(result.status, 0); assert.deepEqual(readPermissions(explicit, [], operator).allow, []); assert(!result.stdout.includes(identity.secret)); assert(!result.stdout.includes(identity.operatorId));
  const again = spawnSync(process.execPath, [cli, identity.operator, explicit, '--all'], { encoding: 'utf8', timeout: 5000, env: { ...process.env, NODE_NO_WARNINGS: '1' } });
  assert.equal(again.status, 1); assert.equal(JSON.parse(again.stderr).code, 'ERR_KIBITZ_PERMISSIONS_CONFIG'); assert(!again.stderr.includes(identity.dir));
});
