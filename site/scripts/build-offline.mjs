import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { offlineHtml } from '../server/static.mjs';

export function buildOffline(dist, page) {
  fs.writeFileSync(path.join(dist, 'offline.html'), offlineHtml('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + page + '</body></html>'));
  fs.writeFileSync(path.join(dist, 'manifest.webmanifest'), JSON.stringify({
    id: './', name: 'Kibitz Chess Coach', short_name: 'Kibitz', start_url: './', scope: './', display: 'standalone',
    background_color: '#eceef3', theme_color: '#3a49d6',
    icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  }, null, 2));
  const assets = [];
  function visit(dir, relative = '') {
    for (const file of fs.readdirSync(dir).sort()) {
      const name = relative + file, full = path.join(dir, file);
      if (fs.statSync(full).isDirectory()) visit(full, name + '/');
      else if (!['index.html', '_test.html', 'sw.js'].includes(name)) {
        const content = fs.readFileSync(full); assets.push({ path: name, bytes: content.length, sha256: crypto.createHash('sha256').update(content).digest('hex') });
      }
    }
  }
  visit(dist);
  const revision = crypto.createHash('sha256').update(JSON.stringify(assets)).digest('hex');
  fs.writeFileSync(path.join(dist, 'sw.js'), `// Generated public app bundle. Never cache API responses or model weights.\nimport { registerOfflineWorker } from './platform/offline-worker.js';\nregisterOfflineWorker(self, ${JSON.stringify(assets)}, ${JSON.stringify(revision)});\n`);
  return { revision, assets };
}
