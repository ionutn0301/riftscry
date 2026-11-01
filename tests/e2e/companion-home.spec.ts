import { test, expect, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Patch } from '../../src/lib/schema';
import { homeSignals, openScene, reachableTarget, readySignal, readyWorld, readyJourney, stationaryWorld } from './journey-test-helpers';

const savedPlayer = { platform: 'eun1', puuid: 'fixture-player-000000000000000000000000000000000', name: 'Fixture Player#TEST' };
const rememberedKey = 'riftscry:remembered-player:v1';
const destinations = ['/next-game', '/players', '/champions', '/patches', '/pool#briefing'];
const personal = (page: Page) => page.locator('#signal [data-home-personal]');
const destination = (page: Page, id: string) => page.locator(`#rift-map-dialog [data-station-link="${id}"]`);
async function target(link: Locator, page: Page) { return new URL(await link.getAttribute('href') ?? '', page.url()); }
function identity(url: URL, player: typeof savedPlayer) {
  expect(url.pathname).toBe('/next-game');
  expect(url.searchParams.get('platform')).toBe(player.platform);
  expect(url.searchParams.get('puuid')).toBe(player.puuid);
  expect(url.searchParams.get('name')).toBe(player.name);
}
const findings = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('riftscry:kept-findings') ?? '[]'));
test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }); });

for (const [width, height] of [[320, 568], [390, 844], [1440, 900]] as const) test(`a newcomer can reveal a signal or enter a briefing at ${width}×${height} without a player request`, async ({ page }) => {
  await page.setViewportSize({ width, height });
  const requests: string[] = [];
  await page.route('**/api/player/**', route => {
    requests.push(route.request().url());
    return route.fulfill({ status: 503, json: { error: 'The opening must not request player data.' } });
  });
  await page.goto('/'); await readySignal(page);
  await expect(page.locator('[data-home-return]')).toBeHidden();
  await expect(personal(page)).toHaveAttribute('href', '/next-game');
  await reachableTarget(personal(page), page);
  await reachableTarget(page.locator('[data-home-reveal]'), page);
  await expect(destination(page, 'players')).toHaveAttribute('href', '/players');
  await stationaryWorld(page);
  expect(requests).toEqual([]);
  await personal(page).click();
  await expect(page).toHaveURL(url => url.pathname === '/next-game');
  await expect(page.locator('[data-automatic-briefing]')).toBeVisible();
  await page.goBack(); await readySignal(page);
  await expect(page.locator('[data-home-return]')).toBeHidden();
  expect(requests).toEqual([]);
});

for (const [width, height] of [[320, 568], [568, 320], [844, 390], [1440, 900]] as const) test(`the map keeps five destinations and specialist tools reachable at ${width}×${height}`, async ({ page }) => {
  await page.setViewportSize({ width, height });
  await page.goto('/'); await readySignal(page);
  const opener = page.getByRole('button', { name: 'Open the Rift map', exact: true });
  await reachableTarget(opener, page); await opener.click();
  const map = page.getByRole('dialog', { name: 'Where next?', exact: true });
  const links = map.locator('.signal-destinations [data-station-link]');
  await expect(links).toHaveCount(5);
  expect(await links.evaluateAll(nodes => nodes.map(node => node.getAttribute('href')))).toEqual(destinations);
  // The destination list may scroll on a short screen; the document must not.
  for (const link of await links.all()) await reachableTarget(link, page);
  await reachableTarget(map.locator('[data-map-explore]'), page);
  await expect(map.locator('[data-signal-compare]')).toHaveAttribute('href', /^\/compare\/\d+\.\d+\/\d+\.\d+$/);
  await reachableTarget(map.locator('[data-signal-compare]'), page);
  await reachableTarget(map.locator('a[href="/notebook"]'), page);
  await reachableTarget(map.getByRole('button', { name: 'Search the archive', exact: true }), page);
  const close = map.getByRole('button', { name: 'Close the Rift map', exact: true });
  await reachableTarget(close, page); await close.click();
  await expect(opener).toBeFocused(); await expect(map).toBeHidden();
  await stationaryWorld(page);
});

