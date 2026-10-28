import { test, expect } from "@playwright/test";
import historicalPatch from "../../src/data/patches/26.16.json" with { type: "json" };

test("land → pick pool → see personalized patch → persists → share link", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.goto("/pool");
  await expect(page).toHaveURL(/\/pool/);

  // Select two champions.
  await expect(page.locator('astro-island:has(.pool-picker)')).not.toHaveAttribute('ssr', '');
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
  const fresh = await browser.newContext({ baseURL });
  const cold = await fresh.newPage();
  await cold.goto("/patch/26.16?champions=azir");
  await expect(cold.locator(".pool-strip li")).toHaveCount(1);
  await expect(cold.locator(".pool-strip")).toContainText("Azir");
  await fresh.close();
});

test("patch filters sync to the URL and restore from it", async ({ page }) => {
  // Filter champion-level classifications, not individual ability directions.
  const expectedBuffIds = historicalPatch.champions
    .filter((champion) => champion.classification === "buff")
    .map((champion) => champion.championId.toLowerCase())
    .sort();
  expect(expectedBuffIds.length).toBeGreaterThan(0);
  await page.goto("/patch/26.16");
  await expect(page.locator('.filter-bar')).toHaveAttribute('data-ready', 'true');
  await page.getByRole("button", { name: "Buffs" }).click();
  await expect(page).toHaveURL(/type=buff/);
  const visible = page.locator(".change-card[data-champion-id]:not([data-filtered])");
  const visibleIds = () => visible.evaluateAll((cards) =>
    cards.map((card) => card.getAttribute("data-champion-id")).sort(),
  );
  await expect.poll(visibleIds).toEqual(expectedBuffIds);

  await page.reload();
  await expect(page.locator('.filter-bar')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole("button", { name: "Buffs" })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(visibleIds).toEqual(expectedBuffIds);

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
