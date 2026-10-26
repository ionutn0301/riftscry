import {test,expect} from '@playwright/test';
test.describe('keyboard-only story navigation',()=>{
  test.skip(({isMobile})=>isMobile,'desktop keyboard checks; mobile touch covered separately');
  test('skip link targets direct content',async({page})=>{await page.goto('/patch/26.16');await page.keyboard.press('Tab');await expect(page.locator('.skip-link')).toBeFocused();await page.keyboard.press('Enter');await expect(page).toHaveURL(/#main/);});
  test('champion, values and pool work without a pointer',async({page})=>{
    await page.goto('/');await expect(page.locator('astro-island:has(.rift-story)')).not.toHaveAttribute('ssr','');
    await page.getByRole('button',{name:'Choose Camille'}).focus();await page.keyboard.press('Enter');await expect(page.locator('#changes')).toContainText('Tactical Sweep');
    await page.getByRole('button',{name:'Before',exact:true}).focus();await page.keyboard.press('Space');await expect(page.locator('.rank-number')).toHaveText(['15','14','13','12','11']);
    await page.getByRole('button',{name:'Add to My Pool',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.locator('.saved-lineup')).toContainText('Camille');
  });
  test('global search remains available and escape dismisses it',async({page})=>{await page.goto('/champions');await page.waitForSelector('astro-island[component-url*="CommandPalette"]:not([ssr])',{state:'attached'});await page.keyboard.press('Control+k');await expect(page.locator('[cmdk-input]')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('[cmdk-input]')).toBeHidden();});
});
