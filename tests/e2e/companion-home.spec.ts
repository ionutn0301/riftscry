import { test, expect, type Locator, type Page } from '@playwright/test';

const savedPlayer = { platform: 'eun1', puuid: 'fixture-player-000000000000000000000000000000000', name: 'Fixture Player#TEST' };
const rememberedKey = 'riftscry:remembered-player:v1';
const destinations = ['/players', '/next-game', '/pool', '/champions', '/patches', '/compare', '/explore'];

async function homeReady(page: Page) {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Review your games. Prepare for the next.');
  await expect(page.locator('astro-island[component-url*="HomeReturn"]')).not.toHaveAttribute('ssr', '');
  await page.evaluate(() => document.fonts.ready);
}

async function expectTapTarget(link: Locator, width: number, height: number) {
  const bounds = await link.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.height).toBeGreaterThanOrEqual(44);
  expect(bounds!.width).toBeGreaterThanOrEqual(44);
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height + 1);
  expect(await link.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return hit === element || (hit !== null && element.contains(hit));
  })).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

for (const [width, height] of [[320, 568], [390, 844], [1440, 900]] as const) {
  test(`companion purpose and working task actions fit ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const playerRequests: string[] = [];
    await page.route('**/api/player/**', route => {
      playerRequests.push(new URL(route.request().url()).pathname);
      return route.fulfill({ status: 503, json: { error: 'Homepage must not request player data.' } });
    });
    await page.goto('/');
    await homeReady(page);
    await expect(page.getByRole('heading', { name: 'Rift Recall', exact: true })).toBeVisible();
    await expect(page.locator('.companion-welcome')).toContainText('ARAM');
    const tasks = [
      ['Find my games', '/players'],
      ['Prepare my next game', '/next-game'],
      ['See my champion changes', '/pool#briefing'],
    ] as const;
    for (const [name, href] of tasks) {
      const action = page.getByRole('link', { name, exact: true });
      await expect(action).toHaveAttribute('href', href);
      await expectTapTarget(action, width, height);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    expect(playerRequests).toEqual([]);

    // The dynamic player entry is exercised end-to-end in companion-integration.
    // This suite serves the production build's static archive/preparation output.
    await page.getByRole('link', { name: 'Prepare my next game', exact: true }).click();
    await expect(page).toHaveURL(/\/next-game\/?$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Next game.');
    await page.goBack();
    await homeReady(page);
    await page.getByRole('link', { name: 'See my champion changes', exact: true }).click();
    await expect(page).toHaveURL(/\/pool#briefing$/);
    await expect(page.locator('#briefing')).toBeVisible();
    expect(playerRequests).toEqual([]);
  });
}

for (const [width, height] of [[320, 568], [568, 320], [844, 390], [1440, 900]] as const) {
  test(`homepage map fits seven destinations and restores focus at ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await homeReady(page);
    const opener = page.getByRole('button', { name: 'Open the Rift map', exact: true });
    await expectTapTarget(opener, width, height);
    await opener.click();
    const map = page.locator('#rift-map-dialog');
    await expect(map).toBeVisible();
    const links = map.locator('.map-destination');
    await expect(links).toHaveCount(7);
    expect(await links.evaluateAll(nodes => nodes.map(node => node.getAttribute('href')))).toEqual(destinations);
    for (const link of await links.all()) await expectTapTarget(link, width, height);
    expect(await map.locator('.navigation-landscape').evaluate(element => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
    await expectTapTarget(map.getByRole('button', { name: 'Close the Rift map' }), width, height);
    await expectTapTarget(map.locator('[data-palette-trigger]'), width, height);
    await map.getByRole('button', { name: 'Close the Rift map' }).click();
    await expect(opener).toBeFocused();
    await expect(map).not.toBeVisible();
  });
}

test('the saved-player shortcut validates browser data and uses a canonical games route', async ({ page }) => {
  await page.addInitScript(({ key, player }) => localStorage.setItem(key, JSON.stringify(player)), { key: rememberedKey, player: savedPlayer });
  const requests: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/player/')) requests.push(request.url()); });
  await page.goto('/');
  await homeReady(page);
  const shortcut = page.getByRole('link', { name: /Return to Fixture Player#TEST/ });
  await expect(shortcut).toBeVisible();
  await expect(shortcut).toHaveAttribute('href', `/players/${savedPlayer.platform}/${savedPlayer.puuid}?view=history`);
  expect(requests).toEqual([]);

  for (const invalid of [
    { ...savedPlayer, platform: '__proto__' },
    { ...savedPlayer, puuid: '../another-route' },
    { ...savedPlayer, name: { text: 'Not a player name' } },
  ]) {
    await page.evaluate(({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
      window.dispatchEvent(new StorageEvent('storage', { key }));
    }, { key: rememberedKey, value: invalid });
    await expect(page.locator('.companion-return')).toHaveCount(0);
  }
  await expect(page.getByRole('link', { name: 'Find my games', exact: true })).toBeVisible();
});

test('blocked browser storage leaves the public companion actions available', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }));
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await homeReady(page);
  await expect(page.locator('.companion-return')).toHaveCount(0);
  await page.getByRole('link', { name: 'Prepare my next game', exact: true }).click();
  await expect(page).toHaveURL(/\/next-game\/?$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Next game.');
  expect(errors).toEqual([]);
});

test('old journey links retain their champion, interval and saved reading place', async ({ page }) => {
  await page.goto('/?champion=Azir&older=26.15&newer=26.16#change');
  await expect(page).toHaveURL(url => url.pathname === '/explore' && url.searchParams.get('champion') === 'Azir' && url.hash === '#change');
  await expect(page.locator('[data-voyage]')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('[data-voyage]')).toHaveAttribute('data-loading', 'false');
  await expect(page.locator('[data-record-after]')).toContainText('75 / 95 / 115 / 135 / 155');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('riftscry:resume') ?? '{}').href)).toMatch(/^\/explore\?/);
  await page.getByRole('link', { name: 'RiftScry home', exact: true }).click();
  await expect(page).toHaveURL(url => url.pathname === '/' && url.search === '');
  await homeReady(page);
  await page.locator('.companion-explore').getByRole('link', { name: 'Explore the Rift', exact: true }).click();
  await expect(page).toHaveURL(/\/explore\/?(?:\?|$)/);
  await expect(page.locator('[data-voyage]')).toHaveAttribute('data-ready', 'true');
});

test('a legacy patch-only journey link still opens the archive journey', async ({ page }) => {
  await page.goto('/?patch=26.16');
  await expect(page).toHaveURL(url => url.pathname === '/explore' && url.searchParams.get('patch') === '26.16');
  await expect(page.locator('[data-voyage]')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('[data-voyage]')).toHaveAttribute('data-loading', 'false');
});
