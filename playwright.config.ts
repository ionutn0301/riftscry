import { defineConfig, devices } from "@playwright/test";

const chromiumLaunch = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } }
  : {};

export default defineConfig({
  testDir: "tests/e2e",
  // Earlier presentations remain archived. Voyage, keyboard, spatial-history
  // (migrated resilience contracts) and core-flow cover the active experience.
  testIgnore: [
    "**/cinematic-production.spec.ts",
    "**/investigation.spec.ts",
    "**/investigation-review.spec.ts",
    "**/incision-*.spec.ts",
    "**/living-archive.spec.ts",
    "**/home-cinematic*.spec.ts",
    "**/journey-review.spec.ts",
    "**/mobile-observatory.spec.ts",
    "**/reduced-motion.spec.ts",
    "**/spatial-journey.spec.ts",
  ],
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4322",
    trace: "retain-on-failure",
  },
  webServer: {
    // astro 7 `preview` daemonizes; Playwright needs a foreground process.
    command: "node tests/e2e/serve.mjs",
    url: "http://127.0.0.1:4322",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        ...chromiumLaunch,
      },
    },
    { name: "mobile", use: { ...devices["iPhone 13"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, ...chromiumLaunch } },
  ],
});
