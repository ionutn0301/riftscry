import { test, expect, type Page } from '@playwright/test';
import { cinema, cinemaSignals, chooseSignal, cinemaFitsViewport, openCinemaNavigation, readyCinema } from './cinema-test-helpers';
import { wheelAt } from './gesture-test-helpers';

test.use({ contextOptions: { reducedMotion: 'reduce' } });
const tour = (page: Page) => page.locator('button[data-cinema-tour]');

test('world gestures advance one champion per gesture and leave interactive controls alone', async ({ page, browserName, isMobile }) => {
  await page.goto('/'); await readyCinema(page);
  const signals = await cinemaSignals(page);
  const viewport = page.viewportSize()!;
  // Responsive player actions may occupy the former fixed wheel coordinate.
  // Find a real open part of the world, including the native swipe path, so
  // this verifies gestures on artwork rather than accidentally on a button.
  const point = await page.evaluate(({ width, height }) => {
    const world = document.querySelector('[data-rift-cinema]')!;
    for (const fraction of [.3, .36, .48, .58]) {
      const candidate = { x: width * .53, y: height * fraction };
      if ([0, 45, 100].every(offset => {
        const target = document.elementFromPoint(candidate.x - offset, candidate.y);
        return target && world.contains(target) && !target.closest('a,button,input,dialog');
      })) return candidate;
    }
    throw new Error('No unobstructed artwork area for a world gesture');
  }, viewport);
  const mobileWebKit = isMobile && browserName === 'webkit';
  const open = page.getByRole('button', { name: 'Open navigation menu', exact: true });
  const openBox = (await open.boundingBox())!;
  // Native wheel deltas are scaled in mobile Chromium. Mobile WebKit exposes
  // no native wheel injection, so that project checks the DOM gesture contract.
  await wheelAt(page, { x: openBox.x + openBox.width / 2, y: openBox.y + openBox.height / 2 }, 400, mobileWebKit);
  await expect(cinema(page)).toHaveAttribute('data-home-subject', signals[0]!.championId);
  // A fresh gesture after a pause is distinct from the wheel over a control.
  await page.waitForTimeout(1000);
  await page.mouse.move(point.x, point.y);
  expect(await page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest('a,button,input,dialog')), point)).toBe(false);
  // Queue the burst together so remote-call latency cannot turn trailing
  // momentum into several separate, deliberately spaced gestures.
  await Promise.all([120, 80, 50, 30].map(delta => wheelAt(page, point, delta, mobileWebKit)));
  await expect(cinema(page)).toHaveAttribute('data-home-subject', signals[1]!.championId);
  await page.waitForTimeout(1000);
  await expect(cinema(page)).toHaveAttribute('data-home-subject', signals[1]!.championId);
  await wheelAt(page, point, -400, mobileWebKit);
  await expect(cinema(page)).toHaveAttribute('data-home-subject', signals[0]!.championId);

  if (isMobile && browserName === 'chromium') {
    // Chromium exposes native touch injection through its browser protocol.
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y, id: 1 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x - 45, y: point.y, id: 1 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x - 100, y: point.y, id: 1 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await session.detach();
    await expect(cinema(page)).toHaveAttribute('data-home-subject', signals[1]!.championId);
  }
  await cinemaFitsViewport(page);
});

async function readyTour(page: Page) {
  await page.clock.install();
  await page.goto('/'); await readyCinema(page);
  // Freeze after real page readiness. This also proves that idle time alone
  // does not start a tour, and prevents slow graphics calls consuming its 8s.
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 60_000));
  await expect(tour(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(tour(page)).toHaveText('Play tour');
}

test('an explicit tour advances real champions without adding history and pauses on request', async ({ page }) => {
  await readyTour(page);
  const signals = await cinemaSignals(page);
  await expect(cinema(page)).toHaveAttribute('data-home-subject', signals[0]!.championId);
  const historyLength = await page.evaluate(() => history.length);
  await tour(page).click();
  await expect(tour(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(tour(page)).toHaveText('Pause tour');
  await expect(cinema(page)).toHaveAttribute('data-cinema-motion', 'full');
  await page.clock.fastForward(8100);
  await expect(cinema(page)).toHaveAttribute('data-home-subject', signals[1]!.championId);
  await expect(page.locator(`[data-home-choice="${signals[1]!.championId}"]`)).toHaveAttribute('aria-current', 'true');
  await expect(page).toHaveURL(url => url.searchParams.get('signal') === signals[1]!.championId);
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  await tour(page).click();
  await expect(tour(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(tour(page)).toHaveText('Play tour');
  await page.clock.fastForward(16_100);
  await expect(cinema(page)).toHaveAttribute('data-home-subject', signals[1]!.championId);
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
});

test('menu, manual selection and still-world preference stop the tour without resuming it', async ({ page }) => {
  await readyTour(page);
  const signals = await cinemaSignals(page);
  await tour(page).click();
  const dialog = await openCinemaNavigation(page);
  await expect(tour(page)).toHaveAttribute('aria-pressed', 'false');
  await dialog.getByRole('button', { name: 'Close navigation', exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.clock.fastForward(8100);
  await expect(cinema(page)).toHaveAttribute('data-home-subject', signals[0]!.championId);

  await tour(page).click();
  await chooseSignal(page, signals[1]!);
  await expect(tour(page)).toHaveAttribute('aria-pressed', 'false');
  await page.clock.fastForward(8100);
  await expect(cinema(page)).toHaveAttribute('data-home-subject', signals[1]!.championId);

  await tour(page).click();
  await page.locator('button[data-cinema-motion]').click();
  await expect(cinema(page)).toHaveAttribute('data-cinema-motion', 'reduced');
  await expect(tour(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(tour(page)).toHaveText('Play tour');
  await page.clock.fastForward(16_100);
  await expect(cinema(page)).toHaveAttribute('data-home-subject', signals[1]!.championId);
});
