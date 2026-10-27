import { test, expect } from '@playwright/test';

test('unavailable device storage leaves evidence readable', async ({page}) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', {get() { throw new DOMException('Blocked', 'SecurityError'); }}));
  await page.goto('/');
  await page.waitForSelector('[data-ready="true"]');
  await page.locator('#return').scrollIntoViewIfNeeded();
  await expect(page.getByText('Device storage is unavailable.', {exact:false})).toBeVisible();
  await expect(page.getByRole('button', {name:'Mark 26.16 reviewed'})).toBeDisabled();
  await page.locator('#change').scrollIntoViewIfNeeded();
  await expect(page.locator('#change')).toContainText('Health Growth');
});

for (const [width, height] of [[835,833],[1440,900],[1280,720],[390,844],[844,390]] as const) {
  test(`chapter layout at ${width} by ${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({width,height});
    await page.goto('/');
    await page.waitForSelector('[data-ready="true"]');
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({path:`/tmp/agent-browser/voyage-${testInfo.project.name}-${width}.png`});
    for (const id of ['perspective','change','history','return']) {
      await page.locator('#'+id).scrollIntoViewIfNeeded();
      await expect(page.locator('#'+id)).toBeVisible();
      await page.screenshot({path:`/tmp/agent-browser/voyage-${testInfo.project.name}-${width}-${id}.png`});
    }
  });
}
