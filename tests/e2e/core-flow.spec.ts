import { test, expect } from "@playwright/test";

test("land → pick pool → see personalized patch → persists → share link", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Your main got nerfed");

  // CTA to the pool picker.
  await page.getByRole("link", { name: "Pick your champions" }).click();
  await expect(page).toHaveURL(/\/pool/);

  // Select two champions.
  await page.getByRole("option", { name: "Ahri", exact: true }).click();
  await page.getByRole("option", { name: "Jinx", exact: true }).click();
  await expect(page.locator(".pool-bar .count")).toContainText("2");

  // Jump to the personalized patch.
  await page.locator(".pool-bar .cta").click();
  await expect(page).toHaveURL(/\/patch\/\d+\.\d+/);

  // Pool strip renders both members (changed or UNCHANGED).
  const strip = page.locator(".pool-strip li");
  await expect(strip).toHaveCount(2);
  await expect(page.locator(".pool-strip")).toContainText("Ahri");
  await expect(page.locator(".pool-strip")).toContainText("Jinx");

  // Persistence across reload.
  await page.reload();
  await expect(page.locator(".pool-strip li")).toHaveCount(2);

  // Shared ?champions= link works with no localStorage.
  const fresh = await browser.newContext();
  const cold = await fresh.newPage();
  await cold.goto("/patch/26.16?champions=azir");
  await expect(cold.locator(".pool-strip li")).toHaveCount(1);
  await expect(cold.locator(".pool-strip")).toContainText("Azir");
  await fresh.close();
});

test("patch filters sync to the URL and restore from it", async ({ page }) => {
  await page.goto("/patch/26.16");
  await page.getByRole("button", { name: "Buffs" }).click();
  await expect(page).toHaveURL(/type=buff/);
  const visible = page.locator("[data-champion-id]:not([data-filtered])");
  await expect(visible).toHaveCount(3); // 26.16 has exactly 3 champion buffs

  await page.goto("/patch/26.16?role=top");
  await expect(page.getByRole("button", { name: "Top", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("compare page shows aggregated span with net groups", async ({ page }) => {
  await page.goto("/compare/26.16/26.12");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("26.16");
  await expect(page.getByRole("heading", { name: /Buffed/ })).toBeVisible();
  await expect(page.locator(".champ-rows li").first()).toBeVisible();
});

test("champion history timeline renders and links back to patches", async ({ page }) => {
  await page.goto("/champion/camille");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Camille");
  const first = page.locator(".timeline-entry").first();
  await expect(first.locator("details")).toHaveAttribute("open", "");
  await expect(first).toContainText("Cooldown");
});
