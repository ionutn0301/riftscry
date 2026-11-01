import {expect,test,type Locator} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {installFixtures} from './fixtures';

async function top(element:Locator){return (await element.boundingBox())!.y;}

for(const viewport of [{width:1024,height:600},{width:1366,height:768},{width:1440,height:900}]){
  test(`${viewport.width}×${viewport.height}: champion preview stays pinned while scrolling from either column`,async({page})=>{
    await page.setViewportSize(viewport);await installFixtures(page);await page.goto('/champions');
    await expect(page.locator('body')).toHaveAttribute('data-journey-ready','true');
    await page.evaluate(()=>document.fonts.ready);
    const lens=page.locator('.journey-roster-lens');const media=lens.locator('[data-reader-lens-media]');
    await expect(lens).toBeInViewport({ratio:.99});
    const initial=await lens.boundingBox();const imageTop=await top(media);
    expect(initial!.x+initial!.width).toBeLessThan(viewport.width*.6);
    // The stage is centered in the usable screen, independent of roster length.
    expect(Math.abs(initial!.y+initial!.height/2-viewport.height/2)).toBeLessThan(50);
    await page.locator('[data-roster-expand]').click();
    const rows=page.locator('[data-roster-row]:visible');
    expect(await rows.count()).toBeGreaterThan(100);
    expect(Math.abs(await top(media)-imageTop)).toBeLessThanOrEqual(1);
    const firstTop=await top(rows.first());
    await media.hover();await page.mouse.wheel(0,500);
    await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(400);
    expect(Math.abs(await top(media)-imageTop)).toBeLessThanOrEqual(1);
    expect(await top(rows.first())).toBeLessThan(firstTop-400);

    await page.mouse.move(viewport.width*.8,viewport.height*.6);
    const before=await page.evaluate(()=>scrollY);await page.mouse.wheel(0,500);
    await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(before+400);
    expect(Math.abs(await top(media)-imageTop)).toBeLessThanOrEqual(1);
    await mkdir('player-visuals',{recursive:true});
    await page.screenshot({path:`player-visuals/champions-pinned-${viewport.width}x${viewport.height}.png`});

    await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));
    await expect(rows.last()).toBeInViewport({ratio:.99});
    expect(Math.abs(await top(media)-imageTop)).toBeLessThanOrEqual(1);
    await expect(lens.locator('[data-reader-champion-link]')).toBeInViewport({ratio:.99});
    await page.screenshot({path:`player-visuals/champions-last-row-${viewport.width}x${viewport.height}.png`});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
    // Retain native document scrolling: no wheel forwarding or trapped inner list.
    expect(await page.locator('#main').evaluate(main=>[...main.querySelectorAll('*')].filter(element=>
      /^(auto|scroll)$/.test(getComputedStyle(element).overflowY)&&element.scrollHeight>element.clientHeight+3).length)).toBe(0);

    await page.locator('[data-roster-search]').fill('Ahri');
    await expect(rows).toHaveCount(1);await expect(lens).toHaveAttribute('data-reader-key','Ahri');
    await expect(media).toBeInViewport({ratio:.99});
  });
}

test('390px champion preview stays pinned only on desktop; mobile keeps one document scroll',async({page})=>{
  await page.setViewportSize({width:390,height:844});await installFixtures(page);await page.goto('/champions');
  await expect(page.locator('body')).toHaveAttribute('data-journey-ready','true');
  await page.locator('[data-roster-search]').fill('Ahri');
  await expect(page.locator('[data-roster-row]:visible')).toHaveCount(1);
  await expect(page.locator('.journey-roster-lens')).toHaveAttribute('data-reader-key','Ahri');
  await expect(page.locator('.journey-roster-lens')).toHaveCSS('position','static');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});
