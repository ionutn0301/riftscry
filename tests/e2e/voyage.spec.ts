import { test, expect, type Page } from "@playwright/test";

// Current five-chapter presentation. These are new, unexecuted acceptance tests;
// core-flow, keyboard and the migrated resilience specs protect related goals.
const ready = async (page: Page) => {
  await expect(page.locator("[data-voyage]")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("[data-voyage]")).toHaveAttribute("data-loading", "false");
};

async function expectOpeningBounds(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  const bounds = await page.locator("#arrival").evaluate((arrival) => {
    const rect = arrival.getBoundingClientRect();
    return {
      top: rect.top,
      bottom: rect.bottom,
      height: rect.height,
      viewport: innerHeight,
      documentHeight: document.documentElement.scrollHeight,
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  expect(Math.abs(bounds.top)).toBeLessThanOrEqual(2);
  expect(Math.abs(bounds.height - bounds.viewport)).toBeLessThanOrEqual(2);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewport + 2);
  expect(bounds.horizontalOverflow).toBeLessThanOrEqual(1);
  // Only the arrival fits a screen. The other four chapters need real document space.
  expect(bounds.documentHeight).toBeGreaterThan(bounds.viewport * 3);
  await expect(page.locator("#arrival h1")).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole("link", { name: /Enter the journey/ })).toBeInViewport({ ratio: 1 });
  await expect(page.locator("[data-map-open]")).toBeInViewport({ ratio: 1 });
}

test("five document chapters are connected by named native links", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  const chapters = page.locator("[data-journey-chapter]");
  await expect(chapters).toHaveCount(5);
  expect(await chapters.evaluateAll((sections) => sections.map((section) => section.id))).toEqual([
    "arrival", "perspective", "change", "history", "return",
  ]);
  expect(await chapters.evaluateAll((sections) => sections.map((section) => getComputedStyle(section).position)))
    .not.toContain("absolute");
  expect(await page.locator('nav[aria-label="Journey chapters"] a').evaluateAll((links) => links.map((link) => link.getAttribute("href"))))
    .toEqual(["#arrival", "#perspective", "#change", "#history", "#return"]);
  await expectOpeningBounds(page);
  await page.getByRole("link", { name: /Enter the journey/ }).click();
  await expect(page).toHaveURL(/#perspective$/);
  await expect(page.locator("#perspective h2")).toBeFocused();
  await expect(page.locator("[data-champion-splash]")).toHaveCSS("object-fit", "contain");
});
test("the arrival also fits a short desktop while the journey can scroll", async ({ page, isMobile }) => {
  test.skip(isMobile, "The mobile project already exercises its actual 390×844 viewport.");
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await ready(page);
  await expectOpeningBounds(page);
});

test("champion choice loads a canonical static model and Back restores perspective", async ({ page }) => {
  await page.goto("/?ref=regression");
  await ready(page);
  const azirResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/journey/Azir.json");
  await page.locator('.quick-perspectives [data-choose-champion="Azir"]').click();
  const response = await azirResponse;
  expect(response.ok()).toBe(true);
  expect((await response.json()).identity.id).toBe("Azir");
  await ready(page);
  await expect(page.locator("[data-champion-name]")).toHaveText("Azir");
  await expect(page).toHaveURL((url) => url.searchParams.get("champion") === "Azir" && url.searchParams.get("ref") === "regression" && url.hash === "#perspective");
  await page.locator('.quick-perspectives [data-choose-champion="Ahri"]').click();
  await ready(page);
  await expect(page.locator("[data-champion-name]")).toHaveText("Ahri");
  await page.goBack();
  await ready(page);
  await expect(page.locator("[data-champion-name]")).toHaveText("Azir");
  await expect(page).toHaveURL((url) => url.searchParams.get("champion") === "Azir");
  await page.reload();
  await ready(page);
  await expect(page.locator("[data-champion-name]")).toHaveText("Azir");
  await expect(page.locator("[data-champion-link]")).toHaveAttribute("href", "/champion/azir");
});

test("the full roster supports roles and normalized names beyond featured champions", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  const rosterResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/journey/roster.json");
  await page.locator("[data-roster-open]").click();
  await expect(page.locator("#voyage-roster")).toBeVisible();
  await expect(page.locator("[data-roster-query]")).toBeFocused();
  const response = await rosterResponse;
  expect(response.ok()).toBe(true);
  const roster = await response.json() as Array<{ id: string; roles: string[] }>;
  expect(roster).toHaveLength(173); // The committed roster, not a live-game count.
  const results = page.locator("[data-roster-results] [data-choose-champion]");
  await expect(results).toHaveCount(roster.length);
  const junglers = roster.filter((champion) => champion.roles.includes("jungle"));
  expect(junglers.length).toBeGreaterThan(0);
  await page.locator("#voyage-roster [data-roster-role]").selectOption("jungle");
  await expect(results).toHaveCount(junglers.length);
  await page.locator("#voyage-roster [data-roster-role]").selectOption("");
  await page.locator("[data-roster-query]").fill("kha zix");
  await expect(results).toHaveCount(1);
  await expect(results).toHaveAttribute("data-choose-champion", "Khazix");
  const championResponse = page.waitForResponse((item) => new URL(item.url()).pathname === "/journey/Khazix.json");
  await results.click();
  expect((await championResponse).ok()).toBe(true);
  await ready(page);
  await expect(page.locator("#voyage-roster")).not.toBeVisible();
  await expect(page).toHaveURL((url) => url.searchParams.get("champion") === "Khazix");
  await expect(page.locator("[data-champion-link]")).toHaveAttribute("href", "/champion/khazix");
});

