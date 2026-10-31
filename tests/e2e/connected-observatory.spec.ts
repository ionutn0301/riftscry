import { stationaryWorld } from './journey-test-helpers';
import { expect, test, type Locator, type Page } from '@playwright/test';
import historicalPatch from '../../src/data/patches/26.16.json' with { type: 'json' };

// Behavior of the connected presentation, not a second implementation of its
// state machine. Player/profile/match documents use the fixture-backed SSR
// companion file in tests/player-e2e/connected-observatory.spec.ts.
async function ready(page: Page) {
  await expect(page.locator('body')).toHaveAttribute('data-journey-ready', 'true');
  await expect(page.locator('[data-journey-deck]')).toHaveCount(1);
  await expect(page.locator('astro-island[client="load"][ssr]')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
}

async function reachable(control: Locator) {
  await expect(control).toBeInViewport({ ratio: 0.99 });
  await expect.poll(() => control.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return hit === element || Boolean(hit && element.contains(hit));
  }), { message: 'The selected task must receive a click without the world or navigation covering it' }).toBe(true);
}

async function activeScene(page: Page, id: string) {
  const panel = page.locator(`[data-journey-panel][id="${id}"]`);
  await expect(panel).toBeVisible();
  await expect(page.locator('[data-journey-panel]:visible')).toHaveCount(1);
  await expect(page.locator(`[data-journey-tab="${id}"]`)).toHaveAttribute('aria-selected', 'true');
  await stationaryWorld(page);
  return panel;
}

test('the opening reveals a real signal and its menu supports a useful champion choice', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await ready(page);
  await expect(page.locator('[data-home-signals]')).toBeVisible();
  await page.locator('[data-home-reveal]').click();
  const reveal = await activeScene(page, 'reveal');
  await expect(reveal.locator('[data-home-record]:not([hidden]) .before')).not.toBeEmpty();
  await expect(reveal.locator('[data-home-record]:not([hidden]) .after')).not.toBeEmpty();
  await page.locator('[data-map-open]').click();
  const map = page.locator('#rift-map-dialog');
  const destinations = map.locator('a[data-world-link]');
  await expect(destinations).toHaveCount(5);
  const paths = await destinations.evaluateAll(links => links.map(link => new URL((link as HTMLAnchorElement).href).pathname).sort());
  expect(paths).toEqual(['/champions', '/next-game', '/patches', '/players', '/pool']);
  const champions = map.locator('a[data-world-link][href="/champions"]');
  await champions.scrollIntoViewIfNeeded();
  await reachable(champions);
  await champions.click();
  await expect(page).toHaveURL(url => url.pathname === '/champions');
  await ready(page);
  const search = page.getByRole('searchbox', { name: 'Find a champion', exact: true });
  await reachable(search);
  await search.fill('nunu');
  const result = page.locator('[data-roster-row]:not([hidden])');
  await expect(result).toHaveCount(1);
  await expect(result).toContainText('Nunu & Willump');
  await result.getByRole('link').click();
  await expect(page).toHaveURL(url => url.pathname === '/champion/nunu');
  await ready(page);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Nunu & Willump');
  await activeScene(page, 'history');
  expect(errors).toEqual([]);
});

test('patch stations retain exact filtered records through scene changes, Back and refresh', async ({ page }) => {
  await page.goto('/patch/26.16#champions');
  await ready(page);
  await activeScene(page, 'champions');
  await expect(page.locator('.filter-bar')).toHaveAttribute('data-ready', 'true');
  await page.locator('.patch-filter-options > summary').click();
  const buffs = page.getByRole('button', { name: 'Buffs', exact: true, includeHidden: true });
  await reachable(buffs);
  await buffs.click();
  const expectedIds = historicalPatch.champions.filter(champion => champion.classification === 'buff')
    .map(champion => champion.championId.toLowerCase()).sort();
  const records = page.locator('.change-card[data-champion-id]:not([data-filtered])');
  const actualIds = () => records.evaluateAll(cards => cards.map(card => card.getAttribute('data-champion-id')).sort());
  await expect.poll(actualIds).toEqual(expectedIds);

  await page.locator('[data-journey-tab="items"]').click();
  await expect(page).toHaveURL(url => url.hash === '#items' && url.searchParams.get('type') === 'buff');
  const items = await activeScene(page, 'items');
  const greaves = items.locator('details').filter({ has: page.getByText("Berserker's Greaves", { exact: true }) });
  await expect(greaves.locator('summary')).toBeVisible();
  await expect(greaves).toHaveAttribute('open', '');
  await expect(greaves).toContainText('25%');
  await expect(greaves).toContainText('30%');
  await expect(buffs).toBeHidden();
  // A hidden scene must not be reachable by programmatic focus, either. This
  // catches a visually concealed panel whose controls still steal keyboard input.
  await buffs.evaluate(element => (element as HTMLElement).focus());
  await expect(buffs).not.toBeFocused();
  await page.goBack();
  await expect(page).toHaveURL(url => url.hash === '#champions' && url.searchParams.get('type') === 'buff');
  await activeScene(page, 'champions');
  await expect(buffs).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(actualIds).toEqual(expectedIds);
  await page.reload();
  await ready(page);
  await activeScene(page, 'champions');
  await expect(buffs).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(actualIds).toEqual(expectedIds);
});

