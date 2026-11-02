import { test, expect } from '@playwright/test';
import { chooseSignal, cinemaSignals, openCinemaNavigation, readyCinema } from './cinema-test-helpers';

// Retain real browser footage of the requested interaction, not a design mockup.
test.use({ video: 'on' });

test('record the mobile menu opening, living state and closing for two champions', async ({ page }, info) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await readyCinema(page);
  const signals = await cinemaSignals(page);
  for (const signal of signals.slice(0, 2)) {
    await chooseSignal(page, signal);
    const menu = await openCinemaNavigation(page);
    await expect(menu.locator('[data-cinema-menu-subject]')).toHaveText(signal.championName);
    // This dwell is intentional: the retained video must show ambient motion,
    // rather than only the opening and closing transitions back-to-back.
    await page.waitForTimeout(1800);
    await page.screenshot({ path: info.outputPath(`menu-${signal.championId}.png`) });
    await menu.getByRole('button', { name: 'Close navigation', exact: true }).click();
    await expect(menu).toBeHidden();
    await expect(page.getByRole('button', { name: 'Open navigation', exact: true })).toBeFocused();
  }
  expect(errors).toEqual([]);
});
