import { test, expect } from "@playwright/test";

// Baselines are rendered on win32; font rasterization differs per OS, so
// these specs only run where their baselines exist. Regenerate with
// `pnpm exec playwright test tests/e2e/visual.spec.ts --update-snapshots`.
test.skip(process.platform !== "win32", "visual baselines are win32-rendered");

// Mask remote imagery on product routes. The homepage baseline intentionally
// renders its committed patch data: the patch numerals are core composition,
// and masking them would conceal the emblem aperture we need to review.
const maskRemote = (page: import("@playwright/test").Page) => [
  page.locator("img[src*='ddragon']"),
  page.locator("[data-version-current]"),
  page.locator("[data-version-old]"),
  page.locator("[data-hero-meta]"),
  page.locator("[data-portal-preview]"),
];

test("homepage hero end state", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await expect(page).toHaveScreenshot("hero.png", {
    maxDiffPixelRatio: 0.02,
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
