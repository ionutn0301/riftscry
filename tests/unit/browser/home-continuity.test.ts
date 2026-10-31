// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HomeSignal } from '../../../src/lib/home-signals';
import type { Evidence } from '../../../src/lib/investigation';
import { rememberSignal, SIGNAL_CONTEXT_EVENT, SIGNAL_CONTEXT_KEY, type SignalContext } from '../../../src/lib/signal-context';

const signals: (HomeSignal & { artwork: { splash: string; portrait: string }; record: Evidence; explore: string })[] = [
  { id: 'LeeSin', name: 'Lee Sin' }, { id: 'Darius', name: 'Darius' },
].map(({ id, name }) => ({
  championId: id, championName: name, patchId: '26.21', releaseDate: '2026-10-20',
  icon: `/images/${id}.png`, ability: 'Q', abilityName: 'Recorded ability',
  classification: 'buff', direction: 'buff', label: 'Cooldown', before: '10s', after: '8s',
  href: `/patch/26.21#${id.toLowerCase()}`, sourceUrl: 'https://www.leagueoflegends.com/patch',
  artwork: { splash: `/images/${id}.jpg`, portrait: `/images/${id}-portrait.jpg` },
  record: { id: `26.21:${id}:0:Q:0`, field: 'Cooldown', patch: '26.21', date: '2026-10-20',
    source: 'https://www.leagueoflegends.com/patch', ability: 'Q', abilityName: 'Recorded ability',
    change: { kind: 'numeric', label: 'Cooldown', before: '10s', after: '8s', direction: 'buff' } },
  explore: `/explore?champion=${id}&event=26.21%3A${id}%3A0%3AQ%3A0#change`,
}));
const prior: SignalContext = { championId: 'Ahri', name: 'Ahri', href: '/champion/ahri?mode=reader#record-26-3', patch: '26.3' };
const other: SignalContext = { championId: 'Ashe', name: 'Ashe', href: '/explore?champion=Ashe&older=26.14&newer=26.16&event=ashe-q#change', patch: '26.16', event: 'ashe-q' };
const stored = () => JSON.parse(localStorage.getItem(SIGNAL_CONTEXT_KEY) ?? 'null') as SignalContext | null;
const link = () => document.querySelector<HTMLAnchorElement>('[data-home-context]')!;
const subject = () => document.querySelector<HTMLElement>('[data-home-signals]')!.dataset.homeSubject;
const expected = (index: number): SignalContext => ({ championId: signals[index]!.championId, name: signals[index]!.championName, href: signals[index]!.explore, patch: signals[index]!.patchId, event: signals[index]!.record.id });

