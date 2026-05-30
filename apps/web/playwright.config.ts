import { defineConfig, devices } from '@playwright/test';

// Real-flow E2E runs the app against the seeded test Postgres on :5433.
const TEST_DB = 'postgresql://wc:wc@localhost:5433/wc_game';

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: false,
    timeout: 120_000,
    env: { ...process.env, DATABASE_URL: TEST_DB, JWT_SECRET: 'e2e-secret', NODE_ENV: 'development' },
  },
});
