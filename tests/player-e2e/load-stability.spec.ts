import { expect, test, type Locator, type Page } from '@playwright/test';
import { installFixtures, itemMetadata, platform, profilePath, puuid, query, sourceMatch, visualMatches } from './fixtures';

function gate() {
  let release = () => {};
  const pending = new Promise<void>(resolve => { release = resolve; });
  return { pending, release };
}

/** Hold the actual island module, while allowing its SSR document and styles to paint. */
async function holdIsland(page: Page, component: string) {
  const held = gate();
  let intercepted = 0;
  await page.route('**/*', async route => {
    const request = route.request();
    if (request.resourceType() === 'script' && new URL(request.url()).pathname.includes(component)) {
      intercepted++;
      await held.pending;
    }
    await route.fallback();
  });
  return { ...held, intercepted: () => intercepted };
}

async function box(locator: Locator) {
  const bounds = await locator.boundingBox();
  expect(bounds).not.toBeNull();
  return bounds!;
}

function unchanged(actual: Awaited<ReturnType<typeof box>>, before: Awaited<ReturnType<typeof box>>) {
  for (const field of ['x', 'y', 'width', 'height'] as const) {
    expect(Math.abs(actual[field] - before[field]), `${field} changed across loading`).toBeLessThanOrEqual(1);
  }
}

async function visibleKeyboardTarget(page: Page, target: Locator) {
  await page.keyboard.press('Tab');
  await expect(target).toBeFocused();
  await expect(target).toBeInViewport({ ratio: .95 });
  const bounds = await box(target);
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  expect(await target.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return hit === element || Boolean(hit && element.contains(hit));
  }), 'The focused control is not covered by fixed navigation').toBe(true);
}

for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
  test(`${viewport.width}px briefing entry keeps its header and chapter slot from SSR through hydration`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const requests = await installFixtures(page);
    const scripts = await holdIsland(page, 'AutomaticBriefing');
    try {
      await page.goto('/next-game', { waitUntil: 'commit' });
      await expect.poll(scripts.intercepted).toBeGreaterThan(0);
      await expect(page.locator('.automatic-loading')).toBeVisible();
      await expect(page.locator('.automatic-wrap')).toHaveCSS('display', 'contents');
      await page.evaluate(() => document.fonts.ready);
      const heading = page.locator('.automatic-header');
      const rail = page.locator('.journey-chapters');
      const beforeHeading = await box(heading);
      const beforeRail = await box(rail);
      expect(beforeRail.height).toBe(viewport.height <= 650 ? 53 : 71);
      scripts.release();
      const form = page.getByRole('form', { name: 'Get an automatic player briefing', exact: true });
      await expect(form).toBeVisible();
      await expect(page.locator('[data-automatic-briefing]')).toHaveAttribute('data-journey-hydrated', 'true');
      await expect(page.locator('body')).toHaveAttribute('data-journey-ready', 'true');
      unchanged(await box(heading), beforeHeading);
      unchanged(await box(rail), beforeRail);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);

      // Begin before the form so every control is reached through real Tab navigation.
      await page.locator('#automatic-entry-heading').focus();
      await visibleKeyboardTarget(page, form.getByLabel('Riot ID', { exact: true }));
      await visibleKeyboardTarget(page, form.getByLabel('Server', { exact: true }));
      await visibleKeyboardTarget(page, form.getByRole('button', { name: 'Get my briefing', exact: true }));
      expect(requests).toEqual([]);
    } finally { scripts.release(); }
  });
}

