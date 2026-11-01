import { expect, test, type Locator, type Page } from '@playwright/test';
import { installFixtures, platform, profilePath, puuid, query, recentAramWin, visualMatches } from './fixtures';

// The development runtime serves the SSR player/profile/match documents.
// All player responses are existing synthetic fixtures, never a live account.
const routes = [
  { path: '/', surface: 'home', action: '#atlas .atlas-follow-signal' },
  { path: '/explore#perspective', surface: 'explore', action: '[data-roster-open]' },
  { path: '/champions', surface: 'champions', action: '[data-roster-search]' },
  { path: '/champion/nunu', surface: 'champion', action: '[data-direct-save="Nunu"]' },
  { path: '/patches', surface: 'patches', action: '[data-archive-focus-link]' },
  { path: '/patch/26.16#champions', surface: 'patch', action: '.filter-bar input' },
  { path: '/compare/26.16/26.15', surface: 'compare', action: '.compare-picker select' },
  { path: '/pool#edit-pool', surface: 'pool', action: '.pool-picker input' },
  { path: '/next-game', surface: 'next-game', action: '.automatic-lookup input' },
  { path: '/notebook', surface: 'notebook', action: '#notes button' },
  { path: '/players?platform=eun1', surface: 'players', action: '.lookup-form input' },
  { path: profilePath, surface: 'player', action: '.match-row' },
  { path: `/matches/${recentAramWin.metadata.matchId}?${query}`, surface: 'match', action: '.review-back' },
  { path: '/404', surface: 'missing', action: '[data-journey-deck] a[href="/"]' },
];

async function ready(page: Page) {
  await expect(page.locator('body')).toHaveAttribute('data-journey-ready', 'true');
  await expect(page.locator('[data-journey-deck]')).toHaveCount(1);
  await expect(page.locator('astro-island[client="load"][ssr]')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
}

async function reachable(control: Locator) {
  await control.scrollIntoViewIfNeeded();
  await expect(control).toBeInViewport({ ratio: 0.99 });
  await expect.poll(() => control.evaluate(element => {
    const box = element.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return hit === element || Boolean(hit && element.contains(hit));
  })).toBe(true);
}

// Independent cases keep slow device/hydration failures isolated. A route should
// not inherit the elapsed timeout budget of thirteen previous navigations.
for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  for (const route of routes) {
    test(`${viewport.width}px ${route.surface}: the station and its task fit one navigable world`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const requests = await installFixtures(page, { matches: visualMatches });
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      expect(response?.status()).toBe(route.surface === 'missing' ? 404 : 200);
      await ready(page);
      await expect(page.locator('body')).toHaveAttribute('data-surface', route.surface);
      const panel = page.locator('[data-journey-panel]:visible');
      await expect(panel).toHaveCount(1);
      const geometry = await panel.evaluate(element => {
        const box = element.getBoundingClientRect();
        return { top: box.top, bottom: box.bottom, width: box.width, height: box.height };
      });
      expect(geometry.top).toBeGreaterThanOrEqual(0);
      expect(geometry.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(geometry.width).toBeGreaterThan(0);
      expect(geometry.height).toBeGreaterThan(100);
      const panelCount = await page.locator('[data-journey-panel]').count();
      if (panelCount > 1 && route.surface!=='home') await expect(page.locator('#main [data-journey-controls]')).toBeVisible();
      // Single-task destinations do not need an extra scene-navigation row;
      // their panel still has an accessible name and the same main navigation.
      await expect(panel).toHaveAttribute('role', 'tabpanel');
      await expect(panel).toHaveAccessibleName(/\S/);
      const navigation = page.getByRole('navigation', { name:'Journey destinations', exact: true });
      await expect(navigation.getByRole('link')).toHaveCount(5);
      for (const name of ['Home','Briefing','Atlas','Games','Saved']) {
        const destination = navigation.getByRole('link', { name, exact: true });
        await reachable(destination);
        expect((await destination.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      await reachable(page.locator(route.action).first());
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      // A route may be longer than the screen, but the document is the only
      // vertical scroll surface. Never trap content inside another scrollport.
      const scrolling = await page.locator('#main').evaluate(main =>
        [...main.querySelectorAll('*')].filter(element =>
          /^(auto|scroll)$/.test(getComputedStyle(element).overflowY) &&
          element.scrollHeight > element.clientHeight + 3).length);
      expect(scrolling).toBe(0);
      const maxScroll = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      const windowScroll = await page.evaluate(() => { window.scrollTo({ top: innerHeight * 2, behavior: 'instant' }); return scrollY; });
      expect(windowScroll).toBeGreaterThanOrEqual(0);
      if (maxScroll > 5) expect(windowScroll).toBeGreaterThan(0);
      expect(requests.filter(request => request.action === 'review' || request.action === 'timeline')).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
}

test('a match continues into its prepared briefing and loadout without another lookup or a manual note', async ({ page }) => {
  const requests = await installFixtures(page, { matches: [recentAramWin] });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`/matches/${recentAramWin.metadata.matchId}?${query}`);
  await ready(page);
  const briefing = page.getByRole('link', { name: 'Automatic briefing', exact: true });
  await reachable(briefing);
  await briefing.click();
  await expect(page).toHaveURL(url => url.pathname === '/next-game' && url.searchParams.get('platform') === platform
    && url.searchParams.get('puuid') === puuid && url.searchParams.get('queue') === '450' && url.searchParams.get('champion') === 'Ahri');
  await ready(page);
  await expect(page.locator('[data-briefing-report]')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#focus')).toBeVisible();
  const loadout = page.locator('[data-journey-tab="loadout"]');
  await reachable(loadout);
  await loadout.click();
  await expect(page.locator('#loadout')).toBeVisible();
  await expect(page.locator('#focus')).toBeHidden();
  await expect(page.locator('#loadout').getByRole('heading', { name: 'Your last Ahri loadout.', exact: true })).toBeVisible();
  await expect(page.locator('#loadout').getByText('Boots', { exact: true })).toBeVisible();
  await expect(page.locator('#loadout').getByRole('link', { name: 'Inspect the match', exact: true })).toHaveAttribute('href', new RegExp(`/matches/${recentAramWin.metadata.matchId}\\?`));
  expect(requests.filter(request => ['lookup', 'review', 'timeline'].includes(request.action))).toEqual([]);
  expect(await page.evaluate(key => localStorage.getItem(key), `riftscry:build-memory:v1:${platform}:${puuid}`)).toBeNull();
  await page.goBack();
  await expect(page.locator('#focus')).toBeVisible();
  await expect(page.locator('#loadout')).toBeHidden();
  await page.goBack();
  await expect(page).toHaveURL(url => url.pathname === `/matches/${recentAramWin.metadata.matchId}`);
  await ready(page);
  expect(errors).toEqual([]);
});
