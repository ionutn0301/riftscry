import { test, expect, type Page } from '@playwright/test';
import { installFixtures, mixedModeMatches, platform, profilePath, query, recentAramLoss, recentAramWin, savedNote, seedNotes } from './fixtures';

// Success artifacts for human design review. These are not pixel baselines and
// never represent the user's live identity, history, rank, or AI responses.
const captureDirectory = 'player-visuals';
const identity = 'Fixture Player#TEST';
const namedProfile = `${profilePath}?name=${encodeURIComponent(identity)}`;

async function settledFonts(page: Page) {
  await page.evaluate(() => document.fonts.ready);
}

async function capture(page: Page, name: string, fullPage = false) {
  await settledFonts(page);
  // Full-page screenshots should show fixed navigation at its initial position,
  // rather than halfway down the image after Playwright scrolls to a control.
  if (fullPage) await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: `${captureDirectory}/${name}.png`, fullPage, animations: 'disabled' });
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

async function expectGatewayInViewport(page: Page) {
  const gateway = page.locator('[data-player-gateway]');
  const form = page.getByRole('form', { name: 'Find a League of Legends player', exact: true });
  await expect(form.getByRole('button', { name: /Find player/ })).toBeEnabled();
  await settledFonts(page);
  await expect(gateway.locator('h1')).toBeInViewport({ ratio: 1 });
  for (const control of [form.getByLabel('Riot ID', { exact: true }), form.getByLabel('Server', { exact: true }), form.getByRole('button', { name: /Find player/ })]) {
    await expect(control).toBeInViewport({ ratio: 1 });
  }
  const bounds = await gateway.evaluate(element => ({ height: element.getBoundingClientRect().height, viewport: innerHeight }));
  expect(bounds.height).toBeLessThanOrEqual(bounds.viewport + 2);
  await expectNoHorizontalOverflow(page);
}

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'compact', width: 359, height: 603 },
]) {
  test(`${viewport.name}: gateway and mode-specific profiles remain usable with reduced motion`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const requests = await installFixtures(page, { matches: mixedModeMatches });
    if (viewport.name === 'desktop') await seedNotes(page, [{
      ...savedNote, role: 'MODE:aram', queue: 450,
      source: recentAramLoss.metadata.matchId, sourceDate: recentAramLoss.info.gameCreation,
      createdAt: recentAramLoss.info.gameCreation + 1_000,
      trackingStartedAt: recentAramLoss.info.gameCreation + 1_000,
    }]);
    await page.goto(`/players?platform=${platform}`, { waitUntil: 'domcontentloaded' });
    await expectGatewayInViewport(page);
    const runningLoops = await page.locator('[data-player-gateway]').evaluate(element => element.getAnimations({ subtree: true })
      .filter(animation => animation.playState === 'running' && animation.effect?.getComputedTiming().endTime === Infinity).length);
    expect(runningLoops).toBe(0);
    await capture(page, `${viewport.name}-gateway`);

    await page.goto(namedProfile, { waitUntil: 'domcontentloaded' });
    const sample = page.getByRole('region', { name: 'Recent match sample', exact: true });
    await expect(sample).toContainText('5 of 5 recent matches imported');
    await expect(page.locator('.match-row')).toHaveCount(5);
    await expect(page.locator('[data-player-profile]')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(identity);
    await expect(page.getByRole('heading', { level: 1 })).toBeInViewport({ ratio: 1 });
    if (viewport.name === 'desktop') {
      const recordReads = () => requests.filter(request => ['history', 'match'].includes(request.action)).length;
      const before = recordReads();
      for (const title of ['About this sample', 'About these stats']) {
        const summary = sample.locator('summary').filter({ hasText: title }).first();
        const disclosure = summary.locator('..');
        await expect(disclosure).toHaveJSProperty('open', false);
        await summary.focus();
        await page.keyboard.press('Enter');
        await expect(disclosure).toHaveJSProperty('open', true);
        await page.keyboard.press('Enter');
        await expect(disclosure).toHaveJSProperty('open', false);
      }
      expect(recordReads()).toBe(before);
    }
    await settledFonts(page);
    await expectNoHorizontalOverflow(page);
    await capture(page, `${viewport.name}-profile-all`, true);

    for (const mode of [{ id: '450', name: 'aram', count: 2 }, { id: '420', name: 'ranked', count: 1 }]) {
      await page.getByLabel('Game mode', { exact: true }).selectOption(mode.id);
      await expect(sample).toContainText(`${mode.count} of ${mode.count} recent matches imported`);
      await expect(page.locator('.match-row')).toHaveCount(mode.count);
      await expect(page.locator('[data-mode-summary]')).toHaveCount(1);
      await expect(page.locator('[data-mode-summary]')).toHaveAttribute('data-queue', mode.id);
      await settledFonts(page);
      await expectNoHorizontalOverflow(page);
      await capture(page, `${viewport.name}-profile-${mode.name}`, true);
    }
    expect(requests.filter(request => ['timeline', 'review'].includes(request.action))).toEqual([]);

    if (viewport.name === 'desktop') {
      await page.getByLabel('Game mode', { exact: true }).selectOption('450');
      await expect(sample).toContainText('2 of 2 recent matches imported');
      const views = page.getByRole('navigation', { name: 'Player views', exact: true });
      await views.getByRole('button', { name: 'Builds', exact: true }).click();
      await expect(page.locator('.observed-build')).toHaveCount(1);
      await expectNoHorizontalOverflow(page);
      await capture(page, 'desktop-profile-builds', true);
      await views.getByRole('button', { name: 'Build Memory', exact: true }).click();
      await expect(page.locator('.memory-note')).toHaveCount(1);
      await expect(page.getByText(/1 eligible later match/)).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await capture(page, 'desktop-profile-memory', true);
      expect(requests.filter(request => ['timeline', 'review'].includes(request.action))).toEqual([]);
    }

    if (viewport.name !== 'mobile') {
      await page.goto(`/matches/${recentAramWin.metadata.matchId}?${query}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: /^Ahri/, level: 1 })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Match overview', exact: true })).toContainText('18 / 6 / 24');
      await expect(page.getByRole('button', { name: 'Review with AI', exact: true })).toBeEnabled();
      await expectNoHorizontalOverflow(page);
      await capture(page, `${viewport.name}-match-review`, true);
      expect(requests.filter(request => ['timeline', 'review'].includes(request.action))).toEqual([]);
    }
  });
}

test('desktop gateway has a bounded full-motion visual capture without blocking lookup', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await installFixtures(page, { matches: mixedModeMatches });
  await page.goto(`/players?platform=${platform}`, { waitUntil: 'domcontentloaded' });
  await expectGatewayInViewport(page);
  // Capture the live animation after actual readiness; no arbitrary sleep or
  // pixel assertion against a particular animation frame.
  await page.screenshot({ path: `${captureDirectory}/desktop-gateway-full-motion.png`, animations: 'allow', timeout: 10_000 });
});
