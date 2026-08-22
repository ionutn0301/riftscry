import { test, expect } from "@playwright/test";
import { readdirSync } from "node:fs";

test.use({ contextOptions: { reducedMotion: "reduce" } });

// Latest patch id from the committed data so data PRs do not stale this suite.
function latestPatchId(): string {
  return readdirSync("src/data/patches")
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.replace(/\.json$/, ""))
    .sort((a, b) => {
      const [am = 0, an = 0] = a.split(".").map(Number);
      const [bm = 0, bn = 0] = b.split(".").map(Number);
      return bm - am || bn - an;
    })[0]!;
}

test("reduced motion: full journey is readable without camera travel", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
  await expect(page.locator("[data-version-current]")).toContainText(latestPatchId());

  for (const heading of [
    /Something changed/,
    /Only your champions survive the cut/,
    /Before becomes after/,
    /Every patch leaves a trace/,
    /See the source/,
  ]) {
    const element = page.getByRole("heading", { name: heading }).first();
    await element.scrollIntoViewIfNeeded();
    await expect(element).toBeVisible();
  }

  const closing = page.getByText("Queue informed.", { exact: true });
  await closing.scrollIntoViewIfNeeded();
  await expect(closing).toBeVisible();
});
