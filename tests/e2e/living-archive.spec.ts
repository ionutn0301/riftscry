import { test, expect } from "@playwright/test";

test("selection, source-backed reveal, URL restoration and pool persistence", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".archive-explorer")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page
    .getByRole("link", { name: "Explore the archive", exact: true })
    .click();
  await page.getByLabel("Search the champion index").fill("Camille");
  await page.getByRole("button", { name: "Camille", exact: true }).click();
  await expect(page.locator(".focus-identity h3")).toHaveText("Camille");
  await expect(page).toHaveURL(/champion=camille/);
  await page.getByRole("button", { name: "Azir", exact: true }).click();
  await page.goBack();
  await expect(page.locator(".focus-identity h3")).toHaveText("Camille");
  await page.getByRole("button", { name: "Azir", exact: true }).click();
  await page.getByRole("link", { name: "04 Compare" }).click();
  await page.getByRole("button", { name: "Bring changes into focus" }).click();
  await expect(page.locator("#aligned-records")).toContainText(
    "75 / 95 / 115 / 135 / 155",
  );
  await expect(
    page.locator("#aligned-records a.record-source"),
  ).toHaveAttribute("href", /leagueoflegends.com/);
  await page.getByRole("link", { name: "02 Focus" }).click();
  await page
    .getByRole("button", { name: "+ Add to pool", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "✓ In your pool", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("reduced motion, portrait layout, keyboard and renderer-independent content", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".archive-explorer")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await expect(
    page.getByRole("button", { name: "Motion off" }),
  ).toHaveAttribute("aria-pressed", "false");
  expect(await page.locator("canvas").count()).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "04 Compare" }).click();
  await page.locator("#archive-from").focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Tab");
  await page.getByRole("button", { name: "Bring changes into focus" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#aligned-records")).toBeVisible();
  await page.getByRole("link", { name: "01 Arrival" }).click();
  await page.getByRole("button", { name: "Open search" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
