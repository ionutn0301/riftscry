import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Patch } from '../../src/lib/schema';
import { readyWorld, readyJourney, openScene, unobstructed, stationaryWorld } from './journey-test-helpers';

test('champion selection connects artwork, exact source record and native archive destination',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/explore?champion=Azir&older=26.15&newer=26.16#change');await readyJourney(page);
  for(const [championId,name] of [['Azir','Azir'],['Belveth',"Bel'Veth"]]){
    await page.locator(`.quick-perspectives [data-choose-champion="${championId}"]`).click();await readyJourney(page);
    await openScene(page,'change');
    await expect(page.locator('[data-champion-name]')).toHaveText(name!);
    await expect(page.locator('[data-champion-splash]')).toHaveAttribute('alt',`${name} — official Riot Games artwork`);
    const patchId=(await page.locator('[data-record-patch]').innerText()).replace('PATCH ','');
    const patch=JSON.parse(readFileSync(new URL(`../../src/data/patches/${patchId}.json`,import.meta.url),'utf8')) as Patch;
    const before=await page.locator('[data-record-before]').innerText();const after=await page.locator('[data-record-after]').innerText();const label=await page.locator('[data-record-label]').innerText();
    expect(patch.champions.find(champion=>champion.championId===championId)?.abilities.flatMap(ability=>ability.changes).find(change=>change.kind==='numeric'&&change.label===label&&change.before===before&&change.after===after)).toBeDefined();
    await expect(page.locator('[data-record-source]')).toHaveAttribute('href',patch.sourceUrl);
  }
  await openScene(page,'history');await page.locator('[data-champion-link]').click();
  await expect(page).toHaveURL(url=>url.pathname==='/champion/belveth');
  await expect(page.locator('h1')).toContainText("Bel'Veth");
});

for(const preference of ['device','saved'] as const)test(`${preference} reduced motion keeps navigation usable and the world still`,async({page})=>{
  await page.emulateMedia({reducedMotion:preference==='device'?'reduce':'no-preference'});
  if(preference==='saved')await page.addInitScript(()=>localStorage.setItem('riftscry:motion','reduced'));
  await page.goto('/');await readyWorld(page);
  await expect(page.locator('html')).toHaveAttribute('data-motion','reduced');
  const scene=page.locator('[data-rift-scene]');
  await expect(scene).toHaveAttribute('data-rift-renderer','static');await expect(scene).toHaveAttribute('data-rift-motion','still');
  await expect(page.locator('[data-rift-scene-canvas]')).toBeHidden();await expect(page.locator('[data-rift-scene-static]')).toBeVisible();
  const navigator=page.locator('[data-observatory] [data-navigator]');
  await navigator.locator('[data-world-next]').click();
  await expect(navigator).toHaveAttribute('data-selected','players');
  await expect(navigator.locator('[data-world-enter]')).toHaveJSProperty('href',new URL('/players',page.url()).href);
  await navigator.locator('[data-world-prev]').click();
  await expect(navigator).toHaveAttribute('data-selected','next-game');
  expect(await scene.evaluate(element=>element.getAnimations({subtree:true}).filter(animation=>animation.playState==='running').length)).toBe(0);
  await stationaryWorld(page);
});

test('without WebGL the environment and both product entries remain usable',async({page})=>{
  await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;Object.defineProperty(HTMLCanvasElement.prototype,'getContext',{configurable:true,value:function(this:HTMLCanvasElement,kind:string,...args:unknown[]){if(/^(webgl2?|experimental-webgl)$/.test(kind))return null;return Reflect.apply(original,this,[kind,...args]);}});});
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await readyWorld(page);
  await expect(page.locator('[data-rift-scene]')).toHaveAttribute('data-rift-renderer','static');await expect(page.locator('[data-rift-scene-canvas]')).toBeHidden();
  const environment=page.locator('.rift-scene__landscape img');await expect(environment).toBeVisible();
  await expect.poll(()=>environment.evaluate((image:HTMLImageElement)=>image.complete&&image.naturalWidth>0)).toBe(true);
  for(const id of ['next-game','players']){const link=page.locator(`[data-observatory] [data-world-link="${id}"]`);await expect(link).toHaveJSProperty('href',new URL('/'+id,page.url()).href);await unobstructed(link);}
  await page.locator('[data-observatory]').getByRole('link',{name:/^Explore a change/}).click();await readyJourney(page);
  await expect(page.locator('[data-current-record]')).toBeVisible();expect(errors).toEqual([]);
});

test.describe('the observatory before JavaScript',()=>{
  test.use({javaScriptEnabled:false});
  test('static world, native destinations and source records are usable immediately',async({page})=>{
    await page.goto('/');await expect(page.locator('[data-rift-scene-static]')).toBeVisible();
    const environment=page.locator('.rift-scene__landscape img');await expect(environment).toBeVisible();await expect.poll(()=>environment.evaluate((image:HTMLImageElement)=>image.complete&&image.naturalWidth>0)).toBe(true);
    const links=page.locator('[data-observatory] [data-world-link]');await expect(links).toHaveCount(5);
    for(const link of await links.all())await expect(link).toHaveAttribute('href',/^\/(next-game|players|champions|patches|pool)(?:#briefing)?$/);
    await page.locator('[data-observatory]').getByRole('link',{name:/^Explore a change/}).click();
    await expect(page.locator('[data-record-before]')).not.toBeEmpty();await expect(page.locator('[data-record-after]')).not.toBeEmpty();await expect(page.locator('[data-record-source]')).toHaveAttribute('href',/^https:\/\//);
  });
});

test('entering and navigating the world never creates unsolicited audio',async({page})=>{
  await page.addInitScript(()=>{const contexts:AudioContext[]=[];Object.defineProperty(window,'__observatoryAudioContexts',{value:contexts});const NativeAudioContext=window.AudioContext;window.AudioContext=new Proxy(NativeAudioContext,{construct(target,args){const context=Reflect.construct(target,args) as AudioContext;contexts.push(context);return context;}});});
  await page.goto('/');await readyWorld(page);
  const audioStates=()=>page.evaluate(()=>(window as unknown as {__observatoryAudioContexts:AudioContext[]}).__observatoryAudioContexts.map(context=>context.state));
  expect(await audioStates()).toEqual([]);
  await page.locator('[data-observatory] [data-world-next]').click();
  await page.locator('[data-observatory] [data-world-prev]').click();
  await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
  await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
  expect(await audioStates()).toEqual([]);
});
