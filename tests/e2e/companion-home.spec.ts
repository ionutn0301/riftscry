import { test, expect, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Patch } from '../../src/lib/schema';
import { readyWorld, readyJourney, stationaryWorld, unobstructed } from './journey-test-helpers';

const savedPlayer = { platform: 'eun1', puuid: 'fixture-player-000000000000000000000000000000000', name: 'Fixture Player#TEST' };
const rememberedKey = 'riftscry:remembered-player:v1';
const destinations = ['/next-game', '/players', '/champions', '/patches', '/pool#briefing'];
const world = (page: Page) => page.locator('[data-observatory]');
const destination = (page: Page, id: string) => world(page).locator(`[data-world-link="${id}"]`);
async function ready(page: Page) {
  await readyWorld(page);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('yours to explore.');
}
async function target(link: Locator, page: Page) { return new URL(await link.getAttribute('href') ?? '', page.url()); }
function identity(url: URL, player: typeof savedPlayer) {
  expect(url.pathname).toBe('/next-game');
  expect(url.searchParams.get('platform')).toBe(player.platform);
  expect(url.searchParams.get('puuid')).toBe(player.puuid);
  expect(url.searchParams.get('name')).toBe(player.name);
}
async function tap(link: Locator, width: number, height: number) {
  await expect(link).toBeInViewport({ ratio: 0.99 });
  const box = (await link.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(height + 1);
  await unobstructed(link);
}
test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }); });

for (const [width, height] of [[320, 568], [390, 844], [1440, 900]] as const) test(`newcomer destinations and briefing fit ${width}×${height}`, async ({ page }) => {
  await page.setViewportSize({ width, height });
  const requests: string[] = [];
  await page.route('**/api/player/**', route => {
    requests.push(route.request().url());
    return route.fulfill({ status: 503, json: { error: 'The opening must not request player data.' } });
  });
  await page.goto('/'); await ready(page);
  await expect(page.locator('[data-observatory-return]')).toBeHidden();
  for (const [id, href] of [['next-game', '/next-game'], ['players', '/players']] as const) {
    await expect(destination(page, id)).toHaveAttribute('href', href);
    await tap(destination(page, id), width, height);
  }
  await stationaryWorld(page);
  expect(requests).toEqual([]);
  await destination(page, 'next-game').click();
  await expect(page).toHaveURL(url => url.pathname === '/next-game');
  await expect(page.locator('[data-automatic-briefing]')).toBeVisible();
  await page.goBack(); await ready(page);
  await expect(page.locator('[data-observatory-return]')).toBeHidden();
  expect(requests).toEqual([]);
});

for (const [width, height] of [[320, 568], [568, 320], [844, 390], [1440, 900]] as const) test(`five primary and three specialist destinations fit ${width}×${height}`, async ({ page }) => {
  await page.setViewportSize({ width, height });
  await page.goto('/'); await ready(page);
  const opener = page.getByRole('button', { name: 'Open the Rift map', exact: true });
  await tap(opener, width, height); await opener.click();
  const map = page.locator('#rift-map-dialog');
  const links = map.locator('[data-world-link]');
  await expect(links).toHaveCount(5);
  expect(await links.evaluateAll(nodes => nodes.map(node => node.getAttribute('href')))).toEqual(destinations);
  for (const link of await links.all()) await tap(link, width, height);
  for (const href of ['/explore#change', '/compare', '/notebook']) await unobstructed(map.locator(`a[href="${href}"]`));
  expect(await map.locator('.navigation-landscape').evaluate(element => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
  await tap(map.getByRole('button', { name: 'Close the Rift map' }), width, height);
  await unobstructed(map.locator('[data-palette-trigger]'));
  await map.getByRole('button', { name: 'Close the Rift map' }).click();
  await expect(opener).toBeFocused(); await expect(map).toBeHidden();
  await stationaryWorld(page);
});

test('returning players resume the exact identity without a homepage API request', async ({ page }) => {
  await page.addInitScript(({ key, player }) => localStorage.setItem(key, JSON.stringify(player)), { key: rememberedKey, player: savedPlayer });
  const requests: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/player/')) requests.push(request.url()); });
  await page.goto('/'); await ready(page);
  await expect(page.locator('[data-resume-name]')).toHaveText(savedPlayer.name);
  identity(await target(page.locator('[data-resume-link]'), page), savedPlayer);
  identity(await target(destination(page, 'next-game'), page), savedPlayer);
  const games = await target(destination(page, 'players'), page);
  expect(games.pathname).toBe(`/players/${savedPlayer.platform}/${savedPlayer.puuid}`);
  expect(games.searchParams.get('view')).toBe('history');
  expect(games.searchParams.get('name')).toBe(savedPlayer.name);
  expect(requests).toEqual([]);
  for (const invalid of [{ ...savedPlayer, platform: '__proto__' }, { ...savedPlayer, puuid: '../another-route' }, { ...savedPlayer, name: { text: 'Invalid' } }]) {
    await page.evaluate(({ key, value }) => { localStorage.setItem(key, JSON.stringify(value)); window.dispatchEvent(new StorageEvent('storage', { key })); }, { key: rememberedKey, value: invalid });
    await expect(page.locator('[data-observatory-return]')).toBeHidden();
    await expect(destination(page, 'next-game')).toHaveAttribute('href', '/next-game');
    await expect(destination(page, 'players')).toHaveAttribute('href', '/players');
  }
});

test('blocked storage leaves the public destinations available', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }));
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await ready(page);
  await expect(page.locator('[data-observatory-return]')).toBeHidden();
  await destination(page, 'next-game').click();
  await expect(page).toHaveURL(url => url.pathname === '/next-game');
  await expect(page.locator('[data-automatic-briefing]')).toBeVisible();
  expect(errors).toEqual([]);
});

