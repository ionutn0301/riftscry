// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const key = 'riftscry:atlas-places:v1';
const query = <T extends Element = HTMLElement>(selector:string) => document.querySelector<T>(selector)!;
async function mount(surface = 'home') {
  document.body.dataset.surface = surface;
  document.documentElement.dataset.motion = 'full';
  document.body.innerHTML = `
    <img data-atlas-environment="gateway" class="is-current"><img data-atlas-environment>
    <div data-rift-atlas><a href="/next-game" data-atlas-portal="next-game">Briefing</a><a href="/champions" data-atlas-portal="champions">Champions</a><a href="/patches" data-atlas-portal="patches">Patches</a></div>
    <a data-spine-station="players"></a><a data-spine-station="champions"></a>
    <section id="history" data-journey-world="champions"></section><dialog id="rift-map-dialog"></dialog>`;
  for (const image of document.querySelectorAll('img')) {
    Object.defineProperty(image,'naturalWidth',{value:720,configurable:true});
    Object.defineProperty(image,'complete',{value:false,configurable:true});
  }
  await import('../../../src/scripts/rift-atlas');
}
beforeEach(() => { vi.resetModules(); sessionStorage.clear(); });
afterEach(() => {
  window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false}));
  document.body.innerHTML = ''; vi.restoreAllMocks();
});

it('discards late environment loads and restores the actual place after a preview', async () => {
  await mount();
  const image = query<HTMLImageElement>('img:not(.is-current)');
  query('[data-atlas-portal="champions"]').dispatchEvent(new Event('pointerover',{bubbles:true}));
  const stale = image.onload!;
  query('[data-atlas-portal="patches"]').dispatchEvent(new Event('pointerover',{bubbles:true}));
  stale.call(image,new Event('load'));
  expect(image.classList.contains('is-current')).toBe(false);
  image.onload!.call(image,new Event('load'));
  expect(image.classList.contains('is-current')).toBe(true);
  expect(image.src).toContain('fracture-mobile.webp');
  query('[data-rift-atlas]').dispatchEvent(new Event('pointerleave'));
  const entrance = query<HTMLImageElement>('img:first-child');
  entrance.onload!.call(entrance,new Event('load'));
  expect(entrance.classList.contains('is-current')).toBe(true);
  expect(image.classList.contains('is-current')).toBe(false);
});

it('tracks only known places and retains no player, match or query identifiers', async () => {
  sessionStorage.setItem(key,JSON.stringify(['champions','private-puuid', {name:'player'},'/matches/private']));
  await mount('match');
  expect(JSON.parse(sessionStorage.getItem(key)!)).toEqual(['champions','players']);
  expect(query('[data-spine-station="players"]').hasAttribute('data-visited')).toBe(true);
});

it('leaves native portal activation available when browser storage is blocked', async () => {
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(() => { throw new DOMException('Blocked','SecurityError'); });
  await mount();
  const link = query<HTMLAnchorElement>('[data-atlas-portal="champions"]');
  const event = new MouseEvent('click',{bubbles:true,cancelable:true,ctrlKey:true});
  link.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
  expect(link.getAttribute('href')).toBe('/champions');
});

it('moves focus spatially while leaving modified arrows to the browser', async () => {
  await mount();
  const links = [...document.querySelectorAll<HTMLAnchorElement>('[data-atlas-portal]')];
  const positions = [[0,0],[100,200],[200,0]];
  links.forEach((link,index) => vi.spyOn(link,'getBoundingClientRect').mockReturnValue(new DOMRect(...positions[index] as [number,number],50,50)));
  links[0]!.focus();
  links[0]!.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));
  expect(document.activeElement).toBe(links[2]);
  const modified = new KeyboardEvent('keydown',{key:'ArrowLeft',ctrlKey:true,bubbles:true,cancelable:true});
  links[2]!.dispatchEvent(modified);
  expect(document.activeElement).toBe(links[2]); expect(modified.defaultPrevented).toBe(false);
});

it('uses the active chapter environment and removes listeners when the document leaves', async () => {
  await mount();
  window.dispatchEvent(new CustomEvent('riftscry:journey-change',{detail:{id:'history'}}));
  const image = query<HTMLImageElement>('img:not(.is-current)');
  expect(image.src).toContain('archive-mobile.webp');
  window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false}));
  const before = image.src;
  query('[data-atlas-portal="patches"]').dispatchEvent(new Event('pointerover',{bubbles:true}));
  expect(image.src).toBe(before); expect(image.onload).toBeNull();
});
