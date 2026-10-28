import { test, expect, type Page } from '@playwright/test';
import { RECENT_PLAYER_KEY } from '../../src/lib/player/identity';
import { installFixtures, makeMatch, platform, puuid, otherPuuid, recentAramWin, sourceMatch, type FixtureRequest } from '../player-e2e/fixtures';

const player = { platform, puuid, name: 'Fixture Player#TEST' };
const direct = (id = puuid, extra = '') => `/next-game?platform=${platform}&puuid=${id}${extra}`;
const rememberedKey = 'riftscry:remembered-player:v1';
const archiveMatch = makeMatch('EUN1_99101', Date.parse('2026-10-18T18:00:00Z'), 6621);
archiveMatch.info.gameVersion = '16.20.1';
archiveMatch.info.participants[0]!.championName = 'Azir';

async function open(page: Page, path = '/next-game') {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your next game.');
  await expect(page.locator('astro-island:has([data-automatic-briefing])')).not.toHaveAttribute('ssr', '');
  await expect(page.getByRole('status').filter({ hasText: 'Opening your briefing' })).toHaveCount(0);
}

async function reportReady(page: Page) {
  const report = page.locator('[data-briefing-report]');
  await expect(report).toBeVisible();
  await expect(report).toHaveAttribute('aria-busy', 'false');
  return report;
}

async function seedPlayer(page: Page, value = player, key = RECENT_PLAYER_KEY) {
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key, value });
}

const historyRequests = (requests: FixtureRequest[]) => requests.filter(request => request.action === 'history');
const noAuthoringRequests = (requests: FixtureRequest[]) => expect(requests.filter(request => ['review', 'timeline'].includes(request.action))).toEqual([]);

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('one lookup automatically prepares the report and the next visit resumes without authoring', async ({ page }) => {
  const requests = await installFixtures(page, { matches: [sourceMatch] });
  await open(page);
  expect(requests).toEqual([]);
  const form = page.getByRole('form', { name: 'Get an automatic player briefing' });
  await form.getByLabel('Riot ID', { exact: true }).fill('Fixture Player#TEST');
  await form.getByLabel('Server', { exact: true }).selectOption(platform);
  await form.getByRole('button', { name: 'Get my briefing', exact: true }).click();
  const report = await reportReady(page);
  await expect(page).toHaveURL(url => url.pathname === '/next-game' && url.searchParams.get('puuid') === puuid && url.searchParams.get('platform') === platform);
  await expect(report.getByRole('heading', { name: 'Fixture Player#TEST', exact: true })).toBeVisible();
  await expect(report.locator('[data-automatic-focus]')).toBeVisible();
  await expect(report.getByRole('list', { name: 'Recorded final loadout' })).toContainText('Boots');
  await expect(page.locator('textarea')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Add a quick note|Save note|Take this into my game|Save for next game/ })).toHaveCount(0);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), RECENT_PLAYER_KEY)).toEqual(player);
  expect(await page.evaluate(() => localStorage.getItem('riftscry:companion:v1'))).toBeNull();
  await open(page);
  await reportReady(page);
  await expect(page.getByRole('form', { name: 'Get an automatic player briefing' })).toHaveCount(0);
  expect(requests.filter(request => request.action === 'lookup')).toHaveLength(1);
  noAuthoringRequests(requests);
});

test('old match data automatically produces exact numeric patch catch-up and a source loadout', async ({ page }) => {
  const requests = await installFixtures(page, { matches: [archiveMatch] });
  await open(page, direct());
  const report = await reportReady(page);
  await expect(report.locator('[data-automatic-focus="patch"]')).toContainText('Azir');
  const catchup = report.locator('[data-champion-catchup="Azir:420"]');
  await expect(catchup).toHaveAttribute('data-patch-status', 'changed');
  await expect(catchup).toContainText('patch 26.20');
  const change = catchup.locator('.automatic-delta').filter({ hasText: 'Mana Growth' });
  await expect(change).toContainText('40');
  await expect(change).toContainText('50');
  await expect(catchup.getByRole('link', { name: 'Read patch 26.21', exact: true })).toHaveAttribute('href', '/patch/26.21#azir');
  await expect(report.getByRole('heading', { name: 'Your last Azir loadout.', exact: true })).toBeVisible();
  await expect(report.locator(`a[href^="/matches/${archiveMatch.metadata.matchId}"]`).first()).toHaveAttribute('href', new RegExp(`puuid=${puuid}`));
  noAuthoringRequests(requests);
});

