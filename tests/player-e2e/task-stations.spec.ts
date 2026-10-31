import { expect, test, type Page } from '@playwright/test';
import { installFixtures, platform, profilePath, puuid, query, sourceMatch, matches } from './fixtures';

async function hydrated(page: Page) {
  await expect(page.locator('body')).toHaveAttribute('data-journey-ready', 'true');
  await expect(page.locator('astro-island[client="load"][ssr]')).toHaveCount(0);
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`${viewport.width}px notebook: keep one thought without a game setup, then resume it`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const requests = await installFixtures(page);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/notebook');
    await hydrated(page);
    await expect(page.locator('#notes')).toBeVisible();
    await expect(page.locator('#game-card')).toBeHidden();
    const opener = page.locator('#notes').getByRole('button', { name: 'New note', exact: true });
    await opener.click();
    const editor = page.locator('dialog.recall-editor');
    await expect(editor).toBeVisible();
    await expect(editor.getByLabel('Note text', { exact: true })).toBeFocused();
    await expect(editor.getByLabel('Applies to champion', { exact: true })).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(editor).toHaveCount(0);
    await expect(opener).toBeFocused();
    await opener.click();
    await editor.getByLabel('Note text', { exact: true }).fill('Hold the dash until their engage is used.');
    await editor.getByRole('button', { name: 'Save note', exact: true }).click();
    await expect(editor).toHaveCount(0);
    await expect(page.locator('#notes')).toBeVisible();
    await expect(page.locator('[data-recall-note]')).toBeFocused();
    await expect(page.locator('#notes')).toContainText('Hold the dash until their engage is used.');
    await page.reload();
    await hydrated(page);
    await expect(page.locator('#notes')).toContainText('Hold the dash until their engage is used.');
    await expect(page.locator('#game-card')).toBeHidden();
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
  });

  test(`${viewport.width}px gateway: an already selected player needs no new lookup or save`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const requests = await installFixtures(page);
    await page.addInitScript(({ platform, puuid }) => {
      localStorage.setItem('riftscry:recent-player:v1', JSON.stringify({ platform, puuid, name: 'FixturePlayer#EUNE' }));
    }, { platform, puuid });
    await page.goto('/players');
    await hydrated(page);
    const resume = page.locator('.remembered-player');
    await expect(resume).toContainText('FixturePlayer#EUNE');
    await expect(page.locator('.lookup-form')).toBeHidden();
    await resume.click();
    await expect(page).toHaveURL(new RegExp(profilePath));
    await hydrated(page);
    await expect(page.locator('.match-row').first()).toBeVisible();
    expect(requests.some(request => request.action === 'lookup')).toBe(false);
    expect(await page.evaluate(() => localStorage.getItem('riftscry:remembered-player:v1'))).toBeNull();
  });

  test(`${viewport.width}px match: inspect an actual fact and a draft as connected scenes`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const requests = await installFixtures(page, { matches });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`/matches/${sourceMatch.metadata.matchId}?${query}`);
    await hydrated(page);
    await expect(page.locator('#match-overview')).toBeVisible();
    expect(requests.filter(request => ['timeline', 'review'].includes(request.action))).toEqual([]);
    await page.locator('[data-journey-tab="match-review"]').click();
    await expect(page.locator('#match-review')).toBeVisible();
    await page.getByRole('button', { name: 'Review with AI', exact: true }).click();
    await expect(page.locator('.review-full')).toHaveJSProperty('open', true);
    const evidence = page.locator('.review-focus a[href="#fact-event-0"]').first();
    await evidence.click();
    await expect(page.locator('#match-evidence')).toBeVisible();
    await expect(page.locator('#fact-event-0')).toBeFocused();
    await expect(page.locator('#match-review')).toBeHidden();
    await page.locator('[data-journey-tab="match-review"]').click();
    await page.getByRole('button', { name: 'Review draft', exact: true }).first().click();
    await expect(page.locator('#match-memory')).toBeVisible();
    await expect(page.locator('#build-memory')).toBeVisible();
    await expect(page.locator('[data-prepared-adjustment]')).toBeVisible();
    await expect(page.locator('[data-prepared-adjustment]')).toBeFocused();
    await expect(page.locator('.signal-adjustment-details')).toHaveJSProperty('open', false);
    await expect(page.getByRole('button', { name: 'Save adjustment', exact: true })).toBeVisible();
    await page.locator('.signal-adjustment-details > summary').click();
    await expect(page.getByLabel('Decision being reconsidered', { exact: true })).toBeVisible();
    expect(requests.filter(request => request.action === 'review').map(request => request.method)).toEqual(['POST']);
    expect(requests.filter(request => request.action === 'timeline')).toEqual([]);
    expect(await page.evaluate(key => localStorage.getItem(key), `riftscry:build-memory:v1:${platform}:${puuid}`)).toBeNull();
    expect(errors).toEqual([]);
  });
}

test('an explicit game-card continuation keeps the older preparation and reflection workflow', async ({ page }) => {
  const requests = await installFixtures(page);
  await page.goto('/notebook?champion=Ahri&queue=450');
  await hydrated(page);
  await expect(page.locator('#game-card')).toBeVisible();
  await expect(page.getByLabel('Champion for next game', { exact: true })).toHaveValue('Ahri');
  await page.getByRole('button', { name: 'Add a quick note', exact: true }).click();
  const editor = page.locator('dialog.recall-editor');
  await editor.getByLabel('Note text', { exact: true }).fill('Keep the dash for their engage.');
  await editor.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(page.locator('#game-card')).toBeVisible();
  await page.getByRole('button', { name: 'Take this into my game', exact: true }).click();
  await expect(page.locator('.recall-card--active')).toContainText('Keep the dash for their engage.');
  await page.getByRole('button', { name: 'Helped', exact: true }).click();
  await page.getByRole('button', { name: 'Save reflection', exact: true }).click();
  await page.locator('[data-journey-tab="notebook-history"]').click();
  await expect(page.locator('#notebook-history')).toContainText('Keep the dash for their engage.');
  expect(requests).toEqual([]);
});
