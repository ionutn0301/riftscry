import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: '**/performance-experience.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 45_000,
  // Trace screenshots read GPU pixels and perturb the very timings we measure.
  // Capture only after a failure; the tests save their metrics before assertions.
  use: { ...base.use, trace: 'off', screenshot: 'only-on-failure' },
  projects: [base.projects![0]!],
});
