import { expect, test } from '@playwright/test';
import { openScene, readyJourney, readyWorld } from './journey-test-helpers';

test('continue restores the selected champion record and exact query after another destination', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/champion/ahri?mode=reader#perspective');
  await readyWorld(page);
  await openScene(page, 'history');
  const choice = page.locator('[data-history-select]').last();
  const recordHash = await choice.getAttribute('href');
  expect(recordHash).toMatch(/^#record-/);
  await choice.click();
  await expect(page).toHaveURL(url => url.hash === recordHash && url.search === '?mode=reader');
  const selected = page.locator(recordHash!);
  await expect(selected).toBeVisible();
  const expected = new URL(page.url());
  const exactReading = expected.pathname + expected.search + expected.hash;

  await page.getByRole('navigation', { name: 'Journey destinations', exact: true })
    .getByRole('link', { name: 'Patches', exact: true }).click();
  await readyWorld(page);
  await expect(page).toHaveURL(url => url.pathname === '/patches');
  await page.getByRole('button', { name: 'Open the Rift map', exact: true }).click();
  const map = page.getByRole('dialog', { name: 'Where next?', exact: true });
  const resume = map.getByRole('link', { name: 'Continue Ahri Patch History', exact: true });
  await expect(resume).toBeVisible();
  await expect(resume).toHaveAttribute('href', exactReading);
  await expect(map.locator('[data-map-explore]')).toBeHidden();
  // The remembered subject is a separate shortcut, not a change to a station.
  await expect(map.locator('[data-world-link="champions"]')).toHaveAttribute('href', '/champions');
  await resume.click();
  await readyWorld(page);
  await expect(page).toHaveURL(expected.href);
  await expect(selected).toBeVisible();
  await expect(page.locator('[data-history-record]:visible')).toHaveCount(1);
  await expect(selected.getByRole('link', { name: /^Riot’s notes/ })).toHaveAttribute('href', /^https:\/\/www\.leagueoflegends\.com\//);

  await page.getByRole('button', { name: 'Open the Rift map', exact: true }).click();
  await expect(map.locator('[data-reading-resume]')).toBeHidden();
  await expect(map.locator('[data-map-explore]')).toBeVisible();
  expect(errors).toEqual([]);
});

test('scene navigation leaves Explore’s selected interval and record in charge of its continuation', async ({ page }) => {
  await page.goto('/explore?champion=Azir&older=26.15&newer=26.16#change');
  await readyJourney(page);
  const exactReading = await page.evaluate(() => JSON.parse(localStorage.getItem('riftscry:resume') ?? '{}').href as string);
  expect(exactReading).toMatch(/^\/explore\?champion=Azir&older=26\.15&newer=26\.16&event=.+#change$/);
  await openScene(page, 'history');
  await expect(page).toHaveURL(url => url.hash === '#history');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('riftscry:resume') ?? '{}').href)).toBe(exactReading);

  await page.getByRole('navigation', { name: 'Journey destinations', exact: true })
    .getByRole('link', { name: 'Champions', exact: true }).click();
  await readyWorld(page);
  await page.getByRole('button', { name: 'Open the Rift map', exact: true }).click();
  const resume = page.locator('#rift-map-dialog [data-reading-resume]');
  await expect(resume).toHaveAttribute('href', exactReading);
  await resume.click();
  await readyJourney(page);
  await expect(page).toHaveURL(new URL(exactReading, page.url()).href);
  await expect(page.locator('[data-journey-panel]:visible')).toHaveAttribute('id', 'change');
  await expect(page.locator('[data-period-older]')).toHaveValue('26.15');
  await expect(page.locator('[data-period-newer]')).toHaveValue('26.16');
  await expect(page.locator('[data-record-after]')).toContainText('75 / 95 / 115 / 135 / 155');
});
