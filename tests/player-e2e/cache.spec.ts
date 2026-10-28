import { test, expect, type Page } from '@playwright/test';
import { installFixtures, mixedModeMatches, profilePath, recentAramWin, type FixtureRequest } from './fixtures';

const sample = (page: Page) => page.getByRole('region', { name: 'Recent match sample', exact: true });
const refresh = (page: Page) => page.getByRole('button', { name: 'Refresh recent matches', exact: true });
const matchRequests = (requests: FixtureRequest[]) => requests.filter(request => request.action === 'match');

async function settled(page: Page, count: number) {
  await expect(sample(page)).toContainText(`${count} of ${count} recent matches imported`);
  await expect(sample(page)).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.match-row')).toHaveCount(count);
  await expect(refresh(page)).toBeEnabled();
}

test('repeated refresh, exact-queue changes and match navigation reuse completed summaries', async ({ page }) => {
  const requests = await installFixtures(page, { matches: mixedModeMatches });
  await page.goto(profilePath, { waitUntil: 'domcontentloaded' });
  await settled(page, 5);
  expect(matchRequests(requests)).toHaveLength(5);

  for (let index = 0; index < 3; index++) {
    const count = requests.filter(request => request.action === 'history').length;
    const historyResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/player/history');
    await refresh(page).click();
    await (await historyResponse).finished();
    await settled(page, 5);
    expect(requests.filter(request => request.action === 'history')).toHaveLength(count + 1);
    expect(matchRequests(requests)).toHaveLength(5);
  }

  for (const [queue, count] of [['450', 2], ['420', 1], ['all', 5]] as const) {
    await page.getByLabel('Game mode', { exact: true }).selectOption(queue);
    await expect(page).toHaveURL(url => (url.searchParams.get('queue') ?? 'all') === queue);
    await settled(page, count);
    expect(matchRequests(requests)).toHaveLength(5);
  }

  await page.locator(`.match-row[href^="/matches/${recentAramWin.metadata.matchId}?"]`).click();
  await expect(page).toHaveURL(url => url.pathname === `/matches/${recentAramWin.metadata.matchId}`);
  await expect(page.getByRole('region', { name: 'Match overview', exact: true })).toContainText('18 / 6 / 24');
  expect(matchRequests(requests)).toHaveLength(5);
  await page.getByRole('link', { name: '← Back to player and filters', exact: true }).click();
  await expect(page).toHaveURL(url => url.pathname === profilePath);
  await settled(page, 5);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settled(page, 5);
  const ids = matchRequests(requests).map(request => new URL(request.url).searchParams.get('id'));
  expect(ids.sort()).toEqual(mixedModeMatches.map(match => match.metadata.matchId).sort());
  expect(requests.filter(request => request.action === 'account')).toHaveLength(1);
  expect(requests.filter(request => request.action === 'rank')).toHaveLength(1);
  expect(requests.some(request => request.action === 'timeline' || request.action === 'review')).toBe(false);
});

test('a rate-limited refresh retains the previous sample and waits for Retry-After before another request', async ({ page }) => {
  const now = Date.parse('2026-10-28T12:00:00Z');
  await page.clock.setFixedTime(now);
  let historyCalls = 0;
  const requests = await installFixtures(page, {
    matches: mixedModeMatches,
    response: ({ action }) => {
      if (action === 'history' && ++historyCalls === 2) {
        return { status: 429, headers: { 'Retry-After': '120' }, json: { error: 'Fixture Riot cooldown. Please wait before refreshing.' } };
      }
    },
  });
  await page.goto(profilePath, { waitUntil: 'domcontentloaded' });
  await settled(page, 5);
  await refresh(page).click();
  const retry = page.getByRole('button', { name: /^Retry in \d+s$/ });
  await expect(retry).toHaveText('Retry in 120s');
  await expect(retry).toBeDisabled();
  await expect(sample(page)).toContainText('5 previously imported matches remain available.');
  await expect(sample(page)).toContainText('Retry in 120 seconds');
  await expect(sample(page).getByRole('alert')).toContainText('Fixture Riot cooldown. Please wait before refreshing.');
  await expect(sample(page)).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.match-row')).toHaveCount(5);
  expect(historyCalls).toBe(2);
  expect(matchRequests(requests)).toHaveLength(5);

  await page.clock.setFixedTime(now + 119_000);
  await expect(retry).toHaveText('Retry in 1s');
  await expect(retry).toBeDisabled();
  expect(historyCalls).toBe(2);

  await page.clock.setFixedTime(now + 121_000);
  await expect(refresh(page)).toBeEnabled();
  expect(historyCalls).toBe(2);
  const recovery = page.waitForResponse(response => new URL(response.url()).pathname === '/api/player/history');
  await refresh(page).click();
  await (await recovery).finished();
  await settled(page, 5);
  await expect(sample(page)).not.toContainText(/incomplete|Retry in/);
  expect(historyCalls).toBe(3);
  expect(matchRequests(requests)).toHaveLength(5);
});

test('refresh after a cold account and rank cooldown recovers identity without reloading completed summaries', async ({ page }) => {
  const now = Date.parse('2026-10-28T12:00:00Z');
  await page.clock.setFixedTime(now);
  let releaseIdentity!: () => void;
  const heldIdentity = new Promise<void>(resolve => { releaseIdentity = resolve; });
  const calls = { account: 0, rank: 0 };
  const requests = await installFixtures(page, {
    matches: mixedModeMatches,
    response: async ({ action }) => {
      if ((action === 'account' || action === 'rank') && ++calls[action] === 1) {
        // These initial requests are independently pending while the other
        // scheduler slots import fixture summaries. Their late 429 responses must
        // not strand the verified identity/rank after the cooldown expires.
        await heldIdentity;
        return { status: 429, headers: { 'Retry-After': '60' }, json: { error: `Fixture ${action} cooldown.` } };
      }
    },
  });
  try {
    await page.goto(profilePath, { waitUntil: 'domcontentloaded' });
    await settled(page, 5);
    expect(calls).toEqual({ account: 1, rank: 1 });
    expect(matchRequests(requests)).toHaveLength(5);
    releaseIdentity();
    const rank = page.getByRole('complementary', { name: 'Current ranked status', exact: true });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Player profile');
    await expect(page.getByText('The Riot identity is unavailable right now.', { exact: false })).toBeVisible();
    await expect(rank).toContainText('Current rank unavailable');
    await expect(page.getByRole('button', { name: 'Retry in 60s', exact: true })).toBeDisabled();
    await expect(page.locator('.match-row')).toHaveCount(5);
    await expect(sample(page)).toContainText('5 of 5 recent matches imported');

    await page.clock.setFixedTime(now + 61_000);
    await expect(refresh(page)).toBeEnabled();
    expect(calls).toEqual({ account: 1, rank: 1 });
    await refresh(page).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Fixture Player#TEST');
    await expect(rank).toContainText('GOLD II');
    await expect(rank).toContainText('35 LP');
    await expect(rank).not.toContainText('unavailable');
    await expect(page.getByText('The Riot identity is unavailable right now.', { exact: false })).toHaveCount(0);
    await settled(page, 5);
    expect(calls).toEqual({ account: 2, rank: 2 });
    expect(requests.filter(request => request.action === 'history')).toHaveLength(2);
    const ids = matchRequests(requests).map(request => new URL(request.url).searchParams.get('id'));
    expect(ids.sort()).toEqual(mixedModeMatches.map(match => match.metadata.matchId).sort());
  } finally {
    releaseIdentity();
  }
});
