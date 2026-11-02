import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { cinema, cinemaSignals, chooseSignal, closeEvidence, inspectCinema, readyCinema } from '../e2e/cinema-test-helpers';

// A visual review artifact, deliberately recorded with motion enabled. This
// shows the initial world, selection, and evidence before a broad regression
// run; it does not preserve the retired chapter layout.
for (const viewport of [{ width: 1440, height: 900, name: 'desktop' }, { width: 390, height: 844, name: 'mobile' }]) {
  test(`cinema preview: ${viewport.name} world, selection and inspection`, async ({ browser, baseURL }, info) => {
    // Software-rendered WebGL and full-size recording can outlast the normal
    // action-test budget; readiness and individual actions remain bounded.
    test.setTimeout(90_000);
    const size = { width: viewport.width, height: viewport.height };
    const context = await browser.newContext({
      baseURL, viewport: size, reducedMotion: 'no-preference',
      hasTouch: viewport.name === 'mobile', isMobile: viewport.name === 'mobile',
      recordVideo: { dir: info.outputPath('video'), size },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    const video = page.video();
    const diagnostics: { pageErrors: string[]; console: string[]; states: unknown[] } = { pageErrors: [], console: [], states: [] };
    page.on('pageerror', error => diagnostics.pageErrors.push(error.message));
    page.on('console', message => { if (['error', 'warning'].includes(message.type())) diagnostics.console.push(message.text()); });
    try {
      await page.goto('/'); await readyCinema(page);
      await expect(cinema(page)).toHaveAttribute('data-renderer', /^(webgl|fallback)$/, { timeout: 20_000 });
      const start = Date.now();
      await mkdir('player-visuals', { recursive: true });
      const capture = async (state: string) => {
        const name = `cinema-${viewport.name}-${state}`;
        diagnostics.states.push(await cinema(page).evaluate((element, state) => ({
          state, attributes: { ...(element as HTMLElement).dataset }, viewport: { width: innerWidth, height: innerHeight },
          geometry: ['#main', '.rift-site-shell', '[data-rift-cinema]', '.cinema-opening', '.cinema-primary'].map(selector => {
            const node = document.querySelector(selector)!, box = node.getBoundingClientRect(), style = getComputedStyle(node);
            return { selector, x: box.x, y: box.y, width: box.width, height: box.height, padding: style.padding, transform: style.transform };
          }),
        }), state));
        const frame = await page.screenshot({ path: `player-visuals/${name}.png` });
        await info.attach(name, { body: frame, contentType: 'image/png' });
      };
      // Brief waits sample presentation for review, not app readiness.
      await page.waitForTimeout(900); await capture('initial');
      const signals = await cinemaSignals(page); expect(signals.length).toBeGreaterThan(1);
      await chooseSignal(page, signals[1]!);
      await page.waitForTimeout(250); await capture('in-motion');
      await page.waitForTimeout(900); await capture('selected');
      await inspectCinema(page); await page.waitForTimeout(350); await capture('inspect');
      await closeEvidence(page);
      await expect(cinema(page)).toHaveAttribute('data-home-subject', signals[1]!.championId);
      if (signals[2]) {
        await chooseSignal(page, signals[2]); await page.waitForTimeout(1300);
        await capture('thresh');
        if (viewport.name === 'desktop') {
          await page.mouse.move(size.width * .25, size.height * .3, { steps: 20 });
          await page.waitForTimeout(700);
          await page.mouse.move(size.width * .8, size.height * .5, { steps: 30 });
          await page.waitForTimeout(700);
        }
        await inspectCinema(page); await page.waitForTimeout(1000); await capture('thresh-inspect');
        await closeEvidence(page);
      }
      await page.waitForTimeout(Math.max(0, 13_000 - (Date.now() - start)));
    } finally {
      await info.attach(`cinema-${viewport.name}-diagnostics`, { body: JSON.stringify(diagnostics, null, 2), contentType: 'application/json' });
      console.log(`Cinema ${viewport.name} diagnostics: ${JSON.stringify(diagnostics)}`);
      // The runner may already have disposed a timed-out context. Cleanup must
      // not replace the actual action failure with a second disposal error.
      await context.close().catch(() => {});
      if (video) await info.attach(`cinema-${viewport.name}-motion`, { path: await video.path(), contentType: 'video/webm' });
    }
  });
}
