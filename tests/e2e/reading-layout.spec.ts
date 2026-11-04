import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { readyCinema } from './cinema-test-helpers';
import { readyWorld, reachableTarget, stationaryWorld } from './journey-test-helpers';
import { installFixtures, visualMatches } from '../player-e2e/fixtures';

test.setTimeout(90_000);

// Review artifacts use isolated browser data, never the owner's saved account.
async function capture(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await mkdir('player-visuals', { recursive: true });
  await page.screenshot({ path: `player-visuals/reading-${name}-${test.info().project.name}.png`, animations: 'disabled' });
}

test('reading layout: a new visitor can understand and enter the champion directory', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/'); await readyCinema(page);
  const browse = page.getByRole('link', { name: 'Find your champion', exact: false });
  const briefing = page.getByRole('link', { name: 'Build my briefing', exact: false });
  await expect(page.locator('.cinema-introduction')).toBeInViewport({ ratio: 1 });
  await reachableTarget(browse, page); await reachableTarget(briefing, page);
  await capture(page, 'home');
  await browse.click(); await readyWorld(page);
  await expect(page).toHaveURL(/\/champions\/?$/);
  const rows = page.locator('[data-roster-row]:visible');
  await expect(rows.first()).toBeVisible();
  const geometry = await rows.first().evaluate(row => {
    const portrait = row.querySelector('.roster-portrait')!.getBoundingClientRect();
    const name = row.querySelector('.roster-entry-copy')!.getBoundingClientRect();
    const record = row.querySelector('.roster-entry-record')!.getBoundingClientRect();
    return { portraitRight: portrait.right, nameLeft: name.left, nameRight: name.right, recordLeft: record.left, height: row.getBoundingClientRect().height };
  });
  expect(geometry.portraitRight).toBeLessThan(geometry.nameLeft);
  expect(geometry.nameRight).toBeLessThanOrEqual(geometry.recordLeft);
  expect(geometry.height).toBeLessThan(90);
  await stationaryWorld(page); await capture(page, 'champions');
  await page.getByRole('searchbox', { name: 'Find a champion', exact: true }).fill('Ahri');
  await expect(rows).toHaveCount(1);
  await rows.first().getByRole('link').click();
  await expect(page).toHaveURL(/\/champion\/ahri\/?$/);
  await readyWorld(page); await stationaryWorld(page); await capture(page, 'champion-history');
});

test('reading layout: the homepage guide explains each feature and account requirements', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/'); await readyCinema(page);
  await expect(page.locator('.cinema-introduction')).toContainText('Review your matches.');
  const guide = page.getByRole('link', { name: 'How RiftScry works', exact: true });
  await reachableTarget(guide, page); await guide.click(); await readyWorld(page);
  await expect(page.getByRole('heading', { name: 'A clearer next game.' })).toBeVisible();
  await expect(page.locator('.guide-workflows > section')).toHaveCount(6);
  await expect(page.getByRole('heading', { name: 'What needs an account?' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await capture(page, 'feature-guide');
  await page.getByRole('link', { name: 'Open my account', exact: false }).click();
  await expect(page).toHaveURL(/\/account\/?$/);
  await expect(page.getByRole('heading', { name: 'My account.' })).toBeVisible();
});

test('reading layout: briefing form and contents stay readable before and after lookup', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installFixtures(page, { matches: visualMatches });
  await page.goto('/next-game'); await readyWorld(page);
  const form = page.getByRole('form', { name: 'Get an automatic player briefing', exact: true });
  await expect(page.getByRole('heading', { name: 'Start with your Riot ID.', exact: true })).toBeVisible();
  await expect(page.locator('.briefing-outline > li')).toHaveCount(3);
  await reachableTarget(form.getByRole('button', { name: 'Get my briefing', exact: true }), page);
  await stationaryWorld(page); await capture(page, 'briefing-start');
  await page.locator('.briefing-outline').scrollIntoViewIfNeeded();
  await capture(page, 'briefing-contents');
  await form.getByLabel('Riot ID', { exact: true }).fill('Fixture Player#TEST');
  await form.getByLabel('Server', { exact: true }).selectOption('eun1');
  await form.getByRole('button', { name: 'Get my briefing', exact: true }).click();
  await expect(page.locator('[data-briefing-report]')).toHaveAttribute('aria-busy', 'false');
  await stationaryWorld(page); await capture(page, 'briefing-report');
});
