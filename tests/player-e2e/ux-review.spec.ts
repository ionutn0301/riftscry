import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {installFixtures,platform,puuid,profilePath,query,recentAramWin,visualMatches} from './fixtures';

async function ready(page:Page){
  await expect(page.locator('body')).toHaveAttribute('data-journey-ready','true');
  await expect(page.locator('astro-island[client="load"][ssr]')).toHaveCount(0);
  await page.evaluate(()=>document.fonts.ready);
}
async function capture(page:Page,name:string){
  await mkdir('player-visuals',{recursive:true});
  await page.screenshot({path:`player-visuals/ux-${name}.png`});
}

test('UX audit: returning player controls fit above the dock through rotation and disclosure',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.addInitScript(player=>localStorage.setItem('riftscry:remembered-player:v1',JSON.stringify(player)),{platform,puuid,name:'ABCDEFGHIJKLMNOP#ABCDE'});
  await installFixtures(page,{matches:visualMatches});await page.setViewportSize({width:568,height:320});
  await page.goto('/players?view=builds&queue=450&champion=Ahri&result=win');await ready(page);
  for(const viewport of [{width:568,height:320},{width:320,height:568},{width:844,height:390},{width:1440,height:900}]){
    await page.setViewportSize(viewport);
    const dock=(await page.locator('.journey-chrome').boundingBox())!;
    for(const control of await page.locator('[data-player-gateway] summary:visible,.remembered-player').all()){
      const box=(await control.boundingBox())!;
      expect.soft(box.height).toBeGreaterThanOrEqual(44);
      expect.soft(box.y+box.height).toBeLessThanOrEqual(dock.y-8);
      expect.soft(await control.evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===el||Boolean(hit&&el.contains(hit));})).toBe(true);
    }
    expect.soft(await page.evaluate(()=>document.documentElement.scrollHeight-innerHeight)).toBeLessThanOrEqual(1);
    await capture(page,`returning-player-${viewport.width}x${viewport.height}`);
  }
  await page.setViewportSize({width:568,height:320});
  const privacy=page.locator('.gateway-privacy > summary');await privacy.click();
  await expect(page.locator('.gateway-privacy')).toHaveJSProperty('open',true);
  await page.locator('.gateway-privacy p').scrollIntoViewIfNeeded();await expect(page.locator('.gateway-privacy p')).toBeInViewport({ratio:1});
  await privacy.click();await expect(page.locator('.gateway-privacy')).toHaveJSProperty('open',false);
  await page.locator('.remembered-player').click();
  await expect(page).toHaveURL(url=>url.pathname===profilePath&&url.searchParams.get('view')==='builds'&&url.searchParams.get('champion')==='Ahri');
});