test('the most recent selection and cross-tab changes update the same resume action', async ({ page }) => {
  const recent = { ...savedPlayer, name: 'Recent Player#TEST', puuid: 'recent-player-0000000000000000000000000000000000' };
  await page.addInitScript(({ remembered, selected }) => {
    localStorage.setItem('riftscry:remembered-player:v1', JSON.stringify(remembered));
    localStorage.setItem('riftscry:recent-player:v1', JSON.stringify(selected));
  }, { remembered: savedPlayer, selected: recent });
  const requests: string[] = []; page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/player/')) requests.push(request.url()); });
  await page.goto('/'); await ready(page);
  const shortcut = page.locator('[data-resume-link]');
  await expect(page.locator('[data-resume-name]')).toHaveText(recent.name);
  identity(await target(shortcut, page), recent);
  await page.evaluate(selected => { localStorage.setItem('riftscry:recent-player:v1', JSON.stringify(selected)); window.dispatchEvent(new Event('riftscry:recent-player-change')); }, savedPlayer);
  await expect(page.locator('[data-resume-name]')).toHaveText(savedPlayer.name);
  identity(await target(shortcut, page), savedPlayer);
  const other = await page.context().newPage(); await other.goto('/'); await ready(other);
  await other.evaluate(selected => localStorage.setItem('riftscry:recent-player:v1', JSON.stringify(selected)), recent);
  await expect(page.locator('[data-resume-name]')).toHaveText(recent.name);
  identity(await target(shortcut, page), recent); await other.close();
  expect(requests).toEqual([]);
});

test('a long returning identity leaves the resume action reachable at 320px', async ({ page }) => {
  const player = { ...savedPlayer, name: `${'LongPlayerName'.repeat(9)}#TEST` };
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(selected => localStorage.setItem('riftscry:recent-player:v1', JSON.stringify(selected)), player);
  await page.goto('/'); await ready(page);
  await expect(page.locator('[data-resume-name]')).toHaveText(player.name);
  await tap(page.locator('[data-resume-link]'), 320, 568);
  identity(await target(page.locator('[data-resume-link]'), page), player);
  await stationaryWorld(page);
});

test('the archive entry reaches real records and manual scene choice never rotates automatically', async ({ page }) => {
  await page.goto('/'); await ready(page);
  await world(page).getByRole('link', { name: /^Explore a change/ }).click(); await readyJourney(page);
  for (const championId of ['Azir', 'Belveth']) {
    await page.goto(`/explore?champion=${championId}&older=26.15&newer=26.16#change`); await readyJourney(page);
    const patchId = (await page.locator('[data-record-patch]').innerText()).replace('PATCH ', '');
    const patch = JSON.parse(readFileSync(new URL(`../../src/data/patches/${patchId}.json`, import.meta.url), 'utf8')) as Patch;
    const before = await page.locator('[data-record-before]').innerText();
    const after = await page.locator('[data-record-after]').innerText();
    const label = await page.locator('[data-record-label]').innerText();
    expect(patch.champions.find(champion => champion.championId === championId)?.abilities.flatMap(ability => ability.changes)
      .find(change => change.kind === 'numeric' && change.label === label && change.before === before && change.after === after)).toBeDefined();
    await expect(page.locator('[data-record-source]')).toHaveAttribute('href', patch.sourceUrl);
  }
  const tabs = page.locator('[data-journey-tabs] [role="tab"]'); await tabs.first().focus();
  await page.keyboard.press('ArrowRight'); await expect(tabs.nth(1)).toBeFocused(); await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End'); await expect(tabs.last()).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Home'); await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
  await page.clock.install(); await page.clock.fastForward(30_000);
  await expect(tabs.first()).toHaveAttribute('aria-selected', 'true'); await expect(tabs.first()).toBeFocused(); await stationaryWorld(page);
});

test.describe('static first visit', () => {
  test.use({ javaScriptEnabled: false });
  test('the world and source records remain accessible through native links', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
    await expect(world(page)).toBeVisible();
    await expect(destination(page, 'next-game')).toHaveAttribute('href', '/next-game');
    await expect(destination(page, 'players')).toHaveAttribute('href', '/players');
    await expect(world(page).locator('.observatory-signal a[href^="/patch/"]')).toHaveAttribute('href', /^\/patch\/\d+\.\d+$/);
    await world(page).getByRole('link', { name: /^Explore a change/ }).click();
    await expect(page.locator('[data-record-before]')).not.toBeEmpty(); await expect(page.locator('[data-record-after]')).not.toBeEmpty();
    await expect(page.locator('[data-record-source]')).toHaveAttribute('href', /^https:\/\/www\.leagueoflegends\.com\//);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});

test('old journey links retain their champion, interval and saved reading place', async ({ page }) => {
  await page.goto('/?champion=Azir&older=26.15&newer=26.16#change');
  await expect(page).toHaveURL(url => url.pathname === '/explore' && url.searchParams.get('champion') === 'Azir' && url.hash === '#change');
  await readyJourney(page); await expect(page.locator('[data-record-after]')).toContainText('75 / 95 / 115 / 135 / 155');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('riftscry:resume') ?? '{}').href)).toMatch(/^\/explore\?/);
  await page.getByRole('link', { name: 'RiftScry home', exact: true }).click(); await ready(page);
  await world(page).getByRole('link', { name: /^Explore a change/ }).click(); await readyJourney(page);
});

test('a legacy patch-only journey link still opens the archive journey', async ({ page }) => {
  await page.goto('/?patch=26.16');
  await expect(page).toHaveURL(url => url.pathname === '/explore' && url.searchParams.get('patch') === '26.16');
  await readyJourney(page);
});
