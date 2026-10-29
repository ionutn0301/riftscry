import { test, expect } from '@playwright/test';
import { installFixtures, platform, puuid, query, recentAramWin, visualMatches } from './fixtures';

for (const viewport of [
  { width: 320, height: 568 },
  { width: 568, height: 320 },
  { width: 844, height: 390 },
]) {
  for (const returning of [false, true]) {
    test(`${viewport.width}×${viewport.height}: ${returning ? 'returning' : 'new'} player lookup fits the first screen`, async ({ page }) => {
      await page.setViewportSize(viewport);
      if (returning) await page.addInitScript(player => {
        localStorage.setItem('riftscry:remembered-player:v1', JSON.stringify(player));
      }, { platform, puuid, name: 'ABCDEFGHIJKLMNOP#ABCDE' });
      await page.goto('/players');
      const form = page.getByRole('form', { name: 'Find a League of Legends player', exact: true });
      await expect(form.getByRole('button', { name: 'Find player', exact: true })).toBeEnabled();
      if (returning) await expect(page.locator('.remembered-player')).toBeVisible();
      await page.evaluate(() => document.fonts.ready);

      const geometry = await page.locator('[data-player-gateway]').evaluate(element => {
        const box = element.getBoundingClientRect();
        const controls = Array.from(element.querySelectorAll<HTMLElement>('input, select, button, summary, .remembered-player'));
        return {
          bottom: box.bottom, viewport: innerHeight, scroll: scrollY,
          controls: controls.map(control => {
            const rect = control.getBoundingClientRect();
            return { text: control.textContent?.slice(0, 40), left: rect.left, right: rect.right, bottom: rect.bottom, height: rect.height, overflow: control.scrollWidth - control.clientWidth };
          }),
        };
      });
      expect(geometry.bottom).toBeLessThanOrEqual(viewport.height + 1);
      expect(geometry.scroll).toBe(0);
      for (const control of geometry.controls) {
        expect(control.left, control.text).toBeGreaterThanOrEqual(0);
        expect(control.right, control.text).toBeLessThanOrEqual(viewport.width + 1);
        expect(control.bottom, control.text).toBeLessThanOrEqual(viewport.height + 1);
        expect(control.height, control.text).toBeGreaterThanOrEqual(44);
        expect(control.overflow, control.text).toBeLessThanOrEqual(1);
      }
      await form.getByLabel('Riot ID', { exact: true }).click();
      await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    });
  }
}

test('desktop expanded purchase evidence scrolls with the page', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const timeline = { info: { frames: [{ timestamp: 1_500_000, events: Array.from({ length: 24 }, (_, index) => ({
    type: 'ITEM_PURCHASED', timestamp: (index + 1) * 60_000, participantId: 1, itemId: 3047,
  })) }] } };
  await installFixtures(page, {
    matches: visualMatches,
    response: request => request.action === 'timeline' ? { status: 200, json: timeline } : undefined,
  });
  await page.goto(`/matches/${recentAramWin.metadata.matchId}?${query}`);
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
  const before = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 250);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before);
  expect(await events.evaluate(element => element.scrollTop)).toBe(0);
});
