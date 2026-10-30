import { test, expect } from '@playwright/test';
import { openScene } from './profile-controls';
import { installFixtures, platform, puuid, query, recentAramWin, visualMatches } from './fixtures';

for (const viewport of [
  { width: 320, height: 568 },
  { width: 568, height: 320 },
  { width: 844, height: 390 },
]) {
  for (const returning of [false, true]) {
    test(`${viewport.width}×${viewport.height}: ${returning ? 'returning' : 'new'} player lookup stays reachable inside one scene`, async ({ page }) => {
      await page.setViewportSize(viewport);
      if (returning) await page.addInitScript(player => {
        localStorage.setItem('riftscry:remembered-player:v1', JSON.stringify(player));
      }, { platform, puuid, name: 'ABCDEFGHIJKLMNOP#ABCDE' });
      await page.goto('/players');
      await expect(page.locator('body')).toHaveAttribute('data-journey-ready', 'true');
      await expect(page.locator('astro-island[client="load"][ssr]')).toHaveCount(0);
      const gateway = page.locator('[data-player-gateway]');
      const form = page.getByRole('form', { name: 'Find a League of Legends player', exact: true });
      if (returning) {
        await expect(page.locator('.remembered-player')).toBeInViewport({ ratio: 1 });
        await page.locator('.gateway-lookup-scene > summary').click();
      }
      await expect(form.getByRole('button', { name: 'Find player', exact: true })).toBeEnabled();
      await page.evaluate(() => document.fonts.ready);
      expect(await gateway.evaluate(element => element.getBoundingClientRect().bottom)).toBeLessThanOrEqual(viewport.height + 1);
      // Optional destination choices must remain reachable when expanded too.
      await page.locator('.gateway-destinations > summary').click();
      const controls = gateway.locator('input:visible, select:visible, button:visible, summary:visible, .remembered-player:visible');
      for (const control of await controls.all()) {
        // A short landscape viewport can scroll the focused station; each actual
        // action still fits and the surrounding world never moves.
        await control.scrollIntoViewIfNeeded();
        await expect(control).toBeInViewport({ ratio: 1 });
        const geometry = await control.evaluate(element => {
          const box = element.getBoundingClientRect();
          return { left: box.left, right: box.right, height: box.height, overflow: element.scrollWidth - element.clientWidth };
        });
        expect(geometry.left).toBeGreaterThanOrEqual(0);
        expect(geometry.right).toBeLessThanOrEqual(viewport.width + 1);
        expect(geometry.height).toBeGreaterThanOrEqual(44);
        expect(geometry.overflow).toBeLessThanOrEqual(1);
      }
      await form.getByLabel('Riot ID', { exact: true }).click();
      await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    });
  }
}

test('desktop expanded purchase evidence scrolls within its scene', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const timeline = { info: { frames: [{ timestamp: 1_500_000, events: Array.from({ length: 24 }, (_, index) => ({
    type: 'ITEM_PURCHASED', timestamp: (index + 1) * 60_000, participantId: 1, itemId: 3047,
  })) }] } };
  await installFixtures(page, {
    matches: visualMatches,
    response: request => request.action === 'timeline' ? { status: 200, json: timeline } : undefined,
  });
  await page.goto(`/matches/${recentAramWin.metadata.matchId}?${query}`);
  await openScene(page, 'match-evidence');
  await page.getByRole('button', { name: 'Open timeline', exact: true }).click();
  await page.getByText('Recorded item and death events · 24', { exact: true }).click();
  const events = page.locator('.purchase-timeline');
  await expect(events.locator('li')).toHaveCount(24);
  const dimensions = await events.evaluate(element => ({ height: element.clientHeight, scrollHeight: element.scrollHeight }));
  expect(dimensions.height).toBeGreaterThan(560);
  expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.height + 1);
  await events.locator('li').first().scrollIntoViewIfNeeded();
  const box = await events.locator('li').first().boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  const before = await page.locator('#match-evidence').evaluate(element => element.scrollTop);
  await page.mouse.wheel(0, 250);
  await expect.poll(() => page.locator('#match-evidence').evaluate(element => element.scrollTop)).toBeGreaterThan(before);
  expect(await events.evaluate(element => element.scrollTop)).toBe(0);
  expect(await page.evaluate(() => scrollY)).toBe(0);
});
