import {test,expect,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {mapControl} from '../shared/navigation';
import {installFixtures,profilePath,query,recentAramWin,visualMatches} from './fixtures';
import {readyCinema,cinemaFitsViewport} from '../e2e/cinema-test-helpers';
import {readyWorld,reachableTarget} from '../e2e/journey-test-helpers';

// Intersect actual painted text ranges, not only the containers around them.
async function textCollisions(page:Page, selector:string){
  return page.locator(selector).evaluate(root=>{
    const text:{parent:Element,text:string,rect:DOMRect}[]=[];
    const walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    while(walk.nextNode()){
      const node=walk.currentNode,el=node.parentElement;
      if(!node.textContent?.trim()||!el?.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})||el.closest('script,style,svg,[aria-hidden=true],.sr-only,.visually-hidden,dialog:not([open])'))continue;
      const range=document.createRange();range.selectNodeContents(node);
      for(const source of range.getClientRects()){
        let left=source.left,right=source.right,top=source.top,bottom=source.bottom;
        // Ellipsized labels paint only inside their clipping ancestor.
        for(let ancestor:Element|null=el;ancestor&&root.contains(ancestor);ancestor=ancestor.parentElement){
          const style=getComputedStyle(ancestor),box=ancestor.getBoundingClientRect();
          if(/hidden|clip|auto|scroll/.test(style.overflowX)){left=Math.max(left,box.left);right=Math.min(right,box.right);}
          if(/hidden|clip|auto|scroll/.test(style.overflowY)){top=Math.max(top,box.top);bottom=Math.min(bottom,box.bottom);}
        }
        const rect=new DOMRect(left,top,right-left,bottom-top);
        if(rect.width>2&&rect.height>2)text.push({parent:el,text:node.textContent.trim().slice(0,80),rect});
      }
    }
    const collisions=[];
    for(let i=0;i<text.length;i++)for(let j=i+1;j<text.length;j++){
      const a=text[i]!,b=text[j]!;
      if(a.parent===b.parent||a.parent.contains(b.parent)||b.parent.contains(a.parent))continue;
      const dx=Math.min(a.rect.right,b.rect.right)-Math.max(a.rect.left,b.rect.left);
      const dy=Math.min(a.rect.bottom,b.rect.bottom)-Math.max(a.rect.top,b.rect.top);
      if(dx>2&&dy>3)collisions.push([a.text,b.text]);
    }
    return collisions;
  });
}
const widths=[320,390,480,568,700,701,760,761,1000,1001,1050,1051,1100,1101,1366,1440,1913,2560];
for(const state of ['guest','context','reading'] as const)test(`responsive audit: homepage ${state} text never collides across breakpoint boundaries`,async({page})=>{
  test.setTimeout(180_000);await installFixtures(page);await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(mode=>{
    if(mode==='context')localStorage.setItem('riftscry:signal-context:v1',JSON.stringify({championId:'Yasuo',name:'Yasuo',href:'/champion/yasuo'}));
    if(mode==='reading')localStorage.setItem('riftscry:resume',JSON.stringify({href:'/champion/heimerdinger',label:'Heimerdinger — a long saved reading with an exact historical record',updatedAt:new Date().toISOString()}));
  },state);
  await page.goto('/');await readyCinema(page);await mkdir('player-visuals',{recursive:true});
  for(const width of widths){
    const height=width===1913?917:width<600?568:width<1101?600:900;
    await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo(0,0));
    await cinemaFitsViewport(page);
    expect(await textCollisions(page,'[data-rift-cinema]'),`${state} ${width}×${height}`).toEqual([]);
    for(const el of await page.locator('[data-home-primary],.cinema-entry-actions a:visible,[data-home-choice]:visible,[data-home-review]').all())await reachableTarget(el,page);
    if([320,390,761,1101,1913].includes(width))await page.screenshot({path:`player-visuals/responsive-home-${state}-${width}.png`,fullPage:true});
  }
});

