import { test, expect } from "@playwright/test";
test.describe("keyboard-only exploration", () => {
  test.skip(
    ({ isMobile }) => isMobile,
    "Keyboard on desktop; touch covered separately.",
  );
  test("skip link targets content", async ({ page }) => {
    await page.goto("/patch/26.16");
    await page.keyboard.press("Tab");
    await expect(page.locator(".skip-link")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main/);
  });
  test("choose, inspect, save and return without pointer", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(
      page.locator("astro-island:has(.investigation)"),
    ).not.toHaveAttribute("ssr", "");
    await page.getByRole("button", { name: "Choose your champion" }).focus();
    await page.keyboard.press("Enter");
    await page.getByLabel(/Search all/).fill("Azir");
    await page.getByRole("button", { name: /^Azir/ }).focus();
    await page.keyboard.press("Enter");
    await page.locator(".record-place").first().focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".evidence-main")).toContainText(
      "75 / 95 / 115 / 135 / 155",
    );
    await page.getByRole("button", { name: /Gather your findings/ }).focus();
    await page.keyboard.press("Enter");
    await page
      .getByRole("button", { name: "Add to My Pool", exact: true })
      .focus();
    await page.keyboard.press("Space");
    await expect(
      page.getByRole("button", { name: /My Pool \(1\)/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Azir’s history/ }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".history-field")).toBeVisible();
  });
  test("search handoff closes native dialog", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(
      'astro-island[component-url*="CommandPalette"]:not([ssr])',
      { state: "attached" },
    );
    await page.getByRole("button", { name: /Explore/ }).click();
    await page.getByRole("button", { name: "Search the archive" }).click();
    await expect(page.locator("dialog")).not.toBeVisible();
    await expect(page.locator("[cmdk-input]")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Control+k");
    await expect(page.locator("[cmdk-input]")).toBeVisible();
  });
});
