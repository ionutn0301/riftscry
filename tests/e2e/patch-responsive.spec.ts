import { test, expect } from '@playwright/test';

for (const [width, height] of [[320,568],[359,603],[390,844],[700,800],[844,390],[1440,900]] as const) {
  test(`filtered champion deep link remains readable at ${width}x${height}`, async ({page}) => {
    await page.setViewportSize({width,height});
    await page.addInitScript(() => localStorage.setItem('riftscry:pool', JSON.stringify(['Belveth'])));
    await page.goto('/patch/26.16?pool=1#belveth');
    await page.waitForSelector('.filter-bar[data-ready="true"]');
    await expect(page.locator('[data-champion-id]:not([data-filtered])')).toHaveCount(1);
    await expect.poll(() => page.locator('#belveth').evaluate(el => Math.round(el.getBoundingClientRect().top))).toBeGreaterThanOrEqual(80);
    await expect.poll(() => page.locator('#belveth').evaluate(el => Math.round(el.getBoundingClientRect().top))).toBeLessThan(130);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('.filter-bar')).toHaveCSS('position','static');
    if(width <= 700) {
      const name = await page.locator('#belveth h3').boundingBox();
      const badge = await page.locator('#belveth > header > :last-child').boundingBox();
      expect(badge!.y).toBeGreaterThanOrEqual(name!.y + name!.height);
      const dock=await page.locator('.wayfinder-dock').boundingBox();
      expect(dock!.y+dock!.height).toBeLessThanOrEqual(72);
    }
    await page.screenshot({path:`/tmp/agent-browser/patch-fixed-${width}.png`});
    await page.getByRole('button',{name:'Open the Rift map',exact:true}).click();
    await expect(page.locator('#rift-map-dialog')).toBeVisible();
    await page.getByRole('button',{name:'Close the Rift map',exact:true}).click();
    await page.locator('.filter-bar').scrollIntoViewIfNeeded();
    await page.getByRole('button',{name:'My pool (1)',exact:true}).click();
    await page.getByRole('searchbox',{name:'Filter champions by name'}).fill('Bel');
    await expect(page.locator('[data-champion-id]:not([data-filtered])')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
