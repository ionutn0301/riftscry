import { test, expect, type Page } from '@playwright/test';
import { COMPANION_KEY } from '../../src/lib/companion';
import { openScene } from './profile-controls';
import { openBriefingSettings } from './briefing-controls';
import { RECENT_PLAYER_KEY } from '../../src/lib/player/identity';
import {
  installFixtures, mayhemMatch, otherPuuid, platform, profilePath, puuid, query, recentAramLoss, recentAramWin,
} from './fixtures';

const identity = 'Fixture Player#TEST';
const matchPath = (id: string) => `/matches/${id}?${query}`;
const readCompanion = (page: Page) => page.evaluate(key => localStorage.getItem(key), COMPANION_KEY);

function isBriefingTarget(url: URL, queue: string, champion = 'Ahri') {
  return url.pathname === '/next-game' && url.searchParams.get('platform') === platform &&
    url.searchParams.get('puuid') === puuid && url.searchParams.get('queue') === queue &&
    url.searchParams.get('champion') === champion;
}

test('homepage My game prepares the briefing and continues into matches after one lookup', async ({ page }) => {
  const requests = await installFixtures(page, { matches: [recentAramWin] });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName('Every game leaves a ripple.');
  await page.locator('#atlas [data-passage-enter]').click();
  await expect(page).toHaveURL(url => url.pathname === '/next-game');
  const lookup = page.getByRole('form', { name: 'Get an automatic player briefing', exact: true });
  await expect(lookup).toBeVisible();
  expect(requests).toEqual([]);
  await lookup.getByLabel('Server', { exact: true }).selectOption(platform);
  await lookup.getByLabel('Riot ID', { exact: true }).fill(identity);
  await lookup.getByRole('button', { name: 'Get my briefing', exact: true }).click();
  await expect(page).toHaveURL(url => url.pathname === '/next-game' && url.searchParams.get('platform') === platform && url.searchParams.get('puuid') === puuid);
  await expect(page.locator('[data-briefing-report]')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.automatic-sample')).toContainText('1 of 1 recent games imported.');
  expect(requests.filter(request => request.action === 'lookup')).toHaveLength(1);
  expect(requests.filter(request => request.action === 'history')).toHaveLength(1);
  const settings = await openBriefingSettings(page);
  await settings.getByRole('link', { name: 'All matches', exact: true }).click();
  await expect(page).toHaveURL(url => url.pathname === profilePath && url.searchParams.get('view') === 'history');
  await expect(page.locator('[data-player-profile]')).toHaveAttribute('data-view', 'history');
  await expect(page.getByRole('region', { name: 'Recent match sample', exact: true })).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.sample-status')).toContainText('1 of 1 recent matches imported.');
  await expect(page.locator(`a[href^="/matches/${recentAramWin.metadata.matchId}?"]`).first()).toBeVisible();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), RECENT_PLAYER_KEY)).toEqual({ platform, puuid, name: identity });
  expect(await readCompanion(page)).toBeNull();
  expect(requests.filter(request => request.action === 'lookup')).toHaveLength(1);
  expect(requests.filter(request => request.action === 'history')).toHaveLength(2);
  expect(requests.filter(request => request.action === 'review' || request.action === 'timeline')).toEqual([]);
});

