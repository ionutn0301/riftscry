import { test, expect } from '@playwright/test';
import { readyWorld, stationaryWorld, unobstructed } from './journey-test-helpers';

test('the atlas is the entrance and a native round trip retains its place', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => { if (request.url().includes('/api/player/')) requests.push(request.url()); });
  await page.goto('/'); await readyWorld(page);
  await expect(page.locator('[data-journey-panel]:visible')).toHaveAttribute('id', 'atlas');
  await expect(page.locator('#atlas [data-atlas-portal]')).toHaveCount(5);
  await expect(page.locator('.journey-spine a')).toHaveCount(6);
  await expect(page.locator('main h1')).toContainText('ripple.');
  await page.locator('#atlas [data-atlas-portal="champions"]').click();
  await readyWorld(page); await expect(page).toHaveURL(/\/champions\/?$/);
  await expect(page.locator('.journey-spine [aria-current="page"]')).toHaveAttribute('data-spine-station','champions');
  await page.goBack(); await readyWorld(page);
  await expect(page.locator('[data-journey-panel]:visible')).toHaveAttribute('id','atlas');
  await page.reload(); await readyWorld(page);
  await expect(page.locator('[data-journey-panel]:visible')).toHaveAttribute('id','atlas');
  expect(requests).toEqual([]);
});

for (const [width,height] of [[320,568],[390,844],[568,320],[1440,900]] as const) {
  test(`every atlas portal is operable at ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({width,height});
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto('/'); await readyWorld(page);
    for (const portal of await page.locator('#atlas [data-atlas-portal]').all()) await unobstructed(portal);
    await stationaryWorld(page);
    await page.locator('[data-map-open]').click();
    const map = page.locator('#rift-map-dialog');
    for (const portal of await map.locator('[data-atlas-portal]').all()) await unobstructed(portal);
    await map.locator('[data-map-close]').click();
    await expect(page.locator('[data-map-open]')).toBeFocused();
    await expect(page.locator('#atlas')).toBeVisible();
  });
}

test('directional keyboard exploration enters the focused place and Escape returns focus', async ({ page, isMobile }) => {
  test.skip(isMobile,'Desktop keyboard path; touch targets are checked above.');
  await page.goto('/'); await readyWorld(page);
  const beacon = page.locator('#atlas [data-atlas-portal="next-game"]');
  await beacon.focus(); await page.keyboard.press('ArrowRight');
  await expect(beacon).not.toBeFocused();
  const href = await page.locator('#atlas [data-atlas-portal]:focus').getAttribute('href');
  await page.keyboard.press('Enter'); await readyWorld(page);
  expect(new URL(page.url()).pathname).toBe(new URL(href!,page.url()).pathname);
  await page.locator('[data-map-open]').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-map-open]')).toBeFocused();
});

test('an explicit signal link still opens the evidence journey', async ({ page }) => {
  await page.goto('/?signal=Azir#reveal'); await readyWorld(page);
  await expect(page.locator('[data-journey-panel]:visible')).toHaveAttribute('id','reveal');
  await expect(page.locator('[data-home-record]:not([hidden]) .before')).not.toBeEmpty();
  await expect(page.locator('[data-home-record]:not([hidden]) .after')).not.toBeEmpty();
  await page.locator('[data-journey-tab="atlas"]').click();
  await expect(page.locator('#atlas')).toBeVisible();
  await page.goBack();
  await expect(page.locator('[data-journey-panel]:visible')).toHaveAttribute('id','reveal');
});

test('the destination range moves the same object continuously and keeps direct entry ready',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto('/');await readyWorld(page);
  const passage=page.locator('#atlas [data-passage]');
  await expect(passage).toHaveAttribute('data-passage-painted','true');
  const range=passage.locator('[data-passage-range]');await range.focus();await page.keyboard.press('End');
  await expect(range).toHaveAttribute('aria-valuetext','Saved');
  await expect(passage.locator('[data-passage-enter]')).toHaveAttribute('href',/\/pool#briefing$/);
  await expect.poll(()=>passage.getAttribute('data-passage-position')).toBe('4.0000');
  await expect(passage.locator('canvas')).toBeVisible();await expect(passage.locator('[data-passage-still]')).toBeHidden();
  await expect(passage.locator('[data-passage-stop]')).toHaveCount(5);
  await stationaryWorld(page);
});

test('dragging the object changes its camera without navigating or requiring a tutorial',async({page,isMobile})=>{
  test.skip(isMobile,'The range and native links cover touch projects; this checks a real captured pointer drag.');
  await page.setViewportSize({width:390,height:844});await page.goto('/');await readyWorld(page);
  const passage=page.locator('#atlas [data-passage]'),viewport=passage.locator('[data-passage-gesture]');
  await viewport.scrollIntoViewIfNeeded();const box=(await viewport.boundingBox())!;
  const x=box.x+box.width*.8,y=box.y+box.height*.38;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x-box.width*.65,y,{steps:16});await page.mouse.up();
  await expect.poll(async()=>Number(await passage.getAttribute('data-passage-position'))).toBeGreaterThan(.9);
  await expect(page).toHaveURL(url=>url.pathname==='/');
  await expect(passage.locator('[data-passage-enter]')).toHaveText(/Enter (Games|Champions|Patches|Saved)/);
});

test.describe('native atlas without scripts', () => {
  test.use({javaScriptEnabled:false});
  test('all five destinations are genuine usable links', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#atlas [data-atlas-portal]')).toHaveCount(5);
    await page.locator('#atlas [data-atlas-portal="patches"]').click();
    await expect(page).toHaveURL(/\/patches\/?$/);
    await expect(page.locator('main h1')).toBeVisible();
  });
});
