import { test, expect } from '@playwright/test';
test('Atlas selection, actual records, comparison, Back and persisted pool', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('.rift-atlas')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Explore the Atlas', exact: true }).click();
  await page.getByRole('button', { name: 'Camille 2 recorded changes', exact: true }).click();
  await expect(page.locator('.atlas-reading h1')).toHaveText('Camille');
  await expect(page.locator('.atlas-records')).toContainText('Cooldown');
  await page.getByRole('button', { name: 'Champions', exact: true }).click();
  await page.getByRole('button', { name: 'Azir 4 recorded changes', exact: true }).click();
  await page.getByRole('button', { name: 'Compare changes', exact: true }).click();
  await expect(page.locator('.atlas-records')).toContainText('75 / 95 / 115 / 135 / 155');
  await page.getByRole('slider', { name: /First endpoint/ }).focus(); await page.keyboard.press('Home');
  await expect(page.locator('.atlas-records')).toContainText('Health Growth');
  await page.goBack(); await expect(page.getByRole('slider', { name: /First endpoint/ })).toHaveValue('12');
  await page.getByRole('button', { name: 'Add to pool', exact: true }).click();
  await page.reload(); await expect(page.getByRole('button', { name: 'Remove from pool', exact: true })).toHaveAttribute('aria-pressed', 'true');
});
test('portrait reduced-motion preserves the full state graph and readable controls', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/compare/26.14/26.16?champion=azir');
  await expect(page.locator('.rift-atlas')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('button', { name: 'Reduced motion', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('.atlas-records')).toContainText('Conquering Sands');
  await page.getByRole('button', { name: 'Search', exact: false }).click();
  await page.getByRole('searchbox', { name: 'Champion, patch, item, or system' }).fill('Camille');
  await page.getByRole('button', { name: 'Camille', exact: true }).click();
  await expect(page.locator('.atlas-reading h1')).toHaveText('Camille');
});
test('patch filter links and explicit Reader mode retain stored data', async ({ page }) => {
  await page.goto('/patch/26.16?type=buff'); await expect(page.locator('.rift-atlas')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('combobox', { name: 'Classification', exact: true })).toHaveValue('buff');
  await expect(page.locator('.atlas-patch-inspection .atlas-record-champion')).toHaveCount(3);
  await page.getByRole('link', { name: 'Reader view', exact: true }).click();
  await expect(page.locator('.reader-shell')).toBeVisible(); await expect(page.locator('.atlas-mount')).toBeHidden();
});
