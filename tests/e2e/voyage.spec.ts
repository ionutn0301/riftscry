import { test, expect, type Page } from "@playwright/test";
import type { JourneyModel } from '../../src/lib/voyage-data';

// Focused scene navigation, canonical evidence, and resilience in the connected observatory.
const ready = async (page: Page) => {
  await expect(page.locator("[data-voyage]")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("[data-voyage]")).toHaveAttribute("data-loading", "false");
};

async function uncachedFeaturedChampion(page: Page, excludedIds: string[] = []) {
  // The latest patch chooses the embedded model, which is cached at boot even
  // when a different champion is requested in the URL. Exercise an actual fetch.
  const initialId = await page.locator("#voyage-initial-data").evaluate((script) =>
    (JSON.parse(script.textContent!) as { identity: { id: string } }).identity.id);
  const choices = await page.locator(".quick-perspectives [data-choose-champion]").evaluateAll((buttons) =>
    buttons.map((button) => ({
      id: button.getAttribute("data-choose-champion")!,
      name: button.querySelector("span")!.textContent!.trim(),
    })));
  const champion = choices.find(({ id }) => id !== initialId && !excludedIds.includes(id));
  expect(champion, "A featured champion must be absent from the in-memory model cache").toBeDefined();
  return champion!;
}

async function expectOpeningBounds(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  const bounds = await page.locator('#change').evaluate(scene => {
    const rect=scene.getBoundingClientRect();
    return { top:rect.top,bottom:rect.bottom,height:rect.height,viewport:innerHeight,documentHeight:document.documentElement.scrollHeight,horizontalOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth };
  });
  expect(bounds.height).toBeGreaterThan(150);
  expect(bounds.top).toBeGreaterThan(0);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewport + 2);
  expect(bounds.horizontalOverflow).toBeLessThanOrEqual(1);
  expect(bounds.documentHeight).toBeLessThanOrEqual(bounds.viewport + 1);
  await expect(page.locator('.voyage-station-heading h1')).toBeInViewport({ratio:1});
  await expect(page.locator('[data-roster-open]')).toBeInViewport({ratio:1});
  await expect(page.locator('[data-map-open]')).toBeInViewport({ratio:1});
}

