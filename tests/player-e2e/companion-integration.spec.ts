import { test, expect, type Page } from '@playwright/test';
import { COMPANION_KEY, type CompanionState } from '../../src/lib/companion';
import {
  installFixtures, mayhemMatch, platform, profilePath, puuid, query, recentAramLoss, recentAramWin,
} from './fixtures';

const identity = 'Fixture Player#TEST';
const matchPath = (id: string) => `/matches/${id}?${query}`;
const readCompanion = (page: Page): Promise<CompanionState | null> =>
  page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), COMPANION_KEY);

test('homepage Find my games opens the live gateway and completes a player lookup', async ({ page }) => {
  const requests = await installFixtures(page, { matches: [recentAramWin] });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Review your games. Prepare for the next.');
  await page.getByRole('link', { name: 'Find my games', exact: true }).click();
  await expect(page).toHaveURL(url => url.pathname === '/players');
  await expect(page.locator('[data-player-gateway]')).toBeVisible();
  expect(requests).toEqual([]);
  await page.getByLabel('Server', { exact: true }).selectOption(platform);
  await page.getByLabel('Riot ID', { exact: true }).fill(identity);
  await page.getByRole('button', { name: 'Find player', exact: true }).click();
  await expect(page).toHaveURL(url => url.pathname === profilePath && url.searchParams.get('view') === 'history');
  await expect(page.locator('[data-player-profile]')).toHaveAttribute('data-view', 'history');
  await expect(page.getByRole('region', { name: 'Recent match sample', exact: true })).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.sample-status')).toContainText('1 of 1 recent matches imported.');
  await expect(page.locator(`a[href^="/matches/${recentAramWin.metadata.matchId}?"]`).first()).toBeVisible();
  expect(requests.filter(request => request.action === 'lookup')).toHaveLength(1);
  expect(requests.filter(request => request.action === 'history')).toHaveLength(1);
  expect(requests.filter(request => request.action === 'review' || request.action === 'timeline')).toEqual([]);
});

