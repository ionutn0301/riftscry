import { mkdir } from 'node:fs/promises';
import { test, expect, type Locator, type Page } from '@playwright/test';
import type { Match, Participant } from '../../src/lib/player/contracts';
import type { MomentumState } from '../../src/lib/player/momentum';
import { installFixtures, makeMatch, platform, puuid, query, type FixtureRequest } from './fixtures';

const now = Date.parse('2026-11-03T08:00:00Z');
const hour = 60 * 60 * 1000;
const momentumKey = `riftscry:momentum:v1:${platform}:${puuid}`;
const direct = (scope = '') => `/next-game?${query}${scope}`;

/** Synthetic completed 5v5 records: the selected player's 20 involvements / 50 team kills is 40%. */
function game(id: string, startedAt: number, champion = 'Ahri', queue = 450): Match {
  const match = makeMatch(id, startedAt);
  const aram = queue === 450;
  const self: Participant = {
    ...match.info.participants[0]!, championName: champion, participantId: 1, teamId: 100,
    teamPosition: aram ? '' : 'MIDDLE', kills: 5, assists: 15, deaths: 2,
    totalMinionsKilled: 120, neutralMinionsKilled: 0, visionScore: 20,
  };
  const allyChampions = ['Garen', 'LeeSin', 'Jinx', 'Lulu', 'Ashe'].filter(name => name !== champion).slice(0, 4);
  const allies = allyChampions.map((championName, index): Participant => ({
    ...self, puuid: `first-result-ally-${index}-000000000000000000000000000000`,
    participantId: index + 2, championName,
    teamPosition: aram ? '' : ['TOP', 'JUNGLE', 'BOTTOM', 'UTILITY'][index]!,
    kills: index === 3 ? 15 : 10,
  }));
  const enemies = ['Malphite', 'MasterYi', 'Brand', 'Ashe', 'Morgana'].map((championName, index): Participant => ({
    ...self, puuid: `first-result-enemy-${index}-00000000000000000000000000000`,
    participantId: index + 6, teamId: 200, championName, kills: 2, deaths: 10, assists: 3,
    teamPosition: aram ? '' : ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'][index]!,
    win: false,
  }));
  match.info = { ...match.info, queueId: queue, gameMode: aram ? 'ARAM' : 'CLASSIC',
    mapId: aram ? 12 : 11, gameVersion: '16.21.1', participants: [self, ...allies, ...enemies],
  };
  return match;
}

async function complete(page: Page) {
  await expect(page.locator('[data-briefing-report]')).toHaveAttribute('aria-busy', 'false');
}

async function firstResult(page: Page, source: Match, kind: 'farm' | 'vision' | 'participation' | 'record') {
  const result = page.locator('[data-first-result]');
  await expect(result).toBeVisible();
  await expect(result).toHaveAttribute('data-first-result-kind', kind);
  await expect(result.getByRole('heading', { level: 2 })).toHaveText(/\S/);
  const link = result.getByRole('link', { name: 'Open this game', exact: true });
  await expect(link).toBeVisible();
  const destination = new URL((await link.getAttribute('href'))!, page.url());
  expect(destination.pathname).toBe(`/matches/${source.metadata.matchId}`);
  expect(destination.searchParams.get('platform')).toBe(platform);
  expect(destination.searchParams.get('puuid')).toBe(puuid);
  return result;
}

function noFirstValueDependencies(requests: FixtureRequest[]) {
  expect(requests.filter(request => ['rank', 'summoner', 'review', 'timeline'].includes(request.action))).toEqual([]);
}

async function savedMomentum(page: Page) {
  return page.evaluate(key => localStorage.getItem(key), momentumKey);
}

async function keyboardReach(page: Page, target: Locator) {
  for (let index = 0; index < 35; index++) {
    if (await target.evaluate(element => document.activeElement === element)) break;
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
  await expect(target).toBeInViewport({ ratio: 0.95 });
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(now) });
});