for (const view of ['builds', 'memory'] as const) {
  test(`gateway preserves the ${view} task and exact filters through lookup`, async ({ page }) => {
    const requests = await installFixtures(page, { matches: [recentAramLoss, recentAramWin] });
    await page.goto(`/players?platform=${platform}&view=${view}&queue=450&champion=Ahri&result=loss`);
    await page.locator('.gateway-destinations > summary').click();
    const intent = page.getByRole('group', { name: 'Start with', exact: true });
    await expect(intent.getByRole('button', { name: view === 'builds' ? 'Builds' : 'Build Memory', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByLabel('Riot ID', { exact: true }).fill(identity);
    await page.getByRole('button', { name: 'Find player', exact: true }).click();
    await expect(page).toHaveURL(url => url.pathname === profilePath &&
      url.searchParams.get('view') === view && url.searchParams.get('queue') === '450' &&
      url.searchParams.get('champion') === 'Ahri' && url.searchParams.get('result') === 'loss');
    await expect(page.locator('[data-player-profile]')).toHaveAttribute('data-view', view);
    await expect(page.getByRole('region', { name: 'Recent match sample', exact: true })).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('.sample-status')).toContainText('2 of 2 recent matches imported.');
    const briefing = page.locator('.player-next-game-link');
    await expect(briefing).toHaveText('Your briefing');
    expect(isBriefingTarget(new URL(await briefing.getAttribute('href') ?? '', page.url()), '450')).toBe(true);
    await expect.poll(() => requests.filter(request => request.action === 'history').length).toBe(1);
    expect(new URL(requests.find(request => request.action === 'history')!.url).searchParams.get('queue')).toBe('450');
    expect(requests.filter(request => request.action === 'review' || request.action === 'timeline')).toEqual([]);
  });
}

test('remembered player follows the selected task without losing the incoming filters', async ({ page }) => {
  await installFixtures(page, { matches: [recentAramWin] });
  await page.addInitScript(saved => localStorage.setItem('riftscry:remembered-player:v1', JSON.stringify(saved)), { platform, puuid, name: identity });
  await page.goto('/players?view=builds&queue=450&champion=Ahri&result=win');
  const remembered = page.locator('.remembered-player');
  await expect(remembered).toContainText('Builds');
  const initialTarget = new URL(await remembered.getAttribute('href') ?? '', page.url());
  expect(initialTarget.searchParams.get('view')).toBe('builds');

  await page.locator('.gateway-destinations > summary').click();
  await page.getByRole('group', { name: 'Start with', exact: true }).getByRole('button', { name: 'Build Memory', exact: true }).click();
  await expect(remembered).toContainText('Build Memory');
  await remembered.click();
  await expect(page).toHaveURL(url => url.pathname === profilePath &&
    url.searchParams.get('view') === 'memory' && url.searchParams.get('queue') === '450' &&
    url.searchParams.get('champion') === 'Ahri' && url.searchParams.get('result') === 'win');
  await expect(page.getByRole('navigation', { name: 'Player views', exact: true }).getByRole('button', { name: 'Build Memory', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('region', { name: 'Recent match sample', exact: true })).toHaveAttribute('aria-busy', 'false');
});

test('an observed build opens its automatic briefing without saving or using another remembered player', async ({ page }) => {
  const requests = await installFixtures(page, { matches: [recentAramWin] });
  await page.addInitScript(({ key, saved }) => localStorage.setItem(key, JSON.stringify(saved)), {
    key: RECENT_PLAYER_KEY, saved: { platform, puuid: otherPuuid, name: 'Other Fixture Player#TEST' },
  });
  await page.goto(`${profilePath}?view=builds&queue=450&champion=Ahri`);
  const build = page.locator('.observed-build');
  await expect(build).toHaveCount(1);
  await expect(build.locator('.item-label[title="Boots"]')).toBeVisible();
  await expect(build.getByRole('button', { name: 'Keep loadout', exact: true })).toBeVisible();
  const link = build.getByRole('link', { name: 'Automatic briefing', exact: true });
  expect(isBriefingTarget(new URL(await link.getAttribute('href') ?? '', page.url()), '450')).toBe(true);
  await link.click();
  await expect(page).toHaveURL(url => isBriefingTarget(url, '450'));
  await expect(page.locator('[data-automatic-briefing]')).toBeVisible();
  const report = page.locator('[data-briefing-report]');
  await expect(report).toHaveAttribute('aria-busy', 'false');
  await expect(report).toContainText('1 of 1 recent games imported.');
  await openScene(page, 'loadout');
  await expect(report.getByRole('heading', { name: 'Your last Ahri loadout.', exact: true })).toBeVisible();
  await expect(report.getByText('Boots', { exact: true })).toBeVisible();
  expect(await readCompanion(page)).toBeNull();
  const playerRequests = requests.filter(request => ['history', 'match', 'account'].includes(request.action));
  expect(playerRequests.length).toBeGreaterThan(0);
  expect(playerRequests.every(request => new URL(request.url).searchParams.get('puuid') === puuid)).toBe(true);
  expect(requests.filter(request => request.action === 'review' || request.action === 'timeline')).toEqual([]);
});

test('match review opens an automatic Mayhem briefing with exact player and mode context', async ({ page }) => {
  const requests = await installFixtures(page, { matches: [mayhemMatch] });
  await page.goto(matchPath(mayhemMatch.metadata.matchId));
  await expect(page.locator('.player-quick-note')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Keep loadout', exact: true })).toBeVisible();
  const link = page.getByRole('link', { name: 'Automatic briefing', exact: true });
  await expect(link).toBeVisible();
  expect(isBriefingTarget(new URL(await link.getAttribute('href') ?? '', page.url()), '2400')).toBe(true);
  await link.click();
  await expect(page).toHaveURL(url => isBriefingTarget(url, '2400'));
  const report = page.locator('[data-briefing-report]');
  await expect(report).toHaveAttribute('aria-busy', 'false');
  await expect(report).toContainText('1 of 1 recent games imported.');
  await expect(report).toContainText('ARAM: Mayhem');
  await openScene(page, 'loadout');
  await expect(report.getByRole('heading', { name: 'Your last Ahri loadout.', exact: true })).toBeVisible();
  expect(await readCompanion(page)).toBeNull();
  expect(await page.evaluate(key => localStorage.getItem(key), `riftscry:build-memory:v1:${platform}:${puuid}`)).toBeNull();
  const historyRequests = requests.filter(request => request.action === 'history');
  expect(historyRequests.length).toBeGreaterThan(0);
  expect(historyRequests.every(request => new URL(request.url).searchParams.get('queue') === '2400')).toBe(true);
  expect(requests.filter(request => request.action === 'review' || request.action === 'timeline')).toEqual([]);
});

test('one kept loadout carries its champion and mode into an optional game card', async ({ page }) => {
  const requests = await installFixtures(page, { matches: [recentAramWin] });
  await page.goto(`${profilePath}?view=builds&queue=450`);
  const build = page.locator('.observed-build');
  await expect(build.getByRole('button', { name: 'Keep loadout', exact: true })).toBeEnabled();
  expect(await readCompanion(page)).toBeNull();
  await build.getByRole('button', { name: 'Keep loadout', exact: true }).click();
  await expect(build.getByRole('button', { name: 'Loadout kept', exact: true })).toBeDisabled();
  await build.getByRole('link', { name: 'Open notebook', exact: true }).click();
  await expect(page).toHaveURL(url => url.pathname === '/notebook' && url.hash === '#loadouts');
  const saved = page.locator('[data-recall-build]');
  await expect(saved).toHaveCount(1);
  await expect(saved).toContainText('Boots');
  await saved.getByRole('button', { name: 'Use in a game card', exact: true }).click();
  await expect(page.locator('#game-card')).toBeVisible();
  await expect(page.getByLabel('Champion for next game', { exact: true })).toHaveValue('Ahri');
  await expect(page.getByLabel('Game mode for next game', { exact: true })).toHaveValue('450');
  await expect(page.locator('#recall-card')).toContainText('Boots');
  const state = JSON.parse(await readCompanion(page) ?? '{}');
  expect(state.builds).toHaveLength(1);
  expect(state.builds[0]).toMatchObject({ platform, puuid, champion: 'Ahri', queue: 450, source: recentAramWin.metadata.matchId });
  expect(state.runs).toEqual([]);
  expect(requests.filter(request => ['timeline', 'review'].includes(request.action))).toEqual([]);
});

test('lookup and explicit briefing links work when the browser cannot remember the player', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  const requests = await installFixtures(page, { matches: [recentAramWin] });
  await page.addInitScript(key => {
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException('Fixture storage full', 'QuotaExceededError');
      write.call(this, name, value);
    };
  }, RECENT_PLAYER_KEY);
  await page.goto(`/players?platform=${platform}&queue=450&champion=Ahri`);
  await page.getByLabel('Riot ID', { exact: true }).fill(identity);
  await page.getByRole('button', { name: 'Find player', exact: true }).click();
  await expect(page).toHaveURL(url => url.pathname === profilePath);
  await expect(page.getByRole('region', { name: 'Recent match sample', exact: true })).toHaveAttribute('aria-busy', 'false');
  const briefing = page.locator('.player-next-game-link');
  await expect(briefing).toBeVisible();
  await briefing.click();
  await expect(page).toHaveURL(url => isBriefingTarget(url, '450'));
  const report = page.locator('[data-briefing-report]');
  await expect(report).toHaveAttribute('aria-busy', 'false');
  await expect(report).toContainText('1 of 1 recent games imported.');
  await openScene(page, 'loadout');
  await expect(report.getByRole('heading', { name: 'Your last Ahri loadout.', exact: true })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), RECENT_PLAYER_KEY)).toBeNull();
  expect(await readCompanion(page)).toBeNull();
  expect(requests.filter(request => request.action === 'lookup')).toHaveLength(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
