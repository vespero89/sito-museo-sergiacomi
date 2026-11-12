import { defineConfig } from '@playwright/test';

// Browser tests run on `dist/` served by scripts/serve-dist.mjs, which applies the real CSP and
// redirects (config/hosting.mjs). Build first: `npm run test:e2e` does it. The fake tile server
// answers /__tiles/{z}/{x}/{y}.png, so the map never calls OpenStreetMap.
const PORTA = 4322;
const ORIGINE = `http://127.0.0.1:${PORTA}`;

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  // One browser at a time: with several windows open at once, Chromium sometimes skips the page
  // transition, and the transitions test would fail at random.
  workers: 1,
  reporter: [['list']],
  use: { baseURL: ORIGINE },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: `node scripts/serve-dist.mjs --port ${PORTA} --fake-tiles`,
    url: `${ORIGINE}/`,
    reuseExistingServer: false,
  },
});
