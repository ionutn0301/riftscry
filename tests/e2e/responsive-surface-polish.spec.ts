import { expect, test, type Page } from '@playwright/test';

async function readyJourney(page: Page) {
  await expect(page.locator('body')).toHaveAttribute('data-journey-ready', 'true');
  await expect(page.locator('[data-voyage]')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('[data-voyage]')).toHaveAttribute('data-loading', 'false');
  await page.evaluate(() => document.fonts.ready);
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

for (const [width, height] of [[320, 568], [568, 320], [844, 390], [1366, 768], [1440, 900]] as const) {
  test(`the evidence scene fits ${width}×${height} with every primary action reachable`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/explore', { waitUntil: 'domcontentloaded' });
    await readyJourney(page);
    const scene = page.locator('[data-journey-panel]:not([hidden])');
    await expect(scene).toHaveCount(1);
    await expect(scene).toHaveAttribute('id', 'change');
    const bounds = (await scene.boundingBox())!;
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(height + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    const actions = page.locator('[data-roster-open], #change [data-focus-record], #change [data-record-source], #change .voyage-station-continue');
    await expect(actions).toHaveCount(4);
    for (const action of await actions.all()) {
      await action.scrollIntoViewIfNeeded();
      await expect(action).toBeInViewport({ ratio: 0.99 });
      expect(await action.evaluate(element => {
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return hit === element || Boolean(hit && element.contains(hit));
      })).toBe(true);
    }
    expect(await page.evaluate(() => scrollY)).toBe(0);
  });
}

for (const [width, height] of [[320, 568], [568, 320], [844, 390]] as const) {
  test(`champion source artwork stays inside its ${width}px column`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/champion/nunu', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('body')).toHaveAttribute('data-journey-ready', 'true');
    const column = (await page.locator('#history').boundingBox())!;
    const figure = (await page.locator('.journey-champion-art').boundingBox())!;
    await expect(page.locator('[data-champion-art-image]')).toHaveCSS('object-fit', 'contain');
    for (const art of await page.locator('.journey-champion-art, .journey-champion-art picture, .journey-champion-art img, .journey-champion-art figcaption, [data-champion-art-fallback]').all()) {
      if (!await art.isVisible()) continue;
      const bounds = (await art.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(column.x - 1);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(column.x + column.width + 1);
      expect(bounds.y).toBeGreaterThanOrEqual(figure.y - 1);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(figure.y + figure.height + 1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
  });
}

test('failed champion artwork keeps its footprint and leaves exact history usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/cdn/img/champion/splash/Nunu_0.jpg', route => route.abort());
  await page.goto('/champion/nunu', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toHaveAttribute('data-journey-ready', 'true');
  await expect(page.locator('[data-champion-art-image]')).toBeHidden();
  const fallback = page.locator('[data-champion-art-fallback]');
  await expect(fallback).toBeVisible();
  await expect(fallback).toContainText('Nunu & Willump');
  const figure = (await page.locator('[data-champion-art]').boundingBox())!;
  const bounds = (await fallback.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(figure.x - 1);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(figure.x + figure.width + 1);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(figure.y + figure.height + 1);
  const active = page.locator('[data-history-record]:not([hidden])');
  await expect(active).toHaveCount(1);
  await expect(active.locator('[data-signal-record]:not([hidden])')).toBeVisible();
  await expect(active.getByRole('link', { name: /^Original source/ })).toHaveAttribute('href', /^https:\/\//);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
});

for (const [width, height] of [[1366, 768], [1280, 800], [1920, 850], [1440, 900]] as const) {
  test(`the Rift map has no unnecessary scroll at ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/explore', { waitUntil: 'domcontentloaded' });
    await readyJourney(page);
    await page.getByRole('button', { name: 'Open the Rift map', exact: true }).click();
    const dialog = page.locator('#rift-map-dialog');
    const destinations = dialog.locator('[data-world-link]');
    await expect(destinations).toHaveCount(5);
    for (const destination of await destinations.all()) await expect(destination).toBeInViewport({ ratio: 0.99 });
    expect(await dialog.evaluate(element => [element, ...element.querySelectorAll('*')].filter(node =>
      /^(auto|scroll)$/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight + 1).length)).toBe(0);
    await expect(dialog.getByRole('button', { name: 'Close the Rift map' })).toBeInViewport({ ratio: 0.99 });
    await expect(dialog.getByRole('button', { name: 'Search the archive' })).toBeInViewport({ ratio: 0.99 });
  });
}

test('changing a featured perspective preserves the reading position', async ({ page }) => {
  await page.goto('/explore?champion=Belveth&older=26.15&newer=26.16#perspective', { waitUntil: 'domcontentloaded' });
  await readyJourney(page);
  const choice = page.locator('.quick-perspectives [data-choose-champion="Ahri"]');
  await choice.scrollIntoViewIfNeeded();
  await choice.focus();
  const before = await page.evaluate(() => scrollY);
  await choice.press('Enter');
  await readyJourney(page);
  await expect(page.locator('[data-champion-name]')).toHaveText('Ahri');
  await expect(choice).toBeFocused();
  expect(Math.abs(await page.evaluate(() => scrollY) - before)).toBeLessThanOrEqual(1);
  await expect(page).toHaveURL(url => url.searchParams.get('champion') === 'Ahri');
});
