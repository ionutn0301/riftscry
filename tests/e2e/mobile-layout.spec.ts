import { test, expect, type Locator, type Page } from "@playwright/test";
import championData from "../../src/data/champions.json" with { type: "json" };
import roleData from "../../src/data/roles.json" with { type: "json" };

type Bounds = { x: number; y: number; width: number; height: number };

const champions = championData.champions as Record<string, { name: string; title: string }>;
const longChampion = Object.entries(champions).sort((a, b) => b[1].name.length - a[1].name.length)[0]!;

async function readyHome(page: Page) {
  await expect(page.locator("[data-voyage]")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("[data-voyage]")).toHaveAttribute("data-loading", "false");
  await page.evaluate(() => document.fonts.ready);
}

async function bounds(locator: Locator): Promise<Bounds> {
  const rect = await locator.boundingBox();
  expect(rect, "The control must have a rendered box").not.toBeNull();
  return rect!;
}

function overlaps(a: Bounds, b: Bounds) {
  return a.x < b.x + b.width - 1 && a.x + a.width > b.x + 1
    && a.y < b.y + b.height - 1 && a.y + a.height > b.y + 1;
}

async function expectUncovered(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  // Device-scale rounding can leave a fraction of a pixel outside the observer's
  // viewport even after native scrolling; the full touch target remains usable.
  await expect(locator).toBeInViewport({ ratio: 0.99 });
  await expect.poll(() => locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return hit === element || (hit !== null && element.contains(hit));
  }), { message: "The visible control must receive a tap without another surface covering it" }).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

