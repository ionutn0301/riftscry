import {test,expect,chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const out='/tmp/agent-browser/investigation-review';
test('world action without data UI and representative artwork',async()=>{
 test.setTimeout(120000);await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({baseURL:'http://127.0.0.1:4322',viewport:{width:835,height:833},recordVideo:{dir:out,size:{width:835,height:833}}});const page=await context.newPage();page.setDefaultTimeout(15000);
 await page.addInitScript(()=>{const w=window as unknown as {metrics:Record<string,number>};w.metrics={cls:0};new PerformanceObserver(list=>{for(const e of list.getEntries())w.metrics.lcp=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(list=>{for(const e of list.getEntries() as (PerformanceEntry&{value:number;hadRecentInput:boolean})[])if(!e.hadRecentInput)w.metrics.cls!+=e.value;}).observe({type:'layout-shift',buffered:true});});
 try{await page.goto('/');await expect(page.locator('.investigation-world')).toHaveAttribute('data-mode','webgl');
 const style=await page.addStyleTag({content:'.story-content{opacity:0;position:absolute;top:0;pointer-events:auto}.story-header{opacity:0;position:absolute}.investigation-world{height:100vh!important}'});
 await page.screenshot({path:`out`.replace('out',out)+'/world-opening.png'});
 await page.getByRole('button',{name:/Bel'Veth/}).click();await page.evaluate(()=>scrollTo(0,0));await expect(page.locator('.investigation-canvas')).toHaveAttribute('data-action','separating');
 await page.getByRole('button',{name:'Follow what changed'}).click();await page.evaluate(()=>scrollTo(0,0));await expect(page.locator('.investigation-canvas')).toHaveAttribute('data-action','examining');await page.waitForTimeout(700);await page.screenshot({path:out+'/world-development.png'});
 await page.getByRole('button',{name:/Follow this stat/}).click();await page.evaluate(()=>scrollTo(0,0));await expect(page.locator('.investigation-canvas')).toHaveAttribute('data-action','aligned');await page.waitForTimeout(700);await page.screenshot({path:out+'/world-reveal.png'});
 await page.getByRole('button',{name:'Bring the findings together'}).click();await page.evaluate(()=>scrollTo(0,0));await expect(page.locator('.investigation-canvas')).toHaveAttribute('data-action','assembled');await page.waitForTimeout(700);await page.screenshot({path:out+'/world-resolution.png'});
 await style.evaluate(e=>e.parentNode?.removeChild(e));
 const frames=await page.evaluate(()=>new Promise<number[]>(resolve=>{const samples:number[]=[];let last=performance.now();function sample(now:number){samples.push(now-last);last=now;if(samples.length===45)resolve(samples.sort((a,b)=>a-b));else requestAnimationFrame(sample);}requestAnimationFrame(sample);}));
 const metrics=await page.evaluate(()=>({...(window as unknown as {metrics:object}).metrics,paint:performance.getEntriesByType('paint').map(e=>({name:e.name,ms:e.startTime})),renderer:document.querySelector('.investigation-world')?.getAttribute('data-mode')}));
 await fs.writeFile(out+'/performance.json',JSON.stringify({mode:'production build; Chromium ANGLE SwiftShader; video recording active; NOT physical GPU',viewport:[835,833],medianRafMs:frames[22],p95RafMs:frames[42],...metrics},null,2));
 for(const id of ['Belveth','Azir','Camille','AurelionSol']){await page.goto(`/?champion=${id}&beat=subject`);await expect(page.locator('.investigation-world')).toHaveAttribute('data-mode','webgl');await page.waitForFunction(()=>{const i=document.querySelector('.artwork-insert img') as HTMLImageElement|null;return i?i.complete&&i.naturalWidth>0:document.querySelector('.artwork-insert')?.textContent?.includes('unavailable');});await page.locator('.commitment').scrollIntoViewIfNeeded();await page.screenshot({path:out+`/art-${id}.png`});}
 }finally{const video=page.video();await context.close();await video?.saveAs(out+'/world-review.webm');await browser.close();}
});
