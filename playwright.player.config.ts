import { defineConfig } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_PLAYER_BASE_URL ?? 'http://127.0.0.1:3000';

export default defineConfig({
  testDir: 'tests/player-e2e',
  timeout: 45_000,
  workers: 1,
  use: {
    baseURL,
    viewport: { width: 359, height: 603 },
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } }
      : {}),
  },
  webServer: {
    command: `pnpm dev --port ${new URL(baseURL).port || '3000'}`,
    url: `${baseURL}/players`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  reporter: 'list',
});
