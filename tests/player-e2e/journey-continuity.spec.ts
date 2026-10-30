import { expect, test, type Page } from '@playwright/test';
import { COMPANION_KEY } from '../../src/lib/companion';
import { RECENT_PLAYER_KEY } from '../../src/lib/player/identity';
import { RESUME_KEY } from '../../src/lib/return-briefing';
import { installFixtures, mayhemMatch, otherPuuid, platform, profilePath, puuid, query, recentAramWin, sourceMatch } from './fixtures';
import { openFilters, openScene, selectQueue } from './profile-controls';

const station = (page: Page, id: string) => page.getByRole('navigation', { name: 'Journey destinations', exact: true }).locator(`[data-station-link="${id}"]`);

async function stationScope(page: Page, queue: string, champion: string) {
  for (const id of ['next-game', 'players']) {
    await expect.poll(async () => {
      const url = new URL(await station(page, id).getAttribute('href') ?? '', page.url());
      return {
        path: url.pathname,
        identity: id === 'next-game' ? `${url.searchParams.get('platform')}:${url.searchParams.get('puuid')}` : url.pathname,
        queue: url.searchParams.get('queue'), champion: url.searchParams.get('champion') ?? '',
      };
    }).toEqual({
      path: id === 'next-game' ? '/next-game' : profilePath,
      identity: id === 'next-game' ? `${platform}:${puuid}` : profilePath,
      queue, champion,
    });
  }
}

test('shared stations carry committed player scope and a source match returns to its exact briefing scene', async ({ page }) => {
  const requests = await installFixtures(page, { matches: [recentAramWin, mayhemMatch] });
  const reading = { href: '/champion/ahri?mode=reader#record-26-14', label: 'Ahri', updatedAt: '2026-10-30T12:00:00.000Z' };
  await page.addInitScript(({ key, value, resumeKey, reading }) => {
    localStorage.setItem(key, JSON.stringify(value));
    if (localStorage.getItem(resumeKey) === null) localStorage.setItem(resumeKey, JSON.stringify(reading));
  }, {
    key: RECENT_PLAYER_KEY, value: { platform, puuid: otherPuuid, name: 'Other Fixture Player#TEST' },
    resumeKey: RESUME_KEY, reading,
  });
  await page.goto(`${profilePath}?view=history`);
  await expect(page.getByRole('region', { name: 'Recent match sample', exact: true })).toHaveAttribute('aria-busy', 'false');
  await openFilters(page);
  await page.getByLabel('Champion', { exact: true }).selectOption('Ahri');
  await selectQueue(page, '450');
  await stationScope(page, '450', 'Ahri');
  await station(page, 'next-game').click();
  await expect(page.locator('[data-briefing-report]')).toHaveAttribute('aria-busy', 'false');
  await openScene(page, 'loadout');
  await page.getByRole('link', { name: 'Inspect the match', exact: true }).click();
  await expect(page).toHaveURL(url => url.pathname === `/matches/${recentAramWin.metadata.matchId}`);
  await stationScope(page, '450', 'Ahri');
  const back = page.getByRole('link', { name: '← Back to briefing and filters', exact: true });
  const destination = new URL(await back.getAttribute('href') ?? '', page.url());
  expect(destination.pathname).toBe('/next-game');
  expect(destination.hash).toBe('#loadout');
  expect(destination.searchParams.get('puuid')).toBe(puuid);
  expect(destination.searchParams.get('queue')).toBe('450');
  expect(destination.searchParams.get('champion')).toBe('Ahri');
  await back.click();
  await expect(page.locator('#loadout')).toBeVisible();
  await expect(page).toHaveURL(url => url.hash === '#loadout' && url.searchParams.get('queue') === '450' && url.searchParams.get('champion') === 'Ahri');

  await page.getByRole('button', { name: /clear champion focus/ }).click();
  await page.getByLabel('Game mode', { exact: true }).selectOption('2400');
  await stationScope(page, '2400', '');
  await expect(page.locator('[data-briefing-report]')).toHaveAttribute('aria-busy', 'false');
  expect(requests.filter(request => ['lookup', 'review', 'timeline'].includes(request.action))).toEqual([]);
  expect(requests.filter(request => ['account', 'history', 'match'].includes(request.action))
    .every(request => new URL(request.url).searchParams.get('puuid') === puuid)).toBe(true);
  expect(await page.evaluate(key => localStorage.getItem(key), COMPANION_KEY)).toBeNull();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), RESUME_KEY)).toEqual(reading);
});

