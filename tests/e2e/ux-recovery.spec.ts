import { test, expect } from '@playwright/test';

for (const width of [320, 390, 916]) {
  test(`search fits and closes by touch at ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height:640});
    await page.goto('/patch/26.16');
    await page.waitForSelector('.filter-bar[data-ready="true"]');
    await page.locator('[data-palette-trigger]').first().click();
    const dialog = page.locator('.palette');
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x+box!.width).toBeLessThanOrEqual(width);
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth+1)).toBe(true);
    await page.screenshot({path:`/tmp/agent-browser/search-fixed-${width}.png`});
    await page.getByRole('button',{name:'Close search',exact:true}).click();
    await expect(dialog).not.toBeVisible();
  });
}

test('shared empty pool filter can be disabled and all filters cleared', async ({page}) => {
  await page.goto('/patch/26.16?pool=1');
  await page.waitForSelector('.filter-bar[data-ready="true"]');
  await expect(page.getByText('No champions saved on this device.',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'My pool',exact:true}).click();
  await expect(page.locator('[data-filter-empty]')).toBeHidden();
  await page.getByRole('searchbox',{name:'Filter champions by name'}).fill('no-such-champion');
  await expect(page.locator('[data-filter-empty]')).toBeVisible();
  await page.getByRole('button',{name:'Clear filters',exact:true}).click();
  await expect(page.locator('[data-filter-empty]')).toBeHidden();
  await expect(page.getByRole('searchbox',{name:'Filter champions by name'})).toHaveValue('');
  await expect(page).not.toHaveURL(/pool=|q=/);
});
