import {test,expect,type Locator} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {installFixtures} from './fixtures';

async function separated(passage:Locator){
  const collisions=await passage.evaluate(root=>{
    const boxes=['.passage-reading','.passage-viewport','.passage-instrument','.passage-stops'].map(selector=>({selector,rect:root.querySelector(selector)!.getBoundingClientRect()}));
    return boxes.flatMap((a,i)=>boxes.slice(i+1).filter(b=>Math.min(a.rect.right,b.rect.right)-Math.max(a.rect.left,b.rect.left)>1&&Math.min(a.rect.bottom,b.rect.bottom)-Math.max(a.rect.top,b.rect.top)>1).map(b=>`${a.selector} overlaps ${b.selector}`));
  });
  expect(collisions).toEqual([]);
}

for(const viewport of [{width:320,height:568},{width:390,height:844},{width:683,height:384},{width:844,height:390},{width:1366,height:768},{width:1440,height:900},{width:1920,height:1080}]){
  test(`${viewport.width}×${viewport.height}: one homepage, one title and no overlapping controls`,async({page})=>{
    await page.setViewportSize(viewport);await page.emulateMedia({reducedMotion:'reduce'});
    const requests=await installFixtures(page);await page.goto('/');
    await expect(page.locator('body')).toHaveAttribute('data-journey-ready','true');await page.evaluate(()=>document.fonts.ready);
    const entrance=page.locator('#atlas [data-passage]');
    await expect(page.locator('main h1')).toHaveCount(1);await expect(page.locator('#atlas h2')).toHaveCount(0);
    await expect(page.locator('.journey-chrome')).toBeHidden();
    await expect(page.locator('#atlas [data-passage-enter]')).toHaveCount(1);
    for(let i=0;i<5;i++){
      await separated(entrance);
      const bounds=await entrance.locator('[data-passage-title]').boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(viewport.width+1);
      if(i<4)await entrance.locator('[data-passage-step="1"]').click();
    }
    expect(requests).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
    await page.locator('[data-map-open]').click();const menu=page.locator('#rift-map-dialog [data-passage]');await separated(menu);
    for(const stop of await menu.locator('[data-passage-stop]').all()){
      await stop.scrollIntoViewIfNeeded();await expect(stop).toBeInViewport({ratio:.99});
    }
    await page.locator('[data-map-close]').click();
    await entrance.locator('[data-passage-range]').focus();await page.keyboard.press('Home');
    await expect(entrance.locator('h1')).toHaveAccessibleName('Every game leaves a ripple.');
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    await mkdir('player-visuals',{recursive:true});await page.screenshot({path:`player-visuals/home-${viewport.width}x${viewport.height}.png`,fullPage:true});
  });
}
