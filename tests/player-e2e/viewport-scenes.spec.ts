import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {installFixtures,platform,puuid,profilePath,visualMatches} from './fixtures';

async function ready(page:Page){
  await expect(page.locator('body')).toHaveAttribute('data-journey-ready','true');
  await expect(page.locator('astro-island[client="load"][ssr]')).toHaveCount(0);
  await page.evaluate(()=>document.fonts.ready);
}
async function measure(page:Page){
  return page.evaluate(()=>{
    const header=document.querySelector('.journey-header')!.getBoundingClientRect();
    const dock=document.querySelector('.journey-chrome')!.getBoundingClientRect();
    const targets=[...document.querySelectorAll<HTMLElement>('#main a,#main button,#main input,#main select,#main h1')]
      .filter(el=>el.getClientRects().length&&!el.closest('[hidden]'))
      // The chapter rail scrolls horizontally; its selected tab and both
      // arrow controls must fit. Inactive tabs can be outside that rail.
      .filter(el=>!el.closest('[data-journey-tabs]')||el.getAttribute('aria-selected')==='true');
    const portalRegions=['#atlas .passage-reading','#atlas .passage-viewport','#atlas .passage-instrument','#atlas .atlas-arrival-footer'].flatMap(selector=>{
      const el=document.querySelector<HTMLElement>(selector);
      return el?.getClientRects().length?[{selector,rect:el.getBoundingClientRect()}]:[];
    });
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
      collisions:portalRegions.flatMap((a,i)=>portalRegions.slice(i+1).filter(b=>Math.min(a.rect.right,b.rect.right)-Math.max(a.rect.left,b.rect.left)>1&&Math.min(a.rect.bottom,b.rect.bottom)-Math.max(a.rect.top,b.rect.top)>1).map(b=>`${a.selector} overlaps ${b.selector}`)),
      titleTop:document.querySelector('#atlas .passage-reading')?.getBoundingClientRect().top,
      headerBottom:header.bottom,
      regions:[...document.querySelectorAll<HTMLElement>('#main,.passage-reading,.passage-viewport,.passage-instrument,.atlas-arrival-footer,.gateway-composition,.automatic-entry,.recall-library-section')].filter(el=>el.getClientRects().length).map(el=>({name:el.className,top:el.getBoundingClientRect().top,height:el.getBoundingClientRect().height})),
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
const phones=[{width:320,height:480},{width:320,height:568},{width:359,height:603},{width:390,height:660},{width:390,height:844},{width:430,height:932},{width:568,height:320},{width:683,height:384},{width:844,height:390}];
for(const viewport of phones){
  test(`${viewport.width}×${viewport.height}: viewport scene keeps all five home destinations above the dock without scrolling`,async({page})=>{
    await page.setViewportSize(viewport);await installFixtures(page);
    await page.addInitScript(player=>localStorage.setItem('riftscry:recent-player:v1',JSON.stringify(player)),{platform,puuid,name:'Jhinghis Han with a long player name#EUNE'});
    await page.goto('/');await ready(page);
    for(let i=0;i<5;i++){
      const metrics=await record(page,`home-${viewport.width}x${viewport.height}-${i}`);
      expect.soft(metrics.scroll,JSON.stringify(metrics)).toBeLessThanOrEqual(1);
      expect.soft(metrics.horizontal).toBeLessThanOrEqual(1);
      expect.soft(metrics.clipped).toEqual([]);expect.soft(metrics.nested).toEqual([]);
      expect.soft(metrics.collisions).toEqual([]);
      expect.soft(metrics.titleTop).toBeGreaterThanOrEqual(metrics.headerBottom);
      await expect(page.locator('#atlas [data-passage-enter]')).toBeInViewport({ratio:1});
      if(i<4)await page.locator('#atlas [data-passage-step="1"]').click();
    }
    await page.mouse.move(20,120);await page.mouse.wheel(0,600);
    await page.evaluate(()=>window.scrollTo({top:1000,behavior:'instant'}));
    expect(await page.evaluate(()=>scrollY)).toBe(0);
  });
}
for(const viewport of [{width:320,height:568},{width:390,height:844}]){
  test(`${viewport.width}×${viewport.height}: viewport scene fits small utility pages and preserves long document scrolling`,async({page})=>{
    await page.setViewportSize(viewport);await installFixtures(page,{matches:visualMatches});
    for(const route of ['/players','/next-game','/notebook','/404']){
      await page.goto(route);await ready(page);
      const metrics=await record(page,`${route.slice(1)}-${viewport.width}x${viewport.height}`);
      expect.soft(metrics.scroll,route+' '+JSON.stringify(metrics)).toBeLessThanOrEqual(1);
      expect.soft(metrics.clipped,route).toEqual([]);expect.soft(metrics.nested,route).toEqual([]);
    }
    await page.goto(profilePath);await ready(page);await expect(page.locator('.match-row').first()).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollHeight-innerHeight)).toBeGreaterThan(100);
    await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));
    expect(await page.evaluate(()=>scrollY)).toBeGreaterThan(100);
  });
  test(`${viewport.width}×${viewport.height}: viewport scene home chapters retain accessible actions`,async({page})=>{
    await page.setViewportSize(viewport);await installFixtures(page);await page.goto('/');await ready(page);
    await page.locator('.atlas-follow-signal').click();
    for(const scene of ['signal','reveal','carry']){
      await page.locator(`[data-journey-tab="${scene}"]`).click();
      const metrics=await record(page,`${scene}-${viewport.width}x${viewport.height}`);
      expect.soft(metrics.scroll,JSON.stringify(metrics)).toBeLessThanOrEqual(1);
      expect.soft(metrics.clipped).toEqual([]);expect.soft(metrics.nested).toEqual([]);
    }
  });
}
test('viewport scene responds to browser chrome, rotation and native Back without trapping forms',async({page})=>{
  await installFixtures(page);await page.setViewportSize({width:390,height:844});await page.goto('/');await ready(page);
  for(const size of [{width:390,height:660},{width:844,height:390},{width:390,height:844}]){
    await page.setViewportSize(size);
    await expect.poll(async()=>(await measure(page)).scroll).toBeLessThanOrEqual(1);
    expect((await measure(page)).clipped).toEqual([]);
  }
  await page.locator('.journey-dock [data-station-link="players"]').click();await ready(page);
  await page.goBack();await ready(page);expect(await page.evaluate(()=>scrollY)).toBe(0);
  expect((await measure(page)).scroll).toBeLessThanOrEqual(1);
  await page.goto('/players');await ready(page);
  await page.getByLabel('Riot ID',{exact:true}).fill('Test#EUNE');
  await page.setViewportSize({width:390,height:430});
  await page.getByRole('button',{name:'Find player',exact:true}).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button',{name:'Find player',exact:true})).toBeInViewport({ratio:1});
  expect(await page.locator('body').evaluate(el=>getComputedStyle(el).overflowY)).not.toBe('hidden');
});
