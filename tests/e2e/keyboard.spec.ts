import { test, expect } from "@playwright/test";
test.describe("keyboard-only exploration", () => {
  test.skip(
    ({ isMobile }) => isMobile,
    "Keyboard checks use desktop; touch is covered separately.",
  );
  test("skip link targets content", async ({ page }) => {
    await page.goto("/patch/26.16");
    await page.keyboard.press("Tab");
    await expect(page.locator(".skip-link")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main/);
  });
  test("choose, reveal, save, and return without a pointer", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.locator("astro-island:has(.incision-experience)"),
    ).not.toHaveAttribute("ssr", "");
    await page
      .locator(".champion-branches")
      .getByRole("button", { name: /Explore Azir/ })
      .focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Reveal this change" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".record-values")).toContainText(
      "75 / 95 / 115 / 135 / 155",
    );
    await page.getByRole("button", { name: "Add to My Pool" }).focus();
    await page.keyboard.press("Space");
    await expect(page.locator(".collection-rail")).toContainText("Azir");
    await page.getByRole("button", { name: "Other changes" }).focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("button", { name: "Reveal this change" }),
    ).toBeVisible();
  });
  test("visible search and keyboard shortcut both work", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(
      'astro-island[component-url*="CommandPalette"]:not([ssr])',
      { state: "attached" },
    );
    await page.locator("[data-palette-trigger]").click();
    await expect(page.locator("[cmdk-input]")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Control+k");
    await expect(page.locator("[cmdk-input]")).toBeVisible();
  });
});
