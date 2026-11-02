import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {installFixtures} from './fixtures';
import {cinema,cinemaFitsViewport,cinemaSignals,chooseSignal,closeEvidence,evidence,inspectCinema,openCinemaNavigation,readyCinema} from '../e2e/cinema-test-helpers';
import {reachableTarget} from '../e2e/journey-test-helpers';

test.describe('Mobile world focus',()=>{
  test.use({viewport:{width:390,height:844},hasTouch:true});
  test('one homepage: keyboard and touch inspection return focus to their world control',async({page})=>{
    await installFixtures(page);await page.goto('/');await readyCinema(page);
    const inspect=page.locator('[data-cinema-inspect]').first();
    await inspect.focus();await page.keyboard.press('Enter');
    await expect(evidence(page)).toBeVisible();
    expect(await evidence(page).evaluate(dialog=>dialog.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');await expect(inspect).toBeFocused();
    await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');await expect(inspect).toBeFocused();
    expect(await inspect.evaluate(element=>element.matches(':focus-visible'))).toBe(true);
    await expect.poll(()=>inspect.evaluate(element=>{const style=getComputedStyle(element);return style.outlineStyle!=='none'&&parseFloat(style.outlineWidth)>0;})).toBe(true);
    await inspect.tap();await expect(evidence(page)).toBeVisible();
    await page.locator('[data-cinema-close]').tap();await expect(evidence(page)).toBeHidden();
    await expect(inspect).toBeFocused();await cinemaFitsViewport(page);
    await mkdir('player-visuals',{recursive:true});await page.screenshot({path:'player-visuals/home-focused-world-390x844.png'});
  });
});

for(const viewport of [{width:320,height:568},{width:390,height:844},{width:683,height:384},{width:844,height:390},{width:1366,height:600},{width:1366,height:768},{width:1440,height:900},{width:1920,height:1080}]){
  test(`${viewport.width}×${viewport.height}: one homepage, one title and no overlapping controls`,async({page})=>{
    await page.setViewportSize(viewport);await page.emulateMedia({reducedMotion:'reduce'});
    const requests=await installFixtures(page);await page.goto('/');await readyCinema(page);
    await expect(page.locator('main h1')).toHaveCount(1);
    await expect(page.locator('main h1')).toHaveAccessibleName('The Rift has changed.');
    await expect(page.locator('[data-journey-deck],[data-journey-panel],[data-journey-tabs],.journey-chrome')).toHaveCount(0);
    for(const action of await cinema(page).locator('a:visible,button:visible').all())await reachableTarget(action,page);
    await cinemaFitsViewport(page);
    const signals=await cinemaSignals(page);expect(signals.length).toBeGreaterThan(1);
    await chooseSignal(page,signals[1]!);
    await inspectCinema(page);
    for(const action of await evidence(page).locator('a:visible,button:visible').all())await reachableTarget(action,page);
    await closeEvidence(page);
    const menu=await openCinemaNavigation(page);
    for(const action of await menu.locator('a:visible,button:visible').all())await reachableTarget(action,page);
    await page.keyboard.press('Escape');await cinemaFitsViewport(page);expect(requests).toEqual([]);
    await mkdir('player-visuals',{recursive:true});await page.screenshot({path:`player-visuals/home-${viewport.width}x${viewport.height}.png`});
  });
}
