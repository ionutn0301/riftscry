import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { cinema, cinemaSignals, chooseSignal, closeEvidence, evidence, inspectCinema, openCinemaNavigation, readyCinema, selectedSignal, cinemaFitsViewport } from './cinema-test-helpers';
import { reachableTarget, readyWorld } from './journey-test-helpers';

test.use({ video: 'on' });

// Live WebGL with video and traces can render on a CPU in CI. Only tests that
// exercise that moving world opt into 90 seconds; action/readiness assertions
// and the normal failure budgets for static and unavailable-art cases stay.
// The homepage is now a directly interactive world. The previous four-stop
// scroll journey, scene rail, and diagnostic camera-count threshold described
// a retired design; the product, motion preference, and history contracts stay.
test('the cinematic world selects real champions and opens exact evidence without a scroll journey', async ({ page, isMobile }, info) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const errors: string[] = [], requests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/player/')) requests.push(request.url()); });
  await page.goto('/'); await readyCinema(page);
  await expect(page.locator('main h1')).toHaveAccessibleName('The Rift has changed.');
  await expect(page.locator('[data-journey-deck],[data-journey-panel],[data-journey-tabs],.journey-chrome')).toHaveCount(0);
  await expect(page.locator('[data-cinema-canvas]')).toHaveCount(1);
  await page.evaluate(() => { (window as any).__cinemaCanvas = document.querySelector('[data-cinema-canvas]'); });
  await mkdir('player-visuals', { recursive: true });
  await page.screenshot({ path: `player-visuals/flight-${info.project.name}-world.png` });
  const signals = await cinemaSignals(page);
  expect(signals.length).toBeGreaterThan(1);
  for (const signal of signals) {
    await chooseSignal(page, signal);
    await reachableTarget(page.locator('[data-cinema-inspect]').first(), page);
    await inspectCinema(page);
    const record = evidence(page).locator('[data-home-record]:not([hidden])');
    await expect(record.locator('.before')).toHaveText(signal.before);
    await expect(record.locator('.after')).toHaveText(signal.after);
    await expect(record.locator('.signal-value--before')).toBeVisible();
    await expect(record.locator('.signal-value--after')).toBeVisible();
    const valueLayout = () => record.evaluate(element => {
      const aperture = element.querySelector('.signal-aperture')!.getBoundingClientRect();
      const before = element.querySelector('.signal-value--before')!.getBoundingClientRect();
      const after = element.querySelector('.signal-value--after')!.getBoundingClientRect();
      return { widthRatio: Math.min(before.width, after.width) / aperture.width, stackGap: after.top - before.bottom };
    });
    // Production CSS ordering once restored the reader's three-column grid,
    // squeezing After into a narrow strip despite the exact text being present.
    await expect.poll(async () => (await valueLayout()).widthRatio, {
      message: `${signal.championName}: both value columns must use most of the evidence width`,
    }).toBeGreaterThanOrEqual(.9);
    await expect.poll(async () => (await valueLayout()).stackGap, {
      message: `${signal.championName}: After must start below the complete Before value`,
    }).toBeGreaterThanOrEqual(-1);
    await expect(record.getByRole('link', { name: 'Original source' })).toHaveAttribute('href', signal.sourceUrl);
    await closeEvidence(page);
  }
  expect(await page.evaluate(() => (window as any).__cinemaCanvas === document.querySelector('[data-cinema-canvas]'))).toBe(true);
  await page.screenshot({ path: `player-visuals/flight-${info.project.name}-selected.png` });
  const selected = await selectedSignal(page);
  if (isMobile) {
    const box = (await cinema(page).boundingBox())!, x = box.x + box.width * .85, y = box.y + box.height * .55;
    await cinema(page).dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 7, isPrimary: true, clientX: x, clientY: y });
    await cinema(page).dispatchEvent('pointermove', { pointerType: 'touch', pointerId: 7, isPrimary: true, clientX: x, clientY: y - 100 });
    await cinema(page).dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 7, isPrimary: true, clientX: x, clientY: y - 100 });
  } else await page.mouse.wheel(0, 700);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(cinema(page)).toHaveAttribute('data-home-subject', selected.championId);
  await expect(cinema(page)).toHaveAttribute('data-cinema-state', 'world');
  await cinemaFitsViewport(page);
  expect(requests).toEqual([]); expect(errors).toEqual([]);
});

