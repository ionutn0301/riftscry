import { test, expect } from '@playwright/test';
import {
  installFixtures, mayhemMatch, mixedModeMatches, profilePath,
  recentAramWin, savedNote, seedNotes,
} from './fixtures';
import { expectSelectedQueue, selectQueue } from './profile-controls';

const mayhemPath = `${profilePath}?queue=2400&view=history`;
const source = 'https://github.com/RiotGames/developer-relations/issues/1109#issuecomment-3671793822';
const unavailable = (page: import('@playwright/test').Page) =>
  page.getByRole('region', { name: 'ARAM: Mayhem availability', exact: true });

// The normal fixture assumes every published queue has readable history. Riot
// documents that Mayhem records are private, so these cases explicitly model
// empty history and inaccessible details independently of that happy path.
for (const width of [390, 1440]) {
  test(`empty Mayhem history explains Riot availability and offers a working mode at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const requests = await installFixtures(page, {
      matches: mixedModeMatches,
      historyIds: queue => queue === '2400' ? [] : [recentAramWin.metadata.matchId],
    });
    await page.goto(mayhemPath, { waitUntil: 'domcontentloaded' });
    await expectSelectedQueue(page, '2400');
    await expect(unavailable(page)).toBeVisible();
    await expect(unavailable(page)).toContainText(/private/i);
    await expect(unavailable(page)).toContainText(/League client/i);
    await expect(unavailable(page).getByRole('link')).toHaveAttribute('href', source);
    await expect(page.getByText('0 of 0 recent matches imported.', { exact: false })).toHaveCount(0);
    await expect(page.getByText('No matching games. Try another filter.', { exact: true })).toHaveCount(0);
    await expect(page.locator('[data-mode-summary], .match-row')).toHaveCount(0);
    expect(requests.filter(request => request.action === 'match')).toHaveLength(0);
    expect(requests.filter(request => request.action === 'history')
      .every(request => new URL(request.url).searchParams.get('queue') === '2400')).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

    await unavailable(page).getByRole('button', { name: 'Show regular ARAM', exact: true }).click();
    await expectSelectedQueue(page, '450');
    await expect(unavailable(page)).toHaveCount(0);
    await expect(page.locator('.match-row')).toHaveCount(1);
    await expect(page.locator('.match-row')).toHaveAttribute('data-queue', '450');
  });
}

test('unavailable Mayhem details retain the failure without presenting an ordinary empty filter', async ({ page }) => {
  await installFixtures(page, {
    matches: [mayhemMatch],
    response: request => request.action === 'match'
      ? { status: 503, json: { error: 'Riot denied this match record.' } }
      : undefined,
  });
  await page.goto(mayhemPath, { waitUntil: 'domcontentloaded' });
  await expect(unavailable(page)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Recent match sample', exact: true })).toContainText(/1.*(unavailable|excluded|failed)/i);
  await expect(page.getByText('No matching games. Try another filter.', { exact: true })).toHaveCount(0);
  await expect(page.locator('.match-row, [data-mode-summary]')).toHaveCount(0);
});

test('Mayhem availability does not hide a real request limit or enable refresh during cooldown', async ({ page }) => {
  await installFixtures(page, {
    response: request => request.action === 'history'
      ? { status: 429, json: { error: 'Riot request budget is busy.' }, headers: { 'Retry-After': '60', 'X-RateLimit-Scope': 'player' } }
      : undefined,
  });
  await page.goto(mayhemPath, { waitUntil: 'domcontentloaded' });
  await expect(unavailable(page)).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Riot request budget is busy.');
  await expect(page.getByRole('button', { name: /Retry in \d+s/ })).toBeDisabled();
  await expect(page.getByRole('region', { name: 'Recent match sample', exact: true })).toContainText(/Retry in \d+ seconds/);
});

test('refresh displays actual Mayhem records when Riot returns them and removes the availability notice', async ({ page }) => {
  let available = false;
  const requests = await installFixtures(page, {
    matches: [mayhemMatch],
    historyIds: () => available ? [mayhemMatch.metadata.matchId] : [],
  });
  await page.goto(mayhemPath, { waitUntil: 'domcontentloaded' });
  await expect(unavailable(page)).toBeVisible();
  available = true;
  await page.getByRole('button', { name: 'Refresh recent matches', exact: true }).click();
  await expect(page.locator('.match-row')).toHaveCount(1);
  await expect(page.locator('.match-row')).toHaveAttribute('data-queue', '2400');
  await expect(unavailable(page)).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Recent match sample', exact: true })).toContainText('1 of 1 recent matches imported.');
  await expectSelectedQueue(page, '2400');
  expect(requests.filter(request => request.action === 'match')).toHaveLength(1);
});

test('a champion filter hiding imported Mayhem records remains a filter state', async ({ page }) => {
  await installFixtures(page, { matches: [mayhemMatch] });
  await page.goto(`${mayhemPath}&champion=Braum`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('region', { name: 'Recent match sample', exact: true })).toContainText('1 of 1 recent matches imported.');
  await expect(unavailable(page)).toHaveCount(0);
  await expect(page.locator('.match-row')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Recent matches', exact: true })
    .getByText('No matching games. Try another filter.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Remove champion filter: Braum', exact: true }).click();
  await expect(page.locator('.match-row')).toHaveCount(1);
  await expect(page.locator('.match-row')).toHaveAttribute('data-queue', '2400');
});

test('unavailable Mayhem imports preserve saved Memory and the recovery action clears unrelated filters', async ({ page }) => {
  await seedNotes(page, [savedNote]);
  await installFixtures(page, {
    matches: [recentAramWin],
    historyIds: queue => queue === '2400' ? [] : [recentAramWin.metadata.matchId],
  });
  await page.goto(`${profilePath}?queue=2400&view=memory&champion=Braum&result=loss`, { waitUntil: 'domcontentloaded' });
  await expect(unavailable(page)).toBeVisible();
  await expect(page.locator(`#memory-${savedNote.id}`)).toBeVisible();
  await expect(page.locator(`#memory-${savedNote.id}`)).toContainText(savedNote.alternative);
  await page.getByRole('navigation', { name: 'Player views', exact: true }).getByRole('button', { name: 'Builds', exact: true }).click();
  await expect(unavailable(page)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No builds here yet.', exact: true })).toHaveCount(0);
  await unavailable(page).getByRole('button', { name: 'Show all games', exact: true }).click();
  await expectSelectedQueue(page, 'all');
  await expect(page).toHaveURL(url => !url.searchParams.get('champion') && !url.searchParams.get('result'));
  await expect(page.locator('.observed-build')).toHaveCount(1);
  await expect(unavailable(page)).toHaveCount(0);
  await selectQueue(page, '450');
  await expect(page.locator('.observed-build')).toHaveCount(1);
});