for (const view of ['builds', 'memory'] as const) {
  test(`gateway preserves the ${view} task and exact filters through lookup`, async ({ page }) => {
    const requests = await installFixtures(page, { matches: [recentAramLoss, recentAramWin] });
    await page.goto(`/players?platform=${platform}&view=${view}&queue=450&champion=Ahri&result=loss`);
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
    await expect(page.locator('.player-next-game-link')).toHaveAttribute('href', '/next-game?champion=Ahri&queue=450');
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

  await page.getByRole('group', { name: 'Start with', exact: true }).getByRole('button', { name: 'Build Memory', exact: true }).click();
  await expect(remembered).toContainText('Build Memory');
  await remembered.click();
  await expect(page).toHaveURL(url => url.pathname === profilePath &&
    url.searchParams.get('view') === 'memory' && url.searchParams.get('queue') === '450' &&
    url.searchParams.get('champion') === 'Ahri' && url.searchParams.get('result') === 'win');
  await expect(page.getByRole('navigation', { name: 'Player views', exact: true }).getByRole('button', { name: 'Build Memory', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('region', { name: 'Recent match sample', exact: true })).toHaveAttribute('aria-busy', 'false');
});

test('an observed build saves once and carries its exact context into Next game', async ({ page }) => {
  const requests = await installFixtures(page, { matches: [recentAramWin] });
  await page.goto(`${profilePath}?view=builds&queue=450&champion=Ahri`);
  const build = page.locator('.observed-build');
  await expect(build).toHaveCount(1);
  await expect(build.locator('.item-label[title="Boots"]')).toBeVisible();
  await build.getByRole('button', { name: 'Save for next game', exact: true }).click();
  await expect(build.getByRole('status')).toHaveText('Loadout saved on this browser.');
  await expect(build.getByRole('button', { name: 'Saved for next game', exact: true })).toBeDisabled();
  let saved = await readCompanion(page);
  expect(saved!.builds).toHaveLength(1);
  expect(saved!.builds[0]).toMatchObject({
    platform, puuid, source: recentAramWin.metadata.matchId, champion: 'Ahri', queue: 450,
    patch: '16.21', version: '16.21.1', items: [{ id: 1001, name: 'Boots' }],
    runes: [{ id: 8112, name: 'Electrocute' }],
  });

  await page.goto(matchPath(recentAramWin.metadata.matchId));
  const capture = page.locator('.player-build-save');
  await expect(capture.getByRole('button', { name: 'Saved for next game', exact: true })).toBeDisabled();
  await page.reload();
  await expect(capture.getByRole('button', { name: 'Saved for next game', exact: true })).toBeDisabled();
  saved = await readCompanion(page);
  expect(saved!.builds).toHaveLength(1);
  await capture.getByRole('link', { name: 'Next game', exact: true }).click();
  await expect(page).toHaveURL(url => url.pathname === '/next-game' && url.searchParams.get('champion') === 'Ahri' && url.searchParams.get('queue') === '450');
  await expect(page.getByLabel('Champion for next game', { exact: true })).toHaveValue('Ahri');
  await expect(page.getByLabel('Game mode for next game', { exact: true })).toHaveValue('450');
  const shelf = page.locator('details').filter({ has: page.locator('summary').filter({ hasText: /^Saved loadouts/ }) });
  await shelf.locator('summary').first().click();
  await expect(shelf.getByText('Boots', { exact: true })).toBeVisible();
  await expect(shelf.getByText('From patch 26.21', { exact: true })).toBeVisible();
  await expect(shelf.locator(`a[href^="/matches/${recentAramWin.metadata.matchId}?"]`)).toBeVisible();
  expect(requests.filter(request => request.action === 'review' || request.action === 'timeline')).toEqual([]);
});

test('a quick note preserves exact Mayhem source context without a tracked item', async ({ page }) => {
  const requests = await installFixtures(page, { matches: [mayhemMatch] });
  await page.goto(matchPath(mayhemMatch.metadata.matchId));
  const capture = page.locator('.player-quick-note');
  const text = 'Before the next teamfight, decide which ally I want to stay near.';
  await capture.getByLabel('Your note for next game', { exact: true }).fill(text);
  await capture.getByRole('button', { name: 'Save quick note', exact: true }).click();
  await expect(capture.getByRole('status')).toHaveText('Note saved on this browser. Find it in Next game.');
  await expect(capture.getByLabel('Your note for next game', { exact: true })).toHaveValue('');
  const saved = await readCompanion(page);
  expect(saved!.notes).toHaveLength(1);
  expect(saved!.notes[0]).toMatchObject({
    text, champion: 'Ahri', queue: '2400', patch: '16.21', situation: 'any',
    source: { platform, puuid, matchId: mayhemMatch.metadata.matchId },
  });
  expect(saved!.notes[0]).not.toHaveProperty('targetItem');
  expect(await page.evaluate(key => localStorage.getItem(key), `riftscry:build-memory:v1:${platform}:${puuid}`)).toBeNull();
  await page.reload();
  expect((await readCompanion(page))!.notes).toEqual(saved!.notes);
  await expect(capture.getByRole('link', { name: 'Next game', exact: true })).toHaveAttribute('href', '/next-game?champion=Ahri&queue=2400');
  await capture.getByRole('link', { name: 'Next game', exact: true }).click();
  await expect(page.getByLabel('Game mode for next game', { exact: true })).toHaveValue('2400');
  await expect(page.getByRole('radio', { name: text, exact: true })).toBeVisible();
  await page.getByLabel('Game mode for next game', { exact: true }).selectOption('450');
  await expect(page.getByRole('radio', { name: text, exact: true })).toHaveCount(0);
  expect((await readCompanion(page))!.notes).toHaveLength(1);
  expect(requests.filter(request => request.action === 'review' || request.action === 'timeline')).toEqual([]);
});

test('failed browser storage keeps the quick-note draft and never reports a saved build', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await installFixtures(page, { matches: [recentAramWin] });
  await page.addInitScript(key => {
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException('Fixture storage full', 'QuotaExceededError');
      write.call(this, name, value);
    };
  }, COMPANION_KEY);
  await page.goto(matchPath(recentAramWin.metadata.matchId));
  const build = page.locator('.player-build-save');
  await build.getByRole('button', { name: 'Save for next game', exact: true }).click();
  await expect(build.getByRole('alert')).toContainText('Nothing was saved.');
  await expect(build.getByRole('button', { name: 'Save for next game', exact: true })).toBeEnabled();
  await expect(build.getByRole('button', { name: 'Saved for next game', exact: true })).toHaveCount(0);

  const note = page.locator('.player-quick-note');
  const field = note.getByLabel('Your note for next game', { exact: true });
  await field.fill('Keep this draft when the browser cannot save.');
  await note.getByRole('button', { name: 'Save quick note', exact: true }).click();
  await expect(note.getByRole('alert')).toContainText('Nothing was saved.');
  await expect(field).toHaveValue('Keep this draft when the browser cannot save.');
  expect(await readCompanion(page)).toBeNull();
  expect(await field.evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
  const outside = await page.locator('.player-build-save-actions > *, .player-quick-note textarea, .player-quick-note button').evaluateAll(elements =>
    elements.filter(element => { const box = element.getBoundingClientRect(); return box.left < 0 || box.right > innerWidth + 1; }).map(element => element.textContent));
  expect(outside).toEqual([]);
});
