import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { readyWorld, stationaryWorld } from '../e2e/journey-test-helpers';
import { installFixtures, profilePath, visualMatches } from './fixtures';

test.setTimeout(90_000);

async function capture(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await mkdir('player-visuals', { recursive: true });
  await page.screenshot({ path: `player-visuals/reading-${name}-${page.viewportSize()!.width}.png`, animations: 'disabled' });
}

// Dynamic player and match pages need the application server, not the static archive host.
for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
test(`${viewport.width}px reading layout: match logs align and notebook entries remain editable`, async ({ page }) => {
  await page.setViewportSize(viewport);
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
  await rows.first().scrollIntoViewIfNeeded(); await capture(page, 'match-log-rows');
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
}
