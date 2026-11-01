import {expect,test,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {installFixtures,platform,profilePath} from './fixtures';
import {navigateStation} from './navigation-controls';

test.use({video:'on'});

const probeKey='riftscry:test:crossing-paint';
type Sample={time:number;clip:string;geometryAnimation:string;panelClipped:boolean;extraHomeSceneVisible:boolean;mobilePrimaryVisible:boolean;layers:{name:string;display:string;opacity:number}[]};
type Crossing={id:string;path:string;ready:boolean;finished:boolean;skipped:boolean;cinematic:boolean;samples:Sample[]};

async function observeCrossings(page:Page){
  await page.addInitScript(({key})=>{
    const read=():Crossing[]=>JSON.parse(sessionStorage.getItem(key)||'[]');
    addEventListener('pagereveal',event=>{
      const transition=(event as Event&{viewTransition?:{ready:Promise<void>;finished:Promise<void>}}).viewTransition;
      if(!transition||!event.isTrusted)return;
      const record:Crossing={id:crypto.randomUUID(),path:location.pathname,ready:false,finished:false,skipped:false,cinematic:false,samples:[]};
      const save=()=>{
        const records=read();const index=records.findIndex(item=>item.id===record.id);
        if(index<0)records.push(record);else records[index]=record;
        sessionStorage.setItem(key,JSON.stringify(records.slice(-20)));
      };
      let frame=0,last=-Infinity;
      const sample=(time:number)=>{
        if(record.finished)return;
        if(time-last>=60){
          last=time;
          const primary=document.querySelector('.journey-primary');
          record.samples.push({time,
            clip:getComputedStyle(document.documentElement,'::view-transition-new(journey-stage)').clipPath,
            geometryAnimation:getComputedStyle(document.documentElement,'::view-transition-group(journey-stage)').animationName,
            panelClipped:[...document.querySelectorAll('[data-journey-panel]')].some(panel=>panel.getClientRects().length>0&&getComputedStyle(panel).clipPath!=='none'),
            extraHomeSceneVisible:[...document.querySelectorAll('.signal-journey[data-journey-active=atlas] > :is(.signal-subject-visual,.signal-cast,[data-journey-panel]:not(#atlas))')].some(element=>element.getClientRects().length>0),
            mobilePrimaryVisible:innerWidth<=700&&Boolean(primary?.getClientRects().length),
            layers:['root','journey-stage','journey-header','journey-navigation','player-identity'].map(name=>{
            const style=getComputedStyle(document.documentElement,`::view-transition-old(${name})`);
            return {name,display:style.display,opacity:Number(style.opacity)};
          })});save();
        }
        frame=requestAnimationFrame(sample);
      };
      save();
      void transition.ready.then(()=>{
        record.ready=true;
        record.cinematic=document.getAnimations().some(animation=>animation instanceof CSSAnimation&&animation.animationName==='rift-camera-arrive');
        sample(performance.now());
      },()=>{record.skipped=true;save();});
      void transition.finished.then(()=>{record.finished=true;cancelAnimationFrame(frame);save();});
    });
  },{key:probeKey});
}

const records=(page:Page)=>page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)||'[]') as Crossing[],probeKey);

