import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { reachableTarget } from './journey-test-helpers';
import { cinema, cinemaFitsViewport, closeEvidence, evidence, inspectCinema, openCinemaNavigation, readyCinema } from './cinema-test-helpers';

const sizes = [[320,480],[320,568],[390,844],[480,320],[568,320],[844,390],[768,1024],[1024,768],[1101,879],[1101,880],[1366,768],[1440,900],[1920,880],[1920,1080]] as const;
const player = { platform: 'eun1', puuid: 'fixture-player-000000000000000000000000000000000', name: `${'LongPlayerName'.repeat(9)}#TEST` };

for (const [width, height] of sizes) for (const state of ['new', 'returning'] as const) test(`world, evidence and navigation stay reachable at ${width}×${height} for ${state} players`, async ({ page }) => {
  await page.setViewportSize({ width, height }); await page.emulateMedia({ reducedMotion: 'reduce' });
  if (state === 'returning') await page.addInitScript(selected => localStorage.setItem('riftscry:recent-player:v1', JSON.stringify(selected)), player);
  await page.goto('/'); await readyCinema(page);
  await expect(page.locator('main h1')).toBeInViewport({ ratio: .99 });
  for (const selector of ['[data-cinema-inspect]', '[data-home-personal]']) await reachableTarget(page.locator(selector).first(), page);
  if (state === 'returning') {
    const href = new URL(await page.locator('[data-home-personal]').first().getAttribute('href') ?? '', page.url());
    expect(href.searchParams.get('name')).toBe(player.name);
  }
  for (const choice of await page.locator('[data-home-choice]').all()) await reachableTarget(choice, page);
  await cinemaFitsViewport(page);
  await inspectCinema(page);
  const record = evidence(page).locator('[data-home-record]:not([hidden])');
  await expect(record.locator('.before')).not.toBeEmpty(); await expect(record.locator('.after')).not.toBeEmpty();
  for (const action of await evidence(page).locator('a:visible,button:visible').all()) await reachableTarget(action, page);
  // A modal may scroll its evidence; the cinematic document never scrolls.
  await cinemaFitsViewport(page); await closeEvidence(page);
  const menu = await openCinemaNavigation(page);
  for (const action of await menu.locator('a:visible,button:visible').all()) await reachableTarget(action, page);
  await page.keyboard.press('Escape'); await cinemaFitsViewport(page);
});

test('the world refits after a returning player rotates portrait and landscape', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(selected => localStorage.setItem('riftscry:recent-player:v1', JSON.stringify(selected)), player);
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/'); await readyCinema(page);
  for (const viewport of [{ width: 844, height: 390 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await reachableTarget(page.locator('[data-home-personal]').first(), page); await cinemaFitsViewport(page);
    await inspectCinema(page); await reachableTarget(evidence(page).locator('[data-home-keep]'), page);
    await closeEvidence(page); await cinemaFitsViewport(page);
  }
});

test('remembering a player does not move the world title or navigation opener', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport); await page.goto('/'); await readyCinema(page);
    const position = () => page.evaluate(() => ({
      heading: document.querySelector('main h1')!.getBoundingClientRect().top,
      menu: document.querySelector('[aria-label="Open navigation"]')!.getBoundingClientRect().top,
      scroll: scrollY,
    }));
    const before = await position();
    await page.evaluate(selected => { localStorage.setItem('riftscry:recent-player:v1', JSON.stringify(selected)); window.dispatchEvent(new Event('riftscry:recent-player-change')); }, player);
    await expect.poll(async () => new URL(await page.locator('[data-home-personal]').first().getAttribute('href') ?? '', page.url()).searchParams.get('name')).toBe(player.name);
    const after = await position();
    for (const key of ['heading', 'menu', 'scroll'] as const) expect(Math.abs(after[key] - before[key]), `${key} at ${viewport.width}×${viewport.height}: ${JSON.stringify({ before, after })}`).toBeLessThanOrEqual(1);
    await reachableTarget(page.locator('[data-home-personal]').first(), page);
    await page.evaluate(() => localStorage.clear());
  }
});

test('the world and inspected record retain a reviewable composition', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/'); await readyCinema(page); await cinemaFitsViewport(page);
  if (['desktop', 'mobile-chromium'].includes(info.project.name)) {
    await mkdir('signal-visuals', { recursive: true });
    for (const state of ['world', 'inspect']) {
      if (state === 'inspect') await inspectCinema(page);
      const name = `${info.project.name}-cinema-${state}`;
      const frame = await page.screenshot({ path: `signal-visuals/${name}.png` });
      await info.attach(name, { body: frame, contentType: 'image/png' });
    }
  }
  await expect(cinema(page)).toBeVisible();
});
