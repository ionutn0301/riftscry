import { test, expect } from '@playwright/test';
import {
  alreadyStartedMatch, followUpMatch, historicalMatch, installFixtures, makeMatch, memoryKey,
  otherProfilePath, platform, profilePath, query, readNotes, savedNote, seedNotes,
  sourceMatch, suggestion, trackingStart,
} from './fixtures';
import { openFilters, openScene } from './profile-controls';

const matchUrl = `/matches/${sourceMatch.metadata.matchId}?${query}`;

test('lookup opens readable profile and grouped builds without eager timeline or AI calls', async ({ page }) => {
  const requests = await installFixtures(page);
  await page.goto(`/players?platform=${platform}`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Riot ID', { exact: true }).fill('Fixture Player#TEST');
  await page.getByLabel('Server', { exact: true }).selectOption(platform);
  await page.getByRole('button', { name: 'Find player', exact: false }).click();

  await expect(page).toHaveURL(url => url.pathname === profilePath && !url.searchParams.has('puuid'));
  await expect(page.locator('[data-player-gateway]')).toHaveCount(0);
  await expect(page.locator('[data-player-profile]')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Fixture Player#TEST');
  await expect(page.locator('.match-row')).toHaveCount(3);
  await expect(page.locator('.match-row').first().locator('.item-label[title="Plated Steelcaps"]')).toBeVisible();
  await expect(page.locator('.match-row').first().locator('[data-match-mode]')).toHaveText('Ranked Solo/Duo');
  await expect(page.locator('[data-player-avatar] img')).toHaveAttribute('src', /\/img\/profileicon\/29\.png$/);
  const lookup = requests.find(request => request.action === 'lookup');
  expect(new URL(lookup!.url).searchParams.get('name')).toBe('Fixture Player');
  expect(new URL(lookup!.url).searchParams.get('tag')).toBe('TEST');
  expect(new URL(lookup!.url).searchParams.get('platform')).toBe(platform);
  expect(requests.filter(request => ['timeline', 'review'].includes(request.action))).toEqual([]);

  await page.getByRole('button', { name: 'Builds', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your builds', exact: true })).toBeVisible();
  const builds = page.locator('.observed-build');
  await expect(builds).toHaveCount(2);
  await expect(builds.first().getByRole('heading', { name: 'Ahri', exact: true })).toBeVisible();
  await expect(builds.first().locator('.build-occurrences')).toHaveText('2 games');
  await builds.first().getByText('View 2 matches', { exact: true }).click();
  await expect(builds.first().locator(`a[href^="/matches/${sourceMatch.metadata.matchId}?"]`)).toBeVisible();
  await expect(builds.first().locator(`a[href^="/matches/${historicalMatch.metadata.matchId}?"]`)).toBeVisible();
  await page.getByRole('button', { name: 'Matches', exact: true }).click();
  await openFilters(page);
  await page.getByLabel('Champion', { exact: true }).selectOption('Ahri');
  await page.getByLabel('Result', { exact: true }).selectOption('win');
  await page.locator('.match-row').first().click();
  await expect(page.getByRole('heading', { name: /^Ahri/, level: 1 })).toBeVisible();
  await page.getByRole('link', { name: /Back to player/ }).click();
  await expect(page.getByLabel('Champion', { exact: true })).toHaveValue('Ahri');
  await expect(page.getByLabel('Result', { exact: true })).toHaveValue('win');
});

test('AI suggestion prefills a draft, opens evidence, and saves only after confirmation', async ({ page }) => {
  const requests = await installFixtures(page);
  await page.goto(matchUrl, { waitUntil: 'domcontentloaded' });
  await openScene(page, 'match-review');
  await page.getByRole('button', { name: 'Review with AI', exact: true }).click();
  await expect(page.getByText(/AI-assisted interpretation/)).toBeVisible();
  await expect(page.locator('.review-full')).toHaveJSProperty('open', true);
  expect(requests.filter(request => request.action === 'review').map(request => request.method)).toEqual(['POST']);

  await page.locator('.review-focus a[href="#fact-event-0"]').first().click();
  await expect(page.locator('#fact-event-0')).toBeVisible();
  await expect(page.locator('#fact-event-0')).toBeFocused();

  await openScene(page, 'match-review');
  await page.getByRole('button', { name: 'Review draft', exact: true }).click();
  await expect(page.getByLabel('Decision being reconsidered', { exact: true })).toHaveValue(suggestion.original);
  await expect(page.getByLabel('Proposed alternative', { exact: true })).toHaveValue(suggestion.alternative);
  await expect(page.getByLabel('Tracked item', { exact: true })).toHaveValue('3047');
  await expect(page.getByLabel('Reason', { exact: true })).toHaveValue(suggestion.reason);
  await expect(page.getByLabel('Tradeoff', { exact: true })).toHaveValue(suggestion.tradeoff);
  expect(await readNotes(page)).toEqual([]);

  await page.getByRole('button', { name: 'Save adjustment', exact: true }).click();
  await expect(page.getByText(/^Saved privately on this browser\./)).toBeVisible();
  const [note] = await readNotes(page);
  expect(note).toMatchObject({ targetItem: 3047, source: sourceMatch.metadata.matchId, evidence: suggestion.evidence });
  expect(note!.createdAt).toBeGreaterThan(sourceMatch.info.gameCreation);
  expect(note!.trackingStartedAt).toBe(note!.createdAt);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: `Ahri · ${suggestion.alternative}`, exact: true })).toBeVisible();
  await page.getByRole('link', { name: /^Check recent matches/ }).click();
  await expect(page.getByText(/No later games available in the imported sample/)).toBeVisible();
});

test('a direct event evidence link loads its timeline and reveals the referenced fact without requesting AI', async ({ page }) => {
  const requests = await installFixtures(page);
  await page.goto(`${matchUrl}#fact-event-0`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#fact-event-0')).toBeVisible();
  await expect(page.locator('#fact-event-0')).toBeFocused();
  await expect(page.locator('.supporting-evidence')).toHaveAttribute('open', '');
  expect(requests.filter(request => request.action === 'timeline')).toHaveLength(1);
  expect(requests.filter(request => request.action === 'review')).toEqual([]);
});

test('manual adjustments persist privately and do not cross player contexts', async ({ page }) => {
  await installFixtures(page);
  await page.goto(matchUrl, { waitUntil: 'domcontentloaded' });
  await openScene(page, 'match-memory');
  await page.getByText('Save an adjustment from this match', { exact: true }).click();
  await page.getByLabel('Decision being reconsidered', { exact: true }).fill('Review the first boots purchase');
  await page.getByLabel('Tracked item', { exact: true }).selectOption('1001');
  await page.getByLabel('Proposed alternative', { exact: true }).fill('Observe boots timing');
  await page.getByLabel('Reason', { exact: true }).fill('Preparation note');
  await page.getByLabel('Tradeoff', { exact: true }).fill('Another component is delayed');
  await page.getByRole('button', { name: 'Save adjustment', exact: true }).click();
  await expect(page.getByText(/^Saved privately on this browser\./)).toBeVisible();

  await page.goto(`${profilePath}?view=memory`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Ahri · Observe boots timing', exact: true })).toBeVisible();
  await page.goto(`${otherProfilePath}?view=memory`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'No saved ideas yet.', exact: true })).toBeVisible();
  expect(await readNotes(page)).toHaveLength(1);
});

test('material revision updates the tracked item and baseline; reflection preserves them', async ({ page }) => {
  await installFixtures(page);
  await seedNotes(page, [savedNote]);
  await page.goto(`${profilePath}?view=memory`, { waitUntil: 'domcontentloaded' });
  const note = page.locator('.memory-note').filter({ has: page.getByRole('heading', { name: `Ahri · ${savedNote.alternative}`, exact: true }) });
  await note.getByText('Revise this adjustment', { exact: true }).click();
  await note.getByLabel('Tracked item', { exact: true }).selectOption('3006');
  await note.getByLabel('Revise alternative', { exact: true }).fill('Observe attack-speed boots instead');
  await note.getByLabel('Reason', { exact: true }).fill('Compare this item in a future suitable situation.');
  await note.getByLabel('Tradeoff', { exact: true }).fill('Different properties replace the previous item choice.');
  await note.getByRole('button', { name: 'Save revision', exact: true }).click();
  await expect(page.getByText('Saved privately on this browser.', { exact: true })).toBeVisible();
  const [revised] = await readNotes(page);
  expect(revised).toMatchObject({ createdAt: trackingStart, targetItem: 3006, alternative: 'Observe attack-speed boots instead', status: 'revised' });
  expect(revised!.trackingStartedAt).toBeGreaterThan(trackingStart);
  expect(revised!.revisedAt).toBe(revised!.trackingStartedAt);

  const changedNote = page.locator('.memory-note').filter({ has: page.getByRole('heading', { name: 'Ahri · Observe attack-speed boots instead', exact: true }) });
  await changedNote.getByText('Revise this adjustment', { exact: true }).click();
  await changedNote.getByLabel('Optional reflection', { exact: true }).fill('Reviewed the replay; continue observing.');
  await changedNote.getByRole('button', { name: 'Save revision', exact: true }).click();
  const [reflected] = await readNotes(page);
  expect(reflected!.trackingStartedAt).toBe(revised!.trackingStartedAt);
  expect(reflected!.targetItem).toBe(3006);
});

test('follow-up excludes historical and already-started games and does not duplicate after refresh', async ({ page }) => {
  const wrongQueue = makeMatch('EUN1_12351', trackingStart + 4_000);
  wrongQueue.info.queueId = 440;
  await installFixtures(page, { matches: [wrongQueue, followUpMatch, alreadyStartedMatch, historicalMatch, sourceMatch] });
  await seedNotes(page, [savedNote]);
  await page.goto(`${profilePath}?view=memory`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/1 eligible later match/)).toBeVisible();
  const selector = page.getByLabel('Inspect purchase evidence', { exact: true });
  await expect(selector.locator('option')).toHaveCount(2);
  await expect(selector.locator(`option[value="${historicalMatch.metadata.matchId}"]`)).toHaveCount(0);
  await expect(selector.locator(`option[value="${alreadyStartedMatch.metadata.matchId}"]`)).toHaveCount(0);
  await expect(selector.locator(`option[value="${wrongQueue.metadata.matchId}"]`)).toHaveCount(0);
  await selector.selectOption(followUpMatch.metadata.matchId);
  await expect(page.getByText(/Purchase event observed/)).toBeVisible();
  await page.getByText('Inspect all recorded item events', { exact: true }).click();
  await expect(page.getByText('undo', { exact: true })).toBeVisible();

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/1 eligible later match/)).toBeVisible();
  expect(await readNotes(page)).toHaveLength(1);
  expect((await readNotes(page))[0]!.trackingStartedAt).toBe(trackingStart);
});