test('returning players resume the exact identity without a homepage API request', async ({ page }) => {
  await page.addInitScript(({ key, player }) => localStorage.setItem(key, JSON.stringify(player)), { key: rememberedKey, player: savedPlayer });
  const requests: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/player/')) requests.push(request.url()); });
  await page.goto('/'); await readySignal(page);
  await expect(page.locator('[data-home-return]')).toContainText(savedPlayer.name);
  identity(await target(personal(page), page), savedPlayer);
  identity(await target(destination(page, 'next-game'), page), savedPlayer);
  const games = await target(destination(page, 'players'), page);
  expect(games.pathname).toBe(`/players/${savedPlayer.platform}/${savedPlayer.puuid}`);
  expect(games.searchParams.get('view')).toBe('history');
  expect(games.searchParams.get('name')).toBe(savedPlayer.name);
  expect(requests).toEqual([]);
  for (const invalid of [{ ...savedPlayer, platform: '__proto__' }, { ...savedPlayer, puuid: '../another-route' }, { ...savedPlayer, name: { text: 'Invalid' } }]) {
    await page.evaluate(({ key, value }) => { localStorage.setItem(key, JSON.stringify(value)); window.dispatchEvent(new StorageEvent('storage', { key })); }, { key: rememberedKey, value: invalid });
    await expect(page.locator('[data-home-return]')).toBeHidden();
    await expect(personal(page)).toHaveAttribute('href', '/next-game');
    await expect(personal(page)).toHaveText('Use my games →');
    await expect(destination(page, 'next-game')).toHaveAttribute('href', '/next-game');
    await expect(destination(page, 'players')).toHaveAttribute('href', '/players');
  }
  expect(requests).toEqual([]);
});

test('blocked storage keeps public navigation working and reports an unsaved finding honestly', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }));
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await readySignal(page);
  await expect(page.locator('[data-home-return]')).toBeHidden();
  await openScene(page, 'reveal');
  await page.locator('[data-home-keep]').click();
  await expect(page.locator('[data-home-keep-status]')).toContainText('could not save the finding');
  await expect(page.locator('[data-home-keep]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-journey-panel]:visible')).toHaveAttribute('id', 'reveal');
  await openScene(page, 'signal');
  await personal(page).click();
  await expect(page).toHaveURL(url => url.pathname === '/next-game');
  await expect(page.locator('[data-automatic-briefing]')).toBeVisible();
  expect(errors).toEqual([]);
});

test('the most recent selection and real cross-tab changes update and clear the same briefing action', async ({ page }) => {
  const recent = { ...savedPlayer, name: 'Recent Player#TEST', puuid: 'recent-player-0000000000000000000000000000000000' };
  await page.addInitScript(({ remembered, selected }) => {
    localStorage.setItem('riftscry:remembered-player:v1', JSON.stringify(remembered));
    localStorage.setItem('riftscry:recent-player:v1', JSON.stringify(selected));
  }, { remembered: savedPlayer, selected: recent });
  const requests: string[] = []; page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/player/')) requests.push(request.url()); });
  await page.goto('/'); await readySignal(page);
  await expect(page.locator('[data-home-return]')).toContainText(recent.name);
  identity(await target(personal(page), page), recent);
  await page.evaluate(selected => { localStorage.setItem('riftscry:recent-player:v1', JSON.stringify(selected)); window.dispatchEvent(new Event('riftscry:recent-player-change')); }, savedPlayer);
  await expect(page.locator('[data-home-return]')).toContainText(savedPlayer.name);
  identity(await target(personal(page), page), savedPlayer);
  const other = await page.context().newPage(); await other.goto('/'); await readySignal(other);
  await other.evaluate(selected => localStorage.setItem('riftscry:recent-player:v1', JSON.stringify(selected)), recent);
  await expect(page.locator('[data-home-return]')).toContainText(recent.name);
  identity(await target(personal(page), page), recent);
  await other.evaluate(() => localStorage.clear());
  await expect(page.locator('[data-home-return]')).toBeHidden();
  await expect(personal(page)).toHaveAttribute('href', '/next-game');
  await expect(destination(page, 'players')).toHaveAttribute('href', '/players');
  await other.close();
  expect(requests).toEqual([]);
});

test('a long returning identity leaves the briefing action reachable at 320px', async ({ page }) => {
  const player = { ...savedPlayer, name: `${'LongPlayerName'.repeat(9)}#TEST` };
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(selected => localStorage.setItem('riftscry:recent-player:v1', JSON.stringify(selected)), player);
  await page.goto('/'); await readySignal(page);
  await expect(page.locator('[data-home-return]')).toContainText(player.name);
  await reachableTarget(personal(page), page);
  identity(await target(personal(page), page), player);
  await stationaryWorld(page);
});

