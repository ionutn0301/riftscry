import { expect, test } from '@playwright/test';

test('cancelling native document transitions preserves links and browser Back without page errors', async ({ page, browserName }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const errors: { name: string; message: string; stack?: string }[] = [];
  page.on('pageerror', error => errors.push({ name: error.name, message: error.message, stack: error.stack }));

  // Cancel real native objects without reading or handling their promises. The
  // incoming cancellation is queued from the actual pagereveal event. Outgoing
  // registration waits for the application's classic head script to register.
  await page.addInitScript(`
    (() => {
      const key = 'riftscry:test:native-transition-cancellation';
      const read = () => JSON.parse(sessionStorage.getItem(key) || '{"pageswaps":0,"pagereveals":0,"incomingCancelled":0,"outgoingCancelled":0}');
      const save = (counts) => sessionStorage.setItem(key, JSON.stringify(counts));
      addEventListener('pagereveal', (event) => {
        if (!event.isTrusted) return;
        const counts = read();
        counts.pagereveals += 1;
        save(counts);
        const transition = event.viewTransition;
        if (transition) queueMicrotask(() => {
          const updated = read();
          updated.incomingCancelled += 1;
          save(updated);
          transition.skipTransition();
        });
      });
      addEventListener('DOMContentLoaded', () => {
        addEventListener('pageswap', (event) => {
          if (!event.isTrusted) return;
          const counts = read();
          counts.pageswaps += 1;
          const transition = event.viewTransition;
          // Let the first navigation create its incoming object. On Back,
          // exercise cancellation of the separate outgoing object instead.
          const cancel = transition && counts.pageswaps > 1;
          if (cancel) counts.outgoingCancelled += 1;
          save(counts);
          if (cancel) transition.skipTransition();
        });
      }, { once: true });
    })();
  `);

  await page.goto('/champion/ahri', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
  await expect(page.locator('body')).toHaveAttribute('data-surface', 'champion');
  const capability = await page.evaluate(() => ({
    pageswap: 'onpageswap' in window,
    transitions: 'onpageswap' in window && 'onpagereveal' in window && 'ViewTransition' in window,
  }));

  const save = page.locator('[data-direct-save="Ahri"]');
  await save.click();
  await expect(save).toHaveAttribute('aria-pressed', 'true');
  const briefingLink = page.locator('.reader-next-actions a[href="/pool#briefing"]').first();
  await briefingLink.click();
  await expect(page).toHaveURL(url => url.pathname === '/pool' && url.hash === '#briefing');
  await expect(page.locator('body')).toHaveAttribute('data-surface', 'pool');
  await expect(page.locator('astro-island:has(.pool-picker)')).not.toHaveAttribute('ssr', '');
  await expect(page.getByRole('option', { name: 'Ahri', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.pool-bar .count')).toHaveText('1 champion in your pool');

  await page.goBack({ waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(url => url.pathname === '/champion/ahri');
  await expect(page.locator('body')).toHaveAttribute('data-surface', 'champion');
  await expect(save).toHaveAttribute('aria-pressed', 'true');
  await expect(briefingLink).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('riftscry:pool') ?? '[]'))).toContain('Ahri');
  // Let the restored document complete a rendering opportunity, including any
  // queued rejection from the outgoing document. No fixed delay is required.
  await page.evaluate(() => new Promise<void>(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));

  const counts = await page.evaluate(() => JSON.parse(
    sessionStorage.getItem('riftscry:test:native-transition-cancellation') || '{"pageswaps":0,"pagereveals":0,"incomingCancelled":0,"outgoingCancelled":0}',
  ) as { pageswaps: number; pagereveals: number; incomingCancelled: number; outgoingCancelled: number });
  await testInfo.attach('native-transition-cancellation', {
    body: JSON.stringify({ browserName, capability, counts, errors }), contentType: 'application/json',
  });
  // These Chromium projects must exercise native cancellation, so removing the
  // application's CSS opt-in cannot silently turn this into fallback coverage.
  // WebKit can expose the properties without dispatching either event here.
  if (browserName === 'chromium' || counts.pageswaps > 0) {
    expect(counts.pageswaps).toBeGreaterThanOrEqual(2);
    expect(counts.incomingCancelled).toBeGreaterThanOrEqual(1);
    expect(counts.outgoingCancelled).toBeGreaterThanOrEqual(1);
  } else testInfo.annotations.push({
    type: 'browser capability',
    description: `Native transition events inactive in ${browserName}; ordinary links, browser Back, and no page errors were still verified.`,
  });
  expect(errors).toEqual([]);
});
