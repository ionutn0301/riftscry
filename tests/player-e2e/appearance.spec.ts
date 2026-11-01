import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {installFixtures} from './fixtures';

test('appearance themes work with device reduced motion and persist across the platform',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
  await installFixtures(page);await page.goto('/');
  const trigger=page.locator('[data-theme-toggle]');
  await expect(trigger).toBeEnabled();await trigger.click();
  const panel=page.locator('[data-appearance-panel]');await expect(panel).toBeVisible();
  const bounds=(await panel.boundingBox())!;expect(bounds.x).toBeGreaterThanOrEqual(12);expect(bounds.x+bounds.width).toBeLessThanOrEqual(378);
  await expect(page.locator('[data-motion-toggle]')).toBeDisabled();
  await expect(page.locator('[data-motion-hint]')).toHaveText('Your device has reduced motion enabled.');
  await page.locator('[data-theme-choice][value=ember]').check();
  await expect(page.locator('html')).toHaveAttribute('data-theme','ember');
  await expect(trigger).toHaveAccessibleName('Choose theme, Ember selected');
  await expect(page.locator('body')).toHaveCSS('background-color','rgb(20, 14, 12)');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content','#140e0c');
  expect(await page.evaluate(()=>localStorage.getItem('riftscry:theme'))).toBe('ember');
  await mkdir('player-visuals',{recursive:true});await page.screenshot({path:'player-visuals/theme-picker-390x844.png'});
  await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollHeight-innerHeight)).toBeLessThanOrEqual(1);
  await page.screenshot({path:'player-visuals/theme-ember-home-390x844.png'});
  await page.addInitScript(()=>{
    (window as any).__paintedThemes=[];
    new MutationObserver(()=>{const theme=document.documentElement?.dataset.theme;if(theme)(window as any).__paintedThemes.push(theme);}).observe(document,{subtree:true,attributes:true,attributeFilter:['data-theme']});
  });
  for(const path of ['/champions','/players','/next-game','/patches','/pool']){
    await page.goto(path,{waitUntil:'domcontentloaded'});
    await expect(page.locator('html')).toHaveAttribute('data-theme','ember');
    await expect(page.locator('[data-theme-toggle]')).toBeEnabled();
    await expect.poll(()=>page.evaluate(()=>(window as any).__paintedThemes.length)).toBeGreaterThan(0);
    expect(await page.evaluate(()=>(window as any).__paintedThemes.every((theme:string)=>theme==='ember'))).toBe(true);
  }
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','ember');
});

test('appearance themes support keyboard selection, storage updates and a return from history',async({page})=>{
  await page.goto('/');const trigger=page.locator('[data-theme-toggle]');
  await trigger.focus();await page.keyboard.press('Enter');
  await expect(page.locator('[data-theme-choice][value=frost]')).toBeFocused();
  await page.keyboard.press('ArrowRight');await expect(page.locator('html')).toHaveAttribute('data-theme','ember');
  await page.keyboard.press('ArrowRight');await expect(page.locator('html')).toHaveAttribute('data-theme','obsidian');
  await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
  await expect(page.locator('body')).toHaveCSS('background-color','rgb(14, 14, 16)');
  await trigger.click();await page.keyboard.press('Control+k');
  await expect(page.locator('[data-appearance-panel]')).toBeHidden();
  await expect(page.locator('[cmdk-input]')).toBeFocused();
  await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
  await page.evaluate(()=>{localStorage.setItem('riftscry:theme','frost');dispatchEvent(new StorageEvent('storage',{key:'riftscry:theme'}));});
  await expect(page.locator('html')).toHaveAttribute('data-theme','frost');
  await page.evaluate(()=>{localStorage.setItem('riftscry:theme','obsidian');dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
  await expect(page.locator('html')).toHaveAttribute('data-theme','obsidian');
  await page.setViewportSize({width:683,height:384});await trigger.click();
  const panel=(await page.locator('[data-appearance-panel]').boundingBox())!;
  expect(panel.x).toBeGreaterThanOrEqual(0);expect(panel.y+panel.height).toBeLessThanOrEqual(384);
  await mkdir('player-visuals',{recursive:true});await page.screenshot({path:'player-visuals/theme-obsidian-landscape.png'});
});

test('appearance themes stay usable when preference storage is unavailable',async({page})=>{
  await page.addInitScript(()=>{
    for(const method of ['getItem','setItem'] as const){const original=Storage.prototype[method];Object.defineProperty(Storage.prototype,method,{value:function(key:string,...args:string[]){if(key==='riftscry:theme')throw new DOMException('Unavailable','SecurityError');return Reflect.apply(original,this,[key,...args]);}});}
  });
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await page.locator('[data-theme-toggle]').click();await page.locator('[data-theme-choice][value=ember]').check();
  await expect(page.locator('html')).toHaveAttribute('data-theme','ember');
  await page.keyboard.press('Escape');await page.locator('.atlas-follow-signal').click();await expect(page.locator('#signal')).toBeVisible();
  expect(errors).toEqual([]);
});