test('rapid world selections and native Back restore the intended champion', async ({ page }) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/'); await readyCinema(page);
  const signals = await cinemaSignals(page);
  await chooseSignal(page, signals[1]!); await chooseSignal(page, signals[2]!);
  await page.goBack();
  await expect(cinema(page)).toHaveAttribute('data-home-subject', signals[1]!.championId);
  await inspectCinema(page);
  await expect(evidence(page).locator('[data-home-record]:not([hidden]) .after')).toHaveText(signals[1]!.after);
  await page.goBack();
  await expect(evidence(page)).toBeHidden();
  await expect(cinema(page)).toHaveAttribute('data-cinema-state', 'world');
  await expect(cinema(page)).toHaveAttribute('data-home-subject', signals[1]!.championId);
});

test('world choices and inspection work by keyboard and Escape restores the opener', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/'); await readyCinema(page);
  const signal = (await cinemaSignals(page))[1]!;
  const choice = page.locator(`[data-home-choice="${signal.championId}"]`);
  await choice.focus(); await page.keyboard.press('Enter');
  await expect(cinema(page)).toHaveAttribute('data-home-subject', signal.championId);
  const inspect = page.locator('[data-cinema-inspect]').first();
  await inspect.focus(); await page.keyboard.press('Enter');
  await expect(evidence(page)).toBeVisible();
  expect(await evidence(page).evaluate(dialog => dialog.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(evidence(page)).toBeHidden(); await expect(inspect).toBeFocused();
  const opener = page.getByRole('button', { name: 'Open navigation', exact: true });
  await opener.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'RiftScry navigation', exact: true })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(opener).toBeFocused();
});

test('the cinema respects reduced motion and remembers its live motion control', async ({ page }) => {
  test.setTimeout(90_000);
  const changeDeviceMotion = async (reducedMotion: 'reduce' | 'no-preference') => {
    await page.emulateMedia({ reducedMotion });
    // Let matchMedia change listeners run before checking that a deliberate
    // visitor choice survived; an immediate assertion could observe old state.
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  };
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/'); await readyCinema(page);
  const motion = page.locator('button[data-cinema-motion]');
  await motion.click();
  await expect(motion).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  await chooseSignal(page, (await cinemaSignals(page))[1]!);
  await inspectCinema(page); await closeEvidence(page);
  await page.reload(); await readyCinema(page);
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  await expect(page.locator('button[data-cinema-motion]')).toHaveAttribute('aria-pressed', 'true');
  for (const preference of ['reduce', 'no-preference', 'reduce'] as const) {
    await changeDeviceMotion(preference);
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
    await expect(cinema(page)).toHaveAttribute('data-cinema-motion', 'reduced');
    await expect(motion).toHaveAttribute('aria-pressed', 'true');
  }
  // The device still requests reduced motion. Explicitly enabling this world
  // must survive a reload, and later device changes must preserve that choice.
  await motion.click();
  await expect(cinema(page)).toHaveAttribute('data-cinema-motion', 'full');
  await expect(motion).toHaveAttribute('aria-pressed', 'false');
  await page.reload(); await readyCinema(page);
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
  await expect(cinema(page)).toHaveAttribute('data-cinema-motion', 'full');
  await expect(motion).toHaveAttribute('aria-pressed', 'false');
  for (const preference of ['no-preference', 'reduce'] as const) {
    await changeDeviceMotion(preference);
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
    await expect(cinema(page)).toHaveAttribute('data-cinema-motion', 'full');
    await expect(motion).toHaveAttribute('aria-pressed', 'false');
  }
});

