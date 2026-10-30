import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Patch } from '../../src/lib/schema';
import { readyWorld } from './journey-test-helpers';

async function expectPatch(page: Page, patchId: string) {
  const patch = JSON.parse(readFileSync(new URL(`../../src/data/patches/${patchId}.json`, import.meta.url), 'utf8')) as Patch;
  const instrument = page.locator('[data-archive-instrument]');
  await expect(instrument).toHaveAttribute('data-reader-key', patch.id);
  await expect(instrument.locator('[data-archive-focus-id]')).toHaveText(patch.id);
  await expect(instrument.locator('[data-archive-focus-date]')).toHaveAttribute('datetime', patch.releaseDate);
  await expect(instrument.locator('[data-archive-scrubber]')).toHaveAttribute('aria-valuetext', new RegExp(`^Patch ${patch.id.replace('.', '\\.')}, `));
  await expect(instrument.locator('[data-reader-patch-bar][data-reader-active]')).toHaveAttribute('data-reader-patch-bar', patch.id);
  for (const category of ['champions', 'items', 'systems'] as const) {
    await expect(instrument.locator(`[data-archive-count="${category}"]`)).toHaveText(String(patch[category].length));
  }
  expect(new URL(await instrument.locator('[data-archive-focus-link]').getAttribute('href') ?? '', page.url()).pathname).toBe(`/patch/${patch.id}`);
  await expect(page).toHaveURL(/\/patches\/?$/);
}

test('the date instrument uses native keyboard steps and keeps archive-link focus in sync', async ({ page }) => {
  await page.goto('/patches');
  await readyWorld(page);
  const range = page.getByRole('slider', { name: 'Select an archived patch' });
  await expect(range).toBeVisible();
  await range.focus();
  await range.press('Home');
  await expectPatch(page, '26.1');
  await range.press('ArrowRight');
  await expectPatch(page, '26.2');
  await range.press('End');
  await expectPatch(page, '26.21');

  await page.locator('[data-reader-patch-key="26.16"] > a').focus();
  await expectPatch(page, '26.16');
  await range.focus();
  await range.press('ArrowLeft');
  await expectPatch(page, '26.15');
  await page.locator('[data-archive-focus-link]').click();
  await expect(page).toHaveURL(/\/patch\/26\.15\/?$/);
  await expect(page.locator('main h1')).toContainText('Patch 26.15');
});

test('touch or dragging the actual date chart changes the preview without navigating', async ({ page, isMobile }) => {
  await page.goto('/patches');
  await readyWorld(page);
  const range = page.getByRole('slider', { name: 'Select an archived patch' });
  await expect(range).toBeVisible();
  await range.scrollIntoViewIfNeeded();
  const bar = await page.locator('[data-reader-patch-bar="26.16"] rect').boundingBox();
  const chart = await range.boundingBox();
  expect(bar).not.toBeNull();
  expect(chart).not.toBeNull();
  const x = bar!.x + bar!.width / 2;
  const y = chart!.y + chart!.height / 2;
  if (isMobile) {
    await page.touchscreen.tap(x, y);
  } else {
    await page.mouse.move(chart!.x + 2, y);
    await page.mouse.down();
    await page.mouse.move(x, y, { steps: 8 });
    await page.mouse.up();
  }
  await expectPatch(page, '26.16');
  await expect(range).toBeFocused();
  await page.locator('[data-archive-focus-link]').click();
  await expect(page).toHaveURL(/\/patch\/26\.16\/?$/);
});
