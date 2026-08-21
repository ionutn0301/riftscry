import { test, expect } from "@playwright/test";

test.use({ contextOptions: { reducedMotion: "reduce" } });

test("reduced motion: full content readable, no pinned scrubbing", async ({ page }) => {
  await page.goto("/");
  // No ScrollTrigger pin spacers in the DOM.
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
  // The patch number shows its final state.
  await expect(page.locator("[data-hero-number]")).toContainText("26.16");
  // All eight scene headings reachable by plain scrolling.
  for (const heading of [
    /Your main got nerfed/,
    /You don't play every champion/,
    /champions\./,
    /See the delta/,
    /Git history/,
    /Your lane felt it too/,
    /open source/,
    /Queue informed/,
  ]) {
    const h = page.getByRole("heading", { name: heading }).first();
    await h.scrollIntoViewIfNeeded();
    await expect(h).toBeVisible();
  }
});