test("exact rank arrays, scaling, prose and source survive selection and reload", async ({ page }) => {
  await page.goto("/?champion=Azir&older=26.15&newer=26.16#change");
  await ready(page);
  await expect(page.locator("[data-record-label]")).toHaveText("Damage");
  await expect(page.locator("[data-record-before]")).toHaveText("60 / 80 / 100 / 120 / 140 (+35 / 40 / 45 / 50 / 55% AP)");
  await expect(page.locator("[data-record-after]")).toHaveText("75 / 95 / 115 / 135 / 155 (+35 / 40 / 45 / 50 / 55% AP)");
  await expect(page.locator("[data-record-date]")).toHaveText("2026-08-11");
  const source = "https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-16-notes/";
  await expect(page.locator("[data-record-source]")).toHaveAttribute("href", source);
  await page.locator("[data-focus-record]").click();
  await expect(page.locator("[data-journey-findings]")).toContainText("75 / 95 / 115 / 135 / 155 (+35 / 40 / 45 / 50 / 55% AP)");

  await page.locator('.quick-perspectives [data-choose-champion="Belveth"]').click();
  await ready(page);
  await page.locator("[data-field-choice]").selectOption({ label: "R / True Form Remora Indicator" });
  await expect(page.locator("[data-record-prose]")).toHaveText("Resource bar now turns purple when True Form can spawn Remora");
  await expect(page.locator("[data-record-prose]")).toBeVisible();
  await expect(page.locator("[data-record-numeric]")).not.toBeVisible();
  await expect(page.locator("[data-record-source]")).toHaveAttribute("href", source);
  await page.reload();
  await ready(page);
  await expect(page.locator("[data-record-prose]")).toHaveText("Resource bar now turns purple when True Form can spawn Remora");
  await expect(page.locator("[data-record-prose]")).toBeVisible();
});

