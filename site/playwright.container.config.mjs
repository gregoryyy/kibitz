// Explicit Docker-image verification; ordinary unit/e2e commands never start Docker.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/container',
  outputDir: 'tests/out/container',
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  use: { channel: process.env.PW_CHANNEL ?? 'chrome', headless: true,
    viewport: { width: 1360, height: 900 }, trace: 'retain-on-failure' },
});
