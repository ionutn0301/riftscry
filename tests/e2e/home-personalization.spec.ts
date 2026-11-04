import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { readyCinema, inspectCinema, closeEvidence } from './cinema-test-helpers';
import { reachableTarget, readyWorld } from './journey-test-helpers';

for (const champion of ['Akali', 'Yasuo', 'Thresh']) {
  test(`all-champion home: ${champion} has its own artwork, evidence state and catch-up action`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const playerRequests: string[] = [];
    page.on('request', request => { if (request.url().includes('/api/player/')) playerRequests.push(request.url()); });
    await page.goto(`/?signal=${champion}`); await readyCinema(page);
    await expect(page.locator('[data-rift-cinema]')).toHaveAttribute('data-home-subject', champion);
    await expect(page.locator('[data-cinema-poster]')).toHaveAttribute('src', new RegExp(`${champion.toLowerCase()}-figure.*\\.webp$`));
    await expect(page.locator('[data-rift-cinema]')).toHaveAttribute('data-art-kind', 'cutout');
    await expect(page.locator('[data-home-catchup]')).toHaveAttribute('href', `/catch-up?champion=${champion}`);
    await reachableTarget(page.locator('[data-home-primary]'), page);
    await reachableTarget(page.locator('[data-home-review]'), page);
    await inspectCinema(page);
    const record = page.locator(`[data-home-record="${champion}"]`);
    await expect(record).toBeVisible();
    await closeEvidence(page);
    await mkdir('player-visuals', { recursive: true });
    await page.screenshot({ path: `player-visuals/home-roster-${champion}-${test.info().project.name}.png`, animations: 'disabled' });
    expect(playerRequests).toEqual([]);
  });
}

for (const champion of ['Lux', 'Chogath', 'AurelionSol', 'RekSai', 'Lulu', 'Zilean', 'Urgot', 'Riven', 'Malphite']) {
  test(`all-champion home: a shared ${champion} link opens its native archive when no matching authored figure exists`, async ({ page }) => {
    await page.goto(`/?signal=${champion}`);
    await expect(page).toHaveURL(new RegExp(`/(?:explore\\?champion=${champion}(?:&|$)|champion/${champion.toLowerCase()}(?:#|$))`));
    await readyWorld(page);
    await expect(page.locator('[data-rift-cinema]')).toHaveCount(0);
    await expect(page.locator('main')).toBeVisible();
  });
}

test('all-champion home: artwork failure keeps champion identity and useful actions', async ({ page }) => {
  await page.route('**/*yasuo-figure*', route => route.abort());
  await page.goto('/?signal=Yasuo'); await readyCinema(page);
  await expect(page.locator('[data-rift-cinema]')).toHaveAttribute('data-home-subject', 'Yasuo');
  await expect(page.locator('[data-rift-cinema]')).toHaveAttribute('data-artwork', 'unavailable');
  await reachableTarget(page.locator('[data-home-primary]'), page);
  await page.locator('[data-home-catchup]').click();
  await expect(page).toHaveURL(/\/catch-up\?champion=Yasuo$/);
});