for (const [width, height] of [[320, 568], [390, 844], [568, 320], [768, 1024], [844, 390], [1024, 768]] as const) {
  test(`home controls and all Rift map destinations fit ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await readyHome(page);

    const headerControls = page.locator(".world-brand, .world-utilities > a, [data-map-open], .world-utilities > [data-palette-trigger], [data-motion-toggle]");
    const controlBounds = await Promise.all((await headerControls.all()).map(bounds));
    for (let index = 0; index < controlBounds.length; index++) {
      const rect = controlBounds[index]!;
      expect(rect.x).toBeGreaterThanOrEqual(-1);
      expect(rect.x + rect.width).toBeLessThanOrEqual(width + 1);
      for (const other of controlBounds.slice(index + 1)) {
        expect(overlaps(rect, other), "Header controls must not overlap").toBe(false);
      }
    }

    const enterJourney = page.getByRole("link", { name: /Enter the journey/ });
    await expectUncovered(enterJourney);
    await enterJourney.click();
    await expect(page.locator("#perspective h2")).toBeFocused();
    const chooseChampion = page.locator("[data-roster-open]");
    await expectUncovered(chooseChampion);
    const chooseBounds = await bounds(chooseChampion);
    for (const label of await page.locator(".journey-coordinates .coordinate-label").all()) {
      expect(overlaps(await bounds(label), chooseBounds), "Chapter labels must not cover the champion action").toBe(false);
    }

    const chapters = page.getByRole("navigation", { name: "Journey chapters" });
    for (const link of await chapters.getByRole("link").all()) {
      expect((await bounds(link)).height).toBeGreaterThanOrEqual(44);
    }
    await chapters.getByRole("link", { name: "Witness a change", exact: true }).click();
    await expect(page.locator("#change h2")).toBeFocused();
    const fieldSizes = await page.locator("[data-field-choice], [data-period-older], [data-period-newer]").evaluateAll((fields) =>
      fields.map((field) => Number.parseFloat(getComputedStyle(field).fontSize)));
    expect(fieldSizes).toHaveLength(3);
    for (const size of fieldSizes) expect(size, "Mobile field controls must not trigger iOS text zoom").toBeGreaterThanOrEqual(16);

    // Astro islands use display:contents; attachment and the hydration attribute
    // establish readiness without waiting for the island itself to be visible.
    const paletteIsland = page.locator('astro-island[component-url*="CommandPalette"]');
    await paletteIsland.waitFor({ state: "attached" });
    await expect(paletteIsland).not.toHaveAttribute("ssr", "");
    const opener = page.locator("[data-map-open]");
    await opener.focus();
    const scrollBefore = await page.evaluate(() => scrollY);
    await opener.click();
    const map = page.locator("#rift-map-dialog");
    await expect(map).toBeVisible();
    const destinations = map.getByRole("navigation", { name: "RiftScry destinations" }).getByRole("link");
    await expect(destinations).toHaveCount(6);
    for (const destination of await destinations.all()) {
      await expect(destination).toBeInViewport({ ratio: 0.99 });
    }
    const scrollableRegions = await map.evaluate((dialog) => [dialog, ...dialog.querySelectorAll("*")]
      .filter((element) => /^(auto|scroll)$/.test(getComputedStyle(element).overflowY)
        && element.scrollHeight > element.clientHeight + 1).length);
    expect(scrollableRegions, "A fitting destination menu must not need scrolling").toBe(0);
    const closeMap = map.getByRole("button", { name: "Close the Rift map" });
    const searchMap = map.locator("[data-palette-trigger]");
    await expectUncovered(closeMap);
    await expectUncovered(searchMap);
    await closeMap.click();
    await expect(map).not.toBeVisible();
    await expect(opener).toBeFocused();
    expect(Math.abs(await page.evaluate(() => scrollY) - scrollBefore)).toBeLessThanOrEqual(1);

    await opener.click();
    await searchMap.click();
    await expect(map).not.toBeVisible();
    await expect(page.locator("[cmdk-input]")).toBeFocused();
    await page.getByRole("button", { name: "Close search", exact: true }).click();
    await expect(page.locator("[cmdk-input]")).not.toBeVisible();
    await expect(opener).toBeFocused();
    expect(Math.abs(await page.evaluate(() => scrollY) - scrollBefore)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
  });
}

for (const [width, height] of [[320, 568], [390, 844]] as const) {
  test(`champion selection has one usable scroll surface at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/#perspective", { waitUntil: "domcontentloaded" });
    await readyHome(page);
    const opener = page.locator("[data-roster-open]");
    await expectUncovered(opener);
    await opener.focus();
    await opener.click();
    const roster = page.locator("#voyage-roster");
    await expect(roster).toBeVisible();
    await expect(roster.locator("[data-choose-champion]")).toHaveCount(Object.keys(champions).length);
    const search = roster.getByRole("searchbox", { name: "Find a champion" });
    await expect(search).toBeFocused();
    expect(await search.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
    const scrollRegions = await roster.evaluate((dialog) => {
      const regions = [dialog, ...dialog.querySelectorAll("*")].filter((element) =>
        /^(auto|scroll)$/.test(getComputedStyle(element).overflowY) && element.scrollHeight > element.clientHeight + 1);
      for (const element of regions) element.scrollTop = element.scrollHeight;
      return regions.length;
    });
    expect(scrollRegions).toBe(1);
    const close = roster.getByRole("button", { name: "Close champion selection" });
    await expectUncovered(close);
    await close.click();
    await expect(roster).not.toBeVisible();
    await expect(opener).toBeFocused();

    await opener.click();
    await expect(search).toBeFocused();
    const scrollPositions = await roster.evaluate((dialog) => [dialog, ...dialog.querySelectorAll("*")]
      .filter((element) => /^(auto|scroll)$/.test(getComputedStyle(element).overflowY)
        && element.scrollHeight > element.clientHeight + 1).map((element) => element.scrollTop));
    expect(scrollPositions).toEqual([0]);
    await search.fill("Azir");
    await expect(roster.locator("[data-choose-champion]")).toHaveCount(1);
    await roster.locator('[data-choose-champion="Azir"]').click();
    await expect(roster).not.toBeVisible();
    await readyHome(page);
    await expect(page.locator("[data-champion-name]")).toHaveText(champions.Azir!.name);
    await expect(page.locator("#perspective h2")).toBeFocused();
    await expect(page).toHaveURL((url) => url.searchParams.get("champion") === "Azir");
  });
}