test('legacy notes retain unknown creation time until tracking is explicitly started', async ({ page }) => {
  await installFixtures(page);
  const { createdAt, trackingStartedAt, revisedAt, ...legacy } = savedNote;
  await seedNotes(page, [legacy]);
  await page.goto(`${profilePath}?view=memory`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/Legacy adjustment: creation time is unknown/)).toBeVisible();
  await page.getByRole('button', { name: 'Start tracking from now', exact: true }).click();
  const [migrated] = await readNotes(page);
  expect(migrated).toMatchObject({ createdAt: null, sourceDate: legacy.sourceDate, original: legacy.original, targetItem: legacy.targetItem });
  expect(migrated!.trackingStartedAt).toBeGreaterThan(trackingStart);
  await expect(page.getByText(/No later games available in the imported sample/)).toBeVisible();
});

test('a custom condition requires explicit match confirmation and can be undone', async ({ page }) => {
  const wrongChampion = makeMatch('EUN1_12349', trackingStart + 2_000);
  wrongChampion.info.participants[0]!.championName = 'Lux';
  const differentPatch = makeMatch('EUN1_12350', trackingStart + 3_000);
  differentPatch.info.gameVersion = '16.22.1';
  const requests = await installFixtures(page, { matches: [differentPatch, wrongChampion, followUpMatch, sourceMatch] });
  await seedNotes(page, [{ ...savedNote, condition: 'Compare physical defense when that threat is relevant.', confirmedMatchIds: [] }]);
  await page.goto(`${profilePath}?view=memory`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/0 eligible later matches.*2 unknown/)).toBeVisible();
  const candidates = page.getByLabel('Match to check', { exact: true });
  await expect(candidates.locator('option')).toHaveCount(2);
  await expect(candidates.locator(`option[value="${wrongChampion.metadata.matchId}"]`)).toHaveCount(0);
  await expect(candidates.locator(`option[value="${differentPatch.metadata.matchId}"]`)).toHaveCount(0);
  expect(requests.filter(request => request.action === 'timeline')).toEqual([]);

  await candidates.selectOption(followUpMatch.metadata.matchId);
  await page.getByRole('button', { name: 'This condition applied', exact: true }).click();
  await expect(page.getByText(/1 eligible later match/)).toBeVisible();
  await expect(page.getByText(/Purchase event observed/)).toBeVisible();
  expect((await readNotes(page))[0]!.confirmedMatchIds).toEqual([followUpMatch.metadata.matchId]);
  expect((await readNotes(page))[0]!.trackingStartedAt).toBe(trackingStart);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/1 eligible later match/)).toBeVisible();
  await page.getByLabel('Inspect purchase evidence', { exact: true }).selectOption(followUpMatch.metadata.matchId);
  await page.getByRole('button', { name: 'Undo condition confirmation', exact: true }).click();
  await expect(page.getByText(/0 eligible later matches.*2 unknown/)).toBeVisible();
  expect((await readNotes(page))[0]!.confirmedMatchIds).toEqual([]);
});