async function mount(href = '/') {
  window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }));
  vi.resetModules();
  history.replaceState(null, '', href);
  document.body.innerHTML = `
    <main data-home-signals>
      <a data-home-reading hidden><strong data-home-reading-label></strong></a>
      <picture><source data-home-portrait><img data-home-art></picture><span data-home-art-fallback hidden></span>
      <section class="signal-act--arrival"><a data-home-personal href="/next-game"></a><p data-home-return hidden></p><a data-home-context hidden href="/explore#change"></a></section>
      ${signals.map(signal => `<a data-home-choice="${signal.championId}" href="${signal.explore}">${signal.championName}</a><div data-home-record="${signal.championId}"></div>`).join('')}
      <button data-home-keep hidden><span>Keep this finding</span><span>+</span></button>
      <a data-home-trace></a><a data-home-explore></a><p data-home-keep-status></p><p data-home-carry-caption></p>
    </main>
    <script type="application/json" id="home-signals-data">${JSON.stringify(signals)}</script>`;
  await import('../../../src/scripts/signal-journey');
}
function expectResume(context: SignalContext) {
  expect(link().hidden).toBe(false);
  expect(link().getAttribute('href')).toBe(context.href);
  expect(link().textContent).toBe(`Continue following ${context.name} ↗`);
}
function expectNoResume() {
  expect(link().hidden).toBe(true);
  expect(link().textContent).toBe('');
  expect(link().getAttribute('href')).toBe('/explore#change');
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }));
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('home context continuity in the actual script', () => {
  it('returns to an exact archive trail without creating new saved work',async()=>{
    const selected={platform:'eun1',puuid:'fixture-player-000000000000000000000000000000000',name:'Returning Player#TEST'};
    localStorage.setItem('riftscry:recent-player:v1',JSON.stringify(selected));
    localStorage.setItem('riftscry:resume',JSON.stringify({href:prior.href,label:'Ahri — exact historical record',updatedAt:'2026-10-31T12:00:00Z'}));
    await mount('/');
    const trail=document.querySelector<HTMLAnchorElement>('[data-home-reading]')!;
    expect(trail.hidden).toBe(false);expect(trail.getAttribute('href')).toBe(prior.href);expect(trail.textContent).toContain('exact historical record');
    expect(localStorage.getItem('riftscry:kept-findings')).toBeNull();expect(localStorage.getItem('riftscry:last-reviewed-patch')).toBeNull();
    localStorage.clear();window.dispatchEvent(new StorageEvent('storage',{key:null}));
    expect(trail.hidden).toBe(true);
  });

  it('keeps the entrance useful when storage is blocked or an unsafe resume was injected',async()=>{
    localStorage.setItem('riftscry:resume',JSON.stringify({href:'https://another.example',label:'Unsafe',updatedAt:'2026-10-31T12:00:00Z'}));
    await mount('/');expect(document.querySelector<HTMLElement>('[data-home-reading]')!.hidden).toBe(true);
    vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new DOMException('Blocked','SecurityError');});
    await mount('/');
    expect(document.querySelector<HTMLElement>('[data-home-reading]')!.hidden).toBe(true);
    expect(document.querySelector('[data-home-personal]')!.getAttribute('href')).toBe('/next-game');
  });
  it('keeps an exact prior record through arrival, canonical reload and arrival history restoration', async () => {
    localStorage.setItem(SIGNAL_CONTEXT_KEY, JSON.stringify(prior));
    await mount('/');
    expect(subject()).toBe('LeeSin');
    expect(location.search).toBe('?signal=LeeSin');
    expect(stored()).toEqual(prior); expectResume(prior);

    await mount(location.pathname + location.search + location.hash);
    expect(stored()).toEqual(prior); expectResume(prior);
    history.replaceState(null, '', '/?signal=Darius#signal');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(subject()).toBe('Darius');
    expect(stored()).toEqual(prior); expectResume(prior);
  });

  it('offers an earlier interval even when its champion matches the featured subject', async () => {
    const earlier: SignalContext = { championId: 'LeeSin', name: 'Lee Sin', href: '/explore?champion=LeeSin&older=26.14&newer=26.16#change', patch: '26.16' };
    localStorage.setItem(SIGNAL_CONTEXT_KEY, JSON.stringify(earlier));
    await mount('/?signal=LeeSin');
    expect(subject()).toBe('LeeSin');
    expect(stored()).toEqual(earlier); expectResume(earlier);
  });

  it('updates and clears the resume link on context events, external storage changes and persisted pageshow', async () => {
    localStorage.setItem(SIGNAL_CONTEXT_KEY, JSON.stringify(prior));
    await mount('/');
    rememberSignal(other); expectResume(other);
    rememberSignal(expected(0)); expectNoResume();

    localStorage.setItem(SIGNAL_CONTEXT_KEY, JSON.stringify(prior));
    window.dispatchEvent(new StorageEvent('storage', { key: SIGNAL_CONTEXT_KEY }));
    expectResume(prior);
    localStorage.removeItem(SIGNAL_CONTEXT_KEY);
    window.dispatchEvent(new StorageEvent('storage', { key: SIGNAL_CONTEXT_KEY }));
    expectNoResume();

    localStorage.setItem(SIGNAL_CONTEXT_KEY, JSON.stringify(other));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    expectResume(other);
    localStorage.clear();
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    expectNoResume();

    rememberSignal(prior); expectResume(prior);
    localStorage.clear();
    window.dispatchEvent(new StorageEvent('storage', { key: null }));
    expectNoResume();
    window.dispatchEvent(new CustomEvent(SIGNAL_CONTEXT_EVENT, { detail: null }));
    expectNoResume();
  });

  it('deliberate subject selection and revealing the record still carry exact context without keeping a finding', async () => {
    localStorage.setItem(SIGNAL_CONTEXT_KEY, JSON.stringify(prior));
    await mount('/?signal=LeeSin');
    document.querySelector<HTMLAnchorElement>('[data-home-choice="Darius"]')!.click();
    expect(subject()).toBe('Darius');
    expect(location.search).toBe('?signal=Darius');
    expect(stored()).toEqual(expected(1)); expectNoResume();

    rememberSignal(other); expectResume(other);
    history.replaceState(null, '', '/?signal=Darius#reveal');
    window.dispatchEvent(new CustomEvent('riftscry:journey-change', { detail: { id: 'reveal' } }));
    expect(stored()).toEqual(expected(1)); expectNoResume();
    expect(localStorage.getItem('riftscry:kept-findings')).toBeNull();
    expect(localStorage.getItem('riftscry:last-reviewed-patch')).toBeNull();
  });

  it.each(['reveal', 'carry'])('opening a direct %s scene deliberately follows its displayed record', async scene => {
    localStorage.setItem(SIGNAL_CONTEXT_KEY, JSON.stringify(prior));
    await mount(`/?signal=Darius#${scene}`);
    expect(subject()).toBe('Darius');
    expect(stored()).toEqual(expected(1)); expectNoResume();
  });
});
