import { expect, test, type Locator } from '@playwright/test';
import { readyWorld } from './journey-test-helpers';

async function swipe(element: Locator, dx: number, dy = 0) {
  await element.evaluate((target, delta) => {
    const emit = (name: string, x: number, y: number, ended = false) => {
      const point = { identifier: 1, clientX: x, clientY: y, target };
      const event = new Event(name, { bubbles: true, cancelable: true });
      Object.defineProperties(event, { touches: { value: ended ? [] : [point] }, changedTouches: { value: [point] } });
      target.dispatchEvent(event);
    };
    emit('touchstart', 200, 300);
    emit('touchmove', 200 + delta.dx, 300 + delta.dy);
    emit('touchend', 200 + delta.dx, 300 + delta.dy, true);
  }, { dx, dy });
}

test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }); });

test('a long patch document scrolls before a fresh boundary gesture changes its chapter', async ({ page }) => {
  await page.goto('/patch/26.16#champions'); await readyWorld(page);
  const champions = page.locator('#champions[data-journey-panel]');
  await expect(champions).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeGreaterThan(100);
  await page.locator('.journey-result-caption').hover();
  const before = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 400);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before);
  await expect(champions).toBeVisible();

  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  // A fresh gesture follows the native reading gesture; inertia alone cannot advance.
  await page.waitForTimeout(300);
  await champions.dispatchEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true });
  const items = page.locator('#items[data-journey-panel]');
  await expect(items).toBeVisible(); await expect(page).toHaveURL(/#items$/);
  await items.dispatchEvent('wheel', { deltaY: 800, bubbles: true, cancelable: true });
  await items.dispatchEvent('wheel', { deltaY: 600, bubbles: true, cancelable: true });
  await expect(items).toBeVisible();
  await page.goBack(); await expect(champions).toBeVisible();
});

test('content swipes select adjacent chapters, stop at each end, and leave form controls alone', async ({ page }) => {
  await page.goto('/pool'); await readyWorld(page);
  const briefing = page.locator('#briefing[data-journey-panel]');
  const findings = page.locator('#findings[data-journey-panel]');
  const chooser = page.locator('#edit-pool[data-journey-panel]');
  await swipe(briefing, 120); await expect(briefing).toBeVisible();
  await swipe(briefing, -120); await expect(findings).toBeVisible();
  await expect(page.locator('[data-journey-tab="findings"]')).toHaveAttribute('aria-selected', 'true');
  await swipe(findings, -120); await expect(chooser).toBeVisible();
  await swipe(chooser, -120); await expect(chooser).toBeVisible();
  const input = chooser.locator('input').first();
  await input.focus(); await swipe(input, 120); await expect(chooser).toBeVisible();
  await input.blur(); await swipe(chooser, 120); await expect(findings).toBeVisible();
  await expect(page).toHaveURL(/#findings$/);
});

test('a remembered champion record is visibly labeled as continuing previous reading', async ({ page }) => {
  await page.goto('/champion/caitlyn'); await readyWorld(page);
  await page.goto('/'); await readyWorld(page);
  const reading = page.locator('[data-home-reading]');
  await expect(reading).toBeVisible();
  await expect(reading).toContainText('Resume Caitlyn Patch History');
  await expect(reading).toHaveAttribute('href', '/champion/caitlyn');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('riftscry:resume') ?? 'null'));
  expect(stored.label).toBe('Caitlyn Patch History'); expect(stored.href).toBe('/champion/caitlyn');
});
