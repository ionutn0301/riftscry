import { test, expect, type Page } from '@playwright/test';
import { readyWorld, unobstructed } from './journey-test-helpers';
import { cinema, cinemaSignals, cinemaFitsViewport, closeEvidence, inspectCinema, openCinemaNavigation, readyCinema } from './cinema-test-helpers';

async function settleLayout(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

test('failed imagery leaves native world entry and exact evidence before and after enhancement', async ({ page }) => {
  let releaseScripts = () => {};
  const scriptsHeld = new Promise<void>(resolve => { releaseScripts = resolve; });
  await page.route('**/*', async route => {
    if (route.request().resourceType() === 'image') return route.abort();
    if (route.request().resourceType() === 'script') await scriptsHeld;
    await route.continue();
  });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const home = cinema(page), choices = home.locator('[data-home-choice]');
  try {
    await page.goto('/', { waitUntil: 'commit' });
    await expect(home).toBeVisible();
    await expect(home.locator('h1')).toHaveAccessibleName('Your next game. A clearer plan.');
    const signals = await cinemaSignals(page);
    await expect(choices).toHaveCount(signals.length);
    for (const signal of signals) {
      const choice = home.locator(`[data-home-choice="${signal.championId}"]`);
      await expect(choice).toHaveAttribute('href', signal.explore);
      await expect(choice).toContainText(signal.championName);
    }
    await expect(page.locator('[data-home-personal]').first()).toHaveAttribute('href', '/next-game');
    await expect(page.locator('[data-cinema-inspect]').first()).toHaveAttribute('href', signals[0]!.explore);
    await expect(page.locator('[data-home-keep]')).toBeHidden();
    releaseScripts(); await readyCinema(page);
    for (const choice of await choices.all()) await unobstructed(choice);
    const dialog = await inspectCinema(page);
    const record = dialog.locator('[data-home-record]:not([hidden])');
    await expect(record.locator('.before')).toHaveText(signals[0]!.before);
    await expect(record.locator('.after')).toHaveText(signals[0]!.after);
    await expect(record.getByRole('link', { name: 'Original source' })).toHaveAttribute('href', signals[0]!.sourceUrl);
    await closeEvidence(page);
    const menu = await openCinemaNavigation(page); await menu.locator('a[href="/champions"]').click();
    await expect(page).toHaveURL(url => url.pathname === '/champions'); await readyWorld(page);
    const search = page.getByRole('searchbox', { name: 'Find a champion', exact: true });
    await search.fill('nunu');
    await expect(page.locator('[data-roster-row]:not([hidden])')).toHaveCount(1);
    await expect(page.locator('[data-roster-row]:not([hidden]) a')).toHaveAttribute('href', '/champion/nunu');
    expect(errors).toEqual([]);
  } finally { releaseScripts(); }
});

test('failed champion artwork leaves an honest identity and exact records available', async ({ page }) => {
  await page.route('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Ahri_0.jpg', route => route.abort());
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/champion/ahri');
  await readyWorld(page);
  await expect(page.locator('[data-champion-art-image]')).toBeHidden();
  const fallback = page.locator('[data-champion-art-fallback]');
  await expect(fallback).toBeVisible();
  await expect(fallback).toContainText('Ahri');
  await expect(fallback).toContainText('Artwork unavailable');
  await expect(page.locator('[data-champion-art-credit]')).toBeHidden();
  const current = page.locator('[data-history-record="26.6"]');
  await expect(current).toBeVisible();
  const record = current.locator('[data-signal-record]:not([hidden])');
  await expect(record).toContainText('Orb of Deception');
  await expect(record.locator('.before')).toHaveText('40 / 65 / 90 / 115 / 140');
  await expect(record.locator('.after')).toHaveText('35 / 60 / 85 / 110 / 135');
  await page.locator('[data-history-select="26.3"]').click();
  const earlier = page.locator('[data-history-record="26.3"]');
  await expect(earlier).toBeVisible();
  await expect(current).toBeHidden();
  await earlier.getByRole('link', { name: 'Open in patch 26.3' }).click();
  await expect(page).toHaveURL(url => url.pathname === '/patch/26.3' && url.hash === '#ahri');
  await readyWorld(page);
  await expect(page.locator('.change-card:not([hidden])')).toHaveAttribute('id', 'ahri');
  expect(errors).toEqual([]);
});

test('choosing a champion changes its evidence without moving the world controls', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/'); await readyCinema(page);
  const home = cinema(page), choices = home.locator('[data-home-choice]');
  const signals = await cinemaSignals(page);
  const position = () => page.evaluate(() => ({
    scroll: scrollY,
    boxes: [...document.querySelectorAll('[data-rift-cinema], #cinema-title, [data-home-choice], .cinema-header, .cinema-primary')]
      .map(element => { const box = element.getBoundingClientRect(); return [box.x, box.y, box.width, box.height]; }),
  }));
  // Native scrolling may reveal the picker on a short window; changing its
  // selection must not cause any further scroll or move the document layout.
  await choices.first().scrollIntoViewIfNeeded();
  await settleLayout(page);
  const baseline = await position();
  const expectStationary = async () => {
    await settleLayout(page);
    const current = await position();
    expect(current.scroll).toBe(baseline.scroll); expect(current.boxes).toHaveLength(baseline.boxes.length);
    for (const [index, box] of current.boxes.entries()) for (const [axis, value] of box.entries()) expect(Math.abs(value - baseline.boxes[index]![axis]!)).toBeLessThanOrEqual(1);
    await cinemaFitsViewport(page);
  };
  for (const index of [1, 2, 0]) {
    const signal = signals[index]!;
    await choices.nth(index).click();
    await expect(home).toHaveAttribute('data-home-subject', signal.championId);
    await expect(choices.nth(index)).toHaveAttribute('aria-current', 'true');
    await expect(page).toHaveURL(url => url.searchParams.get('signal') === signal.championId);
    await expect(home.locator('[data-home-subject]')).toHaveText(signal.championName);
    await expect(home.locator('[data-home-explore]')).toHaveAttribute('href', signal.explore);
    const record = home.locator('[data-home-record]:not([hidden])');
    await expect(record.locator('.before')).toHaveText(signal.before); await expect(record.locator('.after')).toHaveText(signal.after);
    await expectStationary();
  }
  await choices.nth(1).focus(); await page.keyboard.press('Enter');
  await expect(home).toHaveAttribute('data-home-subject', signals[1]!.championId);
  await expect(choices.nth(1)).toBeFocused(); await expectStationary();
  await page.goBack();
  await expect(home).toHaveAttribute('data-home-subject', signals[0]!.championId);
  await expect(choices.first()).toHaveAttribute('aria-current', 'true'); await expectStationary();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('riftscry:kept-findings') ?? '[]'))).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('riftscry:last-reviewed-patch'))).toBeNull();
});
