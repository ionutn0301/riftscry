import { test, expect, type Locator, type Page } from "@playwright/test";
import { openScene, readyWorld, stationaryWorld } from "./journey-test-helpers";
import championData from "../../src/data/champions.json" with { type: "json" };
import roleData from "../../src/data/roles.json" with { type: "json" };

type Bounds = { x: number; y: number; width: number; height: number };

const champions = championData.champions as Record<string, { name: string; title: string }>;
const longChampion = Object.entries(champions).sort((a, b) => b[1].name.length - a[1].name.length)[0]!;

async function readyJourney(page: Page) {
  await readyWorld(page);
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

async function readyJourneyMap(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  // Preserve the selected scene and its real reading-panel position through overlays.
  await page.goto("/explore#change", { waitUntil: "domcontentloaded" });
  await readyJourney(page);
  // Astro islands use display:contents; attachment and the hydration attribute
  // establish readiness without waiting for the island itself to be visible.
  const paletteIsland = page.locator('astro-island[component-url*="CommandPalette"]');
  await paletteIsland.waitFor({ state: "attached" });
  await expect(paletteIsland).not.toHaveAttribute("ssr", "");
  const opener = page.locator("[data-map-open]");
  await opener.focus();
  await expectUncovered(opener);
  const scrollBefore = await page.evaluate(() => scrollY);
  await stationaryWorld(page);
  const reading = page.locator('.voyage-evidence-desk');
  const panelScroll = await reading.evaluate(element => element.scrollTop);
  expect(panelScroll).toBe(0);
  return { opener, scrollBefore, reading, panelScroll };
}

for (const [width, height] of [[320, 568], [390, 844], [568, 320], [768, 1024], [844, 390], [1024, 768]] as const) {
  test(`journey controls and chapter navigation fit ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/explore", { waitUntil: "domcontentloaded" });
    await readyJourney(page);

    const headerControls = page.locator(".world-brand:visible, .world-utilities > a:visible, [data-map-open]:visible, .world-utilities > [data-palette-trigger]:visible, [data-motion-toggle]:visible");
    const controlBounds = await Promise.all((await headerControls.all()).map(bounds));
    for (let index = 0; index < controlBounds.length; index++) {
      const rect = controlBounds[index]!;
      expect(rect.x).toBeGreaterThanOrEqual(-1);
      expect(rect.x + rect.width).toBeLessThanOrEqual(width + 1);
      for (const other of controlBounds.slice(index + 1)) {
        expect(overlaps(rect, other), "Header controls must not overlap").toBe(false);
      }
    }

    const chooseChampion = page.locator("[data-roster-open]");
    await expectUncovered(chooseChampion);
    expect((await bounds(chooseChampion)).height).toBeGreaterThanOrEqual(44);
    const chapters = page.locator('[data-journey-tabs]');
    for (const button of await chapters.getByRole('tab').all()) expect((await bounds(button)).height).toBeGreaterThanOrEqual(44);
    await openScene(page, 'history');
    for (const field of await page.locator('[data-period-older], [data-period-newer]').all()) await expectUncovered(field);
    await openScene(page, 'change');
    const fieldSizes = await page.locator("[data-field-choice], [data-period-older], [data-period-newer]").evaluateAll((fields) =>
      fields.map((field) => Number.parseFloat(getComputedStyle(field).fontSize)));
    expect(fieldSizes).toHaveLength(3);
    for (const size of fieldSizes) expect(size, "Mobile field controls must not trigger iOS text zoom").toBeGreaterThanOrEqual(16);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
  });

  test(`all five primary and three specialist destinations are reachable and close restores the journey at ${width}×${height}`, async ({ page }) => {
    const { opener, scrollBefore, reading, panelScroll } = await readyJourneyMap(page, width, height);
    await opener.click();
    const map = page.locator("#rift-map-dialog");
    await expect(map).toBeVisible();
    const destinations = map.locator("[data-world-link], .journey-map-footer a");
    await expect(destinations).toHaveCount(8);
    for (const destination of await destinations.all()) {
      await expectUncovered(destination);
    }
    const scrollableRegions = await map.evaluate((dialog) => [dialog, ...dialog.querySelectorAll("*")]
      .filter((element) => /^(auto|scroll)$/.test(getComputedStyle(element).overflowY)
        && element.scrollHeight > element.clientHeight + 1)
      .map(element => element.className));
    // Only the outer dialog may scroll on short screens. Its destination
    // instrument must never create a second scroll surface inside it.
    expect(scrollableRegions.length).toBeLessThanOrEqual(1);
    if (scrollableRegions.length) expect(scrollableRegions[0]).toContain('journey-map');
    const closeMap = map.getByRole("button", { name: "Close the Rift map" });
    const searchMap = map.locator("[data-palette-trigger]");
    await expectUncovered(closeMap);
    await expectUncovered(searchMap);
    await closeMap.click();
    await expect(map).not.toBeVisible();
    await expect(opener).toBeFocused();
    await expect.poll(async () => Math.abs(await page.evaluate(() => scrollY) - scrollBefore)).toBeLessThanOrEqual(1);
    expect(await reading.evaluate(element => element.scrollTop)).toBe(panelScroll);
    await expect(page.locator("#change")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
  });

  test(`Rift map reopens into search and restores focus and scroll at ${width}×${height}`, async ({ page }) => {
    const { opener, scrollBefore, reading, panelScroll } = await readyJourneyMap(page, width, height);
    const map = page.locator("#rift-map-dialog");
    const searchMap = map.locator("[data-palette-trigger]");
    await opener.click();
    await expect(map).toBeVisible();
    // Keep the original close → reopen → search lifecycle in one story.
    await map.getByRole("button", { name: "Close the Rift map" }).click();
    await expect(map).not.toBeVisible();
    await expect(opener).toBeFocused();
    await expect.poll(async () => Math.abs(await page.evaluate(() => scrollY) - scrollBefore)).toBeLessThanOrEqual(1);
    expect(await reading.evaluate(element => element.scrollTop)).toBe(panelScroll);
    await expect(page.locator("#change")).toBeVisible();
    await opener.click();
    await expect(map).toBeVisible();
    await searchMap.click();
    await expect(map).not.toBeVisible();
    await expect(page.locator("[cmdk-input]")).toBeFocused();
    await page.getByRole("button", { name: "Close search", exact: true }).click();
    await expect(page.locator("[cmdk-input]")).not.toBeVisible();
    await expect(opener).toBeFocused();
    await expect.poll(async () => Math.abs(await page.evaluate(() => scrollY) - scrollBefore)).toBeLessThanOrEqual(1);
    expect(await reading.evaluate(element => element.scrollTop)).toBe(panelScroll);
    await expect(page.locator("#change")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
  });
}

for (const [width, height] of [[320, 568], [390, 844]] as const) {
  test(`champion selection is searchable without an internal scroll surface at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/explore#perspective", { waitUntil: "domcontentloaded" });
    await readyJourney(page);
    const opener = page.locator("[data-roster-open]");
    await expectUncovered(opener);
    await opener.focus();
    await opener.click();
    const roster = page.locator("#voyage-roster");
    await expect(roster).toBeVisible();
    await expect.poll(() => roster.locator("[data-choose-champion]").count()).toBeGreaterThan(0);
    expect(await roster.locator("[data-choose-champion]").count()).toBeLessThanOrEqual(12);
    const search = roster.getByRole("searchbox", { name: "Find a champion" });
    await expect(search).toBeFocused();
    expect(await search.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
    const scrollRegions = await roster.evaluate((dialog) => {
      const regions = [dialog, ...dialog.querySelectorAll("*")].filter((element) =>
        /^(auto|scroll)$/.test(getComputedStyle(element).overflowY) && element.scrollHeight > element.clientHeight + 1);
      return regions.length;
    });
    expect(scrollRegions).toBe(0);
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
    expect(scrollPositions).toEqual([]);
    await search.fill("Azir");
    await expect(roster.locator("[data-choose-champion]")).toHaveCount(1);
    const scrollBeforeSelection = await page.evaluate(() => scrollY);
    await roster.locator('[data-choose-champion="Azir"]').click();
    await expect(roster).not.toBeVisible();
    await readyJourney(page);
    await expect(page.locator("[data-champion-name]")).toHaveText(champions.Azir!.name);
    await expect(opener).toBeFocused();
    expect(Math.abs(await page.evaluate(() => scrollY) - scrollBeforeSelection)).toBeLessThanOrEqual(1);
    await expect(page).toHaveURL((url) => url.searchParams.get("champion") === "Azir");
  });
}

test("all five pool roles fit a 320px screen and Support filters usable choices", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/pool#edit-pool", { waitUntil: "domcontentloaded" });
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
    await expect(page.locator("#main h1")).toContainText(champion.name);
    await expect(page.locator("html")).toHaveClass(/experience-ready/);
    await page.evaluate(() => document.fonts.ready);

    const expectClearActions = async () => {
      const art = await bounds(page.locator(".journey-champion-art"));
      const actions = await page.locator(".journey-header-actions a, .journey-header-actions button").all();
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
    await page.locator('[data-journey-tab="perspective"]').click();
    await page.locator('[data-journey-tab="history"]').click();
    await expect(page.locator("#history")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
  });
}

test("the short desktop keeps the next-scene action clear of the main navigation", async ({ page, isMobile }) => {
  test.skip(isMobile, "Touch layouts are covered at their own viewport sizes.");
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/explore"); await readyJourney(page);
  const next = page.locator('[data-journey-next]');
  await expectUncovered(next);
  const navigation = page.getByRole('navigation', { name: 'Main navigation', exact: true });
  await expect(navigation).toBeInViewport({ ratio: 1 });
  expect(overlaps(await bounds(next), await bounds(navigation))).toBe(false);
  await next.click();
  await expect(page.locator('#history')).toBeVisible();
  await expect(page.locator('#history')).toBeFocused();
});

test('map and search return to the same scrolled archive record', async ({ page }) => {
  await page.goto('/patches');
  await readyWorld(page);
  await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'instant' }));
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
  const before = await page.evaluate(() => scrollY);
  const opener = page.locator('[data-map-open]');
  // Keyboard activation exercises a visible sticky control without the test
  // driver first scrolling it to its original document position.
  await opener.evaluate(element => (element as HTMLElement).focus({ preventScroll: true }));
  await page.keyboard.press('Enter');
  const map = page.locator('#rift-map-dialog');
  await expect(map).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(map).toBeHidden();
  await expect(opener).toBeFocused();
  await expect.poll(async () => Math.abs(await page.evaluate(() => scrollY) - before)).toBeLessThanOrEqual(1);
  await page.keyboard.press('Enter');
  await expect(map).toBeVisible();
  await map.locator('[data-palette-trigger]').click();
  await expect(page.locator('[cmdk-input]')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('[cmdk-input]')).toBeHidden();
  await expect(opener).toBeFocused();
  await expect.poll(async () => Math.abs(await page.evaluate(() => scrollY) - before)).toBeLessThanOrEqual(1);
});