test('reveal, keep and carry preserve one exact source record through Saved and browser Back', async ({ page }) => {
  await page.goto('/'); await readySignal(page);
  const signal = (await homeSignals(page))[1]!;
  const patch = JSON.parse(readFileSync(new URL(`../../src/data/patches/${signal.patchId}.json`, import.meta.url), 'utf8')) as Patch;
  expect(patch.champions.find(champion => champion.championId === signal.championId)?.abilities
    .find(ability => ability.ability === signal.ability)?.changes
    .find(change => change.kind === 'numeric' && change.label === signal.label && change.before === signal.before && change.after === signal.after)).toBeDefined();
  await page.locator(`[data-home-choice="${signal.championId}"]`).click();
  await expect(page.locator('[data-home-signals]')).toHaveAttribute('data-home-subject', signal.championId);
  await expect(page).toHaveURL(url => url.searchParams.get('signal') === signal.championId);
  expect(await findings(page)).toEqual([]);
  await page.locator('[data-home-reveal]').click();
  await expect(page.locator('[data-journey-panel]:visible')).toHaveAttribute('id', 'reveal');
  const record = page.locator('[data-home-record]:not([hidden])');
  await expect(record.locator('.before')).toHaveText(signal.before);
  await expect(record.locator('.after')).toHaveText(signal.after);
  await expect(record.getByRole('link', { name: 'Original source' })).toHaveAttribute('href', patch.sourceUrl);
  // The home desk presents both exact values together, without a manual scrub.
  await expect(record.locator('[data-signal-scrub]')).toBeHidden();
  await expect(record.locator('.before')).toHaveText(signal.before);
  await expect(record.locator('.after')).toHaveText(signal.after);
  expect(await findings(page)).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('riftscry:last-reviewed-patch'))).toBeNull();
  await page.locator('[data-home-keep]').click();
  await expect(page.locator('[data-journey-panel]:visible')).toHaveAttribute('id', 'carry');
  await expect(page.locator('[data-home-carry-caption]')).toHaveText('FINDING KEPT / ON THIS DEVICE');
  await expect(page.locator('[data-home-carry-value]')).toHaveText(`${signal.before} → ${signal.after}`);
  await expect(page.locator('[data-home-explore]')).toHaveAttribute('href', signal.explore);
  const kept = [{ id: signal.record.id, champion: signal.championId, name: signal.championName, patch: signal.patchId, date: signal.releaseDate, label: `${signal.abilityName} / ${signal.label}`, text: `${signal.before} → ${signal.after}`, href: signal.explore }];
  expect(await findings(page)).toEqual(kept);
  await page.locator('#carry a[href="/pool#findings"]').click(); await readyWorld(page);
  await expect(page).toHaveURL(url => url.pathname === '/pool' && url.hash === '#findings');
  const savedRecord = page.locator('.kept-collection li a');
  await expect(savedRecord).toHaveCount(1);
  await expect(savedRecord).toHaveAttribute('href', signal.explore);
  await expect(savedRecord).toContainText(`${signal.before} → ${signal.after}`);
  await page.goBack(); await readySignal(page);
  await expect(page.locator('[data-home-signals]')).toHaveAttribute('data-home-subject', signal.championId);
  await expect(page.locator('[data-journey-panel]:visible')).toHaveAttribute('id', 'carry');
  await openScene(page, 'reveal');
  await expect(page.locator('[data-home-keep]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-home-keep]').click();
  await expect(page.locator('[data-journey-panel]:visible')).toHaveAttribute('id', 'carry');
  expect(await findings(page)).toEqual(kept);
});

test('a full collection refuses a new finding without silently evicting earlier work', async ({ page }) => {
  const full = Array.from({ length: 50 }, (_, index) => ({ id: `fixture-${index}`, champion: 'Ahri', name: 'Ahri', patch: '26.1', date: '2026-01-08', label: `Finding ${index}`, text: 'Recorded evidence', href: '/patch/26.1#ahri' }));
  await page.addInitScript(saved => localStorage.setItem('riftscry:kept-findings', JSON.stringify(saved)), full);
  await page.goto('/'); await readySignal(page); await openScene(page, 'reveal');
  await page.locator('[data-home-keep]').click();
  await expect(page.locator('[data-home-keep-status]')).toContainText('holds 50 findings');
  await expect(page.locator('[data-journey-panel]:visible')).toHaveAttribute('id', 'reveal');
  await expect(page.locator('[data-home-keep]')).toHaveAttribute('aria-pressed', 'false');
  expect(await findings(page)).toEqual(full);
});