for(const viewport of [{width:320,height:568},{width:390,height:844},{width:1440,height:900}]){
  test(`${viewport.width}px UX audit: chapter names stay whole and have complete accessible labels`,async({page})=>{
    test.setTimeout(90_000);await page.setViewportSize(viewport);await installFixtures(page,{matches:visualMatches});
    const report=[];
    for(const path of ['/','/explore','/champion/nunu','/pool','/notebook',`/matches/${recentAramWin.metadata.matchId}?${query}`,`/next-game?${query}`]){
      await page.goto(path);await ready(page);
      const labels=await page.locator('[data-journey-tab]').evaluateAll(tabs=>tabs.map(tab=>{
        const text=tab.firstChild,words=tab.textContent?.match(/\S+/g)??[];
        let offset=0;const broken:string[]=[];
        for(const word of words){
          if(!text)continue;
          const start=text.textContent!.indexOf(word,offset),range=document.createRange();
          range.setStart(text,start);range.setEnd(text,start+word.length);offset=start+word.length;
          const lines=new Set([...range.getClientRects()].map(r=>Math.round(r.y)));
          if(lines.size>1)broken.push(word);
        }
        const r=tab.getBoundingClientRect();return {text:tab.textContent,name:tab.getAttribute('aria-label'),height:r.height,broken,width:r.width,overflow:tab.scrollWidth-tab.clientWidth};
      }));report.push({path,labels});
      for(const label of labels){expect.soft(label.broken,path).toEqual([]);expect.soft(label.name).toBeTruthy();expect.soft(label.height).toBeGreaterThanOrEqual(44);expect.soft(label.overflow,path).toBeLessThanOrEqual(1);}
      await capture(page,`chapters-${viewport.width}-${path.split('?')[0]!.replaceAll('/','-')||'home'}`);
    }
    await writeFile(`player-visuals/ux-chapters-${viewport.width}.json`,JSON.stringify(report,null,2));
  });

  test(`${viewport.width}px UX audit: empty collections have a clear useful next action`,async({page})=>{
    await page.setViewportSize(viewport);await installFixtures(page,{matches:visualMatches});
    await page.goto('/pool#findings');await ready(page);
    const finding=page.getByRole('link',{name:'Find your first change'});
    await expect(finding).toBeVisible();expect((await finding.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await capture(page,`empty-findings-${viewport.width}`);await finding.click();await expect(page.locator('#change')).toBeVisible();
    await page.goto('/notebook#notebook-history');await ready(page);
    await page.getByRole('link',{name:'Create a game card',exact:true}).click();await expect(page.locator('#game-card')).toBeVisible();
    await page.goto(profilePath+'?view=memory');await ready(page);
    const matches=page.getByRole('link',{name:'Open recent matches',exact:true});await expect(matches).toBeVisible();
    await matches.click();await expect(page.locator('.match-row')).toHaveCount(visualMatches.length);
    if(viewport.width===320){
      const sizes=await page.locator('.mode-families button').evaluateAll(buttons=>buttons.map(button=>({width:button.getBoundingClientRect().width,height:button.getBoundingClientRect().height,overflow:button.scrollWidth-button.clientWidth})));
      for(const size of sizes){expect(size.width).toBeGreaterThanOrEqual(44);expect(size.height).toBeGreaterThanOrEqual(44);expect(size.overflow).toBeLessThanOrEqual(1);}
    }
    await capture(page,`profile-${viewport.width}`);
  });
}

for(const target of [{path:'/players',name:'Find a League of Legends player',button:'Find player'},{path:'/next-game',name:'Get an automatic player briefing',button:'Get my briefing'}]){
  test(`UX audit: ${target.path} identifies invalid input and recovers from a failed lookup`,async({page})=>{
    await page.setViewportSize({width:390,height:844});let fail=true;
    const requests=await installFixtures(page,{matches:visualMatches,response:request=>request.action==='lookup'&&fail?{status:503,json:{error:'Player lookup is temporarily unavailable.'}}:undefined});
    await page.goto(target.path);await ready(page);
    const form=page.getByRole('form',{name:target.name,exact:true}),field=form.getByRole('textbox',{name:'Riot ID',exact:true});
    await field.fill('NoTag');await form.getByRole('button',{name:target.button,exact:true}).click();
    await expect(field).toHaveAttribute('aria-invalid','true');await expect(field).toBeFocused();
    const status=page.locator('#'+await field.getAttribute('aria-describedby'));await expect(status).toContainText('including #tagline');
    expect(requests).toEqual([]);
    await field.fill('Fixture Player#TEST');await form.getByLabel('Server',{exact:true}).selectOption(platform);
    await expect(field).not.toHaveAttribute('aria-invalid','true');await form.getByRole('button',{name:target.button,exact:true}).click();
    await expect(status).toContainText('temporarily unavailable');await expect(field).toHaveValue('Fixture Player#TEST');await expect(field).toBeEnabled();
    await capture(page,`lookup-error-${target.path.slice(1)}`);
    fail=false;await form.getByRole('button',{name:target.button,exact:true}).click();
    if(target.path==='/players')await expect(page.locator('.match-row')).toHaveCount(visualMatches.length);
    else await expect(page.locator('[data-briefing-report]')).toHaveAttribute('aria-busy','false');
  });
}

test('UX audit: search distinguishes loading, failure and no matches and offers a working retry',async({page})=>{
  await page.setViewportSize({width:390,height:844});let release!:()=>void;
  const held=new Promise<void>(resolve=>{release=resolve;});let first=true;
  await page.route('**/search-index.json',async route=>{
    if(first){first=false;await held;await route.fulfill({status:503,json:{error:'Unavailable'}});}
    else await route.fulfill({json:[{type:'champion',label:'Azir',href:'/champion/azir',keywords:['emperor']} ]});
  });
  await page.goto('/champions');await ready(page);
  const trigger=page.getByRole('banner',{name:'RiftScry controls'}).getByRole('button',{name:'Search the archive',exact:true});
  await trigger.click();const search=page.getByRole('dialog',{name:'Search RiftScry'});
  await expect(search.getByRole('status')).toHaveText('Opening the archive…');await expect(search.locator('[cmdk-empty]')).toHaveCount(0);
  release();await expect(search.getByRole('alert')).toContainText('temporarily unavailable');await capture(page,'search-error');
  await search.getByRole('button',{name:'Try again',exact:true}).click();await expect(search.getByRole('option',{name:'Azir',exact:true})).toBeVisible();
  await search.getByRole('combobox',{name:'Search champions, patches, items, and systems'}).fill('no-such-champion');await expect(search.locator('[cmdk-empty]')).toContainText('No matches');
  await page.keyboard.press('Escape');await expect(search).toHaveCount(0);await expect(trigger).toBeFocused();
  await trigger.click();await search.getByRole('combobox').fill('Azir');await search.getByRole('option',{name:'Azir',exact:true}).click();
  await expect(page).toHaveURL(/\/champion\/azir\/?$/);
});
