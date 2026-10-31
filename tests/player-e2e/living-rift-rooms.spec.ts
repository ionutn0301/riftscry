import { expect, test, type Page } from '@playwright/test';
import { installFixtures, platform, profilePath, puuid, query, recentAramWin, visualMatches } from './fixtures';

// These documents include SSR player routes. Use the fixture-backed Astro
// runtime, rather than the static archive server, to test their shared scene.
const rooms = [
  { path: '/', surface: 'home', task: '#atlas [data-passage-enter]' },
  { path: '/explore', surface: 'explore', task: '[data-roster-open]' },
  { path: '/champions', surface: 'champions', task: '[data-roster-search]' },
  { path: '/champion/nunu', surface: 'champion', task: '[data-direct-save="Nunu"]' },
  { path: '/patches', surface: 'patches', task: '[data-archive-focus-link]' },
  { path: '/patch/26.16', surface: 'patch', task: '.filter-bar input' },
  { path: '/compare/26.16/26.15', surface: 'compare', task: '.compare-picker select' },
  { path: '/pool#edit-pool', surface: 'pool', task: '.pool-picker input' },
  { path: '/next-game', surface: 'next-game', task: '.automatic-lookup input' },
  { path: '/notebook', surface: 'notebook', task: '#notes button' },
  { path: '/players?platform=eun1', surface: 'players', task: '.lookup-form input' },
  { path: profilePath, surface: 'player', task: '.player-tabs button' },
  { path: `/matches/${recentAramWin.metadata.matchId}?${query}`, surface: 'match', task: '.review-back' },
  { path: '/404', surface: 'missing', task: '[data-journey-deck] a[href="/"]' },
];

async function ready(page: Page) {
  await expect(page.locator('[data-rift-scene]')).toHaveAttribute('data-rift-ready', 'true');
  await expect(page.locator('body')).toHaveAttribute('data-journey-ready', 'true');
  await expect(page.locator('astro-island[client="load"][ssr]')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`${viewport.width}px: one shared scene frames every room without covering its first task`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installFixtures(page, { matches: visualMatches });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));

    for (const room of rooms) {
      await test.step(room.path, async () => {
        await page.goto(room.path, { waitUntil: 'domcontentloaded' });
        await ready(page);
        await expect(page.locator('body')).toHaveAttribute('data-surface', room.surface);
        const scene = page.locator('[data-rift-scene]');
        await expect(scene).toHaveCount(1);
        await expect(scene).toHaveAttribute('aria-hidden', 'true');
        await expect(scene).toHaveAttribute('data-rift-surface', room.surface);
        // This scenario deliberately uses reduced motion. Every route must
        // retain the authored environment when the animated renderer is off.
        await expect(scene).toHaveAttribute('data-rift-renderer', 'static');
        await expect(scene).toHaveAttribute('data-rift-motion', 'still');
        if(room.surface==='home')await expect(page.locator('#atlas [data-passage-canvas]')).toBeVisible();
        else await expect(scene.locator('[data-rift-scene-static]')).toBeVisible();
        await expect(scene.locator('[data-rift-scene-canvas]')).toBeHidden();
        await expect(scene.locator('a, button, input, select, textarea, [tabindex]')).toHaveCount(0);
        const task = page.locator(room.task).first();
        await task.scrollIntoViewIfNeeded();
        await expect(task).toBeInViewport({ ratio: .99 });
        expect(await task.evaluate(element => {
          const rect = element.getBoundingClientRect();
          const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
          return hit === element || Boolean(hit && element.contains(hit));
        }), `The environment covers the first task on ${room.path}`).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
        expect(errors, `Unexpected client errors on ${room.path}`).toEqual([]);
      });
    }
  });
}

test('a saved player stays reachable through hydration and rotation with full scene motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 568, height: 320 });
  await page.addInitScript(saved => localStorage.setItem('riftscry:remembered-player:v1', JSON.stringify(saved)), {
    platform, puuid, name: 'ABCDEFGHIJKLMNOP#ABCDE',
  });
  const requests = await installFixtures(page, { matches: visualMatches });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && /hydration|server rendered html/i.test(message.text())) errors.push(message.text());
  });
  await page.goto('/players?view=builds&queue=450&champion=Ahri&result=win', { waitUntil: 'domcontentloaded' });
  await ready(page);
  const form = page.getByRole('form', { name: 'Find a League of Legends player', exact: true, includeHidden: true });
  await expect(form.getByRole('button', { name: 'Find player', exact: true, includeHidden: true })).toBeEnabled();
  const remembered = page.locator('.remembered-player');
  await expect(remembered).toContainText('ABCDEFGHIJKLMNOP#ABCDE');
  await expect(remembered).toContainText('Builds');

  for (const viewport of [{ width: 568, height: 320 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await expect.poll(() => page.locator('[data-player-gateway]').evaluate(element => element.getBoundingClientRect().bottom))
      .toBeLessThanOrEqual(viewport.height + 1);
    expect(await page.evaluate(() => scrollY)).toBe(0);
    const controls = page.locator('[data-player-gateway]').locator('summary:visible, .remembered-player:visible');
    for (const control of await controls.all()) {
      await expect(control).toBeInViewport({ ratio: 1 });
      const box = (await control.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(await control.evaluate(element => {
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return hit === element || Boolean(hit && element.contains(hit));
      })).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  }

  expect(requests, 'The gateway scene must not fetch player records before a player is chosen').toEqual([]);
  await remembered.click();
  await expect(page).toHaveURL(url => url.pathname === profilePath && url.searchParams.get('view') === 'builds'
    && url.searchParams.get('queue') === '450' && url.searchParams.get('champion') === 'Ahri' && url.searchParams.get('result') === 'win');
  await ready(page);
  await expect(page.locator('[data-player-profile]')).toHaveAttribute('data-view', 'builds');
  await expect(page.locator('[data-rift-scene]')).toHaveCount(1);
  expect(errors).toEqual([]);
});
