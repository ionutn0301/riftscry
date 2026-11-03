import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { cinema, cinemaSignals, chooseSignal, closeEvidence, evidence, inspectCinema, openCinemaNavigation, readyCinema, selectedSignal, cinemaFitsViewport } from './cinema-test-helpers';
import { reachableTarget, readyWorld } from './journey-test-helpers';
import { captureColdCinemaFrame, expectCinemaStartupStable, installCinemaStartupProbe, markCinemaStartup, projectCinemaForeground, readCinemaStartupTrace, type CinemaStartupTrace } from './cinema-startup-test-helpers';

test.use({ video: 'on' });

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`cold homepage keeps its first-paint composition with delayed assets (${reducedMotion})`, async ({ page, browserName }, info) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ reducedMotion });
    // Cover the inclusive mobile breakpoint without multiplying the matrix.
    // Normal mobile Chromium and both WebKit cases retain the 390px viewport.
    if (info.project.name === 'mobile-chromium' && reducedMotion === 'reduce') await page.setViewportSize({ width: 700, height: 844 });
    const gate = () => {
      let release!: () => void;
      const pending = new Promise<void>(resolve => { release = resolve; });
      return { pending, release };
    };
    const scripts = gate(), images = gate(), fonts = gate();
    const intercepted = { scripts: 0, images: 0, fonts: 0 };
    const errors: string[] = [], playerRequests: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/player/')) playerRequests.push(request.url()); });
    await page.route('**/*', async route => {
      const request = route.request(), path = new URL(request.url()).pathname;
      if (request.resourceType() === 'script') { intercepted.scripts++; await scripts.pending; }
      else if (request.resourceType() === 'font') { intercepted.fonts++; await fonts.pending; }
      else if (request.resourceType() === 'image' && path.startsWith('/images/rift-cinema/')) { intercepted.images++; await images.pending; }
      await route.continue();
    });
    await installCinemaStartupProbe(page);
    let trace: CinemaStartupTrace | undefined;
    let renderer: string | null = null;
    const prefix = `player-visuals/flight-startup-${info.project.name}-${reducedMotion}`;
    await mkdir('player-visuals', { recursive: true });
    try {
      // A module gate prevents DOMContentLoaded. The recorder is installed
      // before navigation and observes the actual styled SSR frames instead.
      await page.goto('/', { waitUntil: 'commit' });
      await page.waitForFunction(() => {
        const frames = (window as unknown as Window & { __cinemaStartup: CinemaStartupTrace }).__cinemaStartup.frames.filter(frame => frame.styled);
        return frames.length >= 2 && frames.at(-1)!.time - frames[0]!.time >= 250;
      });
      expect(intercepted.scripts).toBeGreaterThan(0);
      expect(intercepted.images).toBeGreaterThanOrEqual(2);
      expect(intercepted.fonts).toBeGreaterThan(0);
      await expect(cinema(page)).not.toHaveAttribute('data-home-ready', 'true');
      await markCinemaStartup(page, 'images-released');
      images.release();
      await page.waitForFunction(() => ['[data-cinema-poster]', '.cinema-environment'].every(selector => {
        const image = document.querySelector<HTMLImageElement>(selector);
        return image?.complete && image.naturalWidth > 0;
      }));
      await markCinemaStartup(page, 'ssr-artwork');
      await captureColdCinemaFrame(page, browserName, `${prefix}-before.png`, info);
      await markCinemaStartup(page, 'scripts-released');
      scripts.release();
      // Do not use readyCinema: it waits for fonts, hiding the startup interval.
      await expect(cinema(page)).toHaveAttribute('data-home-ready', 'true');
      await expect(cinema(page)).toHaveAttribute('data-renderer', /^(webgl|fallback)$/);
      renderer = await cinema(page).getAttribute('data-renderer');
      await page.waitForFunction(() => {
        const probe = (window as unknown as Window & { __cinemaStartup: CinemaStartupTrace }).__cinemaStartup;
        const start = probe.marks.rendered ?? probe.marks.enhanced;
        return start !== undefined && performance.now() - start >= 1_300;
      });
      await markCinemaStartup(page, 'observation-end');
      await markCinemaStartup(page, 'fonts-released');
      fonts.release();
      await page.evaluate(() => document.fonts.ready);
      await markCinemaStartup(page, 'fonts-ready');
      await page.waitForFunction(() => {
        const probe = (window as unknown as Window & { __cinemaStartup: CinemaStartupTrace }).__cinemaStartup;
        return (probe.frames.at(-1)?.time ?? 0) - probe.marks['fonts-ready']! >= 300;
      });
      trace = await readCinemaStartupTrace(page, true);
      await page.screenshot({ path: `${prefix}-after.png`, animations: 'allow' });
      if (browserName === 'chromium') expect(renderer, 'Chromium must exercise the GPU handoff, not silently pass as a static fallback').toBe('webgl');
      else if (renderer !== 'webgl') info.annotations.push({
        type: 'graphics capability',
        description: `WebKit verified native artwork, late assets and DOM stability; GPU unavailable: ${await cinema(page).getAttribute('data-cinema-graphics-issue') ?? 'no WebGL context'}`,
      });
      expectCinemaStartupStable(trace, renderer === 'webgl');
      expect(playerRequests).toEqual([]);
      expect(errors).toEqual([]);
    } finally {
      scripts.release(); images.release(); fonts.release();
      trace ??= await readCinemaStartupTrace(page, true).catch(() => undefined);
      await info.attach(`cold-homepage-${reducedMotion}`, { contentType: 'application/json',
        body: JSON.stringify({ viewport: page.viewportSize(), browserName, reducedMotion, renderer, intercepted, errors, playerRequests, trace }) });
    }
  });
}

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

