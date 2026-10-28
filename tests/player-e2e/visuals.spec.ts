import { test, expect, type Page } from '@playwright/test';
import { installFixtures, mixedModeMatches, platform, profilePath } from './fixtures';

// Success artifacts for human design review. These are not pixel baselines and
// never represent the user's live identity, history, rank, or AI responses.
const captureDirectory = 'player-visuals';
const identity = 'Fixture Player#TEST';
const namedProfile = `${profilePath}?name=${encodeURIComponent(identity)}`;

async function settledFonts(page: Page) {
  await page.evaluate(() => document.fonts.ready);
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
    await page.goto(`/players?platform=${platform}`, { waitUntil: 'domcontentloaded' });
    await expectGatewayInViewport(page);
    const runningLoops = await page.locator('[data-player-gateway]').evaluate(element => element.getAnimations({ subtree: true })
      .filter(animation => animation.playState === 'running' && animation.effect?.getComputedTiming().endTime === Infinity).length);
    expect(runningLoops).toBe(0);
    await page.screenshot({ path: `${captureDirectory}/${viewport.name}-gateway.png`, animations: 'disabled' });

    await page.goto(namedProfile, { waitUntil: 'domcontentloaded' });
    const sample = page.getByRole('region', { name: 'Recent match sample', exact: true });
    await expect(sample).toContainText('5 of 5 recent matches imported');
    await expect(page.locator('.match-row')).toHaveCount(5);
    await expect(page.locator('[data-player-profile]')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(identity);
    await expect(page.getByRole('heading', { level: 1 })).toBeInViewport({ ratio: 1 });
    await settledFonts(page);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: `${captureDirectory}/${viewport.name}-profile-all.png`, fullPage: true, animations: 'disabled' });

    for (const mode of [{ id: '450', name: 'aram', count: 2 }, { id: '420', name: 'ranked', count: 1 }]) {
      await page.getByLabel('Game mode', { exact: true }).selectOption(mode.id);
      await expect(sample).toContainText(`${mode.count} of ${mode.count} recent matches imported`);
      await expect(page.locator('.match-row')).toHaveCount(mode.count);
      await expect(page.locator('[data-mode-summary]')).toHaveCount(1);
      await expect(page.locator('[data-mode-summary]')).toHaveAttribute('data-queue', mode.id);
      await settledFonts(page);
      await expectNoHorizontalOverflow(page);
      await page.screenshot({ path: `${captureDirectory}/${viewport.name}-profile-${mode.name}.png`, fullPage: true, animations: 'disabled' });
    }
    expect(requests.filter(request => ['timeline', 'review'].includes(request.action))).toEqual([]);
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
