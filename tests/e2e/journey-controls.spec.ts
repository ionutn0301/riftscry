import { test, expect } from "@playwright/test";

test("chapter controls navigate the world and ambient audio is opt-in", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => !!window.__riftscryJourney);
  const camera = page.locator("[data-world-camera]");
  const initial = await camera.evaluate((element) => getComputedStyle(element).transform);
  await expect(page.getByRole("button", { name: "Enable ambient sound" })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("link", { name: "Enter the Rift" }).click();
  await expect(page.getByRole("button", { name: "Chapter 2: Your champions" })).toHaveAttribute("aria-current", "step");
  await expect(page.getByRole("heading", { name: "Only your champions survive the cut." })).toBeVisible();
  await expect.poll(() => camera.evaluate((element) => getComputedStyle(element).transform)).not.toBe(initial);
  await page.getByRole("button", { name: "Chapter 5: The source" }).click();
  await expect(page.getByRole("button", { name: "Chapter 5: The source" })).toHaveAttribute("aria-current", "step");
  await expect(page.locator("[data-source-code]")).toBeVisible();
  await page.getByRole("button", { name: "Chapter 1: The threshold" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Enable ambient sound" }).click();
  await expect(page.getByRole("button", { name: "Mute ambient sound" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Mute ambient sound" }).click();
  await expect(page.getByRole("button", { name: "Enable ambient sound" })).toHaveAttribute("aria-pressed", "false");
});

test("reduced motion preserves content without the camera journey", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("[data-home-world]")).not.toHaveClass(/motion-ready/);
  await expect(page.getByRole("navigation", { name: "Journey chapters" })).toBeHidden();
  await page.getByRole("link", { name: "Enter the Rift" }).click();
  await expect(page).toHaveURL(/#signal-title$/);
  await expect(page.locator("#signal-title")).toBeInViewport();
});
