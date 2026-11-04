import { test, expect, type Page } from '@playwright/test';
import type { Match, Participant } from '../../src/lib/player/contracts';
import { openBriefingSettings } from './briefing-controls';
import { installFixtures, makeMatch, platform, puuid, query, type FixtureRequest } from './fixtures';

const now = Date.parse('2026-11-03T08:00:00Z');
const hour = 60 * 60 * 1000;
const storageKey = `riftscry:momentum:v1:${platform}:${puuid}`;
const direct = (queue = 420, champion = 'Ahri') => `/next-game?${query}&queue=${queue}&champion=${champion}`;
const readSaved = (page: Page) => page.evaluate(key => localStorage.getItem(key), storageKey);

/** Full synthetic teams make participation a real measured fraction, not a guessed denominator. */
function game(id: string, startedAt: number, options: {
  champion?: string; role?: string; queue?: number; cs?: number; vision?: number;
  assists?: number; win?: boolean; patch?: string;
} = {}): Match {
  const match = makeMatch(id, startedAt);
  const queue = options.queue ?? 420;
  const aram = queue === 450;
  const self: Participant = {
    ...match.info.participants[0]!, teamId: 100,
    championName: options.champion ?? 'Ahri', teamPosition: aram ? '' : options.role ?? 'MIDDLE',
    totalMinionsKilled: options.cs ?? 120, neutralMinionsKilled: 0,
    visionScore: options.vision ?? 20, kills: 5, assists: options.assists ?? 15,
    win: options.win ?? true,
  };
  const roles = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'];
  const roleChampion: Record<string, string> = { TOP: 'Garen', JUNGLE: 'LeeSin', MIDDLE: 'Lux', BOTTOM: 'Jinx', UTILITY: 'Lulu' };
  const otherRoles = aram ? ['TOP', 'JUNGLE', 'BOTTOM', 'UTILITY'] : roles.filter(role => role !== self.teamPosition);
  const allies = otherRoles.map((role, index): Participant => ({
    ...self, puuid: `momentum-ally-${index}-000000000000000000000000000000000`,
    participantId: index + 2, championName: roleChampion[role]!,
    teamPosition: aram ? '' : role,
    // Together with the player's five kills, the team's recorded total is 50.
    kills: index === 3 ? 15 : 10,
  }));
  const enemies = ['Malphite', 'MasterYi', 'Brand', 'Ashe', 'Morgana'].map((championName, index): Participant => ({
    ...self, puuid: `momentum-enemy-${index}-00000000000000000000000000000000`,
    participantId: index + 6, teamId: 200, championName, kills: 2, deaths: 10, assists: 3,
    teamPosition: aram ? '' : roles[index]!,
    win: !self.win,
  }));
  match.info = { ...match.info, queueId: queue, gameMode: aram ? 'ARAM' : 'CLASSIC',
    mapId: aram ? 12 : 11, gameVersion: options.patch ?? '16.21.1',
    participants: [self, ...allies, ...enemies],
  };
  return match;
}

function baseline(options: Parameters<typeof game>[2] = {}): Match[] {
  return [1, 2, 3].map(index => game(`EUN1_${81000 + index}`, now - (5 - index) * hour, options));
}

async function ready(page: Page) {
  await expect(page.locator('[data-briefing-report]')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('[data-momentum]')).toBeVisible();
  return page.locator('[data-momentum]');
}

async function refresh(page: Page) {
  const settings = await openBriefingSettings(page);
  const history = page.waitForResponse(response => new URL(response.url()).pathname === '/api/player/history');
  await settings.getByRole('button', { name: 'Refresh', exact: true }).click();
  await history;
  await ready(page);
}

async function automaticRefresh(page: Page) {
  // Exercise the real visible-page interval; the player does not press Refresh.
  expect(await page.evaluate(() => document.visibilityState)).toBe('visible');
  const history = page.waitForResponse(response => new URL(response.url()).pathname === '/api/player/history');
  await page.clock.fastForward(120_001);
  await history;
  await ready(page);
}

function noExpensiveReviewRequests(requests: FixtureRequest[]) {
  expect(requests.filter(request => ['review', 'timeline'].includes(request.action))).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(now) });
});