test('one keyboard lookup preserves an incoming ARAM and champion scope', async ({ page }) => {
  const source = game('EUN1_82001', now - hour);
  const unrelated = game('EUN1_82002', now - 2 * hour, 'Lux', 420);
  const requests = await installFixtures(page, { matches: [source, unrelated] });
  await page.goto('/next-game?queue=450&champion=Ahri', { waitUntil: 'domcontentloaded' });
  const form = page.getByRole('form', { name: 'Get an automatic player briefing', exact: true });
  await expect(form).toBeVisible();
  expect(requests).toEqual([]);
  await form.getByLabel('Server', { exact: true }).selectOption(platform);
  await form.getByLabel('Riot ID', { exact: true }).fill('Fixture Player#TEST');
  await form.getByLabel('Riot ID', { exact: true }).press('Enter');
  await expect(page).toHaveURL(url => url.pathname === '/next-game' &&
    url.searchParams.get('platform') === platform && url.searchParams.get('puuid') === puuid &&
    url.searchParams.get('queue') === '450' && url.searchParams.get('champion') === 'Ahri');
  await complete(page);
  const result = await firstResult(page, source, 'participation');
  await expect(result.locator('[data-first-result-metric]')).toContainText('40%');
  await expect(result).toContainText('ARAM');
  await expect(page.locator('textarea')).toHaveCount(0);
  expect(requests.filter(request => request.action === 'lookup')).toHaveLength(1);
  const histories = requests.filter(request => request.action === 'history');
  expect(histories.length).toBeGreaterThan(0);
  expect(histories.every(request => new URL(request.url).searchParams.get('queue') === '450')).toBe(true);
  noFirstValueDependencies(requests);
});

test('the first completed batch gives a useful result while a later record is still loading', async ({ page }) => {
  const records = ['Ahri', 'Ashe', 'Lux', 'Jinx', 'Vayne'].map((champion, index) =>
    game(`EUN1_${82101 + index}`, now - (index + 1) * hour, champion));
  const lastId = records.at(-1)!.metadata.matchId;
  let release = () => {};
  const held = new Promise<void>(resolve => { release = resolve; });
  const requests = await installFixtures(page, { matches: records, beforeMatch: async id => {
    if (id === lastId) await held;
  } });
  try {
    await page.goto(direct(), { waitUntil: 'domcontentloaded' });
    await expect.poll(() => requests.some(request => request.action === 'match' && new URL(request.url).searchParams.get('id') === lastId)).toBe(true);
    const result = await firstResult(page, records[0]!, 'participation');
    await expect(page.locator('[data-briefing-report]')).toHaveAttribute('aria-busy', 'true');
    await expect(result).toContainText('More games are loading');
    await expect(result.locator('[data-first-result-metric]')).toContainText('40%');
    await expect(page.locator('[data-momentum-state="tracking"]')).toHaveCount(0);
    expect(await savedMomentum(page)).toBeNull();
    release();
    await complete(page);
    await firstResult(page, records[0]!, 'participation');
    await expect(result).not.toContainText('More games are loading');
    await expect(page.locator('.automatic-sample')).toContainText('5 of 5 recent games imported.');
    expect(await savedMomentum(page)).toBeNull();
    noFirstValueDependencies(requests);
  } finally { release(); }
});

for (const count of [1, 2]) {
  test(`${count} recent ARAM ${count === 1 ? 'game gives' : 'games on different champions give'} value without a comparable-history target`, async ({ page }) => {
    const newest = game('EUN1_82201', now - hour, 'Ahri');
    const older = game('EUN1_82202', now - 2 * hour, 'Ashe');
    const records = count === 1 ? [newest] : [newest, older];
    const requests = await installFixtures(page, { matches: records });
    await page.goto(direct(), { waitUntil: 'domcontentloaded' });
    await complete(page);
    const result = await firstResult(page, newest, 'participation');
    await expect(result.locator('[data-first-result-metric]')).toContainText('40%');
    await expect(result).toContainText('ARAM');
    await expect(result).not.toContainText(/CS per minute|Vision score per minute|starting median|needs at least three/i);
    await expect(page.locator('[data-momentum-state="tracking"]')).toHaveCount(0);
    expect(await savedMomentum(page)).toBeNull();
    noFirstValueDependencies(requests);
  });
}

