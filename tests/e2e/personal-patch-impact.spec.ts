import { test, expect, type Locator, type Page } from '@playwright/test';
import type { Match } from '../../src/lib/player/contracts';
import type { PatchImpactReport } from '../../src/lib/player/patch-impact';
import { installFixtures, makeMatch, platform, puuid, type FixtureRequest } from '../player-e2e/fixtures';

// These are browser-only response fixtures. Engine reference calculations have
// separate unit tests; these figures are not claims about live champion balance.
const first = makeMatch('EUN1_88101', Date.parse('2026-10-19T18:00:00Z'), 6621);
first.info.gameVersion = '16.20.1';
first.info.participants[0]!.championName = 'Azir';
const second = makeMatch('EUN1_88102', first.info.gameCreation - 3_600_000, 1001);
second.info.gameVersion = '16.19.1';
second.info.participants[0]!.championName = 'Ahri';
const direct = `/next-game?platform=${platform}&puuid=${puuid}`;
const patchSource = 'https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-21-notes/';

function impactFor(match: Match, overrides: Partial<PatchImpactReport> = {}): PatchImpactReport {
  const champion = match.info.participants[0]!.championName;
  return {
    status: 'ready', champion, sourceMatchId: match.metadata.matchId,
    sourcePatch: '26.20', targetPatch: '26.21', sourceVersion: match.info.gameVersion, targetVersion: '16.21.1',
    inventory: [{ id: 6621, name: 'Dawncore', quantity: 1 }],
    metrics: [
      {
        id: 'fixture-damage', kind: 'damage', label: `${champion} fixture spell damage`, unit: 'damage',
        before: 280, after: 300, delta: 20, percent: 100 / 14,
        summary: '20 more raw damage in this supported comparison.',
        formula: 'Base damage + 0.5 × 200 ability power',
        assumptions: ['A fixed 200 ability power; damage before target defenses.'],
        sources: [{ label: 'Riot patch notes', url: patchSource }],
        ranks: [{ rank: 1, before: 180, after: 200 }, { rank: 2, before: 230, after: 250 }, { rank: 3, before: 280, after: 300 }],
      },
      {
        id: 'fixture-cooldown', kind: 'cooldown', label: 'Fixture ability cooldown', unit: 'seconds',
        before: 10, after: 9, delta: -1, percent: -10,
        summary: '1 second shorter under the displayed assumptions.', formula: 'Base cooldown ÷ (1 + 20 / 100)',
        assumptions: ['20 item ability haste; excludes rune and temporary haste.'],
        sources: [{ label: 'Riot patch notes', url: patchSource }],
      },
      {
        id: 'fixture-cost', kind: 'cost', label: 'Recorded inventory purchase price', unit: 'gold',
        before: 6000, after: 5900, delta: -100, percent: -100 / 60,
        summary: '100 less gold for the same supported inventory.', formula: 'Sum of each supported item price × recorded quantity',
        assumptions: ['Inventory price; not the amount spent during the match.'],
        sources: [{ label: 'Riot patch notes', url: patchSource }],
      },
    ],
    uncomputedChanges: 0,
    assumptions: ['Reuses the recorded final inventory; this is not a replay of the fight.'],
    sources: [{ label: 'Riot patch notes', url: patchSource }],
    notice: 'Isolated browser fixture with explicit calculation assumptions.',
    ...overrides,
  };
}

type ImpactReply = { status?: number; report?: PatchImpactReport; error?: string };
async function fixtures(page: Page, matches: Match[] = [first], respond?: (request: FixtureRequest) => ImpactReply | Promise<ImpactReply>) {
  const requests = await installFixtures(page, { matches });
  // Registered last, so this route intercepts impact while the shared fixture
  // handler continues to own the normal match/account/history endpoints.
  await page.route('**/api/player/impact?*', async route => {
    const request = { action: 'impact', url: route.request().url(), method: route.request().method() };
    requests.push(request);
    const match = matches.find(record => record.metadata.matchId === new URL(request.url).searchParams.get('id'));
    const reply = respond ? await respond(request) : { report: match ? impactFor(match) : undefined, status: match ? 200 : 404 };
    await route.fulfill({ status: reply.status ?? 200, json: reply.report ?? { error: reply.error ?? 'Fixture impact unavailable.' } });
  });
  return requests;
}