test('a selected briefing keeps the same entrance while its history imports', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const records = gate();
  const requests = await installFixtures(page, { matches: [sourceMatch], beforeMatch: () => records.pending });
  const scripts = await holdIsland(page, 'AutomaticBriefing');
  try {
    await page.goto(`/next-game?${query}`, { waitUntil: 'commit' });
    await expect.poll(scripts.intercepted).toBeGreaterThan(0);
    await expect(page.locator('.automatic-loading')).toBeVisible();
    await expect(page.locator('.automatic-wrap')).toHaveCSS('display', 'contents');
    await page.evaluate(() => document.fonts.ready);
    const heading = page.locator('.automatic-header');
    const rail = page.locator('.journey-chapters');
    const beforeHeading = await box(heading);
    const beforeRail = await box(rail);
    scripts.release();
    const report = page.locator('[data-briefing-report]');
    await expect(report).toHaveAttribute('aria-busy', 'true');
    await expect(page.locator('body')).toHaveAttribute('data-journey-ready', 'true');
    unchanged(await box(heading), beforeHeading);
    unchanged(await box(rail), beforeRail);
    records.release();
    await expect(report).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('#loadout')).toContainText('Your last Ahri loadout.');
    unchanged(await box(heading), beforeHeading);
    unchanged(await box(rail), beforeRail);
    await expect(heading.getByText('Your games become your next move.', { exact: true })).toBeVisible();
    expect(requests.filter(request => ['timeline', 'review'].includes(request.action))).toEqual([]);
  } finally { scripts.release(); records.release(); }
});

test('remembered-player startup shows a pending choice instead of flashing the lookup form', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(player => localStorage.setItem('riftscry:recent-player:v1', JSON.stringify(player)), {
    platform, puuid, name: 'Fixture Player#TEST',
  });
  const requests = await installFixtures(page);
  const scripts = await holdIsland(page, 'PlayerGateway');
  try {
    await page.goto('/players', { waitUntil: 'commit' });
    await expect.poll(scripts.intercepted).toBeGreaterThan(0);
    await expect(page.locator('.gateway-pending')).toBeVisible();
    await expect(page.locator('.gateway-lookup-scene')).toBeHidden();
    await expect(page.locator('.gateway-lookup-scene')).toHaveJSProperty('open', false);
    await expect(page.locator('.player-gateway')).toHaveCSS('padding-top', '0px');
    await page.evaluate(() => document.fonts.ready);
    const before = await box(page.locator('.gateway-heading'));
    scripts.release();
    await expect(page.locator('.remembered-player')).toBeVisible();
    await expect(page.locator('.gateway-pending')).toHaveCount(0);
    await expect(page.locator('body')).toHaveAttribute('data-journey-ready', 'true');
    unchanged(await box(page.locator('.gateway-heading')), before);
    const disclosure = page.locator('.gateway-lookup-scene');
    await expect(disclosure).toHaveJSProperty('open', false);
    await disclosure.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(disclosure.getByLabel('Riot ID', { exact: true })).toBeVisible();
    expect(requests).toEqual([]);
  } finally { scripts.release(); }
});

test('patch status reserves its row before the filter island starts', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const scripts = await holdIsland(page, 'PatchFilterBar');
  try {
    await page.goto('/patch/26.16', { waitUntil: 'commit' });
    await expect.poll(scripts.intercepted).toBeGreaterThan(0);
    await expect(page.locator('body')).toHaveAttribute('data-journey-ready', 'true');
    const filter = page.getByRole('group', { name: 'Filter changes', exact: true });
    await expect(filter).toHaveAttribute('data-ready', 'false');
    const status = filter.locator('.patch-filter-status');
    await expect(status).toHaveText(/\d+ champions in this patch/);
    await page.evaluate(() => document.fonts.ready);
    const before = await box(filter);
    const beforeStatus = await box(status);
    scripts.release();
    await expect(filter).toHaveAttribute('data-ready', 'true');
    await expect(status).toHaveText(/\d+ of \d+ champions/);
    unchanged(await box(filter), before);
    unchanged(await box(status), beforeStatus);
  } finally { scripts.release(); }
});

