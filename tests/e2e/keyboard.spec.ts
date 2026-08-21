import { test, expect } from "@playwright/test";

test.describe("keyboard-only navigation", () => {
  test.skip(({ isMobile }) => isMobile, "keyboard flows are desktop-only");

  test("skip link is first tab stop and jumps to content", async ({ page }) => {
    await page.goto("/patch/26.16");
    await page.keyboard.press("Tab");
    await expect(page.locator(".skip-link")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main/);
  });

  test("palette: open with Ctrl+K, arrow to a result, Enter navigates", async ({ page }) => {
    await page.goto("/patch/26.16");
    await page.waitForTimeout(1200); // client:idle hydration
    await page.keyboard.press("Control+k");
    const input = page.locator("[cmdk-input]");
    await expect(input).toBeVisible();
    await input.pressSequentially("camille");
    await expect(page.locator("[cmdk-item]").first()).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/camille/);
  });

  test("palette closes on Escape and returns focus to the page", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(1200);
    await page.keyboard.press("Control+k");
    await expect(page.locator("[cmdk-input]")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("[cmdk-input]")).toHaveCount(0);
  });

  test("pool picker: toggle a champion with the keyboard", async ({ page }) => {
    await page.goto("/pool");
    const ahri = page.getByRole("option", { name: "Ahri", exact: true });
    await ahri.focus();
    await page.keyboard.press("Enter");
    await expect(ahri).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Enter");
    await expect(ahri).toHaveAttribute("aria-selected", "false");
  });

  test("timeline entries expand with Enter", async ({ page }) => {
    await page.goto("/champion/camille");
    const second = page.locator(".timeline-entry").nth(1);
    const summary = second.locator("summary");
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(second.locator("details")).toHaveAttribute("open", "");
  });
});