async function open(page: Page, path = direct) {
  await page.goto(path);
  await expect(page.locator('[data-briefing-report]')).toHaveAttribute('aria-busy', 'false');
  const impact = page.locator('#impact[data-patch-impact]');
  await expect(impact).toBeVisible();
  return impact;
}

function metric(impact: Locator, id: string) { return impact.locator(`[data-impact-metric="${id}"]`); }
async function settled(impact: Locator) { await expect(metric(impact, 'fixture-damage')).toBeVisible(); }
function impactRequests(requests: FixtureRequest[]) { return requests.filter(request => request.action === 'impact'); }

test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }); });

test('the personal patch result loads automatically with exact values, source links and inspectable assumptions', async ({ page }) => {
  const requests = await fixtures(page);
  const impact = await open(page);
  await settled(impact);
  await expect(metric(impact, 'fixture-damage').locator('[data-impact-before]')).toContainText('280');
  await expect(metric(impact, 'fixture-damage').locator('[data-impact-after]')).toContainText('300');
  await expect(metric(impact, 'fixture-cooldown').locator('[data-impact-before]')).toContainText('10');
  await expect(metric(impact, 'fixture-cooldown').locator('[data-impact-after]')).toContainText('9');
  await expect(metric(impact, 'fixture-cost').locator('[data-impact-before]')).toContainText(/6[,.\s]?000/);
  await expect(metric(impact, 'fixture-cost').locator('[data-impact-after]')).toContainText(/5[,.\s]?900/);

  const evidence = metric(impact, 'fixture-damage').locator('details');
  await evidence.locator('summary').click();
  await expect(evidence).toContainText('Base damage + 0.5 × 200 ability power');
  await expect(evidence).toContainText('damage before target defenses');
  await expect(evidence.locator(`a[href="${patchSource}"]`)).toBeVisible();
  const source = impact.locator(`a[href^="/matches/${first.metadata.matchId}"]`).first();
  await expect(source).toHaveAttribute('href', new RegExp(`puuid=${puuid}`));
  await expect(impact).toContainText('26.20');
  await expect(impact).toContainText('26.21');
  expect(impactRequests(requests)).toHaveLength(1);
  expect(new URL(impactRequests(requests)[0]!.url).searchParams.get('id')).toBe(first.metadata.matchId);
  expect(requests.filter(request => ['review', 'timeline', 'lookup'].includes(request.action))).toEqual([]);
  await expect(impact.locator('input, textarea')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('riftscry:companion:v1'))).toBeNull();
});

test('champion context selection is keyboard operable and a failed new context never shows the previous calculation', async ({ page }) => {
  let failed = true;
  const requests = await fixtures(page, [first, second], request => {
    const isSecond = new URL(request.url).searchParams.get('id') === second.metadata.matchId;
    return isSecond && failed ? { status: 503, error: 'Fixture calculation temporarily unavailable.' }
      : { report: impactFor(isSecond ? second : first, isSecond ? { metrics: [{ ...impactFor(second).metrics[0]!, before: 444, after: 555 }] } : {}) };
  });
  const impact = await open(page);
  await settled(impact);
  const firstChoice = impact.getByRole('button', { name: /Azir/ });
  const secondChoice = impact.getByRole('button', { name: /Ahri/ });
  await expect(firstChoice).toHaveAttribute('aria-pressed', 'true');
  await secondChoice.focus();
  await page.keyboard.press('Enter');
  await expect(secondChoice).toHaveAttribute('aria-pressed', 'true');
  await expect(firstChoice).toHaveAttribute('aria-pressed', 'false');
  await expect(impact.getByRole('alert')).toContainText('Fixture calculation temporarily unavailable.');
  await expect(metric(impact, 'fixture-damage')).toHaveCount(0);
  await expect(impact.locator(`a[href^="/matches/${first.metadata.matchId}"]`)).toHaveCount(0);
  failed = false;
  await impact.getByRole('button', { name: /retry/i }).click();
  await settled(impact);
  await expect(metric(impact, 'fixture-damage').locator('[data-impact-before]')).toContainText('444');
  await expect(metric(impact, 'fixture-damage').locator('[data-impact-after]')).toContainText('555');
  await expect(impact.locator(`a[href^="/matches/${second.metadata.matchId}"]`).first()).toBeVisible();
  expect(impactRequests(requests).map(request => new URL(request.url).searchParams.get('id')))
    .toEqual([first.metadata.matchId, second.metadata.matchId, second.metadata.matchId]);
});