test("interval boundaries, invalid input and a quiet champion stay honest", async ({ page }) => {
  await page.goto("/?champion=Belveth&older=26.14&newer=26.16#history");
  await ready(page);
  await page.locator("[data-field-choice]").selectOption({ label: "Base stats / Health Growth" });
  await expect(page.locator("[data-history-trace] [data-select-record]")).toHaveCount(2);
  await page.locator("[data-period-older]").selectOption("26.15");
  await expect(page.locator("[data-history-trace] [data-select-record]")).toHaveCount(1);
  await expect(page.locator("[data-record-before]")).toHaveText("110");
  await expect(page.locator("[data-record-after]")).toHaveText("105");
  await expect(page.locator("[data-compare-link]")).toHaveAttribute("href", "/compare/26.16/26.15?champions=Belveth");
  const validUrl = page.url();
  await page.locator("[data-period-older]").selectOption("26.16");
  await expect(page.locator("[data-period-status]")).toHaveAttribute("data-invalid", "true");
  await expect(page).toHaveURL(validUrl);
  await expect(page.locator("[data-record-after]")).toHaveText("105");
  await page.goto("/?champion=Ahri&older=26.15&newer=26.16#change");
  await ready(page);
  await expect(page.locator("[data-record-quiet]")).toBeVisible();
  await expect(page.locator("[data-record-quiet]")).toContainText("No direct record");
  await expect(page.locator("[data-record-quiet]")).toContainText("Items, systems, and other champions");
  await expect(page.locator("[data-field-choice]")).toBeDisabled();
  await expect(page.locator("[data-record-numeric]")).not.toBeVisible();
});

test("a failed champion request keeps the last readable perspective and a retry", async ({ page }) => {
  await page.route("**/journey/Azir.json", (route) => route.fulfill({ status: 503, body: "temporarily unavailable" }));
  await page.goto("/?champion=Belveth&older=26.14&newer=26.16");
  await ready(page);
  await page.locator('.quick-perspectives [data-choose-champion="Azir"]').click();
  await ready(page);
  await expect(page.locator("[data-selection-status]")).toContainText("could not load");
  await expect(page.locator("[data-champion-name]")).toHaveText("Bel'Veth");
  await expect(page.locator("[data-record-after]")).not.toBeEmpty();
  await page.unroute("**/journey/Azir.json");
  await page.locator('.quick-perspectives [data-choose-champion="Azir"]').click();
  await ready(page);
  await expect(page.locator("[data-champion-name]")).toHaveText("Azir");
});

test("Rift map has real destinations, restores focus and hands search out of its modal", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  await expect(page.locator('astro-island[component-url*="CommandPalette"]')).not.toHaveAttribute("ssr", "");
  const opener = page.locator("[data-map-open]");
  await opener.click();
  const map = page.locator("#rift-map-dialog");
  await expect(map).toBeVisible();
  expect(await map.locator(".map-destination").evaluateAll((links) => links.map((link) => link.getAttribute("href"))))
    .toEqual(["/", "/champions", "/patches", "/compare", "/pool"]);
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
  await opener.click();
  await map.locator('[href="/champions"]').click();
  await expect(page).toHaveURL(/\/champions\/?$/);
  await expect(page.locator("body")).toHaveAttribute("data-surface", "champions");
  await page.goBack();
  await ready(page);
  await opener.click();
  await map.locator("[data-palette-trigger]").click();
  await expect(map).not.toBeVisible();
  await expect(page.locator("[cmdk-input]")).toBeVisible();
  await page.locator("[cmdk-input]").fill("Camille");
  await page.locator('[cmdk-item]:has(.item-label:text-is("Camille"))').click();
  await expect(page).toHaveURL(/\/champion\/camille\/?$/);
  await expect(page.locator("#main h1")).toContainText("Camille");
});

test("each reading destination has a distinct arrival and the shared map", async ({ page }) => {
  const routes = [
    ["/champions", "champions", "/champions"],
    ["/champion/belveth", "champion", "/champions"],
    ["/patches", "patches", "/patches"],
    ["/patch/26.16", "patch", "/patches"],
    ["/compare/26.16/26.12", "compare", "/compare"],
    ["/pool", "pool", "/pool"],
    ["/404", "missing", null],
  ] as const;
  for (const [path, surface, current] of routes) {
    await test.step(path, async () => {
      await page.goto(path);
      await expect(page.locator("body")).toHaveAttribute("data-surface", surface);
      await expect(page.locator("#main h1")).toHaveCount(1);
      await expect(page.locator("#main h1")).toBeVisible();
      await expect(page.locator("#route-arrival")).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Explore this page" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
      await page.locator("[data-map-open]").click();
      await expect(page.locator("#rift-map-dialog")).toBeVisible();
      if (current) await expect(page.locator('#rift-map-dialog [aria-current="page"]')).toHaveAttribute("href", current);
      await page.locator("[data-map-close]").click();
    });
  }
});
