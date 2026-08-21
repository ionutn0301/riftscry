import { test, expect } from "@playwright/test";
import { readdirSync } from "node:fs";

test.use({ contextOptions: { reducedMotion: "reduce" } });

// Latest patch id from the committed data — never hardcode it, or every
// automated data PR would fail this suite.
function latestPatchId(): string {
  return readdirSync("src/data/patches")
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort((a, b) => {
      const [am = 0, an = 0] = a.split(".").map(Number);
      const [bm = 0, bn = 0] = b.split(".").map(Number);
      return bm - am || bn - an;
    })[0]!;
}

test("reduced motion: full content readable, no pinned scrubbing", async ({ page }) => {
  await page.goto("/");
  // No ScrollTrigger pin spacers in the DOM.
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
  // The patch number shows its final state.
  await expect(page.locator("[data-hero-number]")).toContainText(latestPatchId());
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
