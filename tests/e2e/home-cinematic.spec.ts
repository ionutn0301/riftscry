import { test, expect } from '@playwright/test';

test('observatory connects champion selection, comparison and archive', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Enter the observatory' }).click();
  await expect(page.getByRole('heading', { name: 'Your champions. Your constellation.' })).toBeVisible();
  await page.getByRole('button', { name: '+ Add to constellation' }).click();
  await expect(page.getByRole('button', { name: '− Remove from constellation' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Inspect the change' }).click();
  await expect(page.getByRole('heading', { name: 'A small shift. A different game.' })).toBeVisible();
  await page.getByRole('button', { name: 'Chapter 4: The archive' }).click();
  await expect(page.getByRole('link', { name: 'Open this record' })).toHaveAttribute('href', /\/patch\//);
  await page.getByRole('button', { name: 'Chapter 5: A new perspective' }).click();
  await expect(page.getByText('Your constellation:', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Replay journey' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Nothing stays.');
});

test('reduced motion keeps useful chapter controls without canvas', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Play journey', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Chapter 4: The archive' }).click();
  await expect(page.getByRole('link', { name: 'Open this record' })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
});
