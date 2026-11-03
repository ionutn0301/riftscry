import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/account-e2e',
  timeout: 30_000,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4325', reducedMotion: 'reduce', trace: 'retain-on-failure', screenshot: 'only-on-failure',
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } } : {}),
  },
  webServer: {
    command: 'pnpm exec astro dev --ignore-lock --host 127.0.0.1 --port 4325',
    url: 'http://127.0.0.1:4325/account',
    reuseExistingServer: false,
    env: { ASTRO_DEV_BACKGROUND: '1', PUBLIC_SUPABASE_URL: 'https://account-test.supabase.co', PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', PUBLIC_AUTH_PROVIDERS: 'google' },
  },
});
