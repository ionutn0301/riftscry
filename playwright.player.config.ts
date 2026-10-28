import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/player-e2e',
  timeout: 45_000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:3000',
    viewport: { width: 359, height: 603 },
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } }
      : {}),
  },
  webServer: {
    command: 'pnpm dev --port 3000',
    url: 'http://127.0.0.1:3000/players',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  reporter: 'list',
});
