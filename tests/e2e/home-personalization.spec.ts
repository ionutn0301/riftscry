import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { readyCinema, inspectCinema, closeEvidence } from './cinema-test-helpers';
import { reachableTarget } from './journey-test-helpers';

for (const champion of ['Lux', 'Chogath', 'AurelionSol', 'RekSai', 'Lulu', 'Zilean', 'Urgot', 'Riven', 'Malphite']) {
  test(`all-champion home: ${champion} has its own artwork, evidence state and catch-up action`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const playerRequests: string[] = [];
    page.on('request', request => { if (request.url().includes('/api/player/')) playerRequests.push(request.url()); });
    await page.goto(`/?signal=${champion}`); await readyCinema(page);
    await expect(page.locator('[data-rift-cinema]')).toHaveAttribute('data-home-subject', champion);
    const cutout = ['Urgot', 'Riven', 'Malphite'].includes(champion);
    await expect(page.locator('[data-cinema-poster]')).toHaveAttribute('src', cutout ? `/images/rift-cinema/${champion.toLowerCase()}-figure.webp` : new RegExp(`/${champion}_0.jpg$`));
    await expect(page.locator('[data-rift-cinema]')).toHaveAttribute('data-art-kind', cutout ? 'cutout' : 'splash');
    await expect(page.locator('[data-home-catchup]')).toHaveAttribute('href', `/catch-up?champion=${champion}`);
    await reachableTarget(page.locator('[data-home-primary]'), page);
    await reachableTarget(page.locator('[data-home-review]'), page);
    await inspectCinema(page);
    const record = page.locator(`[data-home-record="${champion}"]`);
    await expect(record).toBeVisible();
    if (champion === 'Lulu') {
      await expect(record).toContainText('No direct change recorded');
      await expect(page.locator('[data-home-keep]')).toBeHidden();
    } else if (champion === 'Zilean') {
      await expect(record.locator('.prose-text')).not.toBeEmpty();
      await expect(record.locator('.before')).toHaveCount(0);
    }
    await closeEvidence(page);
    await mkdir('player-visuals', { recursive: true });
    await page.screenshot({ path: `player-visuals/home-roster-${champion}-${test.info().project.name}.png`, animations: 'disabled' });
    expect(playerRequests).toEqual([]);
  });
}

test('all-champion home: artwork failure keeps champion identity and useful actions', async ({ page }) => {
  await page.route('**/cdn/img/champion/splash/Lux_0.jpg', route => route.abort());
  await page.goto('/?signal=Lux'); await readyCinema(page);
  await expect(page.locator('[data-rift-cinema]')).toHaveAttribute('data-home-subject', 'Lux');
  await expect(page.locator('[data-rift-cinema]')).toHaveAttribute('data-artwork', 'unavailable');
  await reachableTarget(page.locator('[data-home-primary]'), page);
  await page.locator('[data-home-catchup]').click();
  await expect(page).toHaveURL(/\/catch-up\?champion=Lux$/);
});
