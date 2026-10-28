import { test, expect, type Locator, type Page } from '@playwright/test';
import {
  installFixtures, mayhemMatch, mixedModeMatches, oldRankedMatch, platform, profilePath, puuid,
  query, recentAramLoss, recentAramWin, savedNote, seedNotes, swiftplayMatch,
} from './fixtures';

const identity = 'Fixture Player#TEST';
const namedProfile = `${profilePath}?name=${encodeURIComponent(identity)}`;
const rows = (page: Page) => page.locator('.match-row');
const modeSummary = (page: Page, queue: number) => page.locator(`[data-mode-summary][data-queue="${queue}"]`);

async function expectNumber(locator: Locator, expected: number) {
  await expect(locator).toBeVisible();
  await expect.poll(async () => Number((await locator.innerText()).replaceAll(',', '').match(/\d+(?:\.\d+)?/)?.[0])).toBe(expected);
}

async function expectSummary(page: Page, queue: number, values: {
  matches: number; wins: number; winRate: number; kda: number[];
}) {
  const summary = modeSummary(page, queue);
  await expect(summary).toBeVisible();
  await expectNumber(summary.locator('[data-stat="matches"]'), values.matches);
  await expectNumber(summary.locator('[data-stat="wins"]'), values.wins);
  await expectNumber(summary.locator('[data-stat="win-rate"]'), values.winRate);
  await expect.poll(async () => (await summary.locator('[data-stat="average-kda"]').innerText())
    .match(/\d+(?:\.\d+)?/g)?.map(Number)).toEqual(values.kda);
}

test('canonical profile deep links preserve mode and filters through reload and browser Back', async ({ page }) => {
  await installFixtures(page, { matches: mixedModeMatches });
  await page.goto(`${namedProfile}&queue=450&champion=Ahri&result=loss&view=history`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-player-profile]')).toBeVisible();
  await expect(page.locator('[data-player-gateway]')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(identity);
  await expect(page.getByRole('form', { name: 'Find a League of Legends player' })).toHaveCount(0);
  await expect(page.getByLabel('Game mode', { exact: true })).toHaveValue('450');
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toHaveAttribute('href', new RegExp(`/matches/${recentAramLoss.metadata.matchId}\\?`));

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByLabel('Game mode', { exact: true })).toHaveValue('450');
  await expect(page.getByLabel('Champion', { exact: true })).toHaveValue('Ahri');
  await expect(page.getByLabel('Result', { exact: true })).toHaveValue('loss');
  await expect(rows(page)).toHaveCount(1);
  await rows(page).first().click();
  await expect(page).toHaveURL(url => url.pathname === `/matches/${recentAramLoss.metadata.matchId}`);
  const back = new URL(new URL(page.url()).searchParams.get('back')!, 'http://fixture.local');
  expect(back.pathname).toBe(profilePath);
  expect(Object.fromEntries(back.searchParams)).toMatchObject({ queue: '450', champion: 'Ahri', result: 'loss', view: 'history' });
  await page.goBack();
  await expect(page).toHaveURL(url => url.pathname === profilePath && url.searchParams.get('queue') === '450');
  await expect(page.getByLabel('Champion', { exact: true })).toHaveValue('Ahri');
  await expect(page.getByLabel('Result', { exact: true })).toHaveValue('loss');
  await expect(rows(page)).toHaveCount(1);
});

