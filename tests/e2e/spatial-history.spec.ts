import { test, expect, type Page } from "@playwright/test";

// The filename is retained, but the viewport-only investigation is gone. These
// cases now protect the current journey's URL, recovery and motion contracts.
const ready = async (page: Page) => {
  await expect(page.locator("[data-voyage]")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("[data-voyage]")).toHaveAttribute("data-loading", "false");
};

test("missing champion artwork keeps exact records and real route navigation", async ({ page }) => {
  await page.route("**/cdn/img/champion/**", (route) => route.abort());
  await page.goto("/?champion=Belveth&older=26.15&newer=26.16#perspective");
  await ready(page);
  await expect(page.locator("[data-art-fallback]")).toBeVisible();
  await expect(page.locator("[data-art-fallback]")).toContainText("records remain available");
  await expect(page.locator("[data-record-before]")).toHaveText("110");
  await expect(page.locator("[data-record-after]")).toHaveText("105");
  await page.locator("[data-champion-link]").click();
  await expect(page).toHaveURL(/\/champion\/belveth\/?$/);
  await expect(page.locator("#main h1")).toHaveText("Bel'Veth");
  await expect(page.locator(".timeline-entry").first()).toContainText("Health Growth");
});

test("a lowercase champion deep link resolves exact evidence and reloads", async ({ page }) => {
  const path = "/?champion=azir&older=26.15&newer=26.16#change";
  await page.goto(path);
  await ready(page);
  await expect(page.locator("[data-champion-name]")).toHaveText("Azir");
  await expect(page.locator("[data-record-after]")).toHaveText("75 / 95 / 115 / 135 / 155 (+35 / 40 / 45 / 50 / 55% AP)");
  await expect(page.locator("[data-period-older]")).toHaveValue("26.15");
  await expect(page.locator("[data-period-newer]")).toHaveValue("26.16");
  await page.reload();
  await ready(page);
  await expect(page.locator("[data-record-patch]")).toHaveText("PATCH 26.16");
  await expect(page.locator("[data-record-source]")).toHaveAttribute("href", /league-of-legends-patch-26-16-notes/);
});

test("a display name with a different canonical ID resolves without substituting a champion", async ({ page }) => {
  await page.goto("/?champion=Wukong#perspective");
  await ready(page);
  await expect(page.locator("[data-champion-name]")).toHaveText("Wukong");
  await expect(page.locator("[data-champion-link]")).toHaveAttribute("href", "/champion/monkeyking");
  await expect(page.locator("[data-selection-status]")).toContainText("Following Wukong");
  await page.locator("[data-save-champion]").first().click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("riftscry:pool") ?? "[]"))).toContain("MonkeyKing");
});

test("legacy patch and kept-finding URLs restore only records from the chosen interval", async ({ page }) => {
  const response = await page.request.get("/journey/Belveth.json");
  expect(response.ok()).toBe(true);
  const model = await response.json() as { older: string; newer: string; selectedId: string };
  const params = new URLSearchParams({ champion: "Belveth", older: model.older, patch: model.newer, event: model.selectedId, seen: model.selectedId + "|forged-record", beat: "ending" });
  await page.goto("/?" + params.toString());
  await ready(page);
  await expect(page.locator("[data-period-newer]")).toHaveValue(model.newer);
  await expect(page.locator("[data-findings-list] li")).toHaveCount(1);
  await expect(page.locator("[data-focus-record]")).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await ready(page);
  await expect(page.locator("[data-findings-list] li")).toHaveCount(1);
  await page.locator("[data-focus-record]").click();
  await expect(page.locator("[data-journey-findings]")).not.toBeVisible();
  await expect(page).toHaveURL((url) => !url.searchParams.has("seen") && url.searchParams.get("newer") === model.newer);
});

test("unknown champions and invalid URL intervals explain the retained evidence", async ({ page }) => {
  await page.goto("/?champion=NotAChampion#perspective");
  await ready(page);
  await expect(page.locator("[data-selection-status]")).toContainText("not in the loaded roster");
  await expect(page.locator("[data-selection-status]")).toContainText("remains visible");
  await expect(page.locator("[data-champion-name]")).toHaveText("Bel'Veth");
  await page.goto("/?champion=Belveth&older=26.16&newer=26.15#history");
  await ready(page);
  await expect(page.locator("[data-period-status]")).toHaveAttribute("data-invalid", "true");
  await expect(page.locator("[data-period-status]")).toContainText("default archived interval");
  await expect(page.locator("[data-field-choice]")).toBeEnabled();
  await expect(page.locator("[data-record-after]")).not.toBeEmpty();
});

test("reduced motion keeps chapter links, dates and the map available on every viewport", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await ready(page);
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
  await expect(page.locator("[data-motion-toggle]")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-world-shot="0"]')).toHaveCSS("transform", "none");
  await page.locator('[aria-label="Journey chapters"] a[href="#history"]').click();
  await expect(page).toHaveURL(/#history$/);
  await expect(page.locator("#history h2")).toBeFocused();
  await expect(page.locator("[data-period-older]")).toBeEnabled();
  await expect(page.locator("[data-period-newer]")).toBeEnabled();
  await page.locator("[data-map-open]").click();
  await expect(page.locator("#rift-map-dialog")).toBeVisible();
  await page.locator('#rift-map-dialog a[href="/pool"]').click();
  await expect(page).toHaveURL(/\/pool\/?$/);
  await expect(page.locator("#main h1")).toBeVisible();
});

test("a short landscape viewport keeps controls reachable without horizontal overflow", async ({ page, isMobile }) => {
  test.skip(isMobile, "A separate desktop context exercises the short landscape dimensions.");
  await page.setViewportSize({ width: 640, height: 360 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await ready(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  await page.locator("[data-roster-open]").click();
  await expect(page.locator("[data-roster-query]")).toBeVisible();
  await page.locator("[data-roster-close]").click();
  await expect(page.locator("#voyage-roster")).not.toBeVisible();
  await page.locator("[data-map-open]").click();
  await page.locator('#rift-map-dialog a[href="/pool"]').click();
  await expect(page).toHaveURL(/\/pool\/?$/);
});
