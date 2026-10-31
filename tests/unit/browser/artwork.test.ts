// @vitest-environment happy-dom
import { beforeEach,afterEach,it,expect,vi } from 'vitest';
import { swapArtwork } from '../../../src/scripts/artwork';
class Probe {
  src='';decoding='';naturalWidth=1215;
  onload:((event:Event)=>void)|null=null;onerror:(()=>void)|null=null;
  decode=()=>Promise.resolve();
  constructor(){probes.push(this);}
}
let probes:Probe[]=[];
beforeEach(()=>{probes=[];vi.stubGlobal('Image',Probe);document.body.innerHTML='<img src="/current.webp"><p hidden>Artwork unavailable</p>';});
afterEach(()=>{vi.unstubAllGlobals();document.body.innerHTML='';});
const view=()=>({image:document.querySelector('img')!,fallback:document.querySelector('p')!});
it('retains the current art until a replacement has decoded',async()=>{
  const {image,fallback}=view();const pending=swapArtwork(image,{src:'/next.webp',alt:'Next',fallback});
  expect(image.hidden).toBe(false);expect(image.getAttribute('src')).toBe('/current.webp');expect(fallback.hidden).toBe(true);
  probes[0]!.onload!(new Event('load'));await pending;
  expect(image.getAttribute('src')).toBe('/next.webp');expect(image.alt).toBe('Next');expect(image.hidden).toBe(false);
});
it('ignores stale loads after a rapid selection change',async()=>{
  const {image,fallback}=view();const first=swapArtwork(image,{src:'/first.webp',alt:'First',fallback});
  const last=swapArtwork(image,{src:'/last.webp',alt:'Last',fallback});
  probes[1]!.onload!(new Event('load'));await last;probes[0]!.onload!(new Event('load'));await first;
  expect(image.getAttribute('src')).toBe('/last.webp');expect(image.alt).toBe('Last');
});
it('shows an honest fallback only when the selected asset fails',async()=>{
  const {image,fallback}=view();const pending=swapArtwork(image,{src:'/missing.webp',alt:'Selected',fallback});
  expect(image.hidden).toBe(false);probes[0]!.onerror!();await pending;
  expect(image.hidden).toBe(true);expect(fallback.hidden).toBe(false);
});
it('does not commit after a route is disposed',async()=>{
  const {image}=view(),controller=new AbortController();const pending=swapArtwork(image,{src:'/late.webp',alt:'Late'},controller.signal);
  controller.abort();probes[0]!.onload!(new Event('load'));await pending;
  expect(image.getAttribute('src')).toBe('/current.webp');
});
it('cancels a pending change when the visitor returns to the displayed source',async()=>{
  const {image}=view();Object.defineProperty(image,'complete',{value:true});Object.defineProperty(image,'naturalWidth',{value:1215});
  const pending=swapArtwork(image,{src:'/other.webp',alt:'Other'});
  await swapArtwork(image,{src:'/current.webp',alt:'Current'});
  probes[0]!.onload!(new Event('load'));await pending;
  expect(image.getAttribute('src')).toBe('/current.webp');expect(image.alt).toBe('Current');
});
