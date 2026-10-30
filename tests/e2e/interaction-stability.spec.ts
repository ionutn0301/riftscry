import { test, expect, type Page } from '@playwright/test';
import { readyWorld, stationaryWorld } from './journey-test-helpers';

async function settleLayout(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

test('failed scene imagery leaves named native destinations available before and after enhancement', async ({ page }) => {
  let releaseScripts = () => {};
  const scriptsHeld = new Promise<void>(resolve => { releaseScripts = resolve; });
  await page.route('**/*', async route => {
    if (route.request().resourceType() === 'image') return route.abort();
    if (route.request().resourceType() === 'script') await scriptsHeld;
    await route.continue();
  });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const world = page.locator('[data-observatory]');
  const links = world.locator('[data-world-link]');
  try {
    await page.goto('/', { waitUntil: 'commit' });
    await expect(links).toHaveCount(5);
    await expect(world.getByRole('heading', { level: 1 })).toContainText('The Rift is');
    const destinations = [
      ['Briefing', '/next-game'], ['Games', '/players'], ['Champions', '/champions'],
      ['Patches', '/patches'], ['Saved', '/pool#briefing'],
    ] as const;
    for (const [index, [name, href]] of destinations.entries()) {
      await expect(links.nth(index)).toHaveAccessibleName(new RegExp(name));
      await expect(links.nth(index)).toHaveAttribute('href', href);
      await expect(links.nth(index).locator('svg')).toHaveCount(1);
    }
    releaseScripts();
    await readyWorld(page);
    await expect(world).toBeVisible();
    await expect(links).toHaveCount(5);
    for (const link of await links.all()) {
      await expect(link).toBeInViewport({ ratio: 1 });
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await links.nth(2).click();
    await expect(page).toHaveURL(url => url.pathname === '/champions');
    await readyWorld(page);
    const search = page.getByRole('searchbox', { name: 'Find a champion', exact: true });
    await search.fill('nunu');
    await expect(page.locator('[data-roster-row]:not([hidden])')).toHaveCount(1);
    await expect(page.locator('[data-roster-row]:not([hidden]) a')).toHaveAttribute('href', '/champion/nunu');
    expect(errors).toEqual([]);
  } finally { releaseScripts(); }
});

test('failed champion artwork leaves an honest identity and exact records available', async ({ page }) => {
  await page.route('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Ahri_0.jpg', route => route.abort());
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/champion/ahri');
  await readyWorld(page);
  await expect(page.locator('[data-champion-art-image]')).toBeHidden();
  const fallback = page.locator('[data-champion-art-fallback]');
  await expect(fallback).toBeVisible();
  await expect(fallback).toContainText('Ahri');
  await expect(fallback).toContainText('Artwork unavailable');
  await expect(page.locator('[data-champion-art-credit]')).toBeHidden();
  const current = page.locator('[data-history-record="26.6"]');
  await expect(current).toBeVisible();
  await expect(current).toContainText('Orb of Deception');
  await expect(current).toContainText('40 / 65 / 90 / 115 / 140');
  await expect(current).toContainText('35 / 60 / 85 / 110 / 135');
  await page.locator('[data-history-select="26.3"]').click();
  const earlier = page.locator('[data-history-record="26.3"]');
  await expect(earlier).toBeVisible();
  await expect(current).toBeHidden();
  await earlier.getByRole('link', { name: 'Open in patch 26.3' }).click();
  await expect(page).toHaveURL(url => url.pathname === '/patch/26.3' && url.hash === '#ahri');
  await readyWorld(page);
  await expect(page.locator('.change-card:not([hidden])')).toHaveAttribute('id', 'ahri');
  expect(errors).toEqual([]);
});

test('destination previews change without moving the world, named links or navigation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await readyWorld(page);
  const navigator = page.locator('[data-observatory] [data-navigator]');
  const links = navigator.locator('[data-world-link]');
  const ids = await links.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-world-link')));
  const position = () => page.evaluate(() => ({
    scroll: scrollY,
    boxes: [...document.querySelectorAll('[data-observatory], [data-observatory] [data-world-link], .journey-header, .journey-chrome')]
      .map(element => { const box = element.getBoundingClientRect(); return [box.x, box.y, box.width, box.height]; }),
  }));
  const baseline = await position();
  const expectStationary = async () => {
    await settleLayout(page);
    const current = await position();
    expect(current.scroll).toBe(baseline.scroll);
    for (const [index, box] of current.boxes.entries()) {
      for (const [axis, value] of box.entries()) expect(Math.abs(value - baseline.boxes[index]![axis]!)).toBeLessThanOrEqual(1);
    }
    await stationaryWorld(page);
  };
  for (const index of [1, 2, 3, 4, 0]) {
    await navigator.locator('[data-world-next]').click();
    await expect(navigator).toHaveAttribute('data-selected', ids[index]!);
    const destination = await links.nth(index).evaluate(link => (link as HTMLAnchorElement).href);
    await expect(navigator.locator('[data-world-enter]')).toHaveAttribute('href', destination);
    await expectStationary();
  }
  for (const index of [4, 2, 0]) {
    await links.nth(index).focus();
    await expect(links.nth(index)).toBeFocused();
    await expect(navigator).toHaveAttribute('data-selected', ids[index]!);
    await expect(navigator.locator('[data-world-enter]')).toHaveAccessibleName(/^Enter /);
    await expectStationary();
  }
  const previous = navigator.locator('[data-world-prev]');
  await previous.focus();
  await page.keyboard.press('Enter');
  await expect(navigator).toHaveAttribute('data-selected', ids[4]!);
  await expect(previous).toBeFocused();
  await expectStationary();
});
