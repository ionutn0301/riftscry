import { test, expect, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Patch } from '../../src/lib/schema';

const savedPlayer = { platform: 'eun1', puuid: 'fixture-player-000000000000000000000000000000000', name: 'Fixture Player#TEST' };
const rememberedKey = 'riftscry:remembered-player:v1';
const destinations = ['/players', '/next-game', '/pool', '/champions', '/patches', '/compare', '/explore'];

async function homeReady(page: Page) {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The Rift changes. You’re ready.');
  await expect(page.locator('astro-island[component-url*="HomeReturn"]')).not.toHaveAttribute('ssr', '');
  await expect(page.locator('[data-home-launcher]')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

async function targetUrl(link: Locator, page: Page) {
  return new URL(await link.getAttribute('href') ?? '', page.url());
}

function expectBriefingIdentity(url: URL, player: typeof savedPlayer) {
  expect(url.pathname).toBe('/next-game');
  expect(url.searchParams.get('platform')).toBe(player.platform);
  expect(url.searchParams.get('puuid')).toBe(player.puuid);
  expect(url.searchParams.get('name')).toBe(player.name);
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
  test(`newcomer purpose and primary actions fit ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const playerRequests: string[] = [];
    await page.route('**/api/player/**', route => {
      playerRequests.push(new URL(route.request().url()).pathname);
      return route.fulfill({ status: 503, json: { error: 'Homepage must not request player data.' } });
    });
    await page.goto('/');
    await homeReady(page);
    const launcher = page.locator('[data-home-launcher]');
    await expect(launcher).toHaveAttribute('data-player-state', 'new');
    await expect(page.locator('[data-home-signals]')).toBeVisible();
    const tasks = [
      ['Get my briefing', '/next-game'],
      ['Find my games', '/players'],
    ] as const;
    for (const [name, href] of tasks) {
      const action = launcher.getByRole('link', { name, exact: true });
      await expect(action).toHaveAttribute('href', href);
      await expectTapTarget(action, width, height);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    expect(playerRequests).toEqual([]);
    if (width === 390) {
      const example = page.locator('[data-home-signals]').getByRole('tabpanel');
      await expect(example.locator('[data-signal-before]')).toBeInViewport({ ratio: 1 });
      await expect(example.locator('[data-signal-after]')).toBeInViewport({ ratio: 1 });
    }

    // The dynamic player entry is exercised end-to-end in companion-integration.
    // This suite serves the production build's static archive/preparation output.
    await launcher.getByRole('link', { name: 'Get my briefing', exact: true }).click();
    await expect(page).toHaveURL(/\/next-game\/?$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your next game.');
    await expect(page.locator('[data-automatic-briefing]')).toBeVisible();
    await page.goBack();
    await homeReady(page);
    await expect(page.locator('[data-home-launcher]')).toHaveAttribute('data-player-state', 'new');
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

test('returning players get explicit briefing, match, build and catch-up destinations', async ({ page }) => {
  await page.addInitScript(({ key, player }) => localStorage.setItem(key, JSON.stringify(player)), { key: rememberedKey, player: savedPlayer });
  const requests: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/player/')) requests.push(request.url()); });
  await page.goto('/');
  await homeReady(page);
  const launcher = page.locator('[data-home-launcher]');
  await expect(launcher).toHaveAttribute('data-player-state', 'returning');
  await expect(launcher.locator('.home-launcher-identity')).toContainText(savedPlayer.name);
  await expect(launcher.locator('.home-launcher-region')).toContainText('EUNE');
  await expect(launcher.getByRole('link', { name: 'Get my briefing', exact: true })).toHaveCount(0);
  expectBriefingIdentity(await targetUrl(launcher.getByRole('link', { name: 'Open my briefing', exact: true }), page), savedPlayer);
  for (const [name, view] of [['My matches', 'history'], ['My builds', 'builds']] as const) {
    const destination = await targetUrl(launcher.getByRole('link', { name, exact: true }), page);
    expect(destination.pathname).toBe(`/players/${savedPlayer.platform}/${savedPlayer.puuid}`);
    expect(destination.searchParams.get('view')).toBe(view);
    expect(destination.searchParams.get('name')).toBe(savedPlayer.name);
  }
  const catchUp = await targetUrl(launcher.getByRole('link', { name: 'Catch up', exact: true }), page);
  expectBriefingIdentity(catchUp, savedPlayer);
  expect(catchUp.hash).toBe('#changes');
  await expect(launcher.getByRole('link', { name: 'Change player', exact: true })).toHaveAttribute('href', '/next-game?change=1');
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
    await expect(launcher).toHaveAttribute('data-player-state', 'new');
    await expect(launcher.getByRole('link', { name: 'Open my briefing', exact: true })).toHaveCount(0);
  }
  await expect(launcher.getByRole('link', { name: 'Find my games', exact: true })).toBeVisible();
});

test('blocked browser storage leaves the public companion actions available', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }));
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await homeReady(page);
  await expect(page.locator('[data-home-launcher]')).toHaveAttribute('data-player-state', 'new');
  await page.locator('[data-home-launcher]').getByRole('link', { name: 'Get my briefing', exact: true }).click();
  await expect(page).toHaveURL(/\/next-game\/?$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your next game.');
  await expect(page.locator('[data-automatic-briefing]')).toBeVisible();
  expect(errors).toEqual([]);
});

test('the most recently selected player returns directly to a briefing without a homepage request', async ({ page }) => {
  const recent = { ...savedPlayer, name: 'Recent Player#TEST', puuid: 'recent-player-0000000000000000000000000000000000' };
  await page.addInitScript(({ remembered, selected }) => {
    localStorage.setItem('riftscry:remembered-player:v1', JSON.stringify(remembered));
    localStorage.setItem('riftscry:recent-player:v1', JSON.stringify(selected));
  }, { remembered: savedPlayer, selected: recent });
  const requests: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/player/')) requests.push(request.url()); });
  await page.goto('/');
  await homeReady(page);
  const launcher = page.locator('[data-home-launcher]');
  const shortcut = launcher.getByRole('link', { name: 'Open my briefing', exact: true });
  await expect(launcher.locator('.home-launcher-identity')).toContainText(recent.name);
  expectBriefingIdentity(await targetUrl(shortcut, page), recent);

  await page.evaluate(selected => {
    localStorage.setItem('riftscry:recent-player:v1', JSON.stringify(selected));
    window.dispatchEvent(new Event('riftscry:recent-player-change'));
  }, savedPlayer);
  await expect(launcher.locator('.home-launcher-identity')).toContainText(savedPlayer.name);
  expectBriefingIdentity(await targetUrl(shortcut, page), savedPlayer);

  const otherTab = await page.context().newPage();
  await otherTab.goto('/');
  await homeReady(otherTab);
  await otherTab.evaluate(selected => localStorage.setItem('riftscry:recent-player:v1', JSON.stringify(selected)), recent);
  await expect(launcher.locator('.home-launcher-identity')).toContainText(recent.name);
  expectBriefingIdentity(await targetUrl(shortcut, page), recent);
  await otherTab.close();
  expect(requests).toEqual([]);
});

test('a long returning identity keeps the main action reachable and the page within 320px', async ({ page }) => {
  const player = { ...savedPlayer, name: `${'LongPlayerName'.repeat(9)}#TEST` };
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(selected => localStorage.setItem('riftscry:recent-player:v1', JSON.stringify(selected)), player);
  await page.goto('/');
  await homeReady(page);
  const launcher = page.locator('[data-home-launcher]');
  await expect(launcher).toHaveAttribute('data-player-state', 'returning');
  await expect(launcher.locator('.home-launcher-name')).toHaveText(player.name);
  const primary = launcher.getByRole('link', { name: 'Open my briefing', exact: true });
  await primary.scrollIntoViewIfNeeded();
  await expectTapTarget(primary, 320, 568);
  expectBriefingIdentity(await targetUrl(primary, page), player);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  for (const link of await launcher.getByRole('link').all()) {
    await link.scrollIntoViewIfNeeded();
    await expectTapTarget(link, 320, 568);
  }
});

test('archive examples show real records and support keyboard selection without automatic movement', async ({ page }) => {
  await page.clock.install();
  const playerRequests: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/player/')) playerRequests.push(request.url()); });
  await page.goto('/');
  await homeReady(page);
  const signals = page.locator('[data-home-signals]');
  await expect(signals).toHaveAttribute('data-ready', 'true');
  await expect(signals).toContainText('An archive example.');
  const tabs = signals.getByRole('tablist', { name: 'Choose a patch example', exact: true }).getByRole('tab');
  await expect(tabs).toHaveCount(3);

  for (const tab of await tabs.all()) {
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    const panelId = await tab.getAttribute('aria-controls');
    expect(panelId).toBeTruthy();
    const panel = page.locator(`[id="${panelId}"]`);
    await expect(signals.getByRole('tabpanel')).toHaveCount(1);
    await expect(panel).toBeVisible();
    const patchId = await panel.getAttribute('data-patch');
    const championId = await panel.getAttribute('data-champion');
    expect(patchId).toMatch(/^\d+\.\d+$/);
    expect(championId).toMatch(/^[A-Za-z0-9]+$/);
    const patch = JSON.parse(readFileSync(new URL(`../../src/data/patches/${patchId}.json`, import.meta.url), 'utf8')) as Patch;
    const champion = patch.champions.find(change => change.championId === championId);
    expect(champion).toBeDefined();
    const before = (await panel.locator('[data-signal-before]').innerText()).trim();
    const after = (await panel.locator('[data-signal-after]').innerText()).trim();
    const label = (await panel.locator('.home-signal-label').innerText()).trim();
    const recorded = champion!.abilities.flatMap(ability => ability.changes.map(change => ({ ability, change })))
      .find(({ change }) => change.kind === 'numeric' && change.label === label && change.before === before && change.after === after);
    expect(recorded, `${championId} ${patchId}: the displayed before/after pair must exist in the source record`).toBeDefined();
    await expect(panel.locator('.home-signal-ability')).toContainText(recorded!.ability.name);
    await expect(panel.getByRole('link', { name: 'Read the full record', exact: true })).toHaveAttribute('href', `/patch/${patchId}#${championId!.toLowerCase()}`);
    await expect(panel.getByRole('link', { name: 'Riot’s notes', exact: true })).toHaveAttribute('href', patch.sourceUrl);
  }

  await tabs.nth(0).focus();
  await page.keyboard.press('ArrowRight');
  await expect(tabs.nth(1)).toBeFocused();
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(tabs.nth(2)).toBeFocused();
  await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(tabs.nth(0)).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(tabs.nth(2)).toBeFocused();
  await page.keyboard.press('Home');
  await expect(tabs.nth(0)).toBeFocused();
  await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
  await expect(tabs.nth(0)).toHaveAttribute('tabindex', '0');
  await expect(tabs.nth(1)).toHaveAttribute('tabindex', '-1');
  await expect(tabs.nth(2)).toHaveAttribute('tabindex', '-1');
  await page.clock.fastForward(30_000);
  await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
  await expect(tabs.nth(0)).toBeFocused();
  expect(await signals.evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length)).toBe(0);
  expect(playerRequests).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test.describe('static first visit', () => {
  test.use({ javaScriptEnabled: false });
  test('the purpose, primary entry and archive example remain usable without JavaScript', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('The Rift changes. You’re ready.');
    const launcher = page.locator('[data-home-launcher]');
    await expect(launcher).toHaveAttribute('data-player-state', 'new');
    await expect(launcher.getByRole('link', { name: 'Get my briefing', exact: true })).toHaveAttribute('href', '/next-game');
    await expect(launcher.getByRole('link', { name: 'Find my games', exact: true })).toHaveAttribute('href', '/players');
    const signals = page.locator('[data-home-signals]');
    await expect(signals).toBeVisible();
    await expect(signals.getByRole('tabpanel')).toHaveCount(1);
    await expect(signals.getByRole('tabpanel').locator('[data-signal-after]')).not.toBeEmpty();
    await expect(signals.getByRole('link', { name: 'Read the full record', exact: true })).toHaveAttribute('href', /^\/patch\/\d+\.\d+#[a-z0-9]+$/);
    for (const tab of await signals.getByRole('tab').all()) await expect(tab).toBeDisabled();
    await expect(page.getByRole('navigation', { name: 'RiftScry destinations', exact: true }).last()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
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
