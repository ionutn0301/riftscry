import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { openScene, reachableTarget, readySignal, stationaryWorld, unobstructed } from './journey-test-helpers';

const sizes = [[320,480],[320,568],[390,844],[480,320],[568,320],[844,390],[768,1024],[1024,768],[1101,879],[1101,880],[1366,768],[1440,900],[1920,880],[1920,1080]] as const;
const player = { platform: 'eun1', puuid: 'fixture-player-000000000000000000000000000000000', name: `${'LongPlayerName'.repeat(9)}#TEST` };

async function sceneFits(page: Page) {
  const panel = page.locator('[data-journey-panel]:visible');
  await expect(panel).toHaveCount(1);
  const bounds = (await panel.boundingBox())!;
  const header = (await page.locator('.journey-header').boundingBox())!;
  const footer = (await page.locator('.journey-chrome').boundingBox())!;
  const hero = (await page.locator('.signal-journey').boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(bounds.height).toBeGreaterThan(0);
  // The arrival stays compact. Exact evidence can grow in the document; its
  // artwork remains bounded while every source and action stays reachable.
  if (await panel.getAttribute('id') === 'signal') expect(hero.height, 'The opening must fit the screen').toBeLessThanOrEqual(viewport.height + 1);
  const art = (await page.locator('[data-home-world]').boundingBox())!;
  expect(art.height, 'Artwork must not grow with the evidence document').toBeLessThanOrEqual(viewport.height + 1);
  expect(header.y).toBeGreaterThanOrEqual(-1);
  if (viewport.height > 620) {
    expect(footer.y + footer.height).toBeLessThanOrEqual(viewport.height + 1);
  } else {
    // Short-screen navigation follows the content instead of obscuring links.
    const chrome = page.locator('.journey-chrome');
    await chrome.scrollIntoViewIfNeeded();
    await expect(chrome).toBeInViewport({ ratio: 0.99 });
  }
  expect((await page.locator('[data-journey-panel][hidden]').count())).toBe(3);
  for (const inactive of await page.locator('[data-journey-panel][hidden]').all()) await expect(inactive).toHaveJSProperty('inert', true);
  await stationaryWorld(page);
}

for (const [width, height] of sizes) for (const state of ['new', 'returning'] as const) test(`all three signal acts stay reachable at ${width}×${height} for ${state} players`, async ({ page }) => {
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  if (state === 'returning') await page.addInitScript(selected => localStorage.setItem('riftscry:recent-player:v1', JSON.stringify(selected)), player);
  await page.goto('/'); await readySignal(page);
  const arrival = await openScene(page, 'signal');
  if (state === 'returning') await expect(page.locator('[data-home-return]')).toContainText(player.name);
  else await expect(page.locator('[data-home-return]')).toBeHidden();
  await arrival.locator('h2').scrollIntoViewIfNeeded();
  await expect(arrival.locator('h2')).toBeInViewport({ ratio: 0.99 });
  for (const selector of ['[data-home-reveal]', '[data-home-personal]', '[data-home-beacon]']) await reachableTarget(arrival.locator(selector), page);
  if (await arrival.locator('[data-home-context]').isVisible()) await reachableTarget(arrival.locator('[data-home-context]'), page);
  for (const choice of await page.locator('[data-home-choice]').all()) await reachableTarget(choice, page);
  await reachableTarget(page.locator('.signal-cast-all'), page);
  await reachableTarget(page.locator('[data-map-open]'), page);
  await sceneFits(page);

  const reveal = await openScene(page, 'reveal');
  const record = reveal.locator('[data-home-record]:not([hidden])');
  await expect(record.locator('.before')).not.toBeEmpty();
  await expect(record.locator('.after')).not.toBeEmpty();
  await reachableTarget(reveal.locator('[data-home-keep]'), page);
  await reachableTarget(reveal.locator('[data-home-trace]'), page);
  await unobstructed(record.getByRole('link', { name: 'Original source' }));
  await sceneFits(page);

  const carry = await openScene(page, 'carry');
  for (const link of await carry.getByRole('link').all()) await reachableTarget(link, page);
  await sceneFits(page);
});

test('the active signal refits after a returning player rotates portrait and landscape', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(selected => localStorage.setItem('riftscry:recent-player:v1', JSON.stringify(selected)), player);
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/'); await readySignal(page);
  for (const viewport of [{ width: 844, height: 390 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const arrival = await openScene(page, 'signal');
    await expect(page.locator('[data-home-return]')).toContainText(player.name);
    await reachableTarget(arrival.locator('[data-home-personal]'), page);
    await reachableTarget(arrival.locator('[data-home-beacon]'), page);
    await sceneFits(page);
    const reveal = await openScene(page, 'reveal');
    await reachableTarget(reveal.locator('[data-home-keep]'), page);
    await sceneFits(page);
  }
});

test('remembering a player does not move the opening heading or scene controls', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport); await page.goto('/'); await readySignal(page);
    const position = () => page.evaluate(() => ({
      heading: document.querySelector('#signal-title')!.getBoundingClientRect().top,
      footer: document.querySelector('.journey-chrome')!.getBoundingClientRect().top,
      scroll: scrollY,
    }));
    const before = await position();
    await page.evaluate(selected => {
      localStorage.setItem('riftscry:recent-player:v1', JSON.stringify(selected));
      window.dispatchEvent(new Event('riftscry:recent-player-change'));
    }, player);
    await expect(page.locator('[data-home-return]')).toContainText(player.name);
    const after = await position();
    for (const key of ['heading', 'footer', 'scroll'] as const) expect(Math.abs(after[key] - before[key]), `${key} at ${viewport.width}×${viewport.height}: ${JSON.stringify({ before, after })}`).toBeLessThanOrEqual(1);
    await page.evaluate(() => localStorage.clear());
  }
});

test('arrival, reveal and carry retain their composition for visual review', async ({ page }, testInfo) => {
  const capture = ['desktop', 'mobile-chromium'].includes(testInfo.project.name);
  const viewports = testInfo.project.name === 'desktop'
    ? [{ width: 1440, height: 900 }, { width: 568, height: 320 }]
    : [{ width: 390, height: 844 }];
  if (capture) await mkdir('signal-visuals', { recursive: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const viewport of viewports) {
    await page.setViewportSize(viewport); await page.goto('/'); await readySignal(page);
    await expect.poll(() => page.locator('[data-home-art]').evaluate((image: HTMLImageElement) => image.complete)).toBe(true);
    for (const scene of ['signal', 'reveal', 'carry']) {
      await openScene(page, scene); await sceneFits(page);
      if (capture) {
        // Reachability checks may finish at the footer. Capture the chapter's
        // entrance so short-screen review images show the actual first screen.
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        const name = `${testInfo.project.name}-${scene}-${viewport.width}x${viewport.height}`;
        const screenshot = await page.screenshot({ animations: 'disabled', path: `signal-visuals/${name}.png` });
        await testInfo.attach(name, { body: screenshot, contentType: 'image/png' });
      }
    }
  }
});
