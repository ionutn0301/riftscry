import { test, expect, type Page } from "@playwright/test";

const ready = async (page: Page) => {
  await expect(page.locator("[data-voyage]")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("[data-voyage]")).toHaveAttribute("data-loading", "false");
};

test.describe("keyboard-only exploration", () => {
  test.skip(({ isMobile }) => isMobile, "Keyboard on desktop; touch uses the shared voyage cases.");

  test("skip link targets content", async ({ page }) => {
    await page.goto("/patch/26.16");
    await page.keyboard.press("Tab");
    await expect(page.locator(".skip-link")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main/);
  });

  test("choose, inspect, save and open a history without a pointer", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/explore?champion=Belveth&older=26.15&newer=26.16#perspective");
    await ready(page);
    const opener = page.locator("[data-roster-open]");
    await opener.focus();
    await page.keyboard.press("Enter");
    const search = page.locator("[data-roster-query]");
    await expect(search).toBeFocused();
    await search.fill("Azir");
    const champion = page.locator('[data-roster-results] [data-choose-champion="Azir"]');
    await expect(champion).toBeVisible();
    await champion.focus();
    await page.keyboard.press("Enter");
    await ready(page);
    await expect(page.locator("#voyage-roster")).not.toBeVisible();
    await expect(page.locator("#perspective h2")).toBeFocused();
    await expect(page.locator("[data-champion-name]")).toHaveText("Azir");

    await page.locator('[aria-label="Journey chapters"] a[href="#change"]').focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#change h2")).toBeFocused();
    await expect(page.locator("[data-record-after]")).toHaveText("75 / 95 / 115 / 135 / 155 (+35 / 40 / 45 / 50 / 55% AP)");
    await page.locator("[data-focus-record]").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-focus-record]")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("[data-journey-findings]")).toContainText("Azir / Damage");
    await expect(page.locator("[data-record-source]")).toHaveAttribute("href", /league-of-legends-patch-26-16-notes/);

    const save = page.locator("[data-save-champion]").first();
    await save.focus();
    await page.keyboard.press("Space");
    await expect(save).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("[data-world-pool-count]")).toHaveText("1");
    await page.locator("[data-champion-link]").focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/champion\/azir\/?$/);
    await expect(page.locator("#main h1")).toHaveText("Azir");
    await expect(page.locator(".timeline-entry").first()).toContainText("Conquering Sands");
  });

  test("roster Escape restores the opener and the map keeps native focus", async ({ page }) => {
    await page.goto("/explore");
    await ready(page);
    const rosterOpener = page.locator("[data-roster-open]");
    await rosterOpener.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-roster-query]")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(rosterOpener).toBeFocused();
    const mapOpener = page.locator("[data-map-open]");
    await mapOpener.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator('#rift-map-dialog [aria-current="page"]')).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(mapOpener).toBeFocused();
    // A single letter stays available to assistive input; the labeled shortcut
    // opens the map without a pointer, including Option+M on macOS.
    await expect(mapOpener).toHaveAttribute("aria-keyshortcuts", "Alt+M");
    await expect(mapOpener.locator("kbd")).toHaveText("Alt M");
    await expect(mapOpener.locator("kbd")).toHaveAttribute("title", "Alt+M / Option+M");
    await page.keyboard.press("m");
    await expect(page.locator("#rift-map-dialog")).not.toBeVisible();
    await page.keyboard.press("Alt+KeyM");
    await expect(page.locator("#rift-map-dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(mapOpener).toBeFocused();

    // The shortcut must leave conventional form input alone.
    await page.locator("[data-period-older]").focus();
    await page.keyboard.press("Alt+KeyM");
    await expect(page.locator("#rift-map-dialog")).not.toBeVisible();
    await expect(page.locator("[data-period-older]")).toBeFocused();
  });

  test("map-to-search handoff closes the native dialog before opening the palette", async ({ page }) => {
    await page.goto("/explore");
    await ready(page);
    await expect(page.locator('astro-island[component-url*="CommandPalette"]')).not.toHaveAttribute("ssr", "");
    await page.locator("[data-map-open]").focus();
    await page.keyboard.press("Enter");
    await page.locator("#rift-map-dialog [data-palette-trigger]").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#rift-map-dialog")).not.toBeVisible();
    await expect(page.locator("[cmdk-input]")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.locator("[cmdk-input]")).not.toBeVisible();
    await page.keyboard.press("Control+k");
    await expect(page.locator("[cmdk-input]")).toBeFocused();
    await page.locator("[cmdk-input]").fill("Camille");
    await expect(page.locator('[cmdk-item]:has(.item-label:text-is("Camille"))')).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/champion\/camille\/?$/);
    await expect(page.locator("#main h1")).toHaveText("Camille");
  });
});