async function crossing(page:Page,path:string){
  await expect(page).toHaveURL(url=>url.pathname===path);
  await expect(page.locator('body')).toHaveAttribute('data-journey-ready','true');
  await expect.poll(async()=>{
    const latest=(await records(page)).at(-1);return latest?.path===path&&latest.ready;
  },{message:`${path} must exercise a real native page crossing`}).toBe(true);
  await expect.poll(async()=>(await records(page)).at(-1)?.finished).toBe(true);
  const latest=(await records(page)).at(-1)!;
  expect(latest.cinematic,'The incoming camera reveal must remain enabled').toBe(true);
  expect(latest.samples.length).toBeGreaterThan(1);
  // Observe the actual outgoing pseudo layers throughout the native animation,
  // including after the former 300ms exit left its 4%-wide text strip behind.
  for(const sample of latest.samples)for(const layer of sample.layers){
    expect(layer.display==='none'||layer.opacity===0,
      `${path}: stale ${layer.name} text remained paintable at ${sample.time}ms`).toBe(true);
  }
  expect(latest.samples.every(sample=>sample.clip==='none'),'Camera travel must not slice the incoming text').toBe(true);
  expect(latest.samples.every(sample=>sample.geometryAnimation==='none'),'Different page heights must not stretch the incoming text').toBe(true);
  expect(latest.samples.some(sample=>sample.panelClipped),'Chapter arrival must not slice the incoming text either').toBe(false);
  expect(latest.samples.some(sample=>sample.extraHomeSceneVisible),'Returning home must never flash the other champion scene').toBe(false);
  expect(latest.samples.some(sample=>sample.mobilePrimaryVisible),'Desktop navigation must never flash on a phone').toBe(false);
  expect(await page.locator('.gateway-heading,.profile-identity-copy').evaluateAll(elements=>
    elements.every(element=>getComputedStyle(element).viewTransitionName==='none'))).toBe(true);
}

for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  test.describe(`${viewport.width}px full-motion navigation`,()=>{
    test.use({viewport});
    test('page crossing leaves no outgoing text fragments on arrival, Back or Forward',async({page},info)=>{
      test.setTimeout(120_000);
      await page.emulateMedia({reducedMotion:'no-preference'});
      const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
      await installFixtures(page);await observeCrossings(page);
      // Compile the development documents before testing native transitions;
      // a slow first compilation can make Chromium skip the transition itself.
      for(const path of ['/','/champions','/champion/ahri','/patches','/players',profilePath]){
        expect((await page.request.get(path)).ok()).toBe(true);
      }
      await page.goto('/');await expect(page.locator('body')).toHaveAttribute('data-journey-ready','true');
      await expect(page.locator('html')).toHaveAttribute('data-motion','full');
      await navigateStation(page,'champions');await crossing(page,'/champions');
      await page.locator('[data-roster-search]').fill('Ahri');
      await page.locator('[data-roster-key="Ahri"] a').click();await crossing(page,'/champion/ahri');
      await navigateStation(page,'patches');await crossing(page,'/patches');
      await page.locator('.journey-spine [data-spine-station="players"]').click();await crossing(page,'/players');
      await page.getByLabel('Riot ID',{exact:true}).fill('Fixture Player#TEST');
      await page.getByLabel('Server',{exact:true}).selectOption(platform);
      await page.getByRole('button',{name:'Find player',exact:false}).click();await crossing(page,profilePath);
      await expect(page.getByRole('heading',{level:1})).toHaveText('Fixture Player#TEST');
      await page.goBack();await crossing(page,'/players');
      await page.goForward();await crossing(page,profilePath);
      await page.locator('.world-brand').click();await crossing(page,'/');
      await mkdir('player-visuals',{recursive:true});
      await page.screenshot({path:`player-visuals/transition-return-${viewport.width}.png`,animations:'disabled',fullPage:true});
      const evidence=JSON.stringify(await records(page));
      await writeFile(`player-visuals/transition-frames-${viewport.width}.json`,evidence);
      await info.attach('native-crossing-frames',{body:evidence,contentType:'application/json'});
      expect(errors).toEqual([]);
    });
  });
}

test('page crossing respects reduced motion without leaving stale copy or page errors',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await installFixtures(page);await observeCrossings(page);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/champions');
  await expect(page.locator('body')).toHaveAttribute('data-journey-ready','true');
  await page.locator('.journey-spine [data-spine-station="players"]').click();
  await expect(page).toHaveURL(url=>url.pathname==='/players');
  await expect(page.getByLabel('Riot ID',{exact:true})).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-motion','reduced');
  // Skipping in the outgoing document can prevent the incoming native object
  // from being created at all. Both paths must render the destination quietly.
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  expect((await records(page)).every(record=>!record.cinematic&&(record.skipped||record.finished))).toBe(true);
  expect(await page.evaluate(()=>document.getAnimations().some(animation=>animation.playState==='running'))).toBe(false);
  expect(errors).toEqual([]);
});
