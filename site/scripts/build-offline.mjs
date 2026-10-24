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
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      const name = relative + entry.name, full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) throw Error('Offline assets must not be symbolic links');
      if (entry.isDirectory()) visit(full, name + '/');
      else if (!['index.html', '_test.html', 'sw.js'].includes(name)) {
        if (!entry.isFile()) throw Error('Offline assets must be regular files');
        // Check and read the opened file itself. A path stat followed by a path read can
        // inspect one file and hash another if it is replaced between those operations.
        const fd = fs.openSync(full, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
        try {
          if (!fs.fstatSync(fd).isFile()) throw Error('Offline assets must be regular files');
          const content = fs.readFileSync(fd);
          assets.push({ path: name, bytes: content.length, sha256: crypto.createHash('sha256').update(content).digest('hex') });
        } finally { fs.closeSync(fd); }
      }
    }
  }
  visit(dist);
  const revision = crypto.createHash('sha256').update(JSON.stringify(assets)).digest('hex');
  fs.writeFileSync(path.join(dist, 'sw.js'), `// Generated public app bundle. Never cache API responses or model weights.\nimport { registerOfflineWorker } from './platform/offline-worker.js';\nregisterOfflineWorker(self, ${JSON.stringify(assets)}, ${JSON.stringify(revision)});\n`);
  return { revision, assets };
}
