import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { readyCinema } from './cinema-test-helpers';

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`guest startup and search remain light at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      const metrics = { lcp: 0, cls: 0, longTasks: 0, longestTask: 0 };
      (window as any).__auditMetrics = metrics;
      new PerformanceObserver(list => list.getEntries().forEach(entry => { metrics.lcp = entry.startTime; })).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver(list => list.getEntries().forEach((entry: any) => { if (!entry.hadRecentInput) metrics.cls += entry.value; })).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver(list => list.getEntries().forEach(entry => { metrics.longTasks++; metrics.longestTask = Math.max(metrics.longestTask, entry.duration); })).observe({ type: 'longtask', buffered: true });
    });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await readyCinema(page);
    await expect(page.locator('[data-search-host]')).toHaveAttribute('data-search-ready', 'true');
    await expect(page.locator('[data-cinema-poster]')).toHaveJSProperty('complete', true);
    const idle = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      return { ...(window as any).__auditMetrics,
        scripts: resources.filter(entry => /\.js(?:\?|$)/.test(entry.name)).map(entry => ({ url: new URL(entry.name).pathname, bytes: entry.encodedBodySize })),
        fonts: resources.filter(entry => /\.(woff2|ttf)(?:\?|$)/.test(entry.name)).map(entry => new URL(entry.name).pathname),
        indexLoaded: resources.some(entry => entry.name.endsWith('/search-index.json')),
      };
    });
    await mkdir('performance-results', { recursive: true });
    await writeFile(`performance-results/browser-${viewport.width}.json`, JSON.stringify({ viewport, method: 'Cold local production build in CI Chromium; no CPU/network throttling, timings are lab observations, not field Web Vitals.', idle }, null, 2));
    expect(idle.indexLoaded).toBe(false);
    // Player URL helpers also produce a small client.* chunk. Match the React
    // runtime, not that ambiguous basename; the byte budget catches SDK costs.
    expect(idle.scripts.some((entry: { url: string }) => /palette-mount|PaletteDialog|\/react\./.test(entry.url))).toBe(false);
    expect(idle.scripts.reduce((total: number, entry: { bytes: number }) => total + entry.bytes, 0)).toBeLessThan(55_000);
    expect(idle.fonts.some((font: string) => /ClashDisplay|\.ttf/.test(font))).toBe(false);
    expect(idle.cls).toBeLessThan(0.1);
    await page.keyboard.press('Control+k');
    const input = page.locator('[cmdk-input]');
    await expect(input).toBeFocused();
    await expect(page.locator('[cmdk-item]').first()).toBeVisible();
    expect(await page.locator('[cmdk-item]').count()).toBeLessThanOrEqual(48);
    await input.fill('Zyra'); // Beyond the initial result window.
    await expect(page.locator('[cmdk-item]').filter({ has: page.getByText('Zyra', { exact: true }) })).toBeVisible();
    await input.fill('Camille');
    await input.press('Enter');
    await expect(page).toHaveURL(/\/champion\/camille/);
    expect(errors).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`champion-${viewport.width}.png`) });
  });
}

test('slow search startup gives feedback and Escape cancels it without a late popup', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/palette-mount*.js', async route => { await gate; await route.continue(); });
  await page.goto('/');
  await readyCinema(page);
  await page.keyboard.press('Control+k');
  await expect(page.locator('[data-search-feedback]')).toBeVisible();
  await expect(page.locator('[data-search-feedback]')).toContainText('Opening search');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-search-feedback]')).toBeHidden();
  release();
  await page.keyboard.press('Control+k');
  await expect(page.locator('[cmdk-input]')).toBeFocused();
  expect(await page.locator('[cmdk-dialog]').count()).toBe(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('[cmdk-dialog]')).toBeHidden();
});

test('decorative scene animation performs no per-frame DOM geometry reads', async ({ page }) => {
  await page.goto('/champions');
  await expect(page.locator('[data-rift-scene]')).toHaveAttribute('data-rift-ready', 'true');
  const result = await page.evaluate(async () => {
    const object = document.querySelector<HTMLElement>('[data-rift-scene-object]')!;
    const original = object.getBoundingClientRect.bind(object);
    let reads = 0;
    object.getBoundingClientRect = () => { reads++; return original(); };
    await new Promise<void>(resolve => {
      let frames = 0;
      function tick() { if (++frames >= 30) resolve(); else requestAnimationFrame(tick); }
      requestAnimationFrame(tick);
    });
    object.getBoundingClientRect = original;
    return { reads, renderer: document.querySelector<HTMLElement>('[data-rift-scene]')!.dataset.riftRenderer };
  });
  expect(result.reads).toBeLessThanOrEqual(2); // Initial observer delivery can measure once.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('[data-rift-scene]')).toHaveAttribute('data-rift-paused', 'true');
  await expect(page.locator('[data-rift-scene-canvas]')).toBeHidden();
});
