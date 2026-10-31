// @vitest-environment happy-dom
import { beforeEach,afterEach,it,expect,vi } from 'vitest';
let frames:Map<number,FrameRequestCallback>,nextFrame:number,resize:()=>void,widthWrites:number;
let viewport:HTMLElement,canvas:HTMLCanvasElement;
beforeEach(()=>{
  vi.resetModules();frames=new Map();nextFrame=0;widthWrites=0;document.documentElement.dataset.motion='full';
  vi.stubGlobal('requestAnimationFrame',(fn:FrameRequestCallback)=>{frames.set(++nextFrame,fn);return nextFrame;});
  vi.stubGlobal('cancelAnimationFrame',(id:number)=>frames.delete(id));
  vi.stubGlobal('ResizeObserver',class{constructor(fn:()=>void){resize=fn;}observe(){}disconnect(){}});
  vi.stubGlobal('matchMedia',()=>({matches:false}));
  document.body.innerHTML=`<div data-passage data-passage-initial="0"><div data-passage-gesture tabindex="0"><canvas data-passage-canvas hidden></canvas></div><input data-passage-range type="range" min="0" max="4" step="1"><a data-passage-enter href="/next-game">Enter Briefing</a><p data-passage-place></p><h2 data-passage-title></h2><p data-passage-description></p><span data-passage-coordinate></span><div data-passage-instrument hidden><button data-passage-step="-1"></button><button data-passage-step="1"></button></div>${['next-game','players','champions','patches','pool'].map((id,i)=>`<a data-passage-stop="${i}" href="/${id}">${id}</a>`).join('')}</div>`;
  viewport=document.querySelector<HTMLElement>('[data-passage-gesture]')!;canvas=document.querySelector('canvas')!;
  vi.spyOn(viewport,'getClientRects').mockReturnValue([new DOMRect(0,0,390,440)] as unknown as DOMRectList);
  vi.spyOn(viewport,'getBoundingClientRect').mockReturnValue(new DOMRect(0,0,390,440));
  let width=canvas.width;Object.defineProperty(canvas,'width',{get:()=>width,set:(value:number)=>{width=value;widthWrites++;}});
  const context=Object.fromEntries(['setTransform','clearRect','beginPath','moveTo','lineTo','stroke','save','translate','scale','closePath','fill','restore'].map(name=>[name,vi.fn()]));
  Object.assign(context,{createLinearGradient:()=>({addColorStop:vi.fn()})});
  vi.spyOn(canvas,'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
});
afterEach(()=>{window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false}));vi.restoreAllMocks();vi.unstubAllGlobals();document.body.innerHTML='';});
function paint(count=150){for(let i=0;i<count&&frames.size;i++){const pending=[...frames];frames.clear();pending.forEach(([,fn])=>fn((i+1)*16.67));}}
const host=()=>document.querySelector<HTMLElement>('[data-passage]')!;
const enter=()=>document.querySelector<HTMLAnchorElement>('[data-passage-enter]')!;
it('moves a real camera to a selected destination and then stops painting',async()=>{
  await import('../../../src/scripts/rift-passage');
  const range=document.querySelector<HTMLInputElement>('[data-passage-range]')!;range.value='3';range.dispatchEvent(new Event('input'));
  expect(new URL(enter().href).pathname).toBe('/patches');paint();
  expect(host().dataset.passagePosition).toBe('3.0000');expect(frames.size).toBe(0);expect(canvas.hidden).toBe(false);
});
it('does not clear the canvas when an observer reports an unchanged size',async()=>{
  await import('../../../src/scripts/rift-passage');paint();const before=widthWrites;resize();paint();expect(widthWrites).toBe(before);
});
it('uses wheel travel inside the object and releases page scrolling at its boundary',async()=>{
  await import('../../../src/scripts/rift-passage');
  const travel=new WheelEvent('wheel',{deltaY:320,cancelable:true});viewport.dispatchEvent(travel);paint();
  expect(travel.defaultPrevented).toBe(true);expect(host().dataset.passagePosition).toBe('1.0000');
  viewport.dispatchEvent(new KeyboardEvent('keydown',{key:'End',cancelable:true}));paint();
  const edge=new WheelEvent('wheel',{deltaY:200,cancelable:true});viewport.dispatchEvent(edge);expect(edge.defaultPrevented).toBe(false);
});
it('does not chatter between kinetic titles around a wheel or drag boundary',async()=>{
  await import('../../../src/scripts/rift-passage');
  const wheel=(deltaY:number)=>viewport.dispatchEvent(new WheelEvent('wheel',{deltaY,cancelable:true}));
  const range=document.querySelector('[data-passage-range]')!;
  wheel(176);expect(range.getAttribute('aria-valuetext')).toBe('Briefing');
  wheel(32);expect(range.getAttribute('aria-valuetext')).toBe('Games');
  wheel(-32);expect(range.getAttribute('aria-valuetext')).toBe('Games');
});
it('keeps direct destination links native and follows updated remembered-player URLs',async()=>{
  await import('../../../src/scripts/rift-passage');
  const link=document.querySelector<HTMLAnchorElement>('[data-passage-stop="0"]')!;
  link.href='/next-game?platform=eun1&puuid=remembered';await Promise.resolve();expect(enter().href).toBe(link.href);
  const click=new MouseEvent('click',{bubbles:true,cancelable:true,ctrlKey:true});link.dispatchEvent(click);expect(click.defaultPrevented).toBe(false);
});
it('keeps reduced motion immediate, with no continuous idle animation',async()=>{
  await import('../../../src/scripts/rift-passage');
  document.documentElement.dataset.motion='reduced';viewport.dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true,cancelable:true}));paint();
  expect(host().dataset.passagePosition).toBe('4.0000');expect(frames.size).toBe(0);
  window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false}));viewport.dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true,cancelable:true}));expect(frames.size).toBe(0);
});