test('legacy query profile links redirect to the separate profile with their selected view and queue', async ({ page }) => {
  await installFixtures(page, { matches: mixedModeMatches });
  await page.goto(`/players?${query}&queue=450&view=memory&name=${encodeURIComponent(identity)}`, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(url => url.pathname === profilePath && url.searchParams.get('queue') === '450' && url.searchParams.get('view') === 'memory');
  await expect(page.locator('[data-player-gateway]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Build Memory', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(/^No saved adjustments for this player yet\./)).toBeVisible();
});

test('History, Builds and Memory show their own content while preserving mode and history filters', async ({ page }) => {
  const requests = await installFixtures(page, { matches: mixedModeMatches });
  const alternative = 'Review my next ARAM purchase';
  await seedNotes(page, [{
    ...savedNote, id: 'view-switch-adjustment', alternative, role: 'MODE:aram', queue: 450,
    source: recentAramLoss.metadata.matchId, sourceDate: recentAramLoss.info.gameCreation,
    createdAt: recentAramLoss.info.gameCreation + 1_000, trackingStartedAt: recentAramLoss.info.gameCreation + 1_000,
  }]);
  await page.goto(`${namedProfile}&queue=450&champion=Ahri&result=loss&view=history`, { waitUntil: 'domcontentloaded' });
  const views = page.getByRole('navigation', { name: 'Player views', exact: true });
  const filters = page.getByRole('group', { name: 'Filter match sample', exact: true });
  const sample = page.getByRole('region', { name: 'Recent match sample', exact: true });
  const arrival = page.locator('.profile-arrival');
  await expect(sample).toContainText('2 of 2 recent matches imported');
  await expect(rows(page)).toHaveCount(1);
  await expectSummary(page, 450, { matches: 1, wins: 0, winRate: 0, kda: [6, 4, 12] });
  await expect(arrival.getByRole('link', { name: 'Explore your games', exact: true })).toHaveAttribute('href', '#player-records');

  await views.getByRole('button', { name: 'Personal builds', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Observed personal builds', exact: true })).toBeVisible();
  await expect(page.locator('.observed-build')).toHaveCount(1);
  await expect(page.locator('.observed-build')).toHaveAttribute('data-queue', '450');
  await expect(page.locator('.observed-build .build-occurrences')).toHaveText('1 recorded game');
  await expect(page.locator('[data-mode-summary]')).toHaveCount(0);
  await expect(sample).toContainText('2 of 2 recent matches imported');
  await expect(filters.getByLabel('Champion', { exact: true })).toHaveValue('Ahri');
  await expect(filters.getByLabel('Result', { exact: true })).toHaveValue('loss');
  await expect(arrival.getByRole('link', { name: 'Explore your builds', exact: true })).toHaveAttribute('href', '#player-records');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'player-visuals/compact-profile-builds.png', fullPage: true, animations: 'disabled' });

  await views.getByRole('button', { name: 'Build Memory', exact: true }).click();
  await expect(page.getByRole('heading', { name: `Ahri · ${alternative}`, exact: true })).toBeVisible();
  await expect(page.locator('.personal-builds')).toHaveCount(0);
  await expect(page.locator('[data-mode-summary]')).toHaveCount(0);
  await expect(sample).toContainText('2 of 2 recent matches imported');
  await expect(filters.getByLabel('Game mode', { exact: true })).toHaveValue('450');
  await expect(filters.getByLabel('Champion', { exact: true })).toHaveCount(0);
  await expect(filters.getByLabel('Result', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Filter saved adjustments', exact: true }).getByLabel('Champion', { exact: true })).toHaveValue('');
  await expect(arrival.getByRole('link', { name: 'Open Build Memory', exact: true })).toHaveAttribute('href', '#player-records');
  await expect(page).toHaveURL(url => url.searchParams.get('view') === 'memory' && url.searchParams.get('queue') === '450' && url.searchParams.get('champion') === 'Ahri' && url.searchParams.get('result') === 'loss');
  await page.screenshot({ path: 'player-visuals/compact-profile-memory.png', fullPage: true, animations: 'disabled' });

  await views.getByRole('button', { name: 'Match history', exact: true }).click();
  await expect(filters.getByLabel('Game mode', { exact: true })).toHaveValue('450');
  await expect(filters.getByLabel('Champion', { exact: true })).toHaveValue('Ahri');
  await expect(filters.getByLabel('Result', { exact: true })).toHaveValue('loss');
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toHaveAttribute('href', new RegExp(`/matches/${recentAramLoss.metadata.matchId}\\?`));
  await expectSummary(page, 450, { matches: 1, wins: 0, winRate: 0, kda: [6, 4, 12] });
  await expect(arrival.getByRole('link', { name: 'Explore your games', exact: true })).toHaveAttribute('href', '#player-records');
  expect(requests.filter(request => request.action === 'history')).toHaveLength(1);
});

test('a profile displays the canonical account identity instead of trusting an editable name query', async ({ page }) => {
  const requests = await installFixtures(page, { matches: mixedModeMatches });
  const spoofedName = 'Different Player#SPOOF';
  await page.goto(`${profilePath}?name=${encodeURIComponent(spoofedName)}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(identity);
  await expect(page.getByText(spoofedName, { exact: true })).toHaveCount(0);
  const accountRequest = requests.find(request => request.action === 'account');
  expect(accountRequest).toBeDefined();
  expect(new URL(accountRequest!.url).searchParams.get('puuid')).toBe(puuid);
  expect(new URL(accountRequest!.url).searchParams.get('platform')).toBe(platform);
});

test('an unavailable account identity keeps a neutral profile heading instead of presenting a query name as verified', async ({ page }) => {
  await installFixtures(page, { matches: mixedModeMatches, accountFailure: true });
  const spoofedName = 'Different Player#SPOOF';
  await page.goto(`${profilePath}?name=${encodeURIComponent(spoofedName)}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Player profile', exact: true, level: 1 })).toBeVisible();
  await expect(page.getByText(spoofedName, { exact: true })).toHaveCount(0);
  await expect(rows(page)).toHaveCount(5);
});

test('All recent includes newer ARAM and modern normal games ahead of old ranked history with separate mode statistics', async ({ page }) => {
  const requests = await installFixtures(page, { matches: mixedModeMatches });
  await page.goto(namedProfile, { waitUntil: 'domcontentloaded' });
  await expect(page.getByLabel('Game mode', { exact: true })).toHaveValue('all');
  await expect(page.getByRole('region', { name: 'Recent match sample', exact: true })).toContainText('5 of 5 recent matches imported');
  await expect(rows(page)).toHaveCount(5);
  const historyRequest = requests.find(request => request.action === 'history');
  expect([null, '', 'all']).toContain(new URL(historyRequest!.url).searchParams.get('queue'));
  await expect(rows(page).first()).toHaveAttribute('href', new RegExp(`/matches/${recentAramWin.metadata.matchId}\\?`));
  await expect(rows(page).first()).toHaveAttribute('data-queue', '450');
  await expect(rows(page).first()).toContainText('ARAM');
  await expect(rows(page).first()).toContainText('2026');
  await expect(rows(page).last()).toHaveAttribute('href', new RegExp(`/matches/${oldRankedMatch.metadata.matchId}\\?`));
  await expect(rows(page).last()).toContainText('2025');
  await expect(rows(page).last()).toContainText('Ranked Solo/Duo');
  await expect(page.locator('[data-mode-summary]')).toHaveCount(4);
  await expectSummary(page, 450, { matches: 2, wins: 1, winRate: 50, kda: [12, 5, 18] });
  await expectSummary(page, 2400, { matches: 1, wins: 0, winRate: 0, kda: [0, 10, 2] });
  await expectSummary(page, 420, { matches: 1, wins: 1, winRate: 100, kda: [30, 1, 3] });
  await expect(modeSummary(page, 450).locator('[data-stat="cs-per-minute"], [data-stat="vision"]')).toHaveCount(0);
  await expect(modeSummary(page, 2400).locator('[data-stat="cs-per-minute"], [data-stat="vision"]')).toHaveCount(0);
  await expect(page.locator('.match-row[data-queue="2400"] .loadout-runes')).toHaveCount(0);
  await expect(page.locator('.match-row[data-queue="2400"]')).toContainText('Augments mode · rune settings not used');
  const importedIds = requests.filter(request => request.action === 'match')
    .map(request => new URL(request.url).searchParams.get('id'));
  expect(importedIds.sort()).toEqual(mixedModeMatches.map(match => match.metadata.matchId).sort());
  expect(requests.filter(request => ['timeline', 'review'].includes(request.action))).toEqual([]);
});

test('explicit mode selection changes the imported sample and never combines ARAM with Mayhem or ranked', async ({ page }) => {
  const requests = await installFixtures(page, { matches: mixedModeMatches });
  await page.goto(namedProfile, { waitUntil: 'domcontentloaded' });
  const mode = page.getByLabel('Game mode', { exact: true });
  await expect(rows(page)).toHaveCount(5);
  for (const sample of [
    { queue: 450, label: 'ARAM', count: 2, first: recentAramWin, wins: 1, winRate: 50, kda: [12, 5, 18] },
    { queue: 2400, label: 'ARAM: Mayhem', count: 1, first: mayhemMatch, wins: 0, winRate: 0, kda: [0, 10, 2] },
    { queue: 420, label: 'Ranked Solo/Duo', count: 1, first: oldRankedMatch, wins: 1, winRate: 100, kda: [30, 1, 3] },
    { queue: 480, label: 'Swiftplay', count: 1, first: swiftplayMatch, wins: 0, winRate: 0, kda: [2, 8, 4] },
  ]) {
    await test.step(sample.label, async () => {
      await mode.selectOption(String(sample.queue));
      await expect(page).toHaveURL(url => url.searchParams.get('queue') === String(sample.queue));
      await expect(rows(page)).toHaveCount(sample.count);
      await expect(page.locator(`.match-row:not([data-queue="${sample.queue}"])`)).toHaveCount(0);
      await expect(rows(page).first()).toContainText(sample.label);
      await expect(rows(page).first()).toHaveAttribute('href', new RegExp(`/matches/${sample.first.metadata.matchId}\\?`));
      await expect(page.locator('[data-mode-summary]')).toHaveCount(1);
      await expectSummary(page, sample.queue, { matches: sample.count, wins: sample.wins, winRate: sample.winRate, kda: sample.kda });
      expect(requests.some(request => request.action === 'history' && new URL(request.url).searchParams.get('queue') === String(sample.queue))).toBe(true);
    });
  }
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(mode).toHaveValue('480');
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toHaveAttribute('data-queue', '480');
});

test('partial imports stay visibly incomplete and refresh repairs the sample and its averages', async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const failures = [recentAramLoss.metadata.matchId];
  const requests = await installFixtures(page, {
    matches: mixedModeMatches,
    matchFailures: failures,
    beforeMatch: id => id === recentAramLoss.metadata.matchId ? held : Promise.resolve(),
  });
  try {
    await page.goto(`${namedProfile}&queue=450`, { waitUntil: 'domcontentloaded' });
    await expect.poll(() => requests.some(request => request.action === 'match' && new URL(request.url).searchParams.get('id') === recentAramLoss.metadata.matchId)).toBe(true);
    const sample = page.getByRole('region', { name: 'Recent match sample', exact: true });
    await expect(sample).toContainText('0 of 2 recent matches imported');
    await expect(sample).toContainText(/loading|importing|remaining/i);
    await expect(modeSummary(page, 450)).toHaveCount(0);
    release();
    await expect(sample).toContainText('1 of 2 recent matches imported');
    await expect(sample).toContainText(/incomplete|unavailable/i);
    await expect(rows(page)).toHaveCount(1);
    await expectSummary(page, 450, { matches: 1, wins: 1, winRate: 100, kda: [18, 6, 24] });

    failures.length = 0;
    await page.getByRole('button', { name: 'Refresh recent matches', exact: true }).click();
    await expect(sample).toContainText('2 of 2 recent matches imported');
    await expect(rows(page)).toHaveCount(2);
    await expectSummary(page, 450, { matches: 2, wins: 1, winRate: 50, kda: [12, 5, 18] });
    await expect(sample).not.toContainText(/incomplete|unavailable/i);
  } finally {
    release();
  }
});

test('refresh replaces a later history ID when the first batch is unchanged and never restores an obsolete batch', async ({ page }) => {
  const obsoleteId = oldRankedMatch.metadata.matchId;
  const replacement = {
    ...recentAramLoss,
    metadata: { matchId: 'EUN1_22006' },
    info: { ...recentAramLoss.info, gameCreation: Date.parse('2026-10-23T18:00:00Z'),
      participants: [{ ...recentAramLoss.info.participants[0]!, kills: 12, deaths: 2, assists: 0 }],
    },
  };
  const initialIds = [...mixedModeMatches].sort((a, b) => b.info.gameCreation - a.info.gameCreation)
    .map(match => match.metadata.matchId);
  const replacementIds = [...initialIds.slice(0, 4), replacement.metadata.matchId];
  let historyCalls = 0;
  let obsoleteCalls = 0;
  let releaseHistory!: () => void;
  let releaseObsolete!: () => void;
  const heldHistory = new Promise<void>(resolve => { releaseHistory = resolve; });
  const heldObsolete = new Promise<void>(resolve => { releaseObsolete = resolve; });
  const requests = await installFixtures(page, {
    matches: [...mixedModeMatches, replacement],
    historyIds: async () => {
      historyCalls += 1;
      if (historyCalls === 1) return initialIds;
      await heldHistory;
      return replacementIds;
    },
    beforeMatch: async id => {
      if (id === obsoleteId && ++obsoleteCalls > 1) await heldObsolete;
    },
  });
  try {
    await page.goto(namedProfile, { waitUntil: 'domcontentloaded' });
    const sample = page.getByRole('region', { name: 'Recent match sample', exact: true });
    await expect(sample).toContainText('5 of 5 recent matches imported');
    await expect(sample).toHaveAttribute('aria-busy', 'false');
    await expect(rows(page)).toHaveCount(5);
    await expect(page.locator(`.match-row[href^="/matches/${obsoleteId}?"]`)).toBeVisible();
    const refreshedIds = page.waitForResponse(response => new URL(response.url()).pathname === '/api/player/history');
    await page.getByRole('button', { name: 'Refresh recent matches', exact: true }).click();
    await expect.poll(() => historyCalls).toBe(2);
    // A concurrent old implementation may already be refreshing ID5. Keep
    // that stale response pending while the new history snapshot is applied.
    // Sequential refresh correctly avoids issuing the stale request at all.
    releaseHistory();
    expect(await (await refreshedIds).json()).toEqual(replacementIds);
    await expect.poll(() => requests.some(request => request.action === 'match' && new URL(request.url).searchParams.get('id') === replacement.metadata.matchId)).toBe(true);
    await expect(page.locator(`.match-row[href^="/matches/${replacement.metadata.matchId}?"]`)).toBeVisible();
    await expect(page.locator(`.match-row[href^="/matches/${obsoleteId}?"]`)).toHaveCount(0);
    await expect(sample).toContainText('5 of 5 recent matches imported');
    await expect(sample).toHaveAttribute('aria-busy', 'false');
    await expect(rows(page)).toHaveCount(5);
    await expect(page.locator('[data-mode-summary]')).toHaveCount(3);
    await expect(modeSummary(page, 420)).toHaveCount(0);
    await expectSummary(page, 450, { matches: 3, wins: 1, winRate: 33.3, kda: [12, 4, 12] });

    if (obsoleteCalls > 1) {
      const obsoleteResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/player/match' && new URL(response.url()).searchParams.get('id') === obsoleteId);
      releaseObsolete();
      await (await obsoleteResponse).finished();
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    } else releaseObsolete();
    await expect(page.locator(`.match-row[href^="/matches/${obsoleteId}?"]`)).toHaveCount(0);
    await expect(rows(page)).toHaveCount(5);
    await expect(sample).toContainText('5 of 5 recent matches imported');
    await expectSummary(page, 450, { matches: 3, wins: 1, winRate: 33.3, kda: [12, 4, 12] });
  } finally {
    releaseHistory();
    releaseObsolete();
  }
});

test('ARAM review labels its mode and does not invent Summoner’s Rift lane or vision analysis', async ({ page }) => {
  await installFixtures(page, { matches: mixedModeMatches });
  await page.goto(`/matches/${recentAramWin.metadata.matchId}?${query}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /^Ahri/, level: 1 })).toBeVisible();
  await expect(page.getByText(/Recorded summary · available without AI/)).toBeVisible();
  await page.getByText('Supporting facts, not inferred causes', { exact: true }).click();
  await expect(page.locator('#fact-mode-context')).toContainText('ARAM');
  await expect(page.locator('#fact-farm-rate')).toHaveCount(0);
  await expect(page.locator('#fact-vision')).toHaveCount(0);
  await expect(page.locator('#fact-result')).toContainText('18/6/24');
  await expect(page.locator('#fact-inventory')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try this next time', exact: true })).toHaveCount(0);
});

test('new ARAM memory compares later ARAM games while excluding Mayhem even with the same mode context', async ({ page }) => {
  const laterMayhem = { ...mayhemMatch, info: { ...mayhemMatch.info, gameCreation: recentAramWin.info.gameCreation + 1_000 } };
  await installFixtures(page, { matches: [laterMayhem, recentAramWin, recentAramLoss] });
  await seedNotes(page, [{
    ...savedNote, role: 'MODE:aram', queue: 450, source: recentAramLoss.metadata.matchId,
    sourceDate: recentAramLoss.info.gameCreation, createdAt: recentAramLoss.info.gameCreation + 1_000,
    trackingStartedAt: recentAramLoss.info.gameCreation + 1_000,
  }]);
  await page.goto(`${namedProfile}&view=memory`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/1 eligible later match/)).toBeVisible();
  const note = page.locator('.memory-note');
  await expect(note).toContainText('ARAM · no assigned lane');
  await expect(note).not.toContainText('MODE:aram');
  const selector = page.getByLabel('Inspect purchase evidence', { exact: true });
  await expect(selector.locator('option')).toHaveCount(2);
  await expect(selector.locator(`option[value="${mayhemMatch.metadata.matchId}"]`)).toHaveCount(0);
  await selector.selectOption(recentAramWin.metadata.matchId);
  await expect(page.getByText(/Purchase event observed/)).toBeVisible();
});

test('gateway form is keyboard operable and opens the separate player profile', async ({ page }) => {
  await installFixtures(page, { matches: mixedModeMatches });
  await page.goto(`/players?platform=${platform}`, { waitUntil: 'domcontentloaded' });
  const form = page.getByRole('form', { name: 'Find a League of Legends player', exact: true });
  const riotId = form.getByLabel('Riot ID', { exact: true });
  const server = form.getByLabel('Server', { exact: true });
  const submit = form.getByRole('button', { name: /Find player/ });
  await expect(submit).toBeEnabled();
  const buildsIntent = page.getByRole('button', { name: 'Your builds', exact: true });
  await buildsIntent.focus();
  await page.keyboard.press('Enter');
  await expect(buildsIntent).toHaveAttribute('aria-pressed', 'true');
  await riotId.focus();
  await page.keyboard.type(identity);
  await page.keyboard.press('Tab');
  await expect(server).toBeFocused();
  await expect(server).toHaveValue(platform);
  await page.keyboard.press('Tab');
  await expect(submit).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(url => url.pathname === profilePath && url.searchParams.get('view') === 'builds');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(identity);
  await expect(page.getByRole('heading', { name: 'Observed personal builds', exact: true })).toBeVisible();
  await expect(page.locator('[data-player-gateway]')).toHaveCount(0);
});

test('the profile match path and shared map provide keyboard navigation without losing browser Back', async ({ page }) => {
  await installFixtures(page, { matches: mixedModeMatches });
  await page.goto(namedProfile, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toHaveAttribute('data-surface', 'player');
  const mapOpener = page.locator('[data-map-open]');
  await expect(mapOpener).toHaveCount(1);
  await mapOpener.click();
  const map = page.locator('#rift-map-dialog');
  await expect(map).toBeVisible();
  await expect(map.locator('[aria-current="page"]')).toHaveAttribute('href', '/players');
  await map.locator('.map-destination[href="/players"]').click();
  await expect(page).toHaveURL(url => url.pathname === '/players');
  await expect(page.locator('body')).toHaveAttribute('data-surface', 'players');
  await expect(page.locator('[data-player-gateway]')).toBeVisible();
  await expect(mapOpener).toHaveCount(1);

  await page.goBack();
  await expect(page).toHaveURL(url => url.pathname === profilePath);
  await expect(rows(page)).toHaveCount(5);
  const matchPath = page.getByRole('navigation', { name: 'Recent match path', exact: true });
  const rankedMoment = matchPath.getByRole('link', { name: /^Open Ahri, Ranked Solo\/Duo, win,/ });
  await rankedMoment.focus();
  await expect(rankedMoment).toHaveAttribute('data-selected', 'true');
  await expect(page.locator('.profile-path-reading')).toContainText('Ranked Solo/Duo');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(url => url.pathname === `/matches/${oldRankedMatch.metadata.matchId}`);
  await expect(page.locator('body')).toHaveAttribute('data-surface', 'match');
  await expect(mapOpener).toHaveCount(1);
  await mapOpener.click();
  await expect(map).toBeVisible();
  await expect(map.locator('[aria-current="page"]')).toHaveAttribute('href', '/players');
  await page.keyboard.press('Escape');
  await expect(map).not.toBeVisible();
  await expect(mapOpener).toBeFocused();
});