test('a delayed response from a previous selection cannot replace the selected champion result', async ({ page }) => {
  let release = () => {};
  const held = new Promise<void>(resolve => { release = resolve; });
  const requests = await fixtures(page, [first, second], async request => {
    const isFirst = new URL(request.url).searchParams.get('id') === first.metadata.matchId;
    if (isFirst) await held;
    return { report: impactFor(isFirst ? first : second, isFirst ? {} : { metrics: [{ ...impactFor(second).metrics[0]!, before: 444, after: 555 }] }) };
  });
  try {
    const impact = await open(page);
    await expect.poll(() => impactRequests(requests).length).toBe(1);
    await impact.getByRole('button', { name: /Ahri/ }).click();
    await expect(metric(impact, 'fixture-damage').locator('[data-impact-after]')).toContainText('555');
    const oldResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/player/impact'
      && new URL(response.url()).searchParams.get('id') === first.metadata.matchId);
    release();
    await oldResponse;
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(impact.getByRole('button', { name: /Ahri/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(metric(impact, 'fixture-damage').locator('[data-impact-after]')).toContainText('555');
    await expect(impact.locator(`a[href^="/matches/${first.metadata.matchId}"]`)).toHaveCount(0);
  } finally { release(); }
});

test('a calculation from a different source game is rejected rather than labelled as this player context', async ({ page }) => {
  await fixtures(page, [first], () => ({ report: impactFor(second) }));
  const impact = await open(page);
  await expect(impact.getByRole('alert')).toContainText('This calculation could not be matched to the selected game.');
  await expect(impact.locator('[data-impact-metric]')).toHaveCount(0);
  await expect(impact.locator(`a[href^="/matches/${second.metadata.matchId}"]`)).toHaveCount(0);
});

for (const status of ['current', 'unchanged', 'unknown', 'unsupported'] as const) {
  test(`${status} coverage is explained without a fabricated zero-impact result`, async ({ page }) => {
    const notice = `Fixture ${status}: a numeric comparison is not available for this context.`;
    await fixtures(page, [first], () => ({ report: impactFor(first, { status, metrics: [], notice,
      ...(status === 'unknown' ? { sourcePatch: null, sourceVersion: null } : {}),
    }) }));
    const impact = await open(page);
    await expect(impact).toContainText(notice);
    await expect(impact.locator('[data-impact-metric]')).toHaveCount(0);
    await expect(impact).not.toContainText(/NaN|Infinity|0% stronger|zero impact/i);
    await expect(impact.locator(`a[href^="/matches/${first.metadata.matchId}"]`).first()).toBeVisible();
  });
}

test('partial calculations keep supported figures and disclose excluded changes', async ({ page }) => {
  await fixtures(page, [first], () => ({ report: impactFor(first, {
    status: 'partial', uncomputedChanges: 2,
    notice: 'Two changes need mechanics that are not yet supported; these figures are partial.',
    metrics: [impactFor(first).metrics[2]!],
  }) }));
  const impact = await open(page);
  await expect(metric(impact, 'fixture-cost')).toBeVisible();
  await expect(impact.locator('[data-impact-metric]')).toHaveCount(1);
  await expect(impact).toContainText('these figures are partial');
  await expect(impact).toContainText(/2.*(?:change|record)|(?:change|record).*2/i);
});

test('an unavailable item reference can be retried without reimporting the source games', async ({ page }) => {
  let attempts = 0;
  const requests = await fixtures(page, [first], () => {
    attempts++;
    return { report: attempts === 1 ? impactFor(first, {
      status: 'partial', retryable: true, metrics: [impactFor(first).metrics[0]!],
      notice: 'A source item reference is temporarily unavailable; only the supported component is shown.',
    }) : impactFor(first) };
  });
  const impact = await open(page);
  await settled(impact);
  await expect(impact.locator('[data-impact-status]')).toHaveAttribute('data-impact-status', 'partial');
  await expect(metric(impact, 'fixture-cost')).toHaveCount(0);
  const sourceRequests = requests.filter(request => ['match', 'history'].includes(request.action)).length;
  await impact.getByRole('button', { name: 'Retry patch impact', exact: true }).click();
  await expect(impact.locator('[data-impact-status]')).toHaveAttribute('data-impact-status', 'ready');
  await expect(metric(impact, 'fixture-cost').locator('[data-impact-after]')).toContainText(/5[,.\s]?900/);
  await expect(impact.getByRole('button', { name: 'Retry patch impact', exact: true })).toHaveCount(0);
  await expect(impact).not.toContainText('temporarily unavailable');
  expect(impactRequests(requests)).toHaveLength(2);
  expect(requests.filter(request => ['match', 'history'].includes(request.action))).toHaveLength(sourceRequests);
  expect(requests.filter(request => ['review', 'timeline'].includes(request.action))).toEqual([]);
});

test('changing exact game mode clears the old result when there are no imported games', async ({ page }) => {
  const requests = await fixtures(page);
  const impact = await open(page);
  await settled(impact);
  await page.getByLabel('Game mode', { exact: true }).selectOption('2400');
  await expect(page.locator('[data-briefing-report]')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByRole('heading', { name: 'Mayhem history is not available from Riot.', exact: true })).toBeVisible();
  await expect(page.locator('[data-patch-impact]')).toHaveCount(0);
  expect(requests.some(request => request.action === 'history' && new URL(request.url).searchParams.get('queue') === '2400')).toBe(true);
  expect(impactRequests(requests)).toHaveLength(1);
});

test('the calculation fits 320px, keeps controls usable and remains static with reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await fixtures(page, [first, second]);
  const impact = await open(page);
  await settled(impact);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  for (const choice of await impact.locator('button[aria-pressed]').all()) {
    await choice.scrollIntoViewIfNeeded();
    const bounds = await choice.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    expect(bounds!.width).toBeGreaterThanOrEqual(44);
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  }
  for (const value of await impact.locator('[data-impact-before], [data-impact-after]').all()) {
    const bounds = await value.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  }
  expect(await impact.evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length)).toBe(0);
  expect(errors).toEqual([]);
});