test('mode changes request exact history and empty Mayhem never becomes regular ARAM advice', async ({ page }) => {
  const requests = await installFixtures(page, { matches: [recentAramWin] });
  await open(page, direct());
  await reportReady(page);
  await expect(page.locator('[data-champion-catchup="Ahri:450"]')).toBeVisible();
  await page.getByLabel('Game mode', { exact: true }).selectOption('2400');
  const report = await reportReady(page);
  await expect(report.getByRole('heading', { name: 'Mayhem history is not available from Riot.', exact: true })).toBeVisible();
  await expect(report.locator('[data-automatic-focus]')).toHaveCount(0);
  await expect(report.locator('[data-champion-catchup]')).toHaveCount(0);
  expect(historyRequests(requests).some(request => new URL(request.url).searchParams.get('queue') === '2400')).toBe(true);
  await report.getByRole('button', { name: 'Show regular ARAM', exact: true }).click();
  await reportReady(page);
  await expect(page.locator('[data-champion-catchup="Ahri:450"]')).toBeVisible();
  await expect(page.getByLabel('Game mode', { exact: true })).toHaveValue('450');
  noAuthoringRequests(requests);
});

test('partial and unsupported records are identified without inventing additional games or losses', async ({ page }) => {
  const custom = makeMatch('EUN1_99102', sourceMatch.info.gameCreation + 1000);
  custom.info.gameType = 'CUSTOM_GAME';
  custom.info.participants[0]!.championName = 'Jinx';
  const missing = makeMatch('EUN1_99103', sourceMatch.info.gameCreation + 2000);
  const requests = await installFixtures(page, { matches: [sourceMatch, custom, missing], matchFailures: [missing.metadata.matchId] });
  await open(page, direct());
  const report = await reportReady(page);
  await expect(report.locator('.automatic-sample')).toContainText('2 of 3 recent games imported');
  await expect(report.locator('.automatic-sample')).toContainText(/1 records? (?:is|are) unavailable/);
  await expect(report.locator('.automatic-sample')).toContainText(/1 records? (?:has|have) unsupported or incomplete context/);
  await expect(report.locator('[data-champion-catchup]')).toHaveCount(1);
  await expect(report.locator('[data-champion-catchup="Jinx:420"]')).toHaveCount(0);
  await expect(report.locator('.automatic-session-modes')).toContainText('1W / 0L');
  noAuthoringRequests(requests);
});

test('history failure stays explicit and pauses automatic checks instead of fabricating a briefing', async ({ page }) => {
  await page.clock.install();
  const requests = await installFixtures(page, { response: request => request.action === 'history'
    ? { status: 503, json: { error: 'Fixture history is temporarily unavailable.' } } : undefined });
  await open(page, direct());
  const report = await reportReady(page);
  await expect(report.getByRole('alert')).toContainText('Fixture history is temporarily unavailable.');
  await expect(report).toContainText('Automatic checks are paused');
  await expect(report.locator('[data-automatic-focus]')).toHaveCount(0);
  await expect(report.getByRole('list', { name: 'Recorded final loadout' })).toHaveCount(0);
  const before = historyRequests(requests).length;
  await page.clock.fastForward(120001);
  expect(historyRequests(requests)).toHaveLength(before);
  noAuthoringRequests(requests);
});

