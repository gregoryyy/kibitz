// End-to-end tests against the built site, served with the mock AI provider (no keys, no network).
// Uses the installed Google Chrome; set PW_CHANNEL=chromium to use Playwright's own browser instead.
import { defineConfig } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT || 8799);
const DIST = process.env.E2E_DIST || 'dist'; // another build to test, e.g. an older version

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'tests/out/playwright',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}/`,
    channel: process.env.PW_CHANNEL ?? 'chrome',
    headless: true,
    viewport: { width: 1360, height: 900 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `node scripts/serve.mjs ${DIST} --api --env= --index _test.html --port ${PORT}`,
    // Mock provider only: keys from the shell are blanked, so no test can reach a real provider.
    env: { AI_PROVIDER: 'mock', AI_RATE_LIMIT_PER_MINUTE: '1000', ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', MISTRAL_API_KEY: '', OLLAMA_MODEL: '', AI_LOCAL_ONLY: '' },
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
  },
});