test('an opened remembered briefing keeps its explicit player when another tab changes the shortcut', async ({ page }) => {
  const requests = await installFixtures(page, { matches: [recentAramWin] });
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: RECENT_PLAYER_KEY, value: { platform, puuid, name: 'Fixture Player#TEST' },
  });
  await page.goto('/next-game?queue=450&champion=Ahri#loadout');
  await expect(page.locator('[data-briefing-report]')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#loadout')).toBeVisible();
  await expect(page).toHaveURL(url => url.searchParams.get('platform') === platform && url.searchParams.get('puuid') === puuid && url.hash === '#loadout');
  await page.evaluate(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(value) }));
  }, { key: RECENT_PLAYER_KEY, value: { platform, puuid: otherPuuid, name: 'Other Fixture Player#TEST' } });
  await stationScope(page, '450', 'Ahri');
  expect(requests.filter(request => ['lookup', 'review', 'timeline'].includes(request.action))).toEqual([]);
  expect(requests.filter(request => request.action === 'history').every(request => new URL(request.url).searchParams.get('puuid') === puuid)).toBe(true);
});

test('an observed loadout saves once and opens its original items, runes, mode and source in Notebook', async ({ page }) => {
  const requests = await installFixtures(page, { matches: [recentAramWin] });
  await page.goto(`${profilePath}?view=builds&queue=450&champion=Ahri`);
  const build = page.locator('.observed-build');
  await expect(build).toHaveCount(1);
  await expect(build.locator('.item-label[title="Boots"]')).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), COMPANION_KEY)).toBeNull();
  await build.getByRole('button', { name: 'Save loadout', exact: true }).click();
  const continuation = build.getByRole('link', { name: 'View saved loadout', exact: true });
  await expect(continuation).toHaveAttribute('href', '/notebook#loadouts');
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).builds, COMPANION_KEY);
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({
    platform, puuid, champion: 'Ahri', queue: 450, patch: '16.21', version: '16.21.1',
    source: recentAramWin.metadata.matchId, sourceDate: recentAramWin.info.gameCreation,
    items: [{ id: 1001, name: 'Boots' }], runes: [{ id: 8112, name: 'Electrocute' }],
  });
  expect(requests.filter(request => request.action === 'items')).toHaveLength(1);
  await continuation.click();
  const stored = page.locator('#loadouts [data-recall-build]');
  await expect(stored).toBeVisible();
  await expect(stored.getByRole('list', { name: 'Saved final items' })).toContainText('Boots');
  await expect(stored.locator('.recall-runes')).toContainText('Electrocute');
  const source = new URL(await stored.getByRole('link', { name: /Source match/ }).getAttribute('href') ?? '', page.url());
  expect(source.pathname).toBe(`/matches/${recentAramWin.metadata.matchId}`);
  expect(source.searchParams.get('puuid')).toBe(puuid);
  expect(source.searchParams.get('platform')).toBe(platform);
  await page.goBack();
  await expect(build.getByRole('link', { name: 'View saved loadout', exact: true })).toBeVisible();
  await expect(build.getByRole('button', { name: 'Save loadout', exact: true })).toHaveCount(0);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).builds.length, COMPANION_KEY)).toBe(1);
  expect(requests.filter(request => ['review', 'timeline'].includes(request.action))).toEqual([]);
});

test('evidence anchors preserve modified activation and commit one focused scene for keyboard activation', async ({ page }) => {
  const requests = await installFixtures(page, { matches: [sourceMatch] });
  await page.goto(`/matches/${sourceMatch.metadata.matchId}?${query}`);
  await openScene(page, 'match-review');
  const evidence = page.locator('.review-focus .review-evidence-link').first();
  await expect(evidence).toBeVisible();
  const target = await evidence.getAttribute('href');
  expect(target).toMatch(/^#fact-/);
  // Observe the event after application handlers, then cancel the browser's
  // default only in this probe so four modifier checks don't open four windows.
  const intercepted = await evidence.evaluate(anchor => ['ctrlKey', 'metaKey', 'shiftKey', 'altKey'].map(modifier => {
    let intercepted: boolean | null = null;
    window.addEventListener('click', event => { intercepted = event.defaultPrevented; event.preventDefault(); }, { once: true });
    anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, [modifier]: true }));
    return intercepted;
  }));
  expect(intercepted).toEqual([false, false, false, false]);
  await expect(page).toHaveURL(url => url.hash === '#match-review');
  const before = await page.evaluate(() => {
    const state = window as Window & { evidenceCommits?: string[] };
    state.evidenceCommits = [];
    window.addEventListener('riftscry:journey-change', event => {
      const target = (event as CustomEvent<{ target?: string }>).detail?.target;
      if (target?.startsWith('fact-')) state.evidenceCommits!.push(target);
    });
    return history.length;
  });
  await evidence.focus();
  await evidence.press('Enter');
  await expect(page.locator(target!)).toBeVisible();
  await expect(page.locator(target!)).toBeFocused();
  await expect(page.locator('.supporting-evidence')).toHaveJSProperty('open', true);
  expect(await page.evaluate(() => history.length)).toBe(before + 1);
  expect(await page.evaluate(() => (window as Window & { evidenceCommits?: string[] }).evidenceCommits)).toEqual([target!.slice(1)]);
  await page.goBack();
  await expect(page.locator('#match-review')).toBeVisible();
  await page.goForward();
  await expect(page.locator(target!)).toBeFocused();
  expect(requests.filter(request => ['review', 'timeline'].includes(request.action))).toEqual([]);
});