test('a deep record reveals its containing scene and keeps a saved champion through the next destination', async ({ page }) => {
  await page.goto('/champion/ahri#perspective');
  await ready(page);
  await activeScene(page, 'perspective');
  await page.locator('[data-journey-tab="history"]').click();
  await activeScene(page, 'history');
  const recordLink = page.locator('[data-history-select]').last();
  const recordHash = await recordLink.getAttribute('href');
  expect(recordHash).toMatch(/^#record-/);
  await recordLink.click();
  const selected = page.locator(recordHash!);
  await expect(selected).toBeVisible();
  await expect(selected.getByRole('link', { name: /^Original source/ })).toHaveAttribute('href', /^https:\/\/www\.leagueoflegends\.com\//);
  await page.reload();
  await ready(page);
  await activeScene(page, 'history');
  await expect(selected).toBeVisible();
  const save = page.locator('[data-direct-save="Ahri"]');
  await reachable(save);
  await save.click();
  await expect(save).toHaveAttribute('aria-pressed', 'true');
  const pool = page.getByRole('navigation', { name: 'Main navigation', exact: true }).getByRole('link', { name: 'Saved', exact: true });
  await reachable(pool);
  await pool.click();
  await expect(page).toHaveURL(url => url.pathname === '/pool');
  await ready(page);
  await page.locator('[data-journey-tab="edit-pool"]').click();
  await activeScene(page, 'edit-pool');
  await expect(page.getByRole('option', { name: 'Ahri', exact: true })).toHaveAttribute('aria-selected', 'true');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('riftscry:pool') ?? '[]'))).toContain('Ahri');
});

test('Explore presents real evidence directly and moves between scenes with tap controls', async ({ page }) => {
  await page.goto('/explore?champion=Azir&older=26.15&newer=26.16#change');
  await ready(page);
  await expect(page.locator('[data-voyage]')).toHaveAttribute('data-loading', 'false');
  await activeScene(page, 'change');
  await expect(page.locator('[data-record-before]')).toHaveText('60 / 80 / 100 / 120 / 140 (+35 / 40 / 45 / 50 / 55% AP)');
  await expect(page.locator('[data-record-after]')).toHaveText('75 / 95 / 115 / 135 / 155 (+35 / 40 / 45 / 50 / 55% AP)');
  await expect(page.locator('[data-record-source]')).toHaveAttribute('href', 'https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-16-notes/');
  const keep = page.locator('[data-focus-record]');
  // Long rank arrays use the document scroll on a phone; controls remain reachable.
  await keep.scrollIntoViewIfNeeded();
  await reachable(keep);
  await stationaryWorld(page);
  await keep.click();
  await expect(keep).toHaveAttribute('aria-pressed', 'true');
  const next = page.locator('[data-journey-next]');
  await reachable(next);
  await next.click();
  await activeScene(page, 'history');
  await expect(page.locator('[data-period-older]')).toHaveValue('26.15');
  await expect(page.locator('[data-period-newer]')).toHaveValue('26.16');
  const previous = page.locator('[data-journey-prev]');
  await reachable(previous);
  await previous.click();
  await activeScene(page, 'change');
  await expect(keep).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-record-after]')).toHaveText('75 / 95 / 115 / 135 / 155 (+35 / 40 / 45 / 50 / 55% AP)');
});

test('keyboard scene navigation never moves focus into an inactive station', async ({ page }) => {
  await page.goto('/champion/ahri#history');
  await ready(page);
  const tabs = page.locator('[data-journey-tabs]');
  await expect(tabs).toHaveAttribute('role', 'tablist');
  const history = page.locator('[data-journey-tab="history"]');
  const sources = page.locator('[data-journey-tab="perspective"]');
  await history.focus();
  await history.press('ArrowRight');
  await expect(sources).toBeFocused();
  await sources.press('Enter');
  await activeScene(page, 'perspective');
  await expect(sources).toHaveAttribute('aria-controls', 'perspective');
  const oldRecordLink = page.locator('[data-history-select]').first();
  await oldRecordLink.evaluate(element => (element as HTMLElement).focus());
  await expect(oldRecordLink).not.toBeFocused();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => {
    const focused = document.activeElement;
    const panel = focused?.closest<HTMLElement>('[data-journey-panel]');
    return !panel || (panel.id === 'perspective' && !panel.hidden && !panel.inert);
  })).toBe(true);
});

test('reduced motion preserves the same scene controls and native archive exit', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/champion/ahri#perspective');
  await ready(page);
  await activeScene(page, 'perspective');
  await expect(page.locator('[data-rift-scene]')).toHaveAttribute('data-rift-renderer', 'static');
  await expect(page.locator('[data-rift-scene-canvas]')).toBeHidden();
  await page.locator('[data-journey-prev]').click();
  const history = await activeScene(page, 'history');
  const patch = history.locator('[data-history-record]:visible a[href^="/patch/"]').first();
  const target = await patch.getAttribute('href');
  expect(target).toMatch(/^\/patch\/\d+\.\d+#ahri$/);
  await patch.click();
  await expect(page).toHaveURL(url => url.pathname + url.hash === target);
  await ready(page);
  await activeScene(page, 'champions');
  await expect(page.locator('#ahri')).toBeVisible();
});
