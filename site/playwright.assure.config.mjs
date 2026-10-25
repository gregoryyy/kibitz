import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/assure', outputDir: 'tests/out/assure', timeout: 30_000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:8787', channel: process.env.PW_CHANNEL ?? 'chrome', headless: true, viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure' },
  webServer: { command: 'node ../utils/assure-browser/serve.mjs --port 8787', url: 'http://127.0.0.1:8787', reuseExistingServer: false },
});
