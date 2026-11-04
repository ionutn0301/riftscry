import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

for (const width of [320, 390, 1440]) {
  test(`learning paths: catch-up, history, practice and notebook at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/catch-up');
    await page.getByLabel('My champion', { exact: true }).selectOption('Mel');
    await page.getByLabel('I last played on', { exact: true }).selectOption('26.21');
    await page.getByRole('button', { name: 'Show my catch-up' }).click();
    await expect(page.locator('#results-title')).toHaveText('Mel: since patch 26.21');
    await expect(page.getByRole('heading', { name: 'Patch 26.22', exact: true })).toBeVisible();
    await page.getByLabel('My champion', { exact: true }).selectOption('Lux');
    await page.getByRole('button', { name: 'Show my catch-up' }).click();
    await expect(page.locator('#results-title')).toHaveText('Lux: since patch 26.21');
    await page.goBack();
    await expect(page.getByLabel('My champion', { exact: true })).toHaveValue('Mel');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await mkdir('player-visuals', { recursive: true });
    await page.screenshot({ path: `player-visuals/learning-catch-up-${width}.png`, fullPage: true });
    await page.goto('/learn/lux');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Choose a safe follow-up.');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `player-visuals/learning-practice-${width}.png`, fullPage: true });
    await page.getByRole('link', { name: 'Write my takeaway', exact: false }).click();
    await expect(page).toHaveURL(/\/notebook\?champion=Lux#notes$/);
  });
}

test('learning paths: catch-up remains usable without JavaScript and rejects invalid URL selections', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${test.info().project.use.baseURL}/catch-up?champion=Missing&since=99.99`);
  await expect(page.locator('#results-title')).toHaveText('Choose a champion and an archived patch.');
  await page.getByLabel('My champion', { exact: true }).selectOption('Garen');
  await page.getByLabel('I last played on', { exact: true }).selectOption('before-archive');
  await page.getByRole('button', { name: 'Show my catch-up' }).click();
  await expect(page.locator('#results-title')).toHaveText('Garen: across this archive');
  await expect(page.getByText('This is a partial catch-up.', { exact: false })).toBeVisible();
  await context.close();
});