test('graphics-context failure keeps the native world choices and exact evidence usable', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value: () => null }));
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await readyCinema(page);
  const signal = (await cinemaSignals(page))[1]!;
  await chooseSignal(page, signal); await inspectCinema(page);
  await expect(evidence(page).locator('[data-home-record]:not([hidden]) .after')).toHaveText(signal.after);
  await evidence(page).locator('[data-home-keep]').click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('riftscry:kept-findings') ?? '[]'))).toEqual([
    expect.objectContaining({ id: signal.record.id, text: `${signal.before} → ${signal.after}`, href: signal.explore }),
  ]);
  await expect(evidence(page)).toBeVisible(); await closeEvidence(page);
  await reachableTarget(page.locator('[data-home-personal]').first(), page);
  expect(errors).toEqual([]);
});

test('failed visual assets leave world navigation and archive evidence available', async ({ page }) => {
  await page.route(/\.(?:png|jpe?g|webp)(?:\?.*)?$/i, route => route.abort());
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await readyCinema(page);
  const signal = (await cinemaSignals(page))[1]!;
  await chooseSignal(page, signal); await inspectCinema(page);
  const record = evidence(page).locator('[data-home-record]:not([hidden])');
  await expect(record.locator('.before')).toHaveText(signal.before);
  await expect(record.locator('.after')).toHaveText(signal.after);
  await expect(record.getByRole('link', { name: 'Original source' })).toHaveAttribute('href', signal.sourceUrl);
  await closeEvidence(page); const menu = await openCinemaNavigation(page);
  await expect(menu.locator('a[href="/champions"]')).toBeVisible(); expect(errors).toEqual([]);
});

test('world interaction does not wait for decorative images to finish loading', async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  let requested = false;
  await page.route(/\.(?:png|jpe?g|webp)(?:\?.*)?$/i, async route => { requested = true; await pending; await route.abort(); });
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // WebKit can tie document.fonts.ready to the intentionally pending load.
    await readyCinema(page, { fonts: false });
    await expect.poll(() => requested).toBe(true);
    await chooseSignal(page, (await cinemaSignals(page))[1]!); await inspectCinema(page);
    await expect(evidence(page).locator('[data-home-record]:not([hidden]) .after')).not.toBeEmpty();
  } finally { release(); }
});

test('world controls and an open evidence dialog remain reachable after rotation', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/'); await readyCinema(page);
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 390, height: 664 }]) {
    await page.setViewportSize(viewport);
    await reachableTarget(page.locator('[data-cinema-inspect]').first(), page); await cinemaFitsViewport(page);
    await inspectCinema(page);
    await reachableTarget(evidence(page).locator('[data-home-keep]'), page);
    await reachableTarget(page.locator('[data-cinema-close]'), page); await closeEvidence(page);
  }
});

test('appearance choices stay interactive on reduced-motion devices and survive a native exit', async ({ page }, info) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/'); await readyCinema(page);
  const menu = await openCinemaNavigation(page);
  await page.locator('[data-theme-choice][value=obsidian]').check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'obsidian');
  await expect(page.locator('button[data-cinema-motion]')).toHaveAttribute('aria-pressed', 'true');
  await mkdir('player-visuals', { recursive: true });
  await page.screenshot({ path: `player-visuals/flight-${info.project.name}-appearance.png` });
  await page.keyboard.press('Escape');
  // Device preference is the initial state. A deliberate visitor choice can
  // enable this world, and the renderer must agree with the visible control.
  await page.locator('button[data-cinema-motion]').click();
  await expect(page.locator('button[data-cinema-motion]')).toHaveAttribute('aria-pressed', 'false');
  await expect(cinema(page)).toHaveAttribute('data-cinema-motion', 'full');
  await openCinemaNavigation(page);
  await menu.locator('a[href="/champions"]').click();
  // Navigation begins after the animated menu exit, so wait for the destination
  // before asking the shared readiness helper to identify the active route.
  await expect(page).toHaveURL(/\/champions(?:#.*)?$/);
  await readyWorld(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'obsidian');
  await page.locator('[data-theme-toggle]').click();
  await expect(page.locator('[data-theme-choice][value=obsidian]')).toBeChecked();
});
