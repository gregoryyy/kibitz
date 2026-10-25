import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Build-owned manifest: verify every selected font/licence before publishing the directory.
export function copyFonts(source, destination) {
  const manifest = JSON.parse(fs.readFileSync(path.join(source, 'manifest.json'), 'utf8'));
  if (!Array.isArray(manifest.assets) || !manifest.assets.length) throw Error('Missing bundled font inventory');
  for (const asset of manifest.assets) {
    if (!/^[A-Za-z-]+\.(ttf|txt)$/.test(asset.file)) throw Error('Unexpected bundled font asset');
    const bytes = fs.readFileSync(path.join(source, asset.file));
    if (bytes.length !== asset.bytes || createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw Error('Bundled font integrity check failed');
  }
  fs.cpSync(source, destination, { recursive: true });
}
