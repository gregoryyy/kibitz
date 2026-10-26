// Synthetic pre-upgrade data, created through the unchanged version-one store APIs.
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { createLibraryStore } from '../../server/library-store.mjs';
import { sqliteUsageStore } from '../../server/usage-store.mjs';
import { usageAccounting } from '../../server/usage.mjs';
import { loadConfig } from '../../server/ai.mjs';

export function legacyCookieData(dir) {
  const uid = randomBytes(16).toString('base64url'), token = randomBytes(32).toString('base64url');
  const scope = createHash('sha256').update('kibitz-library-v1\0' + token).digest('hex');
  const library = path.join(dir, 'library.sqlite'), usage = path.join(dir, 'usage.sqlite');
  for (const file of [library, usage]) fs.writeFileSync(file, '', { mode: 0o600 });
  const store = createLibraryStore(library), counters = sqliteUsageStore(usage);
  const record = { id: 'legacy-study', kind: 'study', pgn: '1. e4 e5 *' };
  try {
    store.change(scope, 0, [{ collection: 'games', id: record.id, record }]);
    usageAccounting(loadConfig({ AI_PROVIDER: 'mock' }), { store: counters }).countUsage(uid, 'mock', { input: 11, output: 7 }, { paid: false });
  } finally { store.close(); counters.close(); }
  return { uid, token, scope, library, usage, record };
}
