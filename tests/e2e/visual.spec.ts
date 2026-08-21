import { test, expect } from "@playwright/test";

// Baselines are rendered on win32; font rasterization differs per OS, so
// these specs only run where their baselines exist. Regenerate with
// `pnpm exec playwright test tests/e2e/visual.spec.ts --update-snapshots`.
test.skip(process.platform !== "win32", "visual baselines are win32-rendered");

// Mask everything non-deterministic: ddragon portraits (network) and
// latest-patch-dependent hero content (changes every ingestion).
const maskRemote = (page: import("@playwright/test").Page) => [
  page.locator("img[src*='ddragon']"),
  page.locator("[data-hero-number]"),
  page.locator("[data-hero-kicker]"),
  page.locator("[data-hero-orbit]"),
];

test("homepage hero end state", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await expect(page).toHaveScreenshot("hero.png", {
    maxDiffPixelRatio: 0.02,
    mask: maskRemote(page),
  });
});

test("patch page top", async ({ page }) => {
  await page.goto("/patch/26.16");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await expect(page).toHaveScreenshot("patch-top.png", {
    maxDiffPixelRatio: 0.02,
    mask: maskRemote(page),
  });
});

test("palette open", async ({ page, isMobile }) => {
  test.skip(isMobile, "palette is keyboard-driven");
  await page.goto("/patch/26.16");
  await page.waitForSelector("astro-island[component-url*='CommandPalette']:not([ssr])", { state: "attached" });
  await page.keyboard.press("Control+k");
  await expect(page.locator("[cmdk-input]")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await expect(page).toHaveScreenshot("palette.png", {
    maxDiffPixelRatio: 0.02,
    mask: maskRemote(page),
  });
});