test('invalid explicit player links do not fall back to another stored player or request their games', async ({ page }) => {
  await seedPlayer(page);
  const requests = await installFixtures(page);
  for (const path of [`/next-game?platform=__proto__&puuid=${puuid}`, `/next-game?platform=${platform}`, `/next-game?platform=${platform}&puuid=../wrong-player`]) {
    await open(page, path);
    await expect(page.getByRole('form', { name: 'Get an automatic player briefing' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('This player link is incomplete');
    await expect(page.locator('[data-briefing-report]')).toHaveCount(0);
  }
  expect(requests).toEqual([]);
});

test('a direct player link works and reloads when browser storage is blocked', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }));
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const requests = await installFixtures(page, { matches: [sourceMatch] });
  await open(page, direct());
  await reportReady(page);
  await expect(page.locator('[data-champion-catchup="Ahri:420"]')).toBeVisible();
  await page.reload();
  await reportReady(page);
  await expect(page.getByRole('heading', { name: 'Your last Ahri loadout.', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
  expect(requests.filter(request => request.action === 'lookup')).toHaveLength(0);
  noAuthoringRequests(requests);
});

test('explicit identity overrides the saved shortcut and changing players keeps records isolated', async ({ page }) => {
  await seedPlayer(page, { ...player, puuid: otherPuuid, name: 'Other Fixture Player#TEST' }, rememberedKey);
  const otherMatch = makeMatch('EUN1_99104', sourceMatch.info.gameCreation + 100000);
  otherMatch.info.participants[0]!.championName = 'Jinx';
  const requests = await installFixtures(page, { matches: [sourceMatch, otherMatch], response: request => {
    const url = new URL(request.url);
    if (request.action === 'history') return { status: 200, json: [url.searchParams.get('puuid') === otherPuuid ? otherMatch.metadata.matchId : sourceMatch.metadata.matchId] };
    if (request.action === 'lookup') return { status: 200, json: { puuid: otherPuuid, gameName: 'Other Fixture Player', tagLine: 'TEST' } };
    return undefined;
  } });
  await open(page, direct());
  await reportReady(page);
  await expect(page.locator('[data-champion-catchup="Ahri:420"]')).toBeVisible();
  expect(historyRequests(requests).every(request => new URL(request.url).searchParams.get('puuid') === puuid)).toBe(true);
  await page.getByRole('button', { name: 'Change player', exact: true }).click();
  const form = page.getByRole('form', { name: 'Get an automatic player briefing' });
  await expect(form).toBeVisible();
  await form.getByLabel('Riot ID', { exact: true }).fill('Other Fixture Player#TEST');
  await form.getByLabel('Server', { exact: true }).selectOption(platform);
  await form.getByRole('button', { name: 'Get my briefing', exact: true }).click();
  await reportReady(page);
  await expect(page).toHaveURL(url => url.searchParams.get('puuid') === otherPuuid);
  await expect(page.getByRole('heading', { name: 'Other Fixture Player#TEST', exact: true })).toBeVisible();
  await expect(page.locator('[data-champion-catchup="Jinx:420"]')).toBeVisible();
  await expect(page.locator('[data-champion-catchup="Ahri:420"]')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Your last Jinx loadout.', exact: true })).toBeVisible();
  noAuthoringRequests(requests);
});

test('visible automatic checks discover a newly finished game while hidden tabs make no polling requests', async ({ page }) => {
  await page.clock.install();
  const records = [structuredClone(sourceMatch)];
  const requests = await installFixtures(page, { matches: records });
  await open(page, direct());
  await reportReady(page);
  await expect(page.locator('[data-champion-catchup="Ahri:420"]')).toBeVisible();
  const afterInitial = historyRequests(requests).length;
  await page.evaluate(() => Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }));
  await page.clock.fastForward(120001);
  expect(historyRequests(requests)).toHaveLength(afterInitial);
  const next = makeMatch('EUN1_99105', sourceMatch.info.gameCreation + 3600000);
  next.info.participants[0]!.championName = 'Jinx';
  records.unshift(next);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => historyRequests(requests).length).toBeGreaterThan(afterInitial);
  await expect(page.locator('[data-champion-catchup="Jinx:420"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your last Jinx loadout.', exact: true })).toBeVisible();
  await expect(page.locator('.automatic-sample')).toContainText('2 of 2 recent games imported');
  noAuthoringRequests(requests);
});

test('the automatic lookup and report fit 320px with readable fields and usable controls', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await installFixtures(page, { matches: [archiveMatch] });
  await open(page);
  const form = page.getByRole('form', { name: 'Get an automatic player briefing' });
  for (const field of [form.getByLabel('Riot ID', { exact: true }), form.getByLabel('Server', { exact: true })]) {
    expect(await field.evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
    const bounds = await field.boundingBox();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await form.getByLabel('Riot ID', { exact: true }).fill('Fixture Player#TEST');
  await form.getByLabel('Server', { exact: true }).selectOption(platform);
  await form.getByRole('button', { name: 'Get my briefing', exact: true }).click();
  await reportReady(page);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  const mode = page.getByLabel('Game mode', { exact: true });
  expect(await mode.evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
  for (const control of [mode, page.getByRole('button', { name: 'Change player', exact: true })]) {
    const bounds = await control.boundingBox();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  }
  await expect(page.locator('[data-automatic-focus="patch"]')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator('[data-automatic-focus] h2')).toBeInViewport({ ratio: 0.15 });
});

test('a delayed account response in an older tab preserves the newer player selection', async ({ page }) => {
  let release = () => {};
  const held = new Promise<void>(resolve => { release = resolve; });
  await installFixtures(page, { matches: [sourceMatch], response: async request => {
    if (request.action === 'account') await held;
    return undefined;
  } });
  await open(page, direct());
  await reportReady(page);
  const newer = await page.context().newPage();
  try {
    await installFixtures(newer, { matches: [sourceMatch] });
    await open(newer, direct(otherPuuid));
    await reportReady(newer);
    await expect(newer.getByRole('heading', { name: 'Other Fixture Player#TEST', exact: true })).toBeVisible();
    await expect.poll(() => newer.evaluate(key => JSON.parse(localStorage.getItem(key)!).puuid, RECENT_PLAYER_KEY)).toBe(otherPuuid);
    release();
    await expect(page.getByRole('heading', { name: 'Fixture Player#TEST', exact: true })).toBeVisible();
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).puuid, RECENT_PLAYER_KEY)).toBe(otherPuuid);
  } finally { release(); await newer.close(); }
});