test('responsive audit: zoom reflow and short landscape keep document scrolling native',async({page})=>{
  await installFixtures(page);await page.setViewportSize({width:480,height:320});await page.goto('/');await readyCinema(page);
  // 960×640 at 200% and 1280×1024 at 400% have these effective CSS viewports.
  for(const viewport of [{width:480,height:320},{width:320,height:256}]){
    await page.setViewportSize(viewport);await page.evaluate(()=>scrollTo(0,0));
    await cinemaFitsViewport(page);
    expect(await textCollisions(page,'[data-rift-cinema]')).toEqual([]);
    const champion=await page.locator('[data-rift-cinema]').getAttribute('data-home-subject');
    await page.mouse.move(10,150);await page.mouse.wheel(0,180);
    await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(0);
    await expect(page.locator('[data-rift-cinema]')).toHaveAttribute('data-home-subject',champion!);
    await reachableTarget(page.locator('[data-home-review]'),page);
  }
});

const routes=[['champions','/champions'],['champion','/champion/heimerdinger'],['patches','/patches'],['patch','/patch/26.21'],['compare','/compare/26.21/26.20'],['pool','/pool#edit-pool'],['briefing',`/next-game?${query}`],['notebook','/notebook'],['players','/players'],['player',profilePath],['match',`/matches/${recentAramWin.metadata.matchId}?${query}`],['account','/account'],['profile','/profile'],['catch-up','/catch-up?champion=Heimerdinger'],['practice','/learn'],['practice-card','/learn/lux'],['guide','/guide']];
for(const viewport of [{width:320,height:568},{width:568,height:320},{width:1101,height:700},{width:1913,height:917}])test(`responsive audit: site task sections at ${viewport.width}×${viewport.height}`,async({page})=>{
  test.setTimeout(240_000);await page.setViewportSize(viewport);await installFixtures(page,{matches:visualMatches});await mkdir('player-visuals',{recursive:true});
  for(const [name,path] of routes){
    const response=await page.goto(path!);expect(response?.status(),path).toBe(200);await readyWorld(page);
    if(name==='briefing')await expect(page.locator('[data-briefing-report]')).toHaveAttribute('aria-busy','false');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),path).toBeLessThanOrEqual(1);
    for(const group of await page.locator('.journey-reader-header,.journey-roster-lens figcaption,.journey-chapters,.learning-page header,.automatic-entry').all()){
      if(!await group.isVisible())continue;
      // Separate adjacent regions; descendants may legitimately share a text line.
      const overlaps=await group.evaluate(el=>{
        const children=[...el.children].filter(c=>c.checkVisibility()).map(c=>({name:c.tagName,rect:c.getBoundingClientRect()}));
        return children.flatMap((a,i)=>children.slice(i+1).filter(b=>Math.min(a.rect.right,b.rect.right)-Math.max(a.rect.left,b.rect.left)>2&&Math.min(a.rect.bottom,b.rect.bottom)-Math.max(a.rect.top,b.rect.top)>2).map(b=>[a.name,b.name]));
      });
      expect(overlaps,`${path}: adjacent task regions overlap`).toEqual([]);
    }
    await page.screenshot({path:`player-visuals/responsive-${viewport.width}-${name}.png`,fullPage:true});
  }
});

for(const viewport of [{width:844,height:390},{width:1024,height:600},{width:1101,height:900}])test(`responsive audit: long champion preview at ${viewport.width}×${viewport.height}`,async({page})=>{
  await page.setViewportSize(viewport);await installFixtures(page);await page.goto('/champions');await readyWorld(page);
  const lens=page.locator('.journey-roster-lens');
  for(const name of ['Heimerdinger','Fiddlesticks','Nunu']){
    await page.locator('[data-roster-search]').fill(name);
    await expect(lens).toHaveAttribute('data-reader-key',name);
    expect(await textCollisions(page,'.journey-roster-lens')).toEqual([]);
    await reachableTarget(lens.locator('[data-reader-champion-link]'),page);
    if(viewport.height<=700)await expect(lens).not.toHaveCSS('position','sticky');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  }
});
for(const width of [480,568])test(`responsive audit: every landscape map footer destination is reachable at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:320});await installFixtures(page);
  await page.addInitScript(()=>localStorage.setItem('riftscry:resume',JSON.stringify({href:'/champion/heimerdinger',label:'Heimerdinger — a long saved reading with an exact historical record',updatedAt:new Date().toISOString()})));
  await page.goto('/champions');await readyWorld(page);await mapControl(page).click();
  for(const control of await page.locator('#rift-map-dialog .journey-map-footer :is(a,button):visible').all())await reachableTarget(control,page);
  expect(await textCollisions(page,'#rift-map-dialog .journey-map-footer')).toEqual([]);
});
