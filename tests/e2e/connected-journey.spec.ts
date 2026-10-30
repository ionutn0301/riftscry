import { test, expect } from '@playwright/test';

test('kept records survive champion and interval changes and support removal/restoration', async ({ page }) => {
  await page.goto('/explore?champion=Belveth&older=26.14&newer=26.16#change');
  await expect(page.locator('[data-voyage]')).toHaveAttribute('data-loading', 'false');
  await page.locator('[data-focus-record]').click();
  await expect(page.locator('[data-findings-status]')).toContainText('saved on this device');
  await page.locator('.quick-perspectives [data-choose-champion="Ahri"]').click();
  await expect(page.locator('[data-champion-name]')).toHaveText('Ahri');
  await page.getByRole('tab', {name:'Through time',exact:true}).click();
  await page.locator('[data-period-older]').selectOption('26.15');
  await page.goto('/pool#briefing');
  await page.getByRole('tab', { name: 'Findings', exact: true }).click();
  const collection = page.getByRole('region', { name: 'Kept findings' });
  await expect(collection).toContainText("Bel'Veth");
  await collection.getByRole('button', { name: /Remove Bel/ }).click();
  await expect(collection).toContainText('No findings kept yet');
  await collection.getByRole('button', { name: 'Restore last removed finding' }).click();
  await expect(collection).toContainText("Bel'Veth");
});

for (const pool of [[], ['Alistar']]) test(`patch hydration with ${pool.length ? 'populated' : 'empty'} storage`, async ({ page }) => {
  await page.addInitScript((ids) => localStorage.setItem('riftscry:pool', JSON.stringify(ids)), pool);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/patch/26.16?pool=1');
  await expect(page.locator('astro-island[component-url*="PoolStrip"]')).not.toHaveAttribute('ssr', '');
  if (pool.length) await expect(page.locator('.pool-strip')).toContainText('Alistar');
  expect(errors).toEqual([]);
});

test('champion history saves directly and reaches the briefing', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/champion/ahri');
  const save = page.locator('[data-direct-save="Ahri"]');
  await save.click();
  await expect(save).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('navigation', {name:'Journey destinations',exact:true}).getByRole('link',{name:'Saved',exact:true}).click();
  await expect(page).toHaveURL(/\/pool#briefing$/);
  await page.getByRole('tab',{name:'Choose champions',exact:true}).click();
  const picker = page.locator('astro-island:has(.pool-picker)');
  const ahri = page.getByRole('option', { name: 'Ahri', exact: true });
  const count = page.locator('.pool-bar .count');
  await expect(picker).not.toHaveAttribute('ssr', '');
  await expect(ahri).toHaveAttribute('aria-selected', 'true');
  await expect(count).toHaveText('1 champion in your pool');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('riftscry:pool') ?? '[]'))).toContain('Ahri');

  await ahri.click();
  await expect(ahri).toHaveAttribute('aria-selected', 'false');
  await expect(count).toHaveText('0 champions in your pool');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('riftscry:pool') ?? '[]'))).not.toContain('Ahri');

  await ahri.click();
  await expect(count).toHaveText('1 champion in your pool');
  await page.reload();
  await expect(picker).not.toHaveAttribute('ssr', '');
  await expect(ahri).toHaveAttribute('aria-selected', 'true');
  await expect(count).toHaveText('1 champion in your pool');
  expect(errors).toEqual([]);
});

test('quiet historical branch preserves original interval', async ({ page }) => {
  await page.goto('/explore?champion=Ahri&older=26.15&newer=26.16#change');
  await expect(page.locator('[data-voyage]')).toHaveAttribute('data-loading', 'false');
  const recovery = page.locator('[data-historical-recovery]');
  await expect(recovery).toBeVisible();
  await expect(recovery).toContainText('Open latest archived change');
  await expect(page.locator('[data-period-older]')).toHaveValue('26.15');
  await expect(page.locator('[data-period-newer]')).toHaveValue('26.16');
});

for (const [width, height] of [[390,844],[360,800],[320,800],[844,390],[1363,936]]) test(`readable comparison at ${width} × ${height}`, async ({ page }) => {
  await page.setViewportSize({ width: width!, height: height! });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/compare/26.16/26.14?champions=Belveth');
  await expect(page.locator('[data-compare-context]')).toContainText('selected perspective');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.locator('.compare-picker select').first().focus();
  await expect(page.locator('.compare-picker select').first()).toBeFocused();
});
