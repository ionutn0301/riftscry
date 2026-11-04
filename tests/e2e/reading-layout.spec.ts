import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { readyCinema } from './cinema-test-helpers';
import { readyWorld, reachableTarget, stationaryWorld } from './journey-test-helpers';
import { installFixtures, profilePath, visualMatches } from '../player-e2e/fixtures';

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
  await page.getByLabel('Find a champion', { exact: true }).fill('Ahri');
  await expect(rows).toHaveCount(1);
  await rows.first().getByRole('link').click();
  await expect(page).toHaveURL(/\/champion\/ahri\/?$/);
  await readyWorld(page); await stationaryWorld(page); await capture(page, 'champion-history');
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

test('reading layout: match logs align and notebook entries remain editable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installFixtures(page, { matches: visualMatches });
  await page.goto(profilePath + '?name=Fixture%20Player%23TEST'); await readyWorld(page);
  const rows = page.locator('.match-row');
  await expect(rows).toHaveCount(visualMatches.length);
  const boxes = await rows.evaluateAll(rows => rows.map(row => {
    const r = row.getBoundingClientRect(); return { x: r.x, right: r.right, y: r.y, bottom: r.bottom };
  }));
  for (let i = 1; i < boxes.length; i++) {
    expect(Math.abs(boxes[i]!.x - boxes[0]!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(boxes[i]!.right - boxes[0]!.right)).toBeLessThanOrEqual(1);
    expect(boxes[i]!.y).toBeGreaterThanOrEqual(boxes[i - 1]!.bottom - 1);
  }
  await stationaryWorld(page); await capture(page, 'match-log');
  await rows.first().click();
  await expect(page).toHaveURL(/\/matches\//);
  await readyWorld(page); await stationaryWorld(page); await capture(page, 'match-review');
  await page.goto('/notebook'); await readyWorld(page);
  for (const text of ['Check the next objective before recalling.', 'Leave one clear reminder after a difficult game.']) {
    await page.getByRole('button', { name: 'New note', exact: true }).first().click();
    const editor = page.getByRole('dialog', { name: 'Keep one thought.', exact: true });
    await editor.getByLabel('Note text', { exact: true }).fill(text);
    await capture(page, 'note-editor');
    await editor.getByRole('button', { name: 'Save note', exact: true }).click();
    await expect(editor).toHaveCount(0);
  }
  const notes = page.locator('.recall-saved-note');
  await expect(notes).toHaveCount(2);
  await notes.first().getByRole('button', { name: 'Edit note', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Edit your note', exact: true });
  await editor.getByLabel('Note text', { exact: true }).fill('Review the objective timer before recalling.');
  await editor.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(notes.first()).toContainText('Review the objective timer before recalling.');
  await stationaryWorld(page); await capture(page, 'notebook');
  await page.reload(); await readyWorld(page);
  await expect(notes).toHaveCount(2);
  await expect(notes.first()).toContainText('Review the objective timer before recalling.');
  for (const path of ['/pool', '/patches', '/account']) {
    await page.goto(path);
    await expect(page.locator('astro-island[client="load"][ssr]')).toHaveCount(0);
    await expect(page.locator('h1')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await capture(page, path.slice(1));
  }
});
