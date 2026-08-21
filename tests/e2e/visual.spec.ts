import { test, expect } from "@playwright/test";

// Visual anchors for the major surfaces. ddragon portraits load from the
// network; mask them to keep snapshots deterministic.
const maskRemote = (page: import("@playwright/test").Page) => [
  page.locator("img[src*='ddragon']"),
];

test("homepage hero end state", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(1000);
  await expect(page).toHaveScreenshot("hero.png", {
    maxDiffPixelRatio: 0.02,
    mask: maskRemote(page),
  });
});

test("patch page top", async ({ page }) => {
  await page.goto("/patch/26.16");
  await page.waitForTimeout(800);
  await expect(page).toHaveScreenshot("patch-top.png", {
    maxDiffPixelRatio: 0.02,
    mask: maskRemote(page),
  });
});

test("palette open", async ({ page, isMobile }) => {
  test.skip(isMobile, "palette is keyboard-driven");
  await page.goto("/patch/26.16");
  await page.waitForTimeout(1200);
  await page.keyboard.press("Control+k");
  await expect(page.locator("[cmdk-input]")).toBeVisible();
  await page.waitForTimeout(400);
  await expect(page).toHaveScreenshot("palette.png", {
    maxDiffPixelRatio: 0.02,
    mask: maskRemote(page),
  });
});
