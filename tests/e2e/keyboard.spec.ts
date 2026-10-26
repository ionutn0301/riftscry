import { test, expect } from '@playwright/test';
test.describe('keyboard-only Atlas navigation', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop keyboard test; portrait touch is tested separately');
  test('skip link targets the active content', async ({ page }) => {
    await page.goto('/patch/26.16'); await page.keyboard.press('Tab'); await expect(page.locator('.skip-link')).toBeFocused(); await page.keyboard.press('Enter'); await expect(page).toHaveURL(/#atlas-main/);
  });
  test('global search is adjacent to artwork and selects a champion with keyboard', async ({ page }) => {
    await page.goto('/'); await expect(page.locator('.rift-atlas')).toHaveAttribute('data-ready', 'true');
    await page.keyboard.press('Control+k'); const input = page.getByRole('searchbox', { name: 'Champion, patch, item, or system' }); await expect(input).toBeFocused(); await input.fill('Camille');
    await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
    await expect(page.locator('.atlas-reading h1')).toHaveText('Camille');
    await page.getByRole('button', { name: 'Add to pool', exact: true }).focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Remove from pool', exact: true })).toHaveAttribute('aria-pressed', 'true');
  });
  test('escape dismisses in-scene search', async ({ page }) => {
    await page.goto('/'); await expect(page.locator('.rift-atlas')).toHaveAttribute('data-ready', 'true'); await page.keyboard.press('Control+k'); await expect(page.locator('.atlas-global-search')).toBeVisible(); await page.keyboard.press('Escape'); await expect(page.locator('.atlas-global-search')).toHaveCount(0);
  });
});
