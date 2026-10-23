import { test, expect } from '@playwright/test';

test('observatory connects champion selection, comparison and archive', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.world-stage')).toHaveAttribute('data-ready', 'true', { timeout: 20000 });
  await page.getByRole('button', { name: 'Enter the observatory' }).click();
  await expect(page.getByRole('heading', { name: 'Your champions. Your constellation.' })).toBeVisible({ timeout: 10000 });
  const recordToggle = page.getByRole('button', { name: /Tap to explore the record/ });
  if (await recordToggle.isVisible()) await recordToggle.click();
  await page.getByRole('button', { name: '+ Add to constellation' }).click();
  await expect(page.getByRole('button', { name: '− Remove from constellation' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Inspect the change' }).click();
  await expect(page.getByRole('heading', { name: 'A small shift. A different game.' })).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Chapter 4: The archive' }).click();
  const archiveToggle = page.getByRole('button', { name: /Tap to explore the record/ });
  if (await archiveToggle.isVisible()) await archiveToggle.click();
  await expect(page.getByRole('link', { name: 'Open this record' })).toHaveAttribute('href', /\/patch\//);
  await page.getByRole('button', { name: 'Chapter 5: A new perspective' }).click();
  await expect(page.getByText('Your constellation:', { exact: false })).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Replay journey' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Nothing stays.');
});

test('reduced motion keeps useful controls with immediate scene poses', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.world-stage')).toHaveAttribute('data-ready', 'true', { timeout: 20000 });
  await expect(page.getByRole('button', { name: 'Play journey', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Chapter 4: The archive' }).click();
  const archiveToggle = page.getByRole('button', { name: /Tap to explore the record/ });
  if (await archiveToggle.isVisible()) await archiveToggle.click();
  await expect(page.getByRole('link', { name: 'Open this record' })).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.world-stage')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(page.locator('.observatory')).toHaveAttribute('data-phase', 'ready');
});