test('three focused scenes expose real evidence without document scrolling', async ({page}) => {
  await page.goto('/explore'); await ready(page);
  const scenes=page.locator('[data-journey-panel]');
  await expect(scenes).toHaveCount(3);
  expect(await scenes.evaluateAll(nodes=>nodes.map(node=>node.id))).toEqual(['change','history','return']);
  await expectOpeningBounds(page);
  await page.getByRole('button',{name:'Next scene',exact:true}).click();
  await expect(page).toHaveURL(/#history$/);
  await expect(page.locator('#history')).toBeFocused();
  await expect(page.locator('#change')).toBeHidden();
  await expect(page.getByLabel('After patch',{exact:true})).toBeVisible();
  await page.goBack();
  await expect(page.locator('#change')).toBeVisible();
  await expect(page.locator('[data-champion-splash]')).toHaveCSS('object-fit','contain');
});
test('the focused scene also fits a short desktop', async ({page,isMobile}) => {
  test.skip(isMobile,'The mobile project exercises its own viewport.');
  await page.setViewportSize({width:1280,height:720});
  await page.goto('/explore'); await ready(page); await expectOpeningBounds(page);
});

test('free exploration starts with a real latest record without manual interval setup', async ({page})=>{
  const response=await page.request.get('/journey/Ahri.json');
  expect(response.ok()).toBe(true);
  const model=await response.json() as JourneyModel;
  const newest=[...model.records].sort((a,b)=>b.date.localeCompare(a.date))[0]!;
  await page.goto('/explore?champion=Ahri#change'); await ready(page);
  await expect(page.locator('[data-champion-name]')).toHaveText('Ahri');
  await expect(page.locator('[data-record-patch]')).toHaveText('PATCH '+newest.patch);
  await expect(page.locator('[data-period-newer]')).toHaveValue(newest.patch);
  await expect(page.locator('[data-record-quiet]')).toBeHidden();
  const id=await page.locator('[data-current-record]').getAttribute('data-record-id');
  const selected=model.records.find(record=>record.id===id)!;
  expect(selected).toBeDefined();
  await expect(page.locator('[data-record-source]')).toHaveAttribute('href',selected.source);
  if(selected.change.kind==='numeric') {
    await expect(page.locator('[data-record-before]')).toHaveText(selected.change.before);
    await expect(page.locator('[data-record-after]')).toHaveText(selected.change.after);
  } else await expect(page.locator('[data-record-prose]')).toHaveText(selected.change.text);
});

test("champion choice loads a canonical static model and Back restores perspective", async ({ page }) => {
  await page.goto("/explore?ref=regression");
  await ready(page);
  const champion = await uncachedFeaturedChampion(page, ["Ahri"]);
  const modelPath = `/journey/${champion.id}.json`;
  const modelResponse = page.waitForResponse((response) => new URL(response.url()).pathname === modelPath);
  await page.locator(`.quick-perspectives [data-choose-champion="${champion.id}"]`).click();
  const response = await modelResponse;
  expect(response.ok()).toBe(true);
  expect((await response.json()).identity.id).toBe(champion.id);
  await ready(page);
  await expect(page.locator("[data-champion-name]")).toHaveText(champion.name);
  await expect(page).toHaveURL((url) => url.searchParams.get("champion") === champion.id && url.searchParams.get("ref") === "regression" && url.hash === "#change");
  await page.locator('.quick-perspectives [data-choose-champion="Ahri"]').click();
  await ready(page);
  await expect(page.locator("[data-champion-name]")).toHaveText("Ahri");
  await page.goBack();
  await ready(page);
  await expect(page.locator("[data-champion-name]")).toHaveText(champion.name);
  await expect(page).toHaveURL((url) => url.searchParams.get("champion") === champion.id && url.searchParams.get("ref") === "regression");
  await page.reload();
  await ready(page);
  await expect(page.locator("[data-champion-name]")).toHaveText(champion.name);
  await expect(page.locator("[data-champion-link]")).toHaveAttribute("href", `/champion/${champion.id.toLowerCase()}`);
});

test("the full roster supports roles and normalized names beyond featured champions", async ({ page }) => {
  await page.goto("/explore");
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
  await page.goto("/explore?champion=Azir&older=26.15&newer=26.16#change");
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
  await page.goto("/explore?champion=Belveth&older=26.14&newer=26.16#history");
  await ready(page);
  await page.getByRole("tab", { name: "The change", exact: true }).click();
  await page.locator("[data-field-choice]").selectOption({ label: "Base stats / Health Growth" });
  await page.getByRole("tab", { name: "Through time", exact: true }).click();
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
  await page.goto("/explore?champion=Ahri&older=26.15&newer=26.16#change");
  await ready(page);
  await expect(page.locator("[data-record-quiet]")).toBeVisible();
  await expect(page.locator("[data-record-quiet]")).toContainText("No direct record");
  await expect(page.locator("[data-record-quiet]")).toContainText("Item and system changes are separate");
  await expect(page.locator("[data-field-choice]")).toBeDisabled();
  await expect(page.locator("[data-record-numeric]")).not.toBeVisible();
});

test("a failed champion request keeps the last readable perspective and a retry", async ({ page }) => {
  await page.goto("/explore?champion=Belveth&older=26.14&newer=26.16");
  await ready(page);
  const champion = await uncachedFeaturedChampion(page, ["Belveth"]);
  const modelPath = `/journey/${champion.id}.json`;
  const modelRoute = `**${modelPath}`;
  const readableUrl = page.url();
  await expect(page.locator("[data-champion-name]")).toHaveText("Bel'Veth");
  await expect(page.locator("[data-record-after]")).not.toBeEmpty();
  const readableBefore = await page.locator("[data-record-before]").innerText();
  const readableAfter = await page.locator("[data-record-after]").innerText();
  await page.route(modelRoute, (route) => route.fulfill({ status: 503, body: "temporarily unavailable" }));
  const failedResponse = page.waitForResponse((response) => new URL(response.url()).pathname === modelPath);
  await page.locator(`.quick-perspectives [data-choose-champion="${champion.id}"]`).click();
  expect((await failedResponse).status()).toBe(503);
  await ready(page);
  await expect(page.locator("[data-selection-status]")).toContainText("could not load");
  await expect(page.locator("[data-champion-name]")).toHaveText("Bel'Veth");
  await expect(page.locator("[data-record-before]")).toHaveText(readableBefore);
  await expect(page.locator("[data-record-after]")).toHaveText(readableAfter);
  await expect(page).toHaveURL(readableUrl);
  await page.unroute(modelRoute);
  const retryResponse = page.waitForResponse((response) => new URL(response.url()).pathname === modelPath);
  await page.locator(`.quick-perspectives [data-choose-champion="${champion.id}"]`).click();
  const response = await retryResponse;
  expect(response.ok()).toBe(true);
  expect((await response.json()).identity.id).toBe(champion.id);
  await ready(page);
  await expect(page.locator("[data-champion-name]")).toHaveText(champion.name);
  await expect(page).toHaveURL((url) => url.searchParams.get("champion") === champion.id && url.searchParams.get("older") === "26.14" && url.searchParams.get("newer") === "26.16" && url.hash === "#change");
  await page.goBack();
  await ready(page);
  await expect(page).toHaveURL(readableUrl);
  await expect(page.locator("[data-champion-name]")).toHaveText("Bel'Veth");
  await expect(page.locator("[data-record-after]")).toHaveText(readableAfter);
});

test("Rift map has real destinations, restores focus and hands search out of its modal", async ({ page }) => {
  await page.goto("/explore");
  await ready(page);
  await expect(page.locator('astro-island[component-url*="CommandPalette"]')).not.toHaveAttribute("ssr", "");
  const opener = page.locator("[data-map-open]");
  await opener.click();
  const map = page.locator("#rift-map-dialog");
  await expect(map).toBeVisible();
  expect(await map.locator("[data-world-link]").evaluateAll((links) => links.map((link) => link.getAttribute("href"))))
    .toEqual(["/next-game", "/players", "/champions", "/patches", "/pool#briefing"]);
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

const readingRoutes = [
  ['/champions','champions','/champions'], ['/champion/belveth','champion','/champions'],
  ['/patches','patches','/patches'], ['/patch/26.16','patch','/patches'],
  ['/compare/26.16/26.12','compare','/patches'], ['/pool','pool','/pool#briefing'], ['/404','missing',null],
] as const;
for (const [path,surface,current] of readingRoutes) {
  test(`reading destination ${path} exposes its task scenes and shared world`,async ({page})=>{
    await page.goto(path);
    await expect(page.locator('body')).toHaveAttribute('data-surface',surface);
    await expect(page.locator('body')).toHaveAttribute('data-journey-ready','true');
    await expect(page.locator('#main h1')).toHaveCount(1);
    await expect(page.locator('#main h1')).toBeVisible();
    await expect(page.locator('[data-journey-panel]:visible')).toHaveCount(1);
    const controls=page.getByRole('tablist',{name:'Scenes in this destination'});
    if(await controls.isVisible()) {
      const labels=await controls.getByRole('tab').allTextContents();
      for(const label of labels) {
        const tab=controls.getByRole('tab',{name:label,exact:true});
        await tab.click();
        await expect(tab).toHaveAttribute('aria-selected','true');
        const id=await tab.getAttribute('aria-controls');
        await expect(page.locator('#'+id)).toBeVisible();
        await expect(page.locator('[data-journey-panel]:visible')).toHaveCount(1);
        expect(await page.evaluate(()=>scrollY)).toBe(0);
      }
    }
    if(surface==='missing') {
      await page.getByRole('link',{name:'Return to the Rift',exact:false}).first().click();
      await expect(page).toHaveURL(url=>url.pathname==='/');
      await expect(page.locator('[data-home-signals]')).toBeVisible();
      await page.goBack();
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.locator('[data-map-open]').click();
    await expect(page.locator('#rift-map-dialog')).toBeVisible();
    if(current) await expect(page.locator('#rift-map-dialog [aria-current="page"]')).toHaveAttribute('href',current);
    await page.locator('[data-map-close]').click();
    await expect(page.locator('[data-map-open]')).toBeFocused();
  });
}
