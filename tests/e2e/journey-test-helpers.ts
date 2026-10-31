import { expect, type Locator, type Page } from '@playwright/test';
import type { HomeSignal } from '../../src/lib/home-signals';

export type OpeningSignal = HomeSignal & { record: { id: string }; explore: string };

export async function readyWorld(page: Page) {
  await expect(page.locator('body')).toHaveAttribute('data-journey-ready', 'true');
  await expect(page.locator('[data-journey-deck]')).toHaveCount(1);
  await expect(page.locator('astro-island[client="load"][ssr]')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
}

export async function readyJourney(page: Page) {
  await readyWorld(page);
  await expect(page.locator('[data-voyage]')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('[data-voyage]')).toHaveAttribute('data-loading', 'false');
}

export async function readySignal(page: Page) {
  await readyWorld(page);
  await expect(page.locator('[data-home-signals]')).toHaveAttribute('data-home-subject', /^[A-Za-z0-9]+$/);
  await expect(page.locator('[data-journey-tab]')).toHaveCount(4);
  // Signal cases take the explicit branch; the atlas entrance has its own suite.
  if (await page.locator('#atlas').isVisible()) await page.locator('.atlas-follow-signal').click();
  await expect(page.locator('#signal-title')).toContainText('stands still.');
}

/** Read the build-time examples so assertions follow archive updates. */
export async function homeSignals(page: Page): Promise<OpeningSignal[]> {
  return JSON.parse(await page.locator('#home-signals-data').textContent() ?? '[]') as OpeningSignal[];
}

export async function reachableTarget(control: Locator, page: Page) {
  await unobstructed(control);
  const box = (await control.boundingBox())!;
  const viewport = page.viewportSize()!;
  // WebKit can report a CSS 44px target as 43.999969px after layout.
  expect(box.height).toBeGreaterThanOrEqual(43.99);
  expect(box.width).toBeGreaterThanOrEqual(43.99);
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y).toBeGreaterThanOrEqual(-1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
}

export async function openScene(page: Page, id: string) {
  const panel = page.locator(`[data-journey-panel][id="${id}"]`);
  const tab = page.locator(`[data-journey-tab="${id}"]`);
  await expect(page.locator('body')).toHaveAttribute('data-journey-ready', 'true');
  // React can paint a panel before the controller registers its scene tab.
  await expect(tab).toHaveAttribute('aria-selected', /^(true|false)$/);
  if (await tab.getAttribute('aria-selected') !== 'true') await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await expect(panel).toBeVisible();
  await expect(page.locator('[data-journey-panel]:visible')).toHaveCount(1);
  return panel;
}

export async function unobstructed(control: Locator) {
  await control.scrollIntoViewIfNeeded();
  await expect(control).toBeInViewport({ ratio: 0.99 });
  await expect.poll(() => control.evaluate(element => {
    const box = element.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return hit === element || Boolean(hit && element.contains(hit));
  })).toBe(true);
}

export async function stationaryWorld(page: Page) {
  // Navigation remains an animated journey, but only the document may scroll
  // vertically. A nested scroll panel would trap mouse wheel, touch or focus.
  // A scene's finite arrival transform can briefly extend beyond the viewport.
  // Wait for its final layout, keeping the overflow assertion itself unchanged.
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  const report = await page.evaluate(() => ({
    nested: [...document.querySelectorAll('main *')]
      .filter(element => /^(auto|scroll)$/.test(getComputedStyle(element).overflowY)
        && element.scrollHeight > element.clientHeight + 3)
      .map(element => element.tagName.toLowerCase() + '.' + String(element.className).slice(0, 60)),
  }));
  expect(report.nested).toEqual([]);
}