test('sets a target automatically, counts only later games, and keeps a completed receipt across reloads', async ({ page }) => {
  const records = baseline();
  // Older off-context records must not become starting evidence for this focus.
  records.push(game('EUN1_81010', now - 6 * hour, { role: 'TOP', cs: 500 }));
  records.push(game('EUN1_81011', now - 7 * hour, { patch: '16.20.1', cs: 500 }));
  records.push(game('EUN1_81012', now - 8 * hour, { champion: 'Lux', cs: 500 }));
  records.push(game('EUN1_81013', now - 9 * hour, { queue: 440, cs: 500 }));
  const requests = await installFixtures(page, { matches: records });
  await page.goto(direct(), { waitUntil: 'domcontentloaded' });
  const momentum = await ready(page);
  await expect(momentum).toHaveAttribute('data-momentum-state', 'tracking');
  await expect(momentum.getByRole('heading', { name: 'Keep your farm moving.', exact: true })).toBeVisible();
  await expect(momentum.locator('.momentum-baseline')).toContainText('Median of 3 earlier games');
  await expect(momentum.locator('[data-momentum-check="waiting"]')).toHaveCount(3);
  await expect(momentum.locator('[data-momentum-check="met"], [data-momentum-check="recorded"]')).toHaveCount(0);
  await expect(momentum.locator('.momentum-feedback')).toContainText(/Only games started after .+ will count\./);
  await expect(momentum.locator('textarea, input[type="checkbox"]')).toHaveCount(0);
  const fixedTarget = await momentum.locator('.momentum-target strong').innerText();
  const fixedBaseline = await momentum.locator('.momentum-baseline strong').innerText();
  const initial = JSON.parse((await readSaved(page))!);
  expect(initial.cycles).toHaveLength(1);
  expect(new Set(initial.cycles[0].baselineMatchIds)).toEqual(new Set(baseline().map(match => match.metadata.matchId)));

  // A later loss can still meet the personal target and contain a sample high.
  const first = game('EUN1_81101', now + hour, { cs: 160, win: false });
  records.push(first);
  await page.clock.setSystemTime(new Date(now + 2 * hour));
  await automaticRefresh(page);
  await expect(momentum.locator('[data-momentum-check="met"]')).toHaveCount(1);
  await expect(momentum.locator('[data-momentum-check="waiting"]')).toHaveCount(2);
  await expect(momentum.locator('.momentum-steps a')).toHaveAttribute('href', `/matches/${first.metadata.matchId}?${query}`);
  await expect(momentum.locator('[data-momentum-highlight]')).toContainText('PROGRESS, EVEN IN A LOSS');
  await expect(momentum.locator('.momentum-target strong')).toHaveText(fixedTarget);
  await expect(momentum.locator('.momentum-baseline strong')).toHaveText(fixedBaseline);
  const afterFirst = await readSaved(page);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await ready(page);
  await expect(momentum.locator('[data-momentum-check="met"]')).toHaveCount(1);
  await expect(momentum.locator('[data-momentum-check="waiting"]')).toHaveCount(2);
  expect(await readSaved(page)).toBe(afterFirst);

  records.push(game('EUN1_81102', now + 3 * hour, { cs: 100 }));
  records.push(game('EUN1_81103', now + 4 * hour, { cs: 180 }));
  await page.clock.setSystemTime(new Date(now + 5 * hour));
  await refresh(page);
  const receipt = momentum.locator('[data-momentum-receipt]');
  await expect(receipt).toBeVisible();
  await receipt.locator('summary').click();
  await expect(receipt).toContainText('2/3 targets met');
  await expect(receipt.locator('li')).toHaveCount(3);
  await expect(receipt.locator('li a')).toHaveText([
    'Game 1: 8/min · Target met', 'Game 2: 5/min · Recorded', 'Game 3: 9/min · Target met',
  ]);
  const completed = JSON.parse((await readSaved(page))!).cycles.find((cycle: { status: string }) => cycle.status === 'complete');
  expect(completed.baselineMatchIds).toEqual(initial.cycles[0].baselineMatchIds);
  expect(completed.target).toBe(initial.cycles[0].target);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await ready(page);
  await expect(momentum.locator('[data-momentum-receipt]')).toContainText('2/3 targets met');
  noExpensiveReviewRequests(requests);
});

test('gives a support player a vision focus without a farming target', async ({ page }) => {
  const requests = await installFixtures(page, { matches: baseline({ champion: 'Lulu', role: 'UTILITY', cs: 400, vision: 40 }) });
  await page.goto(direct(420, 'Lulu'), { waitUntil: 'domcontentloaded' });
  const momentum = await ready(page);
  await expect(momentum).toHaveAttribute('data-momentum-state', 'tracking');
  await expect(momentum.getByRole('heading', { name: 'Make room for useful vision.', exact: true })).toBeVisible();
  await expect(momentum.locator('.momentum-target')).toContainText('Vision score per minute');
  await expect(momentum.locator('.momentum-target')).not.toContainText('CS per minute');
  await expect(momentum).not.toContainText('safe minion or jungle income');
  await momentum.locator('[data-progress-explanation] summary').click();
  await expect(momentum.locator('[data-progress-explanation]')).toContainText('CS targets are not used.');
  await expect(momentum.locator('[data-momentum-check="waiting"]')).toHaveCount(3);
  noExpensiveReviewRequests(requests);
});

