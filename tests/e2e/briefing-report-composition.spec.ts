import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {installFixtures,makeMatch,baseTime} from '../player-e2e/fixtures';

// Reported route shape, with synthetic identity and records. The production
// build, hydration and browser motion are real; no live player data is saved.
const playerId='composition-player-Aa09_-000000000000000000000000000000000000000000000000000000000000';
const query=`platform=eun1&puuid=${playerId}&name=Fixture+Player%23EUNE`;
const path=`/next-game?${query}`;
const records=Array.from({length:20},(_,index)=>{
  const match=makeMatch(`EUN1_${90000+index}`,baseTime-index*1_500_000);
  match.info.participants=match.info.participants.map(person=>({...person,puuid:playerId}));
  return match;
});
test.use({video:'on'});
test.beforeEach(async({page})=>{await page.emulateMedia({reducedMotion:'no-preference'});});

async function shell(page:Page){
  // Named snapshot layers own paint until a native crossing finishes. Then
  // the real dock must be immediately reachable, including on BFCache restore.
  await expect.poll(()=>page.locator('.journey-chrome').evaluate(dock=>{
    const r=dock.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    return Boolean(hit&&dock.contains(hit));
  })).toBe(true);
  const result=await page.evaluate(()=>{
    const dock=document.querySelector<HTMLElement>('.journey-chrome')!,r=dock.getBoundingClientRect();
    const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    return {height:r.height,bottom:innerHeight-r.bottom,position:getComputedStyle(dock).position,
      hit:Boolean(hit&&dock.contains(hit)),horizontal:document.documentElement.scrollWidth-innerWidth,
      active:[...document.querySelectorAll<HTMLElement>('[data-journey-panel]')].filter(el=>el.getClientRects().length>0).map(el=>el.id),
      navTransition:getComputedStyle(dock).viewTransitionName,
      stageZ:getComputedStyle(document.documentElement,'::view-transition-group(journey-stage)').zIndex,
      navZ:getComputedStyle(document.documentElement,'::view-transition-group(journey-navigation)').zIndex};
  });
  expect.soft(result.height).toBe(68);expect.soft(result.bottom).toBeGreaterThanOrEqual(11);
  expect.soft(result.position).toBe('fixed');expect.soft(result.hit).toBe(true);
  expect.soft(result.horizontal).toBeLessThanOrEqual(1);expect.soft(result.active).toHaveLength(1);
  await expect(page.locator('.journey-dock > [aria-current]')).toHaveAccessibleName('Briefing');
  return result;
}
async function capture(page:Page,name:string){
  await mkdir('player-visuals',{recursive:true});
  await page.screenshot({path:`player-visuals/briefing-${name}.png`});
  await writeFile(`player-visuals/briefing-${name}.json`,JSON.stringify(await shell(page),null,2));
}
for(const viewport of [{width:320,height:568},{width:390,height:844},{width:844,height:390},{width:1440,height:900}]){
  test(`${viewport.width}×${viewport.height}: populated briefing keeps one stable focus and visible dock through import`,async({page},info)=>{
    test.setTimeout(60_000);await page.setViewportSize(viewport);
    let first!:()=>void,remaining!:()=>void;
    const firstBatch=new Promise<void>(resolve=>{first=resolve;}),rest=new Promise<void>(resolve=>{remaining=resolve;});
    await installFixtures(page,{matches:records,beforeMatch:id=>Number(id.split('_')[1])>=90000&&Number(id.split('_')[1])<90004?firstBatch:rest});
    await page.goto(path);await expect(page.locator('body')).toHaveAttribute('data-journey-ready','true');
    await page.evaluate(()=>document.fonts.ready);
    const focus=await page.locator('#focus').elementHandle();
    const prefix=`${info.project.name}-${viewport.width}x${viewport.height}`;
    await capture(page,`${prefix}-loading`);
    first();await expect(page.locator('.automatic-sample')).toContainText('4 of 20');
    expect.soft(await focus!.evaluate(node=>node.isConnected),'The loading stage must remain mounted as match batches arrive').toBe(true);
    await expect.soft(page.locator('[data-automatic-focus]')).toHaveCount(0);
    await capture(page,`${prefix}-partial`);
    remaining();await expect(page.locator('[data-briefing-report]')).toHaveAttribute('aria-busy','false');
    await expect(page.locator('.automatic-sample')).toContainText('20 of 20');
    expect.soft(await focus!.evaluate(node=>node.isConnected),'The completed report must use the same focus stage').toBe(true);
    await expect(page.locator('[data-automatic-focus]')).toHaveCount(1);
    await capture(page,`${prefix}-ready`);
    for(const scene of ['changes','impact','loadout','focus']){
      await page.locator(`[data-journey-tab="${scene}"]`).click();
      await expect(page.locator(`#${scene}`)).toBeVisible();
      await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));
      await shell(page);
      await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    }
    await page.locator('.signal-player-scope > summary').click();await shell(page);
    await page.locator('.automatic-refresh').click();
    await expect(page.locator('[data-briefing-report]')).toHaveAttribute('aria-busy','false');
    expect(await focus!.evaluate(node=>node.isConnected)).toBe(true);
  });
}
test('populated briefing navigation paints the dock above the incoming page camera',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});await installFixtures(page,{matches:records});
  await page.addInitScript(player=>localStorage.setItem('riftscry:recent-player:v1',JSON.stringify(player)),{platform:'eun1',puuid:playerId,name:'Fixture Player#EUNE'});
  await page.goto('/');await page.locator('.journey-dock [data-station-link="next-game"]').click();
  await expect(page.locator('[data-briefing-report]')).toHaveAttribute('aria-busy','false');
  await expect(page.locator('body')).toHaveAttribute('data-journey-ready','true');
  const result=await shell(page);
  expect(result.navTransition,'The fixed dock needs its own paint layer during native page crossings').toBe('journey-navigation');
  expect(Number(result.navZ)).toBeGreaterThan(Number(result.stageZ));
  await capture(page,`${info.project.name}-native-entry`);
  await page.goBack();await expect(page.locator('#atlas')).toBeVisible();
  await page.goForward();await expect(page.locator('[data-briefing-report]')).toHaveAttribute('aria-busy','false');
  await shell(page);
});
test('populated briefing keeps its navigation and compact shell before hydration',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});await installFixtures(page,{matches:records});
  let release!:()=>void;const scripts=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/_astro/*.js',async route=>{await scripts;await route.continue();});
  await page.goto(path,{waitUntil:'commit'});
  await expect(page.locator('.automatic-loading')).toBeVisible();
  expect(await page.locator('.automatic-wrap').evaluate(el=>getComputedStyle(el).display)).toBe('contents');
  const before=await shell(page);
  await capture(page,`${info.project.name}-pending-scripts`);
  release();await expect(page.locator('[data-briefing-report]')).toHaveAttribute('aria-busy','false');
  await expect(page.locator('body')).toHaveAttribute('data-journey-ready','true');
  const after=await shell(page);expect(after.height).toBe(before.height);expect(after.bottom).toBe(before.bottom);
});
