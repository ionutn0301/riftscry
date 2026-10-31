// @vitest-environment happy-dom
import { act,createElement } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { SWRConfig } from 'swr';
import { beforeEach,afterEach,it,expect,vi } from 'vitest';
import MatchReview from '../../../src/components/player/MatchReview';
import { sourceMatch,itemMetadata,review,platform,puuid } from '../../player-e2e/fixtures';

const network=vi.hoisted(()=>vi.fn());
vi.mock('../../../src/components/player/client',async original=>({...await original<typeof import('../../../src/components/player/client')>(),fetcher:network}));
let root:Root,container:HTMLDivElement;
beforeEach(()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);localStorage.clear();sessionStorage.clear();
  history.replaceState(null,'','/matches/EUN1_12345#match-review');
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
  network.mockReset();network.mockImplementation(async(url:string)=>url.includes('/match?')?sourceMatch:url.includes('/items?')?itemMetadata:review);
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
async function mount(){await act(async()=>root.render(createElement(SWRConfig,{value:{provider:()=>new Map()}},createElement(MatchReview,{id:sourceMatch.metadata.matchId,platform,puuid,back:'/players'}))));}
const calls=()=>network.mock.calls.filter(([url])=>String(url).includes('/review?'));

it('keeps AI opt-in, then reaches review and posts once even on a rapid repeat activation',async()=>{
  let resolveReview!:(value:typeof review)=>void;
  network.mockImplementation((url:string)=>url.includes('/review?')?new Promise(resolve=>{resolveReview=resolve;}):Promise.resolve(url.includes('/match?')?sourceMatch:itemMetadata));
  await mount();expect(calls()).toHaveLength(0);
  const entry=container.querySelector<HTMLButtonElement>('[data-match-ai-entry]')!;expect(entry).not.toBeNull();
  const scenes:string[]=[];const handler=(event:Event)=>scenes.push((event as CustomEvent).detail.id);
  window.addEventListener('riftscry:journey-reveal',handler);
  await act(async()=>{entry.click();entry.click();});
  expect(calls()).toHaveLength(1);expect(calls()[0]![1]).toEqual({method:'POST'});expect(scenes).toContain('match-review');
  await act(async()=>resolveReview(review));
  expect(container.querySelector('.review-mode')?.textContent).toContain('AI-assisted interpretation');
  expect(container.querySelector<HTMLDetailsElement>('.review-full')?.open).toBe(true);
  window.removeEventListener('riftscry:journey-reveal',handler);
});
it('keeps recorded evidence and a retry available when AI fails',async()=>{
  network.mockImplementation((url:string)=>url.includes('/review?')?Promise.reject(new Error('AI unavailable')):Promise.resolve(url.includes('/match?')?sourceMatch:itemMetadata));
  await mount();await act(async()=>container.querySelector<HTMLButtonElement>('[data-match-ai-entry]')!.click());
  expect(container.querySelector('#match-review')?.textContent).toContain('AI unavailable');
  expect(container.querySelector('.review-mode')?.textContent).toContain('Recorded summary');
  expect(container.querySelector<HTMLButtonElement>('[data-match-ai-entry]')!.disabled).toBe(false);
});
it('labels a server fallback as a recorded summary instead of claiming AI generation',async()=>{
  network.mockImplementation((url:string)=>Promise.resolve(url.includes('/review?')?{...review,mode:'deterministic',notice:'AI unavailable; recorded facts are retained.'}:url.includes('/match?')?sourceMatch:itemMetadata));
  await mount();await act(async()=>container.querySelector<HTMLButtonElement>('[data-match-ai-entry]')!.click());
  expect(container.querySelector('.review-mode')?.textContent).toContain('Recorded summary');
  expect(container.querySelector('.review-mode')?.textContent).not.toContain('AI-assisted interpretation');
});
