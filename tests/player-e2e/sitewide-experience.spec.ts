import { test, expect, type Locator, type Page } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { installFixtures, profilePath, query, recentAramWin, visualMatches } from './fixtures';

// Run against the development runtime: player and match documents are SSR.
// Player responses below are isolated browser fixtures, never live accounts.
// data.ts uses Vite's import.meta.glob, so the Node test runner reads the same
// archive files directly to keep moving "latest" destinations date-independent.
const patchDirectory = new URL('../../src/data/patches/', import.meta.url);
const patchIds = readdirSync(patchDirectory).filter(file => file.endsWith('.json'))
  .map(file => (JSON.parse(readFileSync(new URL(file, patchDirectory), 'utf8')) as { id: string }).id)
  .sort((a, b) => b.localeCompare(a, 'en', { numeric: true }));
const latestPatchId = patchIds[0]!;
const previousPatchId = patchIds[1]!;
const routes = [
  { path: '/', surface: 'home', action: '#atlas .atlas-follow-signal' },
  { path: '/explore', surface: 'explore', action: '[data-roster-open]' },
  { path: '/champions', surface: 'champions', action: '[data-roster-search]' },
  { path: '/champion/nunu', surface: 'champion', action: '[data-direct-save="Nunu"]' },
  { path: '/patches', surface: 'patches', action: '[data-archive-focus-link]' },
  { path: '/patch/26.21', surface: 'patch', action: '.filter-bar input' },
  { path: '/compare/26.21/26.20', surface: 'compare', action: '.compare-picker select' },
  { path: '/pool#edit-pool', surface: 'pool', action: '.pool-picker input' },
  { path: '/next-game', surface: 'next-game', action: '.automatic-lookup input' },
  { path: '/notebook', surface: 'notebook', action: '#notes button' },
  { path: '/players?platform=eun1', surface: 'players', action: '.lookup-form input' },
  { path: profilePath, surface: 'player', action: '.player-tabs button' },
  { path: `/matches/${recentAramWin.metadata.matchId}?${query}`, surface: 'match', action: '.review-back' },
  { path: '/404', surface: 'missing', action: '[data-journey-deck] a[href="/"]' },
];

async function settled(page: Page) {
  await expect(page.locator('main h1')).toHaveCount(1);
  await expect(page.locator('body')).toHaveAttribute('data-journey-ready', 'true');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('astro-island[client="load"][ssr]')).toHaveCount(0);
}

async function contained(locator: Locator, viewportWidth: number) {
  const box = await locator.boundingBox();
  expect(box, 'The control must have a rendered box').not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth + 1);
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`${viewport.width}px: every route family has a clear first task and shared navigation`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(viewport);
    await installFixtures(page, { matches: visualMatches });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    let canvasColor = '';

    for (const route of routes) {
      await test.step(route.path, async () => {
        const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
        expect(response?.status()).toBe(route.surface === 'missing' ? 404 : 200);
        await settled(page);
        await expect(page.locator('body')).toHaveAttribute('data-surface', route.surface);
        await expect(page.locator('main h1')).toBeInViewport({ ratio: 1 });
        const header = page.getByRole('banner', { name: 'RiftScry controls' });
        const color = await page.locator('body').evaluate(element => getComputedStyle(element).backgroundColor);
        if (!canvasColor) canvasColor = color;
        expect(color, 'The page canvas should retain the shared theme between destinations').toBe(canvasColor);
        for (const control of [
          header.getByRole('button', { name: 'Open the Rift map', exact: true }),
          header.getByRole('button', { name: 'Search the archive', exact: true }),
          header.locator('[data-motion-toggle]'),
        ]) {
          await expect(control).toBeInViewport({ ratio: 1 });
          await contained(control, viewport.width);
          expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        }
        const action = page.locator(route.action).first();
        await expect(action).toBeVisible();
        await expect(action).toBeInViewport({ ratio: 1 });
        await contained(action, viewport.width);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
        expect(errors, `Unexpected client errors on ${route.path}`).toEqual([]);
      });
    }
  });

  test(`${viewport.width}px: the map reaches Notebook and preserves the correct destination through browser Back`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/champions');
    await settled(page);
    const open = page.getByRole('button', { name: 'Open the Rift map', exact: true });
    await open.click();
    const map = page.getByRole('dialog', { name: 'Where next?', exact: true });
    await expect(map).toBeVisible();
    await expect(map.locator('a[aria-current="page"]')).toHaveAttribute('href', '/champions');
    await map.getByRole('link', { name: /Notebook/ }).click();
    await expect(page).toHaveURL(/\/notebook$/);
    await settled(page);
    await expect(page.locator('body')).toHaveAttribute('data-surface', 'notebook');
    await page.getByRole('button', { name: 'Open the Rift map', exact: true }).click();
    await expect(map.locator('[data-world-link][aria-current="page"]')).toHaveAttribute('data-world-link', 'pool');
    await expect(map.locator('[data-world-link="next-game"]')).not.toHaveAttribute('aria-current', 'page');
    await page.keyboard.press('Escape');
    await expect(map).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Open the Rift map', exact: true })).toBeFocused();
    await page.goBack();
    await expect(page).toHaveURL(/\/champions$/);
    await page.getByRole('button', { name: 'Open the Rift map', exact: true }).click();
    await expect(map.locator('a[aria-current="page"]')).toHaveAttribute('href', '/champions');
  });
}

