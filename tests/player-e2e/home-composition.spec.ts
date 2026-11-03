import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {installFixtures} from './fixtures';
import {cinema,cinemaFitsViewport,cinemaSignals,chooseSignal,closeEvidence,evidence,inspectCinema,openCinemaNavigation,readyCinema} from '../e2e/cinema-test-helpers';
import {reachableTarget} from '../e2e/journey-test-helpers';

for (const viewport of [{width:320,height:480},{width:390,height:844},{width:568,height:320},{width:844,height:390},{width:1024,height:600},{width:1366,height:600},{width:1440,height:900}]) {
  test(`${viewport.width}×${viewport.height}: one homepage gives returning actions and header controls room to breathe`, async ({page}) => {
    await page.setViewportSize(viewport); await page.emulateMedia({reducedMotion:'reduce'});
    await installFixtures(page);
    await page.addInitScript(() => {
      localStorage.setItem('riftscry:recent-player:v1', JSON.stringify({platform:'euw1',puuid:'p'.repeat(40),name:'A returning player with a long name#EUW'}));
      localStorage.setItem('riftscry:resume', JSON.stringify({href:'/champion/ahri',label:'Ahri — a long saved reading with an exact historical record',updatedAt:'2026-11-04T00:00:00.000Z'}));
    });
    await page.goto('/'); await readyCinema(page);
    const account=page.getByRole('link',{name:'Account and profile',exact:true});
    const menu=page.getByRole('button',{name:'Open navigation menu',exact:true});
    await expect(menu.getByText('Menu',{exact:true})).toBeVisible();
    await expect(menu.locator('svg')).toBeVisible();
    const accountStyle=await account.evaluate(el=>({background:getComputedStyle(el).backgroundColor,radius:getComputedStyle(el).borderRadius,font:parseFloat(getComputedStyle(el.querySelector('span')!).fontSize)}));
    expect(accountStyle.background).toBe('rgba(0, 0, 0, 0)'); expect(accountStyle.radius).toBe('0px'); expect(accountStyle.font).toBeLessThanOrEqual(14);
    const controls=await page.locator('.cinema-header a:visible,.cinema-header button:visible').all();
    const boxes=[];
    for(const control of controls){await reachableTarget(control,page);boxes.push((await control.boundingBox())!);}
    for(let i=1;i<boxes.length;i++)expect(boxes[i]!.x-boxes[i-1]!.x-boxes[i-1]!.width).toBeGreaterThanOrEqual(5);
    const actions=(await page.locator('.cinema-entry-actions').boundingBox())!;
    const roster=(await page.locator('.cinema-roster').boundingBox())!;
    const footer=(await page.locator('.cinema-footer').boundingBox())!;
    // In landscape the action and champion choices sit in separate columns.
    const separation=Math.max(roster.y-actions.y-actions.height,roster.x-actions.x-actions.width);
    expect(separation,'The returning action must stay separate from champion choices').toBeGreaterThanOrEqual(15);
    expect(footer.y-roster.y-roster.height,'Champion choices need space above playback controls').toBeGreaterThanOrEqual(11.9);
    for(const control of await page.locator('.cinema-playback button').all()){
      await reachableTarget(control,page);
      expect(await control.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(10);
    }
    await expect(page.locator('[data-home-reading]')).toHaveAttribute('href','/champion/ahri');
    await cinemaFitsViewport(page);
    await mkdir('player-visuals',{recursive:true});
    await page.screenshot({path:`player-visuals/home-refined-${viewport.width}x${viewport.height}.png`});
    await menu.click(); await expect(page.getByRole('dialog',{name:'RiftScry navigation',exact:true})).toBeVisible();
    await page.keyboard.press('Escape'); await expect(menu).toBeFocused();
  });
}

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