test('a newest Arena record stays the result instead of inheriting an older ranked farming target', async ({ page }) => {
  const olderRanked = [1, 2, 3].map(index => game(`EUN1_${82300 + index}`, now - (index + 2) * hour, 'Ahri', 420));
  const arena = makeMatch('EUN1_82310', now - hour);
  arena.info = { ...arena.info, queueId: 1700, gameMode: 'CHERRY', mapId: 30, gameVersion: '16.21.1' };
  const requests = await installFixtures(page, { matches: [arena, ...olderRanked] });
  await page.goto(direct(), { waitUntil: 'domcontentloaded' });
  await complete(page);
  const result = await firstResult(page, arena, 'record');
  await expect(result).toContainText('Arena');
  await expect(result).not.toContainText(/CS per minute|Vision score per minute|Kill participation/);
  await expect(page.locator('.momentum-target-row')).toHaveCount(0);
  expect(await savedMomentum(page)).toBeNull();
  const contexts = page.locator('[data-briefing-contexts]');
  await expect(contexts).toBeVisible();
  await expect(contexts.getByRole('button', { name: /Arena/ })).toBeVisible();
  const ranked = contexts.getByRole('button', { name: /Ranked Solo\/Duo/ });
  await expect(ranked).toBeVisible();
  await ranked.click();
  await expect(page).toHaveURL(url => url.searchParams.get('queue') === '420');
  await complete(page);
  await expect(page.locator('[data-briefing-contexts]').getByRole('button', { name: /Ranked Solo\/Duo/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-momentum-state="tracking"]')).toBeVisible();
  await expect(page.locator('.momentum-target')).toContainText('CS per minute');
  await expect(page.locator('[data-first-result]')).toHaveCount(0);
  const rankedProgress = await savedMomentum(page);

  await page.goBack({ waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(url => !url.searchParams.has('queue'));
  await complete(page);
  await firstResult(page, arena, 'record');
  await expect(page.locator('.momentum-target-row')).toHaveCount(0);
  await expect(page.locator('[data-briefing-contexts]').getByRole('button', { name: 'All recent', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await savedMomentum(page)).toBe(rankedProgress);
  expect(requests.filter(request => request.action === 'lookup')).toHaveLength(0);
  noFirstValueDependencies(requests);
});

test('an older completed ranked receipt supports history without replacing the latest Arena result', async ({ page }) => {
  const starting = [1, 2, 3].map(index => game(`EUN1_${82700 + index}`, now - (13 - index) * hour, 'Ahri', 420));
  const later = [1, 2, 3].map(index => {
    const match = game(`EUN1_${82710 + index}`, now - (9 - index) * hour, 'Ahri', 420);
    match.info.participants[0]!.totalMinionsKilled = 160;
    return match;
  });
  const previousGames = [...later, ...starting];
  // Hand-checked v1 receipt: three 120-CS / 20-minute starting games, then
  // three 160-CS / 20-minute games after activation, all above the 6.2 target.
  // The application still validates this document through its normal storage reader.
  const state: MomentumState = {
    version: 1, platform, puuid, cycles: [{
      id: `Ahri:420:MIDDLE:16.21:${now - 9 * hour}`,
      context: { champion: 'Ahri', queueId: 420, queueLabel: 'Ranked Solo/Duo', role: 'MIDDLE', roleLabel: 'Mid', patch: '16.21' },
      metric: 'farm', baseline: 6, baselineMatchIds: [...starting].reverse().map(match => match.metadata.matchId),
      target: 6.2, createdAt: now - 9 * hour,
      checks: later.map(match => ({ matchId: match.metadata.matchId, startedAt: match.info.gameCreation, value: 8, hit: true })),
      status: 'complete', completedAt: now - 5 * hour,
    }],
  };
  const saved = JSON.stringify(state);
  await page.addInitScript(({ key, value }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
  }, { key: momentumKey, value: saved });

  const arena = makeMatch('EUN1_82720', now - hour);
  arena.info = { ...arena.info, queueId: 1700, gameMode: 'CHERRY', mapId: 30, gameVersion: '16.21.1' };
  const requests = await installFixtures(page, { matches: [arena, ...previousGames] });
  await page.goto(direct(), { waitUntil: 'domcontentloaded' });
  await complete(page);
  const result = await firstResult(page, arena, 'record');
  await expect(result).toContainText('Arena');
  await expect(result.locator('[data-momentum-receipt]')).toHaveCount(0);
  await expect(page.locator('.momentum-target-row')).toHaveCount(0);
  const history = page.locator('[data-momentum-history]');
  await expect(history).toBeVisible();
  const receipt = history.locator('[data-momentum-receipt]');
  await expect(receipt).toBeVisible();
  await expect(receipt).toHaveJSProperty('open', false);
  await expect(receipt.locator('summary')).toContainText('Ranked Solo/Duo');
  await receipt.locator('summary').click();
  await expect(receipt).toHaveJSProperty('open', true);
  await expect(receipt.locator('li a')).toHaveCount(3);
  for (const match of later) {
    await expect(receipt.locator(`a[href^="/matches/${match.metadata.matchId}?"]`)).toBeVisible();
  }
  await expect(result).toBeVisible();
  expect(await savedMomentum(page)).toBe(saved);
  noFirstValueDependencies(requests);
});

test('an empty exact mode opens all recent games without another lookup', async ({ page }) => {
  const source = game('EUN1_82401', now - hour);
  const requests = await installFixtures(page, { matches: [source] });
  await page.goto(direct('&queue=420'), { waitUntil: 'domcontentloaded' });
  await complete(page);
  await expect(page.locator('[data-first-result]')).toHaveCount(0);
  const recovery = page.getByRole('button', { name: 'Show all recent games', exact: true });
  await expect(recovery).toBeVisible();
  await recovery.click();
  await expect(page).toHaveURL(url => !url.searchParams.has('queue') || url.searchParams.get('queue') === 'all');
  await complete(page);
  await firstResult(page, source, 'participation');
  expect(requests.filter(request => request.action === 'lookup')).toHaveLength(0);
  const requestedQueues = requests.filter(request => request.action === 'history').map(request => new URL(request.url).searchParams.get('queue'));
  expect(requestedQueues).toContain('420');
  expect(requestedQueues).toContain('all');
  noFirstValueDependencies(requests);
});

test('empty all-recent history offers a direct player or server correction', async ({ page }) => {
  const requests = await installFixtures(page, { matches: [] });
  await page.goto(direct(), { waitUntil: 'domcontentloaded' });
  await complete(page);
  await expect(page.locator('[data-first-result]')).toHaveCount(0);
  await expect(page.locator('[data-momentum]')).toHaveCount(0);
  const recovery = page.getByRole('button', { name: 'Change player or server', exact: true });
  await expect(recovery).toBeVisible();
  await recovery.click();
  const form = page.getByRole('form', { name: 'Get an automatic player briefing', exact: true });
  await expect(form).toBeVisible();
  await expect(form.getByLabel('Riot ID', { exact: true })).toBeEnabled();
  await expect(form.getByLabel('Server', { exact: true })).toBeEnabled();
  expect(requests.filter(request => request.action === 'lookup')).toHaveLength(0);
  expect(await savedMomentum(page)).toBeNull();
  noFirstValueDependencies(requests);
});

test('a partial first import keeps available facts useful without claiming a complete sample or saved target', async ({ page }) => {
  const source = game('EUN1_82501', now - hour);
  const missing = game('EUN1_82502', now - 2 * hour, 'Ashe');
  const requests = await installFixtures(page, { matches: [source, missing], matchFailures: [missing.metadata.matchId] });
  await page.goto(direct(), { waitUntil: 'domcontentloaded' });
  await complete(page);
  const result = await firstResult(page, source, 'participation');
  await expect(result.locator('[data-first-result-metric]')).toContainText('40%');
  await expect(page.locator('.automatic-sample')).toContainText('1 of 2 recent games imported.');
  await expect(page.locator('.automatic-sample')).toContainText(/partial sample|unavailable/i);
  await expect(page.locator('[data-momentum-state="tracking"]')).toHaveCount(0);
  expect(await savedMomentum(page)).toBeNull();
  noFirstValueDependencies(requests);
});

test('first-result evidence is keyboard reachable at 320px and 200% zoom with desktop and phone captures', async ({ page }) => {
  const source = game('EUN1_82601', now - hour);
  const requests = await installFixtures(page, { matches: [source] });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(direct(), { waitUntil: 'domcontentloaded' });
  await complete(page);
  const result = await firstResult(page, source, 'participation');
  await page.evaluate(() => document.fonts.ready);
  await mkdir('player-visuals', { recursive: true });
  await page.screenshot({ path: 'player-visuals/first-result-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'player-visuals/first-result-mobile.png', fullPage: true });

  const sourceLink = result.getByRole('link', { name: 'Open this game', exact: true });
  for (const viewport of [{ width: 320, height: 844, zoom: 1 }, { width: 640, height: 1000, zoom: 2 }]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.evaluate(zoom => { document.documentElement.style.zoom = String(zoom); }, viewport.zoom);
    await expect(result).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    // Resizing preserves the link's focus, which would skip Tab navigation on
    // the second pass. Start from its preceding section in each layout instead.
    await page.locator('#focus').focus();
    await expect(page.locator('#focus')).toBeFocused();
    await expect(sourceLink).not.toBeFocused();
    await keyboardReach(page, sourceLink);
  }
  noFirstValueDependencies(requests);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(url => url.pathname === `/matches/${source.metadata.matchId}` &&
    url.searchParams.get('platform') === platform && url.searchParams.get('puuid') === puuid);
});