test('a player inventory keeps its slots while metadata and successful or failed images arrive', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const metadata = gate();
  const pictures = gate();
  const requests = await installFixtures(page, {
    matches: [visualMatches[0]!],
    response: async request => {
      if (request.action !== 'items') return undefined;
      await metadata.pending;
      return { status: 200, json: { ...itemMetadata, version: visualMatches[0]!.info.gameVersion } };
    },
  });
  let interceptedPictures = 0;
  await page.route('**/img/item/*.png', async route => {
    interceptedPictures++;
    await pictures.pending;
    if (route.request().url().endsWith('/6655.png')) await route.abort('failed');
    else await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#8ab8aa"/></svg>' });
  });
  try {
    await page.goto(profilePath, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('region', { name: 'Recent match sample', exact: true })).toContainText('1 of 1 recent matches imported');
    const inventory = page.locator('.match-inventory .loadout-items');
    await expect(inventory.locator('.loadout-icon')).toHaveCount(7);
    await expect(inventory.locator('img')).toHaveCount(0);
    // Put the inventory in view before measuring so native lazy loading is
    // exercised without an unrelated scroll between the two measurements.
    await inventory.scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts.ready);
    const before = await box(inventory);
    const icons = await inventory.locator('.loadout-icon').all();
    const beforeIcons = await Promise.all(icons.map(box));
    metadata.release();
    await expect(inventory.locator('.item-label[title="Rabadon\'s Deathcap"]')).toBeVisible();
    await expect(inventory.locator('img')).toHaveCount(7);
    unchanged(await box(inventory), before);
    for (const [index, icon] of icons.entries()) unchanged(await box(icon), beforeIcons[index]!);
    await expect.poll(() => interceptedPictures).toBe(7);
    pictures.release();
    const failed = inventory.locator('.item-label[title="Luden\'s Echo"]');
    await expect(failed.locator('.loadout-icon')).toHaveAttribute('data-image-missing', 'true');
    await expect(failed.locator('img')).toHaveCount(0);
    await expect(failed.locator('.loadout-icon-fallback')).toHaveText('6655');
    await expect(failed.locator('.loadout-label')).toHaveText("Luden's Echo");
    await expect.poll(() => inventory.locator('img').evaluateAll(images => images.every(image => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
    unchanged(await box(inventory), before);
    for (const [index, icon] of icons.entries()) unchanged(await box(icon), beforeIcons[index]!);
    expect(requests.filter(request => ['timeline', 'review'].includes(request.action))).toEqual([]);
  } finally { metadata.release(); pictures.release(); }
});

test('match item and rune fallbacks preserve their icon frames after CDN failures', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const pictures = gate();
  const requests = await installFixtures(page, { matches: [sourceMatch] });
  await page.route('**/cdn/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (!path.includes('/img/item/') && !path.includes('/perk-images/')) return route.fallback();
    await pictures.pending;
    await route.abort('failed');
  });
  try {
    await page.goto(`/matches/${sourceMatch.metadata.matchId}?${query}`, { waitUntil: 'domcontentloaded' });
    const item = page.locator('.review-inventory .item-label[title="Boots"]');
    const rune = page.locator('.review-runes .rune-label[title="Electrocute"]');
    await expect(item).toBeVisible();
    await expect(rune).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    const beforeItem = await box(item);
    const beforeRune = await box(rune);
    const beforeItemIcon = await box(item.locator('.loadout-icon'));
    const beforeRuneIcon = await box(rune.locator('.loadout-icon'));
    pictures.release();
    for (const label of [item, rune]) {
      await label.scrollIntoViewIfNeeded();
      await expect(label.locator('.loadout-icon')).toHaveAttribute('data-image-missing', 'true');
      await expect(label.locator('img')).toHaveCount(0);
    }
    // Return to the same viewport origin after exercising both lazy images.
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    unchanged(await box(item), beforeItem);
    unchanged(await box(rune), beforeRune);
    unchanged(await box(item.locator('.loadout-icon')), beforeItemIcon);
    unchanged(await box(rune.locator('.loadout-icon')), beforeRuneIcon);
    await expect(item).toContainText('Boots');
    await expect(rune).toContainText('Electrocute');
    expect(requests.filter(request => ['timeline', 'review'].includes(request.action))).toEqual([]);
  } finally { pictures.release(); }
});
