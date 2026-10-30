import { expect, type Locator, type Page } from '@playwright/test';

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

export async function openScene(page: Page, id: string) {
  const panel = page.locator(`[data-journey-panel][id="${id}"]`);
  if (!await panel.isVisible()) await page.locator(`[data-journey-tab="${id}"]`).click();
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
  expect(await page.evaluate(() => scrollY)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}
