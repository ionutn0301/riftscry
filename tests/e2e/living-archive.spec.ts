import { test, expect } from '@playwright/test';
const ready = async (page: import('@playwright/test').Page) => { await page.goto('/'); await expect(page.locator('astro-island:has(.rift-story)')).not.toHaveAttribute('ssr',''); };
test('native story, champion selection, full values, and pool reload persistence', async ({ page }) => {
  await ready(page);
  await expect(page.getByRole('slider')).toHaveCount(0);
  for(const id of ['battlefield','champions','changes','my-pool']) { await page.locator(`#${id}`).scrollIntoViewIfNeeded(); await expect(page.locator(`#${id}`)).toBeVisible(); }
  await page.getByRole('button',{name:'Choose Camille'}).scrollIntoViewIfNeeded();
  const scroll = await page.evaluate(()=>scrollY);
  await page.getByRole('button',{name:'Choose Camille'}).click();
  expect(Math.abs(await page.evaluate(()=>scrollY)-scroll)).toBeLessThan(5);
  await expect(page.locator('#changes')).toContainText('Tactical Sweep');
  await page.getByRole('button',{name:'Before',exact:true}).click();
  await expect(page.locator('.rank-number')).toHaveText(['15','14','13','12','11']);
  await page.getByRole('button',{name:'After',exact:true}).click();
  await expect(page.locator('.rank-number')).toHaveText(['12','11.5','11','10.5','10']);
  await page.getByRole('button',{name:'Add to My Pool',exact:true}).click();
  await expect(page.locator('.saved-lineup')).toContainText('Camille');
  await page.reload(); await expect(page.locator('.saved-lineup')).toContainText('Camille');
  await page.getByRole('button',{name:'Remove Camille from My Pool',exact:true}).click();
  await expect(page.locator('.empty-pool')).toBeVisible();
});
test('reduced motion and small portrait retain all scenes without overflow',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'}); await page.setViewportSize({width:359,height:603}); await ready(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  for(const id of ['battlefield','champions','changes','my-pool']) await expect(page.locator(`#${id}`)).toHaveCount(1);
  expect(await page.locator('.battlefield-foreground').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
  await page.getByRole('button',{name:'Choose Kennen'}).click();
  await expect(page.locator('#changes')).toContainText('Slicing Maelstrom');
  await expect(page.locator('.rank-number')).toHaveText(['25','50','75']);
});
test('utility routes open directly without Atlas takeover',async({page})=>{
  for(const path of ['/champions','/champion/azir','/patch/26.16','/compare/26.15/26.16','/pool']){
    await page.goto(path);await expect(page.locator('h1')).toBeVisible();await expect(page.locator('.rift-atlas')).toHaveCount(0);
  }
});
