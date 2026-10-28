import { test, expect } from '@playwright/test';

test('unavailable device storage leaves evidence readable', async ({page}) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', {get() { throw new DOMException('Blocked', 'SecurityError'); }}));
  // Keep the evidence fixture explicit as the default homepage patch advances.
  await page.goto('/?champion=Belveth&older=26.15&newer=26.16');
  await expect(page.locator('[data-voyage]')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('[data-voyage]')).toHaveAttribute('data-loading', 'false');
  const latestArchive = page.locator('.arrival-archive a');
  await expect(latestArchive).toHaveAttribute('href', /^\/patch\/\d+\.\d+$/);
  const activePatch = (await latestArchive.getAttribute('href'))!.replace('/patch/', '');
  await page.locator('#return').scrollIntoViewIfNeeded();
  await expect(page.getByText('Device storage is unavailable.', {exact:false})).toBeVisible();
  const markReviewed = page.locator('#return').getByRole('button', {name:`Mark ${activePatch} reviewed`, exact:true});
  await expect(markReviewed).toBeVisible();
  await expect(markReviewed).toBeDisabled();
  await page.locator('#change').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-record-label]')).toHaveText('Health Growth');
  await expect(page.locator('[data-record-before]')).toHaveText('110');
  await expect(page.locator('[data-record-after]')).toHaveText('105');
  await expect(page.locator('[data-record-numeric]')).toBeVisible();
  await expect(page.locator('[data-record-patch]')).toHaveText('PATCH 26.16');
  await expect(page.locator('[data-record-source]')).toHaveAttribute('href', 'https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-16-notes/');
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
