import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {installFixtures,profilePath,query,recentAramWin,visualMatches} from './fixtures';

async function ready(page:Page){
  await expect(page.locator('body')).toHaveAttribute('data-journey-ready','true');
  await expect(page.locator('astro-island[client="load"][ssr]')).toHaveCount(0);
  await page.evaluate(()=>document.fonts.ready);
}

// Measure the actual text, not just computed padding: nested wrappers can
// provide an inset, and transformed letters can escape an otherwise padded box.
async function paintedSurfaces(page:Page){
  return page.locator('main').evaluate(main=>[...main.querySelectorAll<HTMLElement>('article,section,aside,form,div,details')].flatMap(el=>{
    if(!el.checkVisibility()||el.closest('[aria-hidden="true"]'))return [];
    const r=el.getBoundingClientRect(),s=getComputedStyle(el);
    const alpha=Number(s.backgroundColor.match(/[\d.]+/g)?.[3]??(s.backgroundColor==='rgba(0, 0, 0, 0)'?0:1));
    if(r.width<160||r.height<40||(alpha<.18&&s.backgroundImage==='none'))return [];
    const ranges:DOMRect[]=[];const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
    while(walker.nextNode()){
      const node=walker.currentNode,parent=node.parentElement;
      if(!node.textContent?.trim()||!parent?.checkVisibility()||parent.closest('script,style,[aria-hidden="true"],.visually-hidden,.sr-only'))continue;
      const range=document.createRange();range.selectNodeContents(node);
      ranges.push(...[...range.getClientRects()].filter(b=>b.width>0&&b.height>0));
    }
    if(!ranges.length)return [];
    const inset={left:Math.min(...ranges.map(b=>b.left))-r.left,right:r.right-Math.max(...ranges.map(b=>b.right)),top:Math.min(...ranges.map(b=>b.top))-r.top,bottom:r.bottom-Math.max(...ranges.map(b=>b.bottom))};
    return [{element:el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+'.'+[...el.classList].join('.'),text:el.textContent?.trim().replace(/\s+/g,' ').slice(0,100),inset,padding:[s.paddingTop,s.paddingRight,s.paddingBottom,s.paddingLeft],rect:{x:r.x,y:r.y,width:r.width,height:r.height}}];
  }));
}

const routes=[['home','/'],['atlas','/explore'],['champions','/champions'],['champion','/champion/nunu'],['patches','/patches'],['patch','/patch/26.21'],['compare','/compare/26.21/26.20'],['pool','/pool#edit-pool'],['briefing-entry','/next-game'],['briefing',`/next-game?${query}`],['notebook','/notebook'],['players','/players?platform=eun1'],['profile',profilePath],['match',`/matches/${recentAramWin.metadata.matchId}?${query}`],['missing','/404']];
for(const viewport of [{width:320,height:568},{width:390,height:844},{width:844,height:390},{width:1440,height:900}]){
  test(`${viewport.width}px panel spacing audit across every route family`,async({page})=>{
    test.setTimeout(240_000);await page.setViewportSize(viewport);await page.emulateMedia({reducedMotion:'reduce'});
    await installFixtures(page,{matches:visualMatches});await mkdir('player-visuals',{recursive:true});
    const report=[];
    for(const [name,path] of routes){
      await page.goto(path!);await ready(page);
      if(name==='briefing')await expect(page.locator('[data-briefing-report]')).toHaveAttribute('aria-busy','false');
      const surfaces=await paintedSurfaces(page);report.push({name,path,surfaces});
      expect.soft(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),path).toBeLessThanOrEqual(1);
      await page.screenshot({path:`player-visuals/spacing-${viewport.width}-${name}.png`});
    }
    await writeFile(`player-visuals/spacing-${viewport.width}-audit.json`,JSON.stringify(report,null,2));
  });
}

for(const viewport of [{width:320,height:480},{width:320,height:568},{width:390,height:844},{width:568,height:320},{width:683,height:384},{width:1366,height:600},{width:1440,height:900}]){
  test(`${viewport.width}×${viewport.height} panel spacing contains every home finding and action`,async({page})=>{
    await page.setViewportSize(viewport);await page.emulateMedia({reducedMotion:'reduce'});
    await installFixtures(page);await page.goto('/');await ready(page);await mkdir('player-visuals',{recursive:true});
    const findings=await page.locator('[data-home-choice]').evaluateAll(nodes=>nodes.map(el=>el.getAttribute('data-home-choice')!));
    expect(findings).toHaveLength(3);
    const report=[];
    for(const finding of findings){
      await page.locator('[data-journey-tab="signal"]').click();await page.locator(`[data-home-choice="${finding}"]`).click();
      for(const scene of ['reveal','carry']){
        await page.locator(`[data-journey-tab="${scene}"]`).click();
        const panel=page.locator(`#${scene}`),desk=panel.locator('.signal-reveal-desk,.signal-carry-desk');
        const frame=(await panel.boundingBox())!,surface=(await desk.boundingBox())!;
        const measures=await paintedSurfaces(page);report.push({finding,scene,frame,surface,measures});
        // Capture before assertions so a failure remains visually reviewable.
        await page.screenshot({path:`player-visuals/spacing-home-${viewport.width}x${viewport.height}-${finding}-${scene}.png`});
        expect.soft(surface.y,`${finding} ${scene}: panel top`).toBeGreaterThanOrEqual(frame.y-1);
        expect.soft(surface.y+surface.height,`${finding} ${scene}: panel bottom`).toBeLessThanOrEqual(frame.y+frame.height+1);
        expect.soft(await desk.evaluate(el=>parseFloat(getComputedStyle(el).paddingLeft))).toBeGreaterThanOrEqual(12);
        for(const action of await desk.locator('a,button').all()){
          if(!await action.isVisible())continue;
          const box=(await action.boundingBox())!;
          expect.soft(box.height).toBeGreaterThanOrEqual(44);
          expect.soft(box.x-surface.x).toBeGreaterThanOrEqual(11.99);
          expect.soft(surface.x+surface.width-box.x-box.width).toBeGreaterThanOrEqual(11.99);
          expect.soft(box.y).toBeGreaterThanOrEqual(frame.y-1);
          expect.soft(box.y+box.height).toBeLessThanOrEqual(frame.y+frame.height+1);
        }
        expect.soft(await page.evaluate(()=>document.documentElement.scrollHeight-innerHeight)).toBeLessThanOrEqual(1);
        expect.soft(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
      }
    }
    await writeFile(`player-visuals/spacing-home-${viewport.width}x${viewport.height}.json`,JSON.stringify(report,null,2));
  });
}