test('direct inspection and a restored graphics context begin at the native artwork pose', async ({ page, browserName }, info) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await installCinemaStartupProbe(page);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?signal=Akali#inspect');
  await readyCinema(page);
  await expect(evidence(page)).toBeVisible();
  await expect(cinema(page)).toHaveAttribute('data-renderer', /^(webgl|fallback)$/);
  if (browserName === 'chromium') await expect(cinema(page)).toHaveAttribute('data-renderer', 'webgl');
  if (await cinema(page).getAttribute('data-renderer') !== 'webgl') {
    info.annotations.push({ type: 'graphics capability', description: 'This browser used the native inspection fallback; GPU recovery is covered by Chromium.' });
    return;
  }
  const nativeBox = async () => page.locator('[data-cinema-poster]').evaluate(element => {
    const box = element.getBoundingClientRect();
    return [box.x, box.y, box.width, box.height];
  });
  const matchesNative = (draw: CinemaStartupTrace['draws'][number], expected: number[]) => {
    const projected = projectCinemaForeground(draw);
    for (let axis = 0; axis < 4; axis++) expect(Math.abs(projected[axis]! - expected[axis]!), `First GPU draw agrees with the native artwork on axis ${axis}`).toBeLessThanOrEqual(1);
  };
  const initial = await readCinemaStartupTrace(page);
  expect(initial.draws.length).toBeGreaterThan(0);
  matchesNative(initial.draws[0]!, await nativeBox());

  await closeEvidence(page);
  await cinema(page).dispatchEvent('pointermove', { pointerType: 'mouse', pointerId: 1, isPrimary: true, clientX: page.viewportSize()!.width * .85, clientY: page.viewportSize()!.height * .25 });
  await expect.poll(async () => (await readCinemaStartupTrace(page)).draws.at(-1)?.uniforms.u_pointer?.[0] ?? 0).toBeGreaterThan(.05);
  const canInterrupt = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('[data-cinema-canvas]')!;
    const extension = canvas.getContext('webgl')?.getExtension('WEBGL_lose_context');
    (window as Window & { __cinemaLoss?: WEBGL_lose_context }).__cinemaLoss = extension ?? undefined;
    if (extension) extension.loseContext();
    return Boolean(extension);
  });
  if (browserName === 'chromium') expect(canInterrupt, 'Chromium must exercise a real context loss and restoration').toBe(true);
  if (!canInterrupt) {
    info.annotations.push({ type: 'graphics capability', description: 'Direct inspection pose checked; WEBGL_lose_context is unavailable in this browser.' });
    return;
  }
  await expect(cinema(page)).toHaveAttribute('data-renderer', 'fallback');
  const fallback = await nativeBox();
  await markCinemaStartup(page, 'restore-requested');
  await page.evaluate(() => (window as Window & { __cinemaLoss?: WEBGL_lose_context }).__cinemaLoss!.restoreContext());
  await expect(cinema(page)).toHaveAttribute('data-renderer', 'webgl');
  const restored = await readCinemaStartupTrace(page, true);
  const firstRestored = restored.draws.find(draw => draw.time > restored.marks['restore-requested']!);
  expect(firstRestored).toBeDefined();
  matchesNative(firstRestored!, fallback);
  expect(errors).toEqual([]);
  await info.attach('inspection-and-graphics-recovery', { contentType: 'application/json', body: JSON.stringify({ viewport: page.viewportSize(), fallback, trace: restored }) });
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