test('the saved reduced-motion preference also disables impact animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => localStorage.setItem('riftscry:motion', 'reduced'));
  await fixtures(page);
  const impact = await open(page);
  await settled(impact);
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  expect(await impact.evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length)).toBe(0);
});

for (const [width, height] of [[320, 568], [1440, 900]] as const) {
  test(`the homepage example exposes real calculated sources without a player request at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const requests: string[] = [];
    await page.route('**/api/player/**', async route => {
      requests.push(route.request().url());
      await route.fulfill({ status: 503, json: { error: 'The reference example must not import player data.' } });
    });
    await page.goto('/');
    const example = page.locator('[data-home-impact]');
    await expect(example).toBeVisible();
    await expect(example).toContainText('REFERENCE EXAMPLE');
    await expect(example).toContainText('This is a reference scenario, not a player match.');
    await expect(example.locator('[data-home-impact-delta]')).toHaveText('+6.75');
    const q = example.locator('[data-home-impact-metric="champion-ap-Orianna:Q:damage"]');
    await expect(q.locator('[data-home-impact-before]')).toContainText('74.25');
    await expect(q.locator('[data-home-impact-after]')).toHaveText(/Patch 26\.21:\s*81$/);
    const cta = example.getByRole('link', { name: 'See my patch impact', exact: true });
    await expect(cta).toHaveAttribute('href', '/next-game#impact');
    await cta.scrollIntoViewIfNeeded();
    const bounds = await cta.boundingBox();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    const details = example.locator('.home-impact-example-method');
    await details.locator('summary').click();
    await expect(details).toContainText('135 item AP × 55% = 74.25 → 135 item AP × 60% = 81');
    await expect(details.locator(`a[href="${patchSource}"]`)).toBeVisible();
    for (const version of ['16.20.1', '16.21.1']) {
      await expect(details.locator(`a[href="https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/item.json"]`)).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    expect(requests).toEqual([]);
    await cta.click();
    await expect(page).toHaveURL(url => url.pathname === '/next-game' && url.hash === '#impact');
    await expect(page.getByRole('form', { name: 'Get an automatic player briefing' })).toBeVisible();
    expect(requests).toEqual([]);
  });
}
