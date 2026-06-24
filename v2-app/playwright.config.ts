import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E config for Timo Training App.
 *
 * Tests run against a live Vite dev server (npm run dev).
 * They require two pre-linked test accounts — set via env vars:
 *
 *   E2E_COACH_EMAIL    (default: timo.anis@gmail.com)
 *   E2E_COACH_PASS     (set in .env.e2e — never commit)
 *   E2E_TRAINEE_EMAIL  (default: timoanis+test6@gmail.com)
 *   E2E_TRAINEE_PASS   (set in .env.e2e — never commit)
 *
 * The two accounts must have an accepted coach_link in the DB.
 *
 * Run:  npx playwright test
 * UI:   npx playwright test --ui
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // realtime tests are order-sensitive
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    video: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Start the Vite dev server automatically before running tests.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
