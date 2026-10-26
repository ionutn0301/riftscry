import { test, expect } from "@playwright/test";
const ready = async (page: import("@playwright/test").Page, path = "/") => {
  await page.goto(path);
  await expect(
    page.locator("astro-island:has(.incision-experience)"),
  ).not.toHaveAttribute("ssr", "");
};
test("branches, source values, browser history, and pool persistence", async ({
  page,
}) => {
  await ready(page);
  await page
    .locator(".champion-branches")
    .getByRole("button", { name: /Explore Camille/ })
    .click();
  await page.getByRole("button", { name: "Reveal this change" }).click();
  await expect(page.locator(".record-values")).toContainText(
    "15 / 14 / 13 / 12 / 11s",
  );
  await expect(page.locator(".record-values")).toContainText(
    "12 / 11.5 / 11 / 10.5 / 10s",
  );
  await page.locator('[data-change="W-1"]').click();
  await expect(page.locator(".record-difference")).toContainText(
    "+1 percentage point",
  );
  await page.goBack();
  await expect(page).toHaveURL(/change=W-0/);
  await page.goForward();
  await expect(page).toHaveURL(/change=W-1/);
  await page.getByRole("button", { name: "Add to My Pool" }).click();
  await expect(page.locator(".collection-rail .saved-identity")).toContainText(
    "Camille",
  );
  await page.reload();
  await expect(page.locator(".collection-rail .saved-identity")).toContainText(
    "Camille",
  );
  await page
    .locator(".champion-branches")
    .getByRole("button", { name: /Explore Azir/ })
    .click();
  await expect(page).toHaveURL(/champion=Azir/);
  await page.getByRole("button", { name: "Back to patch" }).click();
  await expect(page.locator(".champion-branches")).toContainText(
    "Last explored",
  );
  await page
    .locator(".incision-header nav")
    .getByRole("button", { name: /My Pool/ })
    .click();
  await expect(page.locator(".pool-identities li")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Remove Camille from My Pool" })
    .click();
  await expect(page.locator(".pool-empty")).toBeVisible();
});
test("direct link and reduced motion preserve complete level context", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page, "/?champion=Camille&change=passive-1&view=record");
  await expect(page.locator(".record-values")).toContainText(
    "18 / 14 / 10 / 6s (levels 1 / 7 / 13 / 19)",
  );
  await expect(page.locator(".record-context-note")).toContainText(
    "not subtracted rank-for-rank",
  );
  expect(
    await page
      .locator(".incision-record")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await page.locator('[data-change="base-0"]').click();
  await expect(page.locator(".record-difference")).toContainText(
    "+36 base mana",
  );
});
test("interrupting a reveal retargets without queuing old scenes", async ({
  page,
}) => {
  await ready(page, "/?champion=Camille");
  await page.getByRole("button", { name: "Reveal this change" }).click();
  await page
    .locator(".champion-branches")
    .getByRole("button", { name: /Explore Azir/ })
    .click();
  await expect(page.locator(".incision-experience")).toHaveAttribute(
    "data-champion",
    "Azir",
  );
  await expect(
    page.getByRole("button", { name: "Reveal this change" }),
  ).toBeVisible();
  await expect(page.locator(".incision-record")).toHaveCount(0);
});
test("existing direct utility routes remain available", async ({ page }) => {
  for (const path of [
    "/champions",
    "/champion/azir",
    "/patch/26.16",
    "/compare/26.15/26.16",
    "/pool",
  ]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator(".incision-experience")).toHaveCount(0);
  }
});