test('an earlier subject outside the featured three remains resumable without the homepage replacing it', async ({ page }) => {
  await page.goto('/'); await readySignal(page);
  const featured = (await homeSignals(page)).map(signal => signal.championId);
  const championId = ['Ahri', 'Ashe', 'Zilean', 'Annie'].find(id => !featured.includes(id))!;
  const retained = { championId, name: championId, href: `/champion/${championId.toLowerCase()}?mode=reader#perspective` };
  await page.evaluate(context => localStorage.setItem('riftscry:signal-context:v1', JSON.stringify(context)), retained);
  await page.goto('/'); await readySignal(page);
  await expect(page.locator('[data-home-context]')).toHaveAttribute('href', retained.href);
  await expect(page.locator('[data-home-context]')).toContainText(championId);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('riftscry:signal-context:v1') ?? 'null'))).toEqual(retained);
  expect(await findings(page)).toEqual([]);
  await page.locator('[data-home-context]').click(); await readyWorld(page);
  await expect(page).toHaveURL(new URL(retained.href, page.url()).href);
  await expect(page.locator('[data-journey-panel]:visible')).toHaveAttribute('id', 'perspective');
});

test('the archive entry reaches real records and manual scene choice never rotates automatically', async ({ page }) => {
  await page.goto('/'); await readySignal(page); await openScene(page, 'carry');
  await page.locator('[data-home-explore]').click(); await readyJourney(page);
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
  test('all acts expose exact source evidence and useful native destinations without inert save controls', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
    const signal = (await homeSignals(page))[0]!;
    await expect(page.locator('[data-home-signals]')).toBeVisible();
    await expect(personal(page)).toHaveAttribute('href', '/next-game');
    await expect(page.locator('.world-nojs-nav a[href="/players"]')).toBeVisible();
    await expect(page.locator('.signal-archive-stamp')).toHaveAttribute('href', /^\/patch\/\d+\.\d+$/);
    await expect(page.locator('[data-home-keep]')).toBeHidden();
    const record = page.locator('[data-home-record]:not([hidden])');
    await expect(record.locator('.before')).toHaveText(signal.before);
    await expect(record.locator('.after')).toHaveText(signal.after);
    await expect(record.getByRole('link', { name: 'Original source' })).toHaveAttribute('href', signal.sourceUrl);
    await page.locator('[data-home-choice]').first().click();
    await expect(page).toHaveURL(new URL(signal.explore, page.url()).href);
    await expect(page.locator('[data-record-before]')).not.toBeEmpty(); await expect(page.locator('[data-record-after]')).not.toBeEmpty();
    await expect(page.locator('[data-record-source]')).toHaveAttribute('href', /^https:\/\/www\.leagueoflegends\.com\//);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});

test('old journey links retain their champion, interval and exact saved reading place', async ({ page }) => {
  await page.goto('/?champion=Azir&older=26.15&newer=26.16#change');
  await expect(page).toHaveURL(url => url.pathname === '/explore' && url.searchParams.get('champion') === 'Azir' && url.hash === '#change');
  await readyJourney(page); await expect(page.locator('[data-record-after]')).toContainText('75 / 95 / 115 / 135 / 155');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('riftscry:resume') ?? '{}').href)).toMatch(/^\/explore\?/);
  const exact = await page.evaluate(() => JSON.parse(localStorage.getItem('riftscry:signal-context:v1') ?? '{}').href as string);
  const exactUrl = new URL(exact, page.url());
  expect(exactUrl.searchParams.get('older')).toBe('26.15'); expect(exactUrl.searchParams.get('newer')).toBe('26.16');
  await page.getByRole('link', { name: 'RiftScry home', exact: true }).click(); await readySignal(page);
  await expect(page.locator('[data-home-context]')).toHaveAttribute('href', exact);
  await page.locator('[data-home-context]').click(); await readyJourney(page);
  await expect(page).toHaveURL(exactUrl.href);
});

test('a legacy patch-only journey link still opens the archive journey', async ({ page }) => {
  await page.goto('/?patch=26.16');
  await expect(page).toHaveURL(url => url.pathname === '/explore' && url.searchParams.get('patch') === '26.16');
  await readyJourney(page);
});
