import { defineConfig, devices } from '@playwright/test';

/**
 * ClickThrough Demo Builder — E2E テスト設定
 *
 * 対象 URL は環境変数 E2E_BASE_URL で上書き可能 (既定は本番 SWA)。
 *   $env:E2E_BASE_URL="http://localhost:5173"; npm run test:e2e
 */
const baseURL = process.env.E2E_BASE_URL ?? 'https://ashy-wave-003b36700.2.azurestaticapps.net';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
