// @vitest-environment happy-dom
import { afterEach,it,expect,vi } from 'vitest';
afterEach(()=>{window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false}));document.body.innerHTML='';delete document.body.dataset.journeyReady;vi.restoreAllMocks();});
it('an action in a newly committed React tree reaches its chapter before the observer frame',async()=>{
  vi.resetModules();history.replaceState(null,'','/matches/fixture');
  vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
  document.body.innerHTML='<main id="main"><div data-journey-deck data-journey-default="match-overview"><section id="match-overview" data-journey-panel>Loading</section></div></main><div data-journey-tabs></div><div data-journey-controls></div>';
  await import('../../../src/scripts/connected-observatory');
  const deck=document.querySelector('[data-journey-deck]')!;
  deck.innerHTML='<section id="match-overview" data-journey-panel>Match</section><section id="match-review" data-journey-panel data-journey-label="AI review"><h2>Review</h2></section>';
  window.dispatchEvent(new CustomEvent('riftscry:journey-reveal',{detail:{id:'match-review'}}));
  const review=document.querySelector<HTMLElement>('#match-review')!,overview=document.querySelector<HTMLElement>('#match-overview')!;
  expect(review.hidden).toBe(false);expect(review.inert).toBe(false);expect(review.hasAttribute('data-journey-visible')).toBe(true);
  expect(overview.hidden).toBe(true);expect(overview.inert).toBe(true);expect(location.hash).toBe('#match-review');
  await vi.waitFor(()=>expect(document.activeElement).toBe(review));
});
