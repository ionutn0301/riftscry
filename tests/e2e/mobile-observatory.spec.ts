import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 359, height: 603 } });

test('compact journey keeps navigation visible and records expandable', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.world-stage')).toHaveAttribute('data-ready', 'true', { timeout: 20000 });
  await page.getByRole('button', { name: /Enter the observatory/ }).click();
  await expect(page.getByRole('heading', { name: /Your constellation/ })).toBeVisible();
  const toggle = page.getByRole('button', { name: /Tap to explore the record/ });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('navigation', { name: 'Journey chapters' })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('.observatory').evaluate(el => el.clientHeight === innerHeight)).toBe(true);
  await toggle.click();
  await page.getByRole('button', { name: '+ Add to constellation', exact: true }).click();
  await expect(page.getByRole('button', { name: /Remove from constellation/ })).toBeVisible();
  await page.getByRole('button', { name: /Inspect the change/ }).click();
  await expect(page.locator('.observatory')).toHaveAttribute('data-chapter', '2', { timeout: 10000 });
  await expect(page.getByRole('button', { name: /Tap to explore the record/ })).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: /Tap to explore the record/ }).click();
  await expect(page.getByRole('slider', { name: 'Separate the lens' })).toBeVisible();
  await page.getByRole('button', { name: 'Chapter 5: A new perspective' }).click();
  await expect(page.getByRole('heading', { name: /Return to the Rift/ })).toBeVisible();
});
