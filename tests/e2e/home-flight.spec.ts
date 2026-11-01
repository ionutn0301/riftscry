import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {readyWorld,openScene,homeSignals} from './journey-test-helpers';
const world=(page:Page)=>page.locator('[data-home-world]');
const progress=(page:Page)=>world(page).getAttribute('data-film-progress').then(Number);
test.use({video:'on'});

test('cinematic home travels through one world and keeps native evidence useful',async({page},info)=>{
  await page.emulateMedia({reducedMotion:'no-preference'});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await readyWorld(page);await expect(world(page)).toHaveAttribute('data-film-paint','ready');
  await expect(page.locator('#main [data-rift-atlas]')).toHaveCount(0);
  const samples:{time:number;progress:number;camera:string|null}[]=[];
  await page.evaluate(()=>{
    (window as any).__filmSamples=[];
    (window as any).__filmTimer=setInterval(()=>{const w=document.querySelector<HTMLElement>('[data-home-world]')!;(window as any).__filmSamples.push({time:performance.now(),progress:Number(w.dataset.filmProgress),camera:w.dataset.filmCamera});},50);
  });
  await mkdir('player-visuals',{recursive:true});
  const initialCamera=await world(page).getAttribute('data-film-camera');
  for(const [i,id] of ['atlas','signal','reveal','carry'].entries()){
    if(i)await page.locator('[data-journey-next]').click();
    await expect(page.locator('[data-journey-panel]:visible')).toHaveAttribute('id',id);
    await expect.poll(()=>progress(page)).toBe(i);
    await expect(world(page)).toHaveAttribute('data-film-travelling','false');
    await page.screenshot({path:`player-visuals/flight-${info.project.name}-${id}.png`});
    expect(await page.evaluate(()=>document.documentElement.scrollHeight-innerHeight)).toBeLessThanOrEqual(1);
  }
  expect(await world(page).getAttribute('data-film-camera')).not.toBe(initialCamera);
  samples.push(...await page.evaluate(()=>{clearInterval((window as any).__filmTimer);return (window as any).__filmSamples;}));
  expect(samples.some(s=>s.progress>.1&&s.progress<.9)).toBe(true);
  expect(new Set(samples.map(s=>s.camera)).size).toBeGreaterThan(15);
  await writeFile(`player-visuals/flight-${info.project.name}-camera.json`,JSON.stringify(samples,null,2));
  await openScene(page,'reveal');
  const signal=(await homeSignals(page))[0]!;
  await expect(page.locator('[data-home-record]:not([hidden]) .before')).toHaveText(signal.before);
  await expect(page.locator('[data-home-record]:not([hidden]) .after')).toHaveText(signal.after);
  await page.locator('[data-home-keep]').click();await expect(page.locator('#carry')).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('riftscry:kept-findings')??'[]'))).toHaveLength(1);
  await expect(page.locator('[data-home-explore]')).toHaveAttribute('href',signal.explore);
  await page.locator('[data-dock-atlas]').click();await expect(page.locator('#rift-map-dialog')).toBeVisible();
  await expect(page.locator('#rift-map-dialog [data-atlas-portal]')).toHaveCount(5);
  await page.locator('[data-map-close]').click();expect(errors).toEqual([]);
});

test('cinematic home reverses in flight, restores Back and accepts wheel or touch travel',async({page,isMobile})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await page.goto('/');await readyWorld(page);
  await page.locator('.atlas-follow-signal').click();await expect.poll(()=>progress(page)).toBeGreaterThan(.05);
  await page.locator('[data-journey-prev]').click();await expect.poll(()=>progress(page)).toBe(0);
  await expect(page.locator('#atlas')).toBeVisible();await page.goBack();await expect(page.locator('#signal')).toBeVisible();
  await expect.poll(()=>progress(page)).toBe(1);
  if(isMobile){
    // The same captured pointer path used by a finger, on the free scene area.
    const film=page.locator('[data-home-film]'),box=(await film.boundingBox())!;
    const x=box.x+box.width*.9,y=box.y+box.height*.5;
    await film.dispatchEvent('pointerdown',{pointerType:'touch',pointerId:5,isPrimary:true,clientX:x,clientY:y});
    await film.dispatchEvent('pointermove',{pointerType:'touch',pointerId:5,isPrimary:true,clientX:x,clientY:y-95});
    await film.dispatchEvent('pointerup',{pointerType:'touch',pointerId:5,isPrimary:true,clientX:x,clientY:y-95});
  }else{
    const box=(await page.locator('[data-home-film]').boundingBox())!;await page.mouse.move(box.x+box.width*.95,box.y+box.height*.45);await page.mouse.wheel(0,160);
  }
  await expect(page.locator('#reveal')).toBeVisible();await expect.poll(()=>progress(page)).toBe(2);
  await page.locator('#reveal').focus();await page.keyboard.press('ArrowDown');await expect(page.locator('#carry')).toBeVisible();
  await expect.poll(()=>progress(page)).toBe(3);
});

