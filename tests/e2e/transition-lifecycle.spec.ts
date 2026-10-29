import { expect, test } from '@playwright/test';

test('cancelling native document transitions preserves links and browser Back without page errors', async ({ page, browserName }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));

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

  await page.goto('/patches', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
  await expect(page.locator('body')).toHaveAttribute('data-surface', 'patches');
  const capability = await page.evaluate(() => ({
    pageswap: 'onpageswap' in window,
    transitions: 'onpageswap' in window && 'onpagereveal' in window && 'ViewTransition' in window,
  }));

  const patchLink = page.locator('.route-arrival-actions a.route-action').first();
  const target = await patchLink.getAttribute('href');
  expect(target).toMatch(/^\/patch\/\d+\.\d+$/);
  await patchLink.click();
  await expect(page).toHaveURL(url => url.pathname === target);
  await expect(page.locator('body')).toHaveAttribute('data-surface', 'patch');
  await expect(page.getByRole('link', { name: /Riot's original notes/ }).first()).toBeVisible();

  await page.goBack({ waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(url => url.pathname === '/patches');
  await expect(page.locator('body')).toHaveAttribute('data-surface', 'patches');
  await expect(patchLink).toBeVisible();
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
