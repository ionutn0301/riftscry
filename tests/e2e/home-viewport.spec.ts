import { test, expect } from '@playwright/test';
import { readyWorld, stationaryWorld, unobstructed } from './journey-test-helpers';

const sizes = [[320,480],[320,568],[390,844],[480,320],[568,320],[844,390],[768,1024],[1024,768],[1101,879],[1101,880],[1366,768],[1440,900],[1920,880],[1920,1080]] as const;
const player = { platform:'eun1', puuid:'fixture-player-000000000000000000000000000000000', name:`${'LongPlayerName'.repeat(9)}#TEST` };
for (const [width,height] of sizes) test(`the world fits ${width}×${height} for new and returning players`, async ({page}) => {
  await page.setViewportSize({width,height}); await page.emulateMedia({reducedMotion:'reduce'});
  for (const state of ['new','returning'] as const) {
    if (state === 'returning') await page.addInitScript(selected => localStorage.setItem('riftscry:recent-player:v1',JSON.stringify(selected)),player);
    await page.goto('/'); await readyWorld(page);
    const world=page.locator('[data-observatory]');
    const panel=world.locator('[data-journey-panel]');
    const bounds=(await panel.boundingBox())!;
    const header=(await page.locator('.world-controls').boundingBox())!;
    expect(bounds.y).toBeGreaterThanOrEqual(header.y+header.height-1);
    expect(bounds.y+bounds.height).toBeLessThanOrEqual(height+1);
    await expect(world.locator('h1')).toBeInViewport({ratio:0.99});
    if(state==='returning') await expect(page.locator('[data-resume-name]')).toHaveText(player.name);
    else await expect(page.locator('[data-observatory-return]')).toBeHidden();
    await stationaryWorld(page);
    for (const link of await world.getByRole('link').all()) {
      const label=await link.getAttribute('aria-label');
      if(label){
        const visibleLabel=await link.evaluate(element=>{
          const text:string[]=[]; const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);
          while(walker.nextNode()){const parent=walker.currentNode.parentElement;if(parent&&!parent.closest('[aria-hidden="true"]')&&parent.getClientRects().length)text.push(walker.currentNode.textContent??'');}
          return text.join(' ').replace(/\s+/g,' ').trim().toLowerCase();
        });
        expect(label.replace(/\s+/g,' ').toLowerCase()).toContain(visibleLabel);
      }
      const target=(await link.boundingBox())!;
      expect(target.height).toBeGreaterThanOrEqual(44);expect(target.width).toBeGreaterThanOrEqual(44);
      expect(target.x).toBeGreaterThanOrEqual(-1);expect(target.x+target.width).toBeLessThanOrEqual(width+1);expect(target.y+target.height).toBeLessThanOrEqual(height+1);
      await unobstructed(link);
    }
    expect(await panel.evaluate(element=>[element,...element.querySelectorAll('*')].some(node=>/^(auto|scroll)$/.test(getComputedStyle(node).overflowY)&&node.scrollHeight>node.clientHeight+1))).toBe(false);
  }
});

test('the world refits after a returning player rotates portrait and landscape',async({page})=>{
  await page.addInitScript(selected=>localStorage.setItem('riftscry:recent-player:v1',JSON.stringify(selected)),player);
  await page.setViewportSize({width:390,height:844});await page.goto('/');await readyWorld(page);
  for(const viewport of [{width:844,height:390},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    await expect(page.locator('[data-resume-link]')).toBeInViewport({ratio:0.99});
    for(const link of await page.locator('[data-observatory] [data-world-link]').all())await unobstructed(link);
    await stationaryWorld(page);
  }
});

test('remembering a player does not move the world heading or destination rail',async({page})=>{
  for(const viewport of [{width:390,height:844},{width:844,height:390},{width:1440,height:900}]){
    await page.setViewportSize(viewport);await page.goto('/');await readyWorld(page);
    const position=()=>page.evaluate(()=>({heading:document.querySelector('#observatory-title')!.getBoundingClientRect().top,footer:document.querySelector('.journey-route-controls')!.getBoundingClientRect().top,scroll:scrollY}));
    const before=await position();
    await page.evaluate(selected=>{localStorage.setItem('riftscry:recent-player:v1',JSON.stringify(selected));window.dispatchEvent(new Event('riftscry:recent-player-change'));},player);
    await expect(page.locator('[data-resume-name]')).toHaveText(player.name);
    const after=await position();for(const key of ['heading','footer','scroll'] as const)expect(Math.abs(after[key]-before[key])).toBeLessThanOrEqual(1);
    await page.evaluate(()=>localStorage.clear());
  }
});