test('at 320px the player task keeps readable fields and a reachable submit control', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await installFixtures(page);
  await page.goto('/players?platform=eun1');
  await settled(page);
  const form = page.getByRole('form', { name: 'Find a League of Legends player', exact: true });
  for (const field of [form.getByLabel('Riot ID', { exact: true }), form.getByLabel('Server', { exact: true })]) {
    await expect(field).toBeEnabled();
    await expect(field).toBeInViewport({ ratio: 1 });
    await contained(field, 320);
    expect(await field.evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
  }
  const submit = form.getByRole('button', { name: 'Find player', exact: true });
  await expect(submit).toBeInViewport({ ratio: 1 });
  expect((await submit.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await form.getByLabel('Riot ID', { exact: true }).fill('Fixture Player#TEST');
  await submit.click();
  await expect(page).toHaveURL(new RegExp(profilePath));
  await expect(page.locator('main h1')).toContainText('Fixture Player');
});

test('archive aliases and invalid player identities retain their recovery destinations', async ({ page }) => {
  await installFixtures(page);
  for (const [path, destination] of [
    ['/patch', `/patch/${latestPatchId}`],
    ['/compare', `/compare/${latestPatchId}/${previousPatchId}`],
    ['/compare/26.1', '/compare/26.1/26.2'],
    ['/players/not-a-platform/not-a-player', '/players'],
  ] as const) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(destination.replaceAll('.', '\\.') + '$'));
    await expect(page.locator('main h1')).toHaveCount(1);
  }
});

test.describe('readers before JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('champion records and original sources remain readable and navigation remains ordinary links', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/champion/nunu');
    await expect(page.locator('main h1')).toContainText('Nunu & Willump');
    const navigation = page.locator('.world-nojs-nav');
    await expect(navigation.getByRole('link', { name: 'Notebook', exact: true })).toBeVisible();
    await page.locator('[data-history-record]').first().scrollIntoViewIfNeeded();
    await expect(page.locator('[data-history-record]').first()).toBeVisible();
    await expect(page.locator('[data-history-record]').first().getByRole('link', { name: /Original source/ })).toHaveAttribute('href', /^https:\/\//);
    await navigation.getByRole('link', { name: 'Patches', exact: true }).click();
    await expect(page).toHaveURL(/\/patches$/);
    await page.locator('[data-archive-focus-link]').click();
    await expect(page).toHaveURL(new RegExp(`/patch/${latestPatchId.replaceAll('.', '\\.')}$`));
    await expect(page.getByRole('link', { name: /Riot.?s notes/ }).first()).toHaveAttribute('href', /^https:\/\//);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });

  test('the compact pool record opens and closes with native disclosure controls', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/pool', { waitUntil: 'domcontentloaded' });
    const record = page.locator('.return-briefing--compact details.return-briefing__archive');
    const toggle = record.locator('summary');
    await expect(record).not.toHaveAttribute('open', '');
    await expect(record.locator('article')).not.toBeVisible();
    await toggle.click();
    await expect(record).toHaveAttribute('open', '');
    await expect(record.locator('article')).toBeVisible();
    await expect(record.getByRole('link', { name: /Riot’s original notes/ })).toHaveAttribute('href', /^https:\/\//);
    await toggle.click();
    await expect(record).not.toHaveAttribute('open', '');
    await expect(record.locator('article')).not.toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });
});

for (const preference of ['operating-system', 'saved'] as const) {
  test(`${preference} reduced motion carries through the homepage, readers and Notebook`, async ({ page }) => {
    if (preference === 'operating-system') await page.emulateMedia({ reducedMotion: 'reduce' });
    else {
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.addInitScript(() => localStorage.setItem('riftscry:motion', 'reduced'));
    }
    for (const path of ['/', '/patch/26.21', '/notebook']) {
      await page.goto(path);
      await settled(page);
      await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
      await expect(page.locator('[data-motion-toggle]')).toHaveAttribute('aria-pressed', 'true');
      const loops = await page.evaluate(() => document.getAnimations().filter(animation =>
        animation.playState === 'running' && animation.effect?.getTiming().iterations === Infinity).length);
      expect(loops, `Decorative loops must stop on ${path}`).toBe(0);
    }
  });
}