test('timeline and AI failures keep the loaded match summary usable while unavailable item details can be retried', async ({ page }) => {
  let itemsAvailable = false;
  const requests = await installFixtures(page, {
    reviewFailure: true, timelineFailure: true,
    response: ({ action }) => action === 'items' && !itemsAvailable
      ? { status: 503, json: { error: 'Fixture historical item details unavailable.' } }
      : undefined,
  });
  await page.goto(matchUrl, { waitUntil: 'domcontentloaded' });
  const overview = page.getByRole('region', { name: 'Match overview', exact: true });
  await expect(overview).toContainText('Item names unavailable. Recorded IDs are kept.');
  await expect(overview.getByText('Item 1001', { exact: true })).toBeVisible();
  await openScene(page, 'match-evidence');
  await page.getByRole('button', { name: 'Open timeline', exact: true }).click();
  await expect(page.getByText(/Timeline unavailable/).first()).toBeVisible();
  await openScene(page, 'match-review');
  await page.getByRole('button', { name: 'Review with AI', exact: true }).click();
  await expect(page.getByText(/Deterministic summary remains available/)).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Ahri/, level: 1 })).toBeVisible();
  await expect(page.locator('.review-full')).toHaveJSProperty('open', false);
  await page.getByText('Full review', { exact: true }).click();
  await expect(page.getByText('Your build', { exact: true })).toBeVisible();
  itemsAvailable = true;
  await openScene(page, 'match-overview');
  await overview.getByRole('button', { name: 'Retry item details', exact: true }).click();
  await expect(overview.locator('.item-label[title="Boots"]')).toBeVisible();
  await expect(overview.locator('.rune-label[title="Electrocute"]')).toBeVisible();
  await expect(overview).not.toContainText('Item names unavailable.');
  expect(requests.filter(request => request.action === 'items')).toHaveLength(2);
  expect(requests.filter(request => request.action === 'match')).toHaveLength(1);
  expect(requests.filter(request => request.action === 'timeline')).toHaveLength(1);
  expect(requests.filter(request => request.action === 'review')).toHaveLength(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('unreadable stored notes are not overwritten by a new save', async ({ page }) => {
  await installFixtures(page);
  await page.addInitScript(key => localStorage.setItem(key, '{not valid JSON'), memoryKey);
  await page.goto(matchUrl, { waitUntil: 'domcontentloaded' });
  await openScene(page, 'match-memory');
  await expect(page.getByText(/Saved notes could not be read/)).toBeVisible();
  await openScene(page, 'match-memory');
  await page.getByText('Save an adjustment from this match', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save adjustment', exact: true })).toBeDisabled();
  expect(await page.evaluate(key => localStorage.getItem(key), memoryKey)).toBe('{not valid JSON');
});