test("all five pool roles fit a 320px screen and Support filters usable choices", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/pool", { waitUntil: "domcontentloaded" });
  const island = page.locator("astro-island:has(.pool-picker)");
  await island.waitFor({ state: "attached" });
  await expect(island).not.toHaveAttribute("ssr", "");
  await page.evaluate(() => document.fonts.ready);
  const roles = page.locator(".pool-picker").getByRole("group", { name: "Role", exact: true });
  await roles.scrollIntoViewIfNeeded();
  const group = await bounds(roles);
  const buttons = roles.getByRole("button");
  await expect(buttons).toHaveCount(5);
  for (const button of await buttons.all()) {
    const rect = await bounds(button);
    expect(rect.x).toBeGreaterThanOrEqual(Math.max(0, group.x) - 1);
    expect(rect.x + rect.width).toBeLessThanOrEqual(Math.min(320, group.x + group.width) + 1);
    expect(rect.y).toBeGreaterThanOrEqual(group.y - 1);
    expect(rect.y + rect.height).toBeLessThanOrEqual(group.y + group.height + 1);
    expect(rect.height).toBeGreaterThanOrEqual(44);
  }
  const support = roles.getByRole("button", { name: "Support", exact: true });
  await expectUncovered(support);
  await support.click();
  await expect(support).toHaveAttribute("aria-pressed", "true");
  const expectedSupportNames = Object.entries(roleData)
    .filter(([, values]) => Array.isArray(values) && values.includes("support"))
    .map(([id]) => champions[id]!.name).sort();
  const choices = page.getByRole("listbox", { name: "Champions" }).getByRole("option");
  await expect.poll(() => choices.evaluateAll((options) => options.map((option) => option.textContent!.trim()).sort()))
    .toEqual(expectedSupportNames);
  await choices.first().click();
  await expect(choices.first()).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".pool-bar .count")).toContainText("1 champion");
});

for (const [width, height] of [[320, 568], [390, 844]] as const) {
  test(`a long champion name leaves hero actions clear at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const [championId, champion] = longChampion;
    await page.goto(`/champion/${championId.toLowerCase()}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("#main h1")).toHaveText(champion.name);
    await expect(page.locator("html")).toHaveClass(/experience-ready/);
    await page.evaluate(() => document.fonts.ready);

    const expectClearActions = async () => {
      const art = await bounds(page.locator(".champion-arrival-art"));
      const actions = await page.locator(".route-arrival-actions a, .route-arrival-actions button").all();
      const rectangles = await Promise.all(actions.map(bounds));
      for (let index = 0; index < rectangles.length; index++) {
        const rect = rectangles[index]!;
        expect(rect.x).toBeGreaterThanOrEqual(-1);
        expect(rect.x + rect.width).toBeLessThanOrEqual(width + 1);
        expect(overlaps(rect, art), "Champion artwork must not overlap hero actions").toBe(false);
        for (const other of rectangles.slice(index + 1)) {
          expect(overlaps(rect, other), "Wrapped hero actions must not overlap each other").toBe(false);
        }
      }
    };
    await expectClearActions();
    const save = page.locator(`[data-direct-save="${championId}"]`);
    await expectUncovered(save);
    await save.click();
    await expect(save).toHaveAttribute("aria-pressed", "true");
    await expectClearActions();
    await page.locator('.route-arrival-actions a[href="#history"]').click();
    await expect(page.locator("#history h2")).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
  });
}

test("the short desktop opening keeps the scroll invitation clear of the Rift map", async ({ page, isMobile }) => {
  test.skip(isMobile, "Touch devices use the compact header at this width.");
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await readyHome(page);
  const invitation = page.locator(".arrival-footer .chapter-invitation");
  await expectUncovered(invitation);
  expect(overlaps(await bounds(invitation), await bounds(page.locator(".wayfinder-dock"))))
    .toBe(false);
  await invitation.click();
  await expect(page.locator("#perspective h2")).toBeFocused();
});
