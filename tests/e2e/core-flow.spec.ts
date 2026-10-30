import { test, expect } from "@playwright/test";
import historicalPatch from "../../src/data/patches/26.16.json" with { type: "json" };

test("land → pick pool → see personalized patch → persists → share link", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.goto("/pool", { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/pool/);

  await expect(page.locator('body')).toHaveAttribute('data-journey-ready', 'true');
  await page.getByRole('tab', { name: 'Choose champions', exact: true }).click();
  await expect(page.locator('#edit-pool')).toBeVisible();

  // Select two champions.
  await expect(page.locator('astro-island:has(.pool-picker)')).not.toHaveAttribute('ssr', '');
  await page.getByRole("option", { name: "Ahri", exact: true }).click();
  await page.getByRole("option", { name: "Jinx", exact: true }).click();
  await expect(page.locator(".pool-bar .count")).toContainText("2");

  // Jump to the personalized patch.
  await page.locator(".pool-bar .cta").click();
  await expect(page).toHaveURL(/\/patch\/\d+\.\d+/);

  // Open the optional saved context. Both members remain recorded whether
  // they changed in the patch or not.
  await page.locator('#your-perspective > summary').click();
  // Pool strip renders both members (changed or UNCHANGED).
  const strip = page.locator(".pool-strip li");
  await expect(strip).toHaveCount(2);
  await expect(page.locator(".pool-strip")).toContainText("Ahri");
  await expect(page.locator(".pool-strip")).toContainText("Jinx");

  // Persistence across reload.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#your-perspective > summary').click();
  await expect(page.locator(".pool-strip li")).toHaveCount(2);

  // Shared ?champions= link works with no localStorage.
  const fresh = await browser.newContext({ baseURL });
  const cold = await fresh.newPage();
  await cold.goto("/patch/26.16?champions=azir", { waitUntil: 'domcontentloaded' });
  await cold.locator('#your-perspective > summary').click();
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
  await page.goto("/patch/26.16", { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.filter-bar')).toHaveAttribute('data-ready', 'true');
  await page.locator('.patch-filter-options > summary').click();
  await page.getByRole("button", { name: "Buffs" }).click();
  await expect(page).toHaveURL(/type=buff/);
  const visible = page.locator(".change-card[data-champion-id]:not([data-filtered])");
  const visibleIds = () => visible.evaluateAll((cards) =>
    cards.map((card) => card.getAttribute("data-champion-id")).sort(),
  );
  await expect.poll(visibleIds).toEqual(expectedBuffIds);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('.filter-bar')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.patch-filter-status')).toContainText('Buffs');
  await page.locator('.patch-filter-options > summary').click();
  await expect(page.getByRole("button", { name: "Buffs" })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(visibleIds).toEqual(expectedBuffIds);

  await page.goto("/patch/26.16?role=top", { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.patch-filter-status')).toContainText('Top');
  await page.locator('.patch-filter-options > summary').click();
  await expect(page.getByRole("button", { name: "Top", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("compare page shows aggregated span with net groups", async ({ page }) => {
  await page.goto("/compare/26.16/26.12", { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole("combobox", { name: "Newer", exact: true })).toHaveValue("26.16");
  await expect(page.getByRole("combobox", { name: "Older", exact: true })).toHaveValue("26.12");
  await expect(page.locator(".journey-context-line")).toContainText("After 26.12, through 26.16");
  await expect(page.getByRole("heading", { name: /Buffed/ })).toBeVisible();
  await expect(page.locator(".champ-rows li").first()).toBeVisible();
});

test("champion history selects exact records and links back to their patches", async ({ page }) => {
  await page.goto("/champion/camille", { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Camille");
  await expect(page.locator('body')).toHaveAttribute('data-journey-ready', 'true');
  const first = page.locator('[data-history-record]:not([hidden])');
  await expect(first).toHaveCount(1);
  await expect(first).toContainText("Cooldown");
  const patch = await first.getAttribute('data-history-record');
  const source = first.getByRole('link', { name: `Open in patch ${patch}` });
  await expect(source).toHaveAttribute('href', `/patch/${patch}#camille`);
  await source.click();
  await expect(page).toHaveURL(new RegExp(`/patch/${patch!.replace('.', '\\.')}#camille$`));
  await expect(page.locator('#camille')).toBeVisible();
});
