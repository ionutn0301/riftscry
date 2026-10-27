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
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/?renderer=fallback");
    await expect(
      page.locator("astro-island:has(.investigation)"),
    ).not.toHaveAttribute("ssr", "");
    await page.getByRole("button", { name: /^Azir/ }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Follow what changed" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".evidence-main")).toContainText(
      "75 / 95 / 115 / 135 / 155",
    );
    await page
      .getByRole("button", { name: "Bring the findings together" })
      .focus();
    await page.keyboard.press("Enter");
    await page
      .getByRole("button", { name: "Add to My Pool", exact: true })
      .focus();
    await page.keyboard.press("Space");
    await expect(
      page.getByRole("button", { name: "My Pool (1)", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Another champion/ }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/beat=opening/);
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