test('uses actual five-player team kills for an ARAM participation focus', async ({ page }) => {
  const records = baseline({ queue: 450, cs: 400, vision: 40 });
  const requests = await installFixtures(page, { matches: records });
  await page.goto(direct(450), { waitUntil: 'domcontentloaded' });
  const momentum = await ready(page);
  await expect(momentum).toHaveAttribute('data-momentum-state', 'tracking');
  await expect(momentum.getByRole('heading', { name: 'Stay connected to your team.', exact: true })).toBeVisible();
  await expect(momentum.locator('.momentum-target')).toContainText('Kill participation');
  await expect(momentum.locator('.momentum-baseline')).toContainText('40%');
  await expect(momentum.locator('.momentum-context')).toContainText('ARAM');
  await momentum.locator('[data-progress-explanation] summary').click();
  await expect(momentum.locator('[data-progress-explanation]')).toContainText('For ARAM, only kill participation is used.');
  await expect(momentum).not.toContainText('CS per minute');
  await expect(momentum).not.toContainText('Vision score per minute');

  records.push(game('EUN1_81201', now + hour, { queue: 450, assists: 25 }));
  await page.clock.setSystemTime(new Date(now + 2 * hour));
  await refresh(page);
  await expect(momentum.locator('[data-momentum-check="met"]')).toHaveCount(1);
  await expect(momentum.locator('.momentum-steps a')).toHaveText('60%');
  noExpensiveReviewRequests(requests);
});

test('preserves corrupt progress untouched and still offers read-only match observations', async ({ page }) => {
  const corrupt = '{"version":1,"cycles":"unreadable saved player work"';
  await page.addInitScript(({ key, value }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
  }, { key: storageKey, value: corrupt });
  const requests = await installFixtures(page, { matches: baseline() });
  await page.goto(direct(), { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-briefing-report]')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('[data-first-result]')).toBeVisible();
  await expect(page.locator('.automatic-storage-note')).toContainText('It has been kept untouched');
  await expect(page.locator('[data-first-result-metric]')).toContainText('CS per minute');
  await expect(page.locator('.momentum-target-row')).toHaveCount(0);
  expect(await readSaved(page)).toBe(corrupt);
  const settings = await openBriefingSettings(page);
  const updated = page.waitForResponse(response => new URL(response.url()).pathname === '/api/player/history');
  await settings.getByRole('button', { name: 'Refresh', exact: true }).click();
  await updated;
  await expect(page.locator('[data-briefing-report]')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('[data-first-result]')).toBeVisible();
  expect(await readSaved(page)).toBe(corrupt);
  noExpensiveReviewRequests(requests);
});

test('freezes saved progress during a partial import and resumes after missing records recover', async ({ page }) => {
  const records = baseline();
  const missingId = 'EUN1_81302';
  let missing = false;
  const requests = await installFixtures(page, { matches: records, response: request => {
    if (missing && request.action === 'match' && new URL(request.url).searchParams.get('id') === missingId) {
      return { status: 503, json: { error: 'Fixture match summary is temporarily unavailable.' } };
    }
    return undefined;
  } });
  await page.goto(direct(), { waitUntil: 'domcontentloaded' });
  const momentum = await ready(page);
  await expect(momentum).toHaveAttribute('data-momentum-state', 'tracking');
  const saved = await readSaved(page);

  records.push(game('EUN1_81301', now + hour, { cs: 160 }));
  records.push(game(missingId, now + 2 * hour, { cs: 180 }));
  missing = true;
  await page.clock.setSystemTime(new Date(now + 3 * hour));
  await refresh(page);
  await expect(page.locator('.automatic-sample')).toContainText('4 of 5 recent games imported.');
  await expect(momentum).toHaveAttribute('data-momentum-state', 'waiting');
  await expect(momentum).toContainText('Waiting for a complete import');
  await expect(momentum.locator('[data-momentum-check="waiting"]')).toHaveCount(3);
  expect(await readSaved(page)).toBe(saved);

  missing = false;
  await refresh(page);
  await expect(page.locator('.automatic-sample')).toContainText('5 of 5 recent games imported.');
  await expect(momentum).toHaveAttribute('data-momentum-state', 'tracking');
  await expect(momentum.locator('[data-momentum-check="met"]')).toHaveCount(2);
  await expect(momentum.locator('[data-momentum-check="waiting"]')).toHaveCount(1);
  noExpensiveReviewRequests(requests);
});
