import {mapControl} from '../shared/navigation';
import { test, expect } from '@playwright/test';
import { readyWorld, stationaryWorld, unobstructed } from './journey-test-helpers';
import { cinema, cinemaSignals, closeEvidence, evidence, openCinemaNavigation, readyCinema } from './cinema-test-helpers';

test('the immersive homepage has a native archive exit and browser Back retains its world', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => { if (request.url().includes('/api/player/')) requests.push(request.url()); });
  await page.goto('/'); await readyCinema(page);
  await expect(page.locator('#main [data-rift-atlas],.journey-dock,[data-journey-tabs]')).toHaveCount(0);
  await expect(page.locator('main h1')).toHaveAccessibleName('The Rift has changed.');
  const subject = await cinema(page).getAttribute('data-home-subject');
  const menu = await openCinemaNavigation(page);
  await menu.locator('a[href="/champions"]').click();
  await readyWorld(page); await expect(page).toHaveURL(/\/champions\/?$/);
  await expect(page.locator('[data-dock-atlas]')).toHaveAttribute('aria-current', 'location');
  await page.goBack(); await readyCinema(page);
  await expect(cinema(page)).toHaveAttribute('data-cinema-state', 'world');
  await expect(cinema(page)).toHaveAttribute('data-home-subject', subject!);
  await expect(menu).toBeHidden();
  await page.reload(); await readyCinema(page);
  await expect(cinema(page)).toHaveAttribute('data-cinema-state', 'world');
  expect(requests).toEqual([]);
});

for (const [width,height] of [[320,568],[390,844],[568,320],[1440,900]] as const) {
  test(`every atlas portal is operable at ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({width,height});
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto('/champions'); await readyWorld(page);
    for (const portal of await page.locator('.journey-dock a').all()) await unobstructed(portal);
    await stationaryWorld(page);
    await mapControl(page).click();
    const map = page.locator('#rift-map-dialog');
    for (const portal of await map.locator('[data-atlas-portal]').all()) await unobstructed(portal);
    await map.locator('[data-map-close]').click();
    await expect(mapControl(page)).toBeFocused();
    await expect(page).toHaveURL(url => url.pathname === '/champions');
  });
}

test('directional keyboard exploration enters the focused place and Escape returns focus', async ({ page, isMobile }) => {
  test.skip(isMobile,'Desktop keyboard path; touch targets are checked above.');
  await page.goto('/champions'); await readyWorld(page);
  await mapControl(page).click();
  const beacon = page.locator('#rift-map-dialog [data-atlas-portal="next-game"]');
  await beacon.focus(); await page.keyboard.press('ArrowRight');
  await expect(beacon).not.toBeFocused();
  const href = await page.locator('#rift-map-dialog [data-atlas-portal]:focus').getAttribute('href');
  await page.keyboard.press('Enter'); await readyWorld(page);
  expect(new URL(page.url()).pathname).toBe(new URL(href!,page.url()).pathname);
  await mapControl(page).click();
  await page.keyboard.press('Escape');
  await expect(mapControl(page)).toBeFocused();
});

test('an explicit legacy signal fragment opens its selected evidence without reinstating the old journey', async ({ page }) => {
  await page.goto('/'); await readyCinema(page);
  const signal = (await cinemaSignals(page))[1]!;
  await page.goto(`/?signal=${signal.championId}#reveal`); await readyCinema(page);
  await expect(cinema(page)).toHaveAttribute('data-cinema-state', 'inspect');
  await expect(cinema(page)).toHaveAttribute('data-home-subject', signal.championId);
  const record = evidence(page).locator('[data-home-record]:not([hidden])');
  await expect(record.locator('.before')).toHaveText(signal.before);
  await expect(record.locator('.after')).toHaveText(signal.after);
  await page.reload(); await readyCinema(page);
  await expect(evidence(page)).toBeVisible();
  await expect(cinema(page)).toHaveAttribute('data-home-subject', signal.championId);
  await closeEvidence(page);
  await expect(cinema(page)).toHaveAttribute('data-cinema-state', 'world');
  await expect(page.locator('[data-journey-tabs],[data-journey-panel]')).toHaveCount(0);
});

test('the destination range moves the same object continuously and keeps direct entry ready',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto('/champions');await readyWorld(page);
  await mapControl(page).click();
  const passage=page.locator('#rift-map-dialog [data-passage]');
  await expect(passage).toHaveAttribute('data-passage-painted','true');
  const shape=await passage.locator('[data-passage-aperture]').getAttribute('d');
  const range=passage.locator('[data-passage-range]');await range.focus();await page.keyboard.press('End');
  await expect(range).toHaveAttribute('aria-valuetext','Saved');
  await expect(passage.locator('[data-passage-enter]')).toHaveAttribute('href',/\/pool#briefing$/);
  await expect.poll(()=>passage.getAttribute('data-passage-position')).toBe('4.0000');
  expect(await passage.locator('[data-passage-aperture]').getAttribute('d')).not.toBe(shape);
  await expect(passage.locator('[data-passage-title]')).toHaveAccessibleName('A world that remembers.');
  await expect(passage.locator('canvas')).toBeVisible();await expect(passage.locator('[data-passage-still]')).toBeHidden();
  await expect(passage.locator('[data-passage-stop]')).toHaveCount(5);
  await stationaryWorld(page);
});

test('dragging the object changes its camera without navigating or requiring a tutorial',async({page,isMobile})=>{
  test.skip(isMobile,'The range and native links cover touch projects; this checks a real captured pointer drag.');
  await page.setViewportSize({width:390,height:844});await page.goto('/champions');await readyWorld(page);
  await mapControl(page).click();
  const passage=page.locator('#rift-map-dialog [data-passage]'),viewport=passage.locator('[data-passage-gesture]');
  await viewport.scrollIntoViewIfNeeded();const box=(await viewport.boundingBox())!;
  const x=box.x+box.width*.8,y=box.y+box.height*.38;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x-box.width*.65,y,{steps:16});await page.mouse.up();
  await expect.poll(async()=>Number(await passage.getAttribute('data-passage-position'))).toBeGreaterThan(.9);
  await expect(page).toHaveURL(url=>url.pathname==='/champions');
  await expect(passage.locator('[data-passage-enter]')).toHaveText(/Enter (Games|Champions|Patches|Saved)/);
});

test.describe('native atlas without scripts', () => {
  test.use({javaScriptEnabled:false});
  test('all five destinations are genuine usable links', async ({ page }) => {
    await page.goto('/champions');
    await expect(page.locator('#rift-map-dialog [data-atlas-portal]')).toHaveCount(5);
    await page.getByRole('navigation',{name:'RiftScry destinations'}).getByRole('link',{name:'Patches',exact:true}).click();
    await expect(page).toHaveURL(/\/patches\/?$/);
    await expect(page.locator('main h1')).toBeVisible();
  });
});
