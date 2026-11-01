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

test.describe('Mobile chapter focus',()=>{
  test.use({viewport:{width:390,height:844},hasTouch:true});

  test('one homepage: chapter navigation never frames the page and controls retain keyboard focus',async({page})=>{
    await installFixtures(page);await page.goto('/');
    await expect(page.locator('body')).toHaveAttribute('data-journey-ready','true');
    await page.evaluate(()=>document.fonts.ready);
    const atlas=page.locator('#atlas');const signal=page.locator('#signal');
    const change=atlas.locator('.atlas-follow-signal');const previous=page.locator('[data-journey-prev]');
    // Keyboard modality used to transfer the full-panel focus outline to each
    // chapter. Assert the actual navigation focus, rather than a fresh page load.
    await change.focus();await page.keyboard.press('Enter');
    await expect(signal).toBeFocused();
    expect(await signal.evaluate(element=>element.matches(':focus-visible'))).toBe(true);
    await expect(signal).toHaveCSS('outline-style','none');
    await previous.focus();await page.keyboard.press('Enter');
    await expect(atlas).toBeFocused();await expect(atlas).toHaveCSS('outline-style','none');
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    await mkdir('player-visuals',{recursive:true});
    await page.screenshot({path:'player-visuals/home-focused-chapter-390x844.png',fullPage:true});

    const entry=atlas.locator('[data-home-briefing]');
    await entry.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');
    await expect(entry).toBeFocused();
    expect(await entry.evaluate(element=>element.matches(':focus-visible'))).toBe(true);
    await expect.poll(()=>entry.evaluate(element=>{
      const style=getComputedStyle(element);
      return style.outlineStyle!=='none'&&parseFloat(style.outlineWidth)>0;
    })).toBe(true);

    // Touch navigation after keyboard use must not bring back the chapter frame.
    await change.tap();await expect(signal).toBeFocused();
    await expect(signal).toHaveCSS('outline-style','none');
    await previous.tap();await expect(atlas).toBeFocused();
    await expect(atlas).toHaveCSS('outline-style','none');
  });
});

for(const viewport of [{width:320,height:568},{width:390,height:844},{width:683,height:384},{width:844,height:390},{width:1366,height:600},{width:1366,height:768},{width:1440,height:900},{width:1920,height:1080}]){
  test(`${viewport.width}×${viewport.height}: one homepage, one title and no overlapping controls`,async({page})=>{
    await page.setViewportSize(viewport);await page.emulateMedia({reducedMotion:'reduce'});
    const requests=await installFixtures(page);await page.goto('/');
    await expect(page.locator('body')).toHaveAttribute('data-journey-ready','true');await page.evaluate(()=>document.fonts.ready);
    await expect(page.locator('main h1')).toHaveCount(1);await expect(page.locator('#atlas h2')).toHaveCount(0);
    await expect(page.locator('.journey-chrome')).toBeVisible();
    await expect(page.locator('#main [data-rift-atlas]')).toHaveCount(0);
    await expect(page.locator('[data-home-world]')).toHaveAttribute('data-film-paint','ready');
    for(const id of ['atlas','signal','reveal','carry']){
      await page.locator(`[data-journey-tab="${id}"]`).click();
      await expect(page.locator('[data-journey-panel]:visible')).toHaveCount(1);
      const bounds=await page.locator(`#${id}`).boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(viewport.width+1);
      const dock=(await page.locator('.journey-chrome').boundingBox())!;
      for(const action of await page.locator(`#${id} a,#${id} button`).all()){
        if(!await action.isVisible())continue;
        const box=(await action.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(43.99);expect(box.y+box.height).toBeLessThanOrEqual(dock.y-8);
      }
      expect(await page.evaluate(()=>document.documentElement.scrollHeight-innerHeight)).toBeLessThanOrEqual(1);
    }
    expect(requests).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
    await page.locator('[data-map-open]').click();const menu=page.locator('#rift-map-dialog [data-passage]');await separated(menu);
    for(const stop of await menu.locator('[data-passage-stop]').all()){
      await stop.scrollIntoViewIfNeeded();await expect(stop).toBeInViewport({ratio:.99});
    }
    await page.locator('[data-map-close]').click();
    await page.locator('[data-journey-tab="atlas"]').click();
    await expect(page.locator('#atlas h1')).toHaveAccessibleName('Every game leaves a ripple.');
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    await mkdir('player-visuals',{recursive:true});await page.screenshot({path:`player-visuals/home-${viewport.width}x${viewport.height}.png`,fullPage:true});
  });
}
