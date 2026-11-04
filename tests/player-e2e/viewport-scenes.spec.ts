import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {installFixtures,platform,puuid,profilePath,visualMatches} from './fixtures';
import {cinema,cinemaFitsViewport,cinemaSignals,chooseSignal,closeEvidence,evidence,inspectCinema,openCinemaNavigation,readyCinema} from '../e2e/cinema-test-helpers';
import {reachableTarget,readyWorld,unobstructed} from '../e2e/journey-test-helpers';

const ready=readyWorld;
async function measure(page:Page){
  return page.evaluate(()=>{
    const header=document.querySelector('.journey-header')!.getBoundingClientRect();
    const dock=document.querySelector('.journey-chrome')!.getBoundingClientRect();
    const targets=[...document.querySelectorAll<HTMLElement>('#main a,#main button,#main input,#main select,#main h1')]
      .filter(el=>el.getClientRects().length&&!el.closest('[hidden]'))
      .filter(el=>!el.closest('[data-journey-tabs]')||el.getAttribute('aria-selected')==='true');
    return {
      scroll:document.documentElement.scrollHeight-innerHeight,
      horizontal:document.documentElement.scrollWidth-innerWidth,
      y:scrollY,
      clipped:targets.flatMap(el=>{
        const r=el.getBoundingClientRect();
        return r.top<header.bottom-1||r.bottom>dock.top-8||r.left<0||r.right>innerWidth+1
          ? [{label:el.getAttribute('aria-label')||el.textContent?.trim(),top:r.top,bottom:r.bottom,header:header.bottom,dock:dock.top}] : [];
      }),
      nested:[...document.querySelectorAll<HTMLElement>('#main,#main *')].filter(el=>el.clientHeight>0&&/^(auto|scroll)$/.test(getComputedStyle(el).overflowY)&&el.scrollHeight>el.clientHeight+1).map(el=>el.className),
      regions:[...document.querySelectorAll<HTMLElement>('#main,.gateway-composition,.automatic-entry,.recall-library-section')].filter(el=>el.getClientRects().length).map(el=>({name:el.className,top:el.getBoundingClientRect().top,height:el.getBoundingClientRect().height})),
    };
  });
}
async function record(page:Page,name:string){
  await mkdir('player-visuals',{recursive:true});
  await page.screenshot({path:`player-visuals/viewport-${name}.png`,fullPage:true});
  const geometry=await measure(page);
  await writeFile(`player-visuals/viewport-${name}.json`,JSON.stringify(geometry,null,2));
  await test.info().attach(name,{body:JSON.stringify(geometry,null,2),contentType:'application/json'});
  return geometry;
}
async function worldControls(page:Page){
  for(const action of await cinema(page).locator('a:visible,button:visible').all())await reachableTarget(action,page);
  await cinemaFitsViewport(page);
}
const phones=[{width:320,height:480},{width:320,height:568},{width:359,height:603},{width:390,height:660},{width:390,height:844},{width:430,height:932},{width:568,height:320},{width:683,height:384},{width:844,height:390}];
for(const viewport of phones){
  test(`${viewport.width}×${viewport.height}: viewport scene keeps the interactive world and utility controls inside the screen`,async({page})=>{
    await page.setViewportSize(viewport);const requests=await installFixtures(page);
    await page.addInitScript(player=>{
      localStorage.setItem('riftscry:recent-player:v1',JSON.stringify(player));
      localStorage.setItem('riftscry:resume',JSON.stringify({href:'/champion/ahri',label:'Ahri: a saved champion reading with a long title',updatedAt:'2026-11-01T00:00:00.000Z'}));
    },{platform,puuid,name:'Jhinghis Han with a long player name#EUNE'});
    await page.goto('/');await readyCinema(page);await worldControls(page);
    const briefing=new URL(await page.locator('[data-home-personal]').first().getAttribute('href')??'',page.url());
    expect(briefing.searchParams.get('puuid')).toBe(puuid);
    await inspectCinema(page);
    for(const action of await evidence(page).locator('a:visible,button:visible').all())await reachableTarget(action,page);
    await closeEvidence(page);
    const menu=await openCinemaNavigation(page);
    for(const action of await menu.locator('a:visible,button:visible').all())await reachableTarget(action,page);
    await page.keyboard.press('Escape');
    await page.mouse.move(20,120);await page.mouse.wheel(0,600);
    await page.evaluate(()=>window.scrollTo({top:1000,behavior:'instant'}));
    await cinemaFitsViewport(page);expect(requests).toEqual([]);
    await mkdir('player-visuals',{recursive:true});await page.screenshot({path:`player-visuals/viewport-home-${viewport.width}x${viewport.height}.png`});
  });
}
for(const viewport of [{width:320,height:568},{width:390,height:844}]){
  test(`${viewport.width}×${viewport.height}: viewport scene fits small utility pages and preserves long document scrolling`,async({page})=>{
    await page.setViewportSize(viewport);await installFixtures(page,{matches:visualMatches});
    for(const route of ['/players','/next-game','/notebook','/404']){
      await page.goto(route);await ready(page);
      const metrics=await record(page,`${route.slice(1)}-${viewport.width}x${viewport.height}`);
      // Readable briefing content and wrapping notebook chapters can reflow.
      if(!['/next-game','/notebook'].includes(route))expect.soft(metrics.scroll,route+' '+JSON.stringify(metrics)).toBeLessThanOrEqual(1);
      if(route!=='/notebook')expect.soft(metrics.clipped,route).toEqual([]);
      expect.soft(metrics.nested,route).toEqual([]);
      expect.soft(metrics.horizontal,route).toBeLessThanOrEqual(1);
      if(route==='/notebook')for(const control of await page.locator('#main a:visible,#main button:visible').all())await unobstructed(control);
      if(route==='/next-game'){
        await expect(page.locator('.briefing-outline > li')).toHaveCount(3);
        await page.locator('.briefing-outline > li').last().scrollIntoViewIfNeeded();
        await expect(page.locator('.briefing-outline > li').last()).toBeInViewport({ratio:1});
        await reachableTarget(page.getByRole('button',{name:'Get my briefing',exact:true}),page);
      }
    }
    await page.goto(profilePath);await ready(page);await expect(page.locator('.match-row').first()).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollHeight-innerHeight)).toBeGreaterThan(100);
    await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));
    expect(await page.evaluate(()=>scrollY)).toBeGreaterThan(100);
  });
  test(`${viewport.width}×${viewport.height}: viewport scene keeps every selected champion and evidence action accessible`,async({page})=>{
    await page.setViewportSize(viewport);await installFixtures(page);await page.goto('/');await readyCinema(page);
    for(const signal of await cinemaSignals(page)){
      await chooseSignal(page,signal);await worldControls(page);await inspectCinema(page);
      const record=evidence(page).locator('[data-home-record]:not([hidden])');
      await expect(record.locator('.before')).toHaveText(signal.before);await expect(record.locator('.after')).toHaveText(signal.after);
      for(const action of await evidence(page).locator('a:visible,button:visible').all())await reachableTarget(action,page);
      await closeEvidence(page);await cinemaFitsViewport(page);
    }
  });
}
test('viewport scene responds to browser chrome, rotation and native Back without trapping forms',async({page})=>{
  await installFixtures(page);await page.setViewportSize({width:390,height:844});await page.goto('/');await readyCinema(page);
  for(const size of [{width:390,height:660},{width:844,height:390},{width:390,height:844}]){
    await page.setViewportSize(size);await worldControls(page);
  }
  const menu=await openCinemaNavigation(page);await menu.locator('[data-station-link="players"]').click();await ready(page);
  await page.goBack();await readyCinema(page);await cinemaFitsViewport(page);
  await page.goto('/players');await ready(page);
  await page.getByLabel('Riot ID',{exact:true}).fill('Test#EUNE');
  await page.setViewportSize({width:390,height:430});
  await page.getByRole('button',{name:'Find player',exact:true}).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button',{name:'Find player',exact:true})).toBeInViewport({ratio:1});
  expect(await page.locator('body').evaluate(el=>getComputedStyle(el).overflowY)).not.toBe('hidden');
});