test('cinematic home respects reduced motion and the live motion control',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await page.goto('/');await readyWorld(page);
  await page.locator('[data-motion-toggle]').click();await expect(world(page)).toHaveAttribute('data-film-motion','reduced');
  await openScene(page,'carry');await expect.poll(()=>progress(page)).toBe(3);
  await expect(world(page)).toHaveAttribute('data-film-travelling','false');
  const still=await world(page).getAttribute('data-film-camera');
  await page.mouse.move(100,200);await page.mouse.move(200,300);
  expect(await world(page).getAttribute('data-film-camera')).toBe(still);
  await page.reload();await readyWorld(page);await expect(world(page)).toHaveAttribute('data-film-motion','reduced');
});

test('cinematic home remains useful when the graphics context is unavailable',async({page})=>{
  await page.addInitScript(()=>{Object.defineProperty(HTMLCanvasElement.prototype,'getContext',{value:()=>null});});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await readyWorld(page);
  await expect(page.locator('[data-home-world-still]')).toBeVisible();await expect(page.locator('[data-home-world-canvas]')).toBeHidden();
  await page.locator('.atlas-follow-signal').click();await expect(page.locator('#signal')).toBeVisible();
  await page.locator('[data-home-reveal]').click();await expect(page.locator('#reveal')).toBeVisible();
  await expect(page.locator('[data-home-record]:not([hidden]) .before')).not.toBeEmpty();
  await expect(page.locator('[data-home-record]:not([hidden]) .after')).not.toBeEmpty();
  await page.locator('[data-home-keep]').click();await expect(page.locator('#carry')).toBeVisible();
  await expect(page.locator('[data-home-explore]')).toHaveAttribute('href',/\/explore\?champion=/);
  expect(errors).toEqual([]);
});


test('cinematic home repaints viewport changes before a blank canvas can flash',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await page.goto('/');await readyWorld(page);
  await expect(world(page)).toHaveAttribute('data-film-paint','ready');
  await page.evaluate(()=>{
    const canvas=document.querySelector<HTMLCanvasElement>('[data-home-world-canvas]')!;
    (window as any).__resizePaints=[];
    new ResizeObserver(()=>{const pixel=[...canvas.getContext('2d')!.getImageData(0,0,1,1).data];(window as any).__resizePaints.push({width:innerWidth,height:innerHeight,pixel});}).observe(canvas);
  });
  for(const viewport of [{width:390,height:660},{width:844,height:390},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    await expect.poll(()=>page.evaluate(({width,height})=>{
      const sample=(window as any).__resizePaints.findLast((p:any)=>p.width===width&&p.height===height);
      return sample?sample.pixel.slice(0,3).some((value:number)=>value>0):false;
    },viewport)).toBe(true);
  }
  expect(await page.evaluate(()=>(window as any).__resizePaints.every((p:any)=>p.pixel[3]===255&&p.pixel.slice(0,3).some((n:number)=>n>0)))).toBe(true);
});


test('cinematic home keeps reading stable when the current scene is selected again',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await page.goto('/');await readyWorld(page);
  await page.locator('[data-journey-tab="atlas"]').click();
  const running=(selector:string)=>page.locator(selector).evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.playState==='running').length);
  expect(await running('#atlas h1')).toBe(0);
  await page.locator('.atlas-follow-signal').click();
  expect(await running('#signal h2')).toBeGreaterThan(0);
  await expect(page.locator('#signal h2')).toHaveAccessibleName('Choose a champion.');
});

test('painted environment keeps the artwork intact and remains useful if its image fails',async({page})=>{
  await page.route('**/images/league/iceborn-vaults.webp',route=>route.abort());
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await readyWorld(page);
  await expect(world(page)).toHaveAttribute('data-art-direction','painted');
  await expect(world(page)).toHaveAttribute('data-film-paint','fallback');
  await expect(page.locator('[data-home-world-canvas]')).toBeHidden();
  await expect(page.locator('[data-home-world] svg polygon')).toHaveCount(0);
  await page.locator('.atlas-follow-signal').click();
  await page.locator('[data-home-reveal]').click();
  const signal=(await homeSignals(page))[0]!;
  await expect(page.locator('[data-home-record]:not([hidden]) .after')).toHaveText(signal.after);
  await page.locator('[data-home-keep]').click();await expect(page.locator('#carry')).toBeVisible();
  expect(errors).toEqual([]);
});
