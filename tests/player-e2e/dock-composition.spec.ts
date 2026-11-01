import {test,expect,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {installFixtures,profilePath,query,recentAramWin,visualMatches} from './fixtures';

const labels=['Home','Briefing','Atlas','Games','Saved'];
async function ready(page:Page){
  await expect(page.locator('body')).toHaveAttribute('data-journey-ready','true');
  await expect(page.locator('astro-island[client="load"][ssr]')).toHaveCount(0);
  await page.evaluate(()=>document.fonts.ready);
}

for(const viewport of [{width:320,height:568},{width:390,height:844},{width:844,height:390},{width:1440,height:900}]){
  test(`${viewport.width}×${viewport.height}: one consistent dock across home, profile and archive pages`,async({page})=>{
    test.setTimeout(120_000);await page.setViewportSize(viewport);await page.emulateMedia({reducedMotion:'reduce'});
    await installFixtures(page,{matches:visualMatches});await mkdir('player-visuals',{recursive:true});
    let baseline:number[]|undefined;
    for(const route of [{path:'/',current:'Home',capture:'home'},{path:profilePath,current:'Games',capture:'profile'},{path:'/champions',current:'Atlas',capture:'champions'},{path:'/patches',current:'Atlas',capture:'patches'},{path:'/pool#edit-pool',current:'Saved',capture:'saved'}]){
      await page.goto(route.path,{waitUntil:'domcontentloaded'});await ready(page);
      if(route.current==='Games')await expect(page.locator('.match-row').first()).toBeVisible();
      const chrome=page.locator('.journey-chrome'),dock=chrome.locator('.journey-dock');
      const headerMenu=page.locator('.journey-header [data-map-open]');
      if(viewport.width<=1100){
        await expect(headerMenu).toBeHidden();
        await expect(page.locator('.journey-header .journey-primary')).toBeHidden();
        await expect(page.locator('[aria-controls="rift-map-dialog"]:visible')).toHaveCount(1);
      }else await expect(headerMenu).toBeVisible();
      await expect(chrome).toBeVisible();await expect(chrome).toHaveCSS('position','fixed');
      await expect(dock.locator(':scope > a > span')).toHaveText(labels);
      await expect(dock.locator('[aria-current]')).toHaveCount(1);
      await expect(dock.locator('[aria-current]')).toHaveAccessibleName(route.current);
      await expect(chrome.locator('[data-journey-controls],[data-signal-thread],.journey-trail-end')).toHaveCount(0);
      const box=(await chrome.boundingBox())!,geometry=[box.x,box.y,box.width,box.height];
      expect(box.height).toBe(68);expect(viewport.height-box.y-box.height).toBeGreaterThanOrEqual(11);
      if(baseline)geometry.forEach((value,index)=>expect(Math.abs(value-baseline![index]!)).toBeLessThanOrEqual(1));
      else baseline=geometry;
      for(const label of labels){
        const link=dock.getByRole('link',{name:label,exact:true});await expect(link).toBeInViewport({ratio:1});
        const bounds=(await link.boundingBox())!;expect(bounds.width).toBeGreaterThanOrEqual(44);expect(bounds.height).toBeGreaterThanOrEqual(44);
        expect(await link.evaluate(element=>{const r=element.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===element||Boolean(hit&&element.contains(hit));})).toBe(true);
      }
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
      // The last task control must have enough document space to clear the dock.
      const last=page.locator('#main a:visible,#main button:visible,#main input:visible,#main select:visible').last();
      await last.scrollIntoViewIfNeeded();
      await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));
      expect((await last.boundingBox())!.y+(await last.boundingBox())!.height).toBeLessThanOrEqual(box.y-8);
      await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
      if(['home','profile'].includes(route.capture))await page.screenshot({path:`player-visuals/dock-${route.capture}-${viewport.width}x${viewport.height}.png`,animations:'disabled'});
    }
  });
}

test.describe('Touch dock navigation',()=>{
  test.use({viewport:{width:390,height:844},hasTouch:true});
  test('one consistent dock opens Atlas, restores focus and reaches champions and patches',async({page})=>{
    await page.emulateMedia({reducedMotion:'reduce'});await installFixtures(page);await page.goto('/');await ready(page);
    const atlas=page.locator('[data-dock-atlas]');await atlas.tap();
    await expect(atlas).toHaveAttribute('aria-expanded','true');await expect(page.locator('#rift-map-dialog')).toBeVisible();
    await page.keyboard.press('Escape');await expect(atlas).toBeFocused();await expect(atlas).toHaveAttribute('aria-expanded','false');
    // The shortcut must return to the dock, including after the desktop opener hides.
    await page.locator('body').evaluate(()=>{(document.activeElement as HTMLElement)?.blur();});
    await page.keyboard.press('Alt+KeyM');await expect(page.locator('#rift-map-dialog')).toBeVisible();
    await page.keyboard.press('Escape');await expect(atlas).toBeFocused();
    await page.setViewportSize({width:1440,height:900});
    await page.locator('.journey-header [data-map-open]').click();
    await page.setViewportSize({width:390,height:844});
    await page.keyboard.press('Escape');await expect(atlas).toBeFocused();
    for(const station of ['champions','patches']){
      await atlas.tap();await page.locator(`#rift-map-dialog [data-passage-stop][data-station-link="${station}"]`).tap();
      await expect(page).toHaveURL(url=>url.pathname===`/${station}`);await ready(page);
      await expect(atlas).toHaveAttribute('aria-current','location');
    }
    await page.locator('.journey-spine-home').tap();await expect(page).toHaveURL(url=>url.pathname==='/');await ready(page);
    await expect(page.locator('.journey-dock a[aria-current]')).toHaveAccessibleName('Home');
  });
});

test('one consistent dock leaves match AI review in the inline chapter controls',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
  const requests=await installFixtures(page,{matches:[recentAramWin]});
  await page.goto(`/matches/${recentAramWin.metadata.matchId}?${query}`);await ready(page);
  const chapter=page.locator('#main [data-journey-tab="match-review"]');await expect(chapter).toBeVisible();await chapter.click();
  await expect(page.locator('#match-review')).toBeVisible();await expect(chapter).toHaveAttribute('aria-selected','true');
  await expect(page.locator('.journey-dock a')).toHaveCount(5);await expect(page.locator('.journey-dock [aria-current]')).toHaveAccessibleName('Games');
  expect(requests.filter(request=>request.action==='review')).toEqual([]);
});
