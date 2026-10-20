import { test, expect } from '@playwright/test';
test.use({ contextOptions: { reducedMotion: 'reduce' } });
test('reduced motion exposes all chapters without camera motion', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('canvas')).toHaveCount(0);
  for (const name of ['Constellation', 'The fracture', 'The archive', 'A new perspective']) {
    await page.getByRole('button', { name: new RegExp(`Chapter \\d: ${name}`) }).click();
    await expect(page.locator('.film-story h2')).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Replay journey' })).toBeVisible();
});
