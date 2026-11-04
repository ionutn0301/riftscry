import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig(base, {
  testIgnore: [],
  testMatch: '**/performance-experience.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 45_000,
  use: { ...base.use, trace: 'retain-on-failure' },
  projects: [base.projects![0]!],
});
