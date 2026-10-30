import { test, expect } from '@playwright/test';
import { readyWorld, stationaryWorld, unobstructed } from './journey-test-helpers';
import patch from '../../src/data/patches/26.16.json' with { type: 'json' };

for (const width of [320, 390, 916]) {
  test(`search fits and closes by touch at ${width}px`, async ({page}, testInfo) => {
    await page.setViewportSize({width, height:640});
    await page.goto('/patch/26.16', { waitUntil: 'domcontentloaded' });
    await readyWorld(page);
    await page.waitForSelector('.filter-bar[data-ready="true"]');
    const opener = page.locator('.journey-header [data-palette-trigger]');
    await unobstructed(opener);
    await opener.click();
    const dialog = page.locator('.palette');
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x+box!.width).toBeLessThanOrEqual(width);
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth+1)).toBe(true);
    await page.screenshot({path:testInfo.outputPath(`search-${width}.png`)});
    const close = page.getByRole('button',{name:'Close search',exact:true});
    await unobstructed(close);
    await close.click();
    await expect(dialog).not.toBeVisible();
    await expect(opener).toBeFocused();
    await stationaryWorld(page);
  });
}

test('shared empty pool filter can be disabled and all filters cleared', async ({page}) => {
  await page.goto('/patch/26.16?pool=1', { waitUntil: 'domcontentloaded' });
  await readyWorld(page);
  await page.waitForSelector('.filter-bar[data-ready="true"]');
  await expect(page.getByText('No champions saved on this device.',{exact:false})).toBeVisible();
  const options = page.locator('.patch-filter-options');
  await options.locator('summary').click();
  const pool = page.getByRole('button',{name:'My pool',exact:true});
  await expect(pool).toBeEnabled();
  await expect(pool).toHaveAttribute('aria-pressed', 'true');
  await pool.click();
  await expect(pool).toHaveAttribute('aria-pressed', 'false');
  await options.locator('summary').click();
  await expect(page.locator('[data-filter-empty]')).toBeHidden();
  await page.getByRole('searchbox',{name:'Filter champions by name'}).fill('no-such-champion');
  await expect(page.locator('[data-filter-empty]')).toBeVisible();
  await page.getByRole('button',{name:'Clear filters',exact:true}).click();
  await expect(page.locator('[data-filter-empty]')).toBeHidden();
  await expect(page.getByRole('searchbox',{name:'Filter champions by name'})).toHaveValue('');
  await expect(page).not.toHaveURL(/pool=|q=/);
  await expect.poll(() => page.locator('.change-card[data-champion-id]:not([data-filtered])').evaluateAll(cards =>
    cards.map(card => card.getAttribute('data-champion-id')).sort(),
  )).toEqual(patch.champions.map(champion => champion.championId.toLowerCase()).sort());
  await stationaryWorld(page);
});
