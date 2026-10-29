import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { steps } from '../../flipbook/tour.mjs';
import { flipbookCalls, checkLine, coachLine, markdown, publishDirectory } from '../../scripts/flipbook.mjs';

test('the paid plan counts button questions as well as chat, captures and player comments', () => {
  assert.equal(flipbookCalls([{ acts: [{ ask: 'Question' }, { askBy: '#explain' }, { capture: '#summary' }, { move: ['e4'], comment: true }, { move: ['d4'] }, { tab: 'library' }] }]), 4);
  assert.equal(flipbookCalls(steps), 9);
  assert.equal(new Set(steps.map(step => step.id)).size, steps.length);
  const local = steps.slice(steps.findIndex(step => step.id === 'source-search'));
  assert.equal(flipbookCalls(local), 0); assert.ok(local.some(step => step.id === 'lesson')); assert.ok(local.some(step => step.id === 'german-opening-guide'));
});

test('transcripts escape HTML, distinguish checker flags from verified claims and identify mock previews', () => {
  const quote = { question: 'Why?', who: 'Coach', text: '<img src=x onerror=alert(1)> ~~Qh9~~', checks: { all: 3, invalid: 1, unchecked: 1 } };
  const text = markdown([{ title: 'One step', file: '01-one.png', caption: 'Actual UI.', quotes: [quote] }], 'Mock placeholder preview', '2026-10-24');
  assert.match(text, /&lt;img src=x onerror=alert\(1\)&gt;/); assert.doesNotMatch(text, /<img/);
  assert.match(text, /red underline/); assert.match(text, /1 legal but outside/); assert.match(text, /do not certify every prose claim/);
  assert.match(text, /coach-prose-v2/); assert.match(text, /Mock placeholder preview/); assert.match(text, /2026-10-24/);
  assert.equal(checkLine({ all: 0, invalid: 0, unchecked: 0 }), '');
  const name = coachLine({ provider: 'anthropic', models: { quick: 'haiku', chat: 'haiku', review: 'haiku' }, apiKey: 'never-print-this' });
  assert.match(name, /Claude.*haiku.*quick questions, chat and reviews/); assert.doesNotMatch(name, /never-print/);
});

test('publication rolls back a failed replacement and publishes a complete staged directory together', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kibitz-flipbook-publish-')), out = path.join(dir, 'out'), staging = path.join(dir, 'staging');
  try {
    await fs.mkdir(out); await fs.writeFile(path.join(out, 'readme.md'), 'previous flipbook');
    await assert.rejects(publishDirectory(staging, out), /ENOENT/);
    assert.equal(await fs.readFile(path.join(out, 'readme.md'), 'utf8'), 'previous flipbook'); assert.deepEqual(await fs.readdir(dir), ['out']);
    await fs.mkdir(staging); await fs.writeFile(path.join(staging, 'readme.md'), 'updated flipbook'); await fs.writeFile(path.join(staging, '01-step.png'), 'synthetic image');
    await publishDirectory(staging, out);
    assert.equal(await fs.readFile(path.join(out, 'readme.md'), 'utf8'), 'updated flipbook'); assert.deepEqual(await fs.readdir(dir), ['out']);
    assert.deepEqual((await fs.readdir(out)).sort(), ['01-step.png', 'readme.md']);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
