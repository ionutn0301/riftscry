// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import patch from '../../../src/data/patches/26.16.json';

const query = <T extends Element = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const contextKey = 'riftscry:signal-context:v1';
const beforeAfter = patch.champions.find(champion => champion.championId === 'Azir')!.abilities[0]!.changes[0]!;

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  document.documentElement.dataset.motion = 'reduced';
  document.body.innerHTML = '';
});

afterEach(() => {
  window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }));
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function comparison() {
  document.body.innerHTML = `
    <p data-compare-context hidden></p><button data-compare-all hidden>Show all</button>
    <div data-comparison-workspace data-comparison-newer="26.16" data-comparison-older="26.15">
      <div data-comparison-stage hidden>
        <img data-comparison-art><p data-comparison-art-fallback hidden>Artwork unavailable</p>
        <h2 data-comparison-name></h2><div data-comparison-trail></div>
        <a data-comparison-history></a><a data-comparison-explore></a>
      </div>
      ${['Azir', 'Belveth'].map(id => `<section class="compare-group"><ul><li id="compare-${id.toLowerCase()}" data-compare-champion="${id}" data-signal-name="${id}" data-signal-patch="26.16" data-compare-art="https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${id}_0.jpg">
        <button data-compare-preview hidden aria-pressed="false">${id}</button>
        <span class="trail"><a href="/patch/26.16#${id.toLowerCase()}">26.16 buff</a></span>
      </li></ul></section>`).join('')}
    </div>`;
}

it('keeps the normalized interval, selected fragment, exact source trail and canonical continuity together', async () => {
  history.replaceState(null, '', '/compare/26.15/26.16?champions=azir');
  comparison();
  await import('../../../src/scripts/compare-context');
  await import('../../../src/scripts/signal-comparison');

  expect(query('[data-comparison-name]').textContent).toBe('Azir');
  expect(query('[data-comparison-explore]').getAttribute('href')).toBe('/explore?champion=Azir&newer=26.16&older=26.15#change');
  expect(query('[data-comparison-trail] a').getAttribute('href')).toBe('/patch/26.16#azir');
  expect(query<HTMLElement>('[data-comparison-stage]').inert).toBe(false);

  query<HTMLButtonElement>('[data-compare-all]').click();
  await vi.waitFor(() => expect(query<HTMLElement>('#compare-belveth').hidden).toBe(false));
  query<HTMLButtonElement>('#compare-belveth button').click();
  expect(location.hash).toBe('#compare-belveth');
  expect(location.search).toBe('');
  expect(query('[data-comparison-name]').textContent).toBe('Belveth');
  expect(JSON.parse(localStorage.getItem(contextKey)!)).toMatchObject({ championId: 'Belveth', patch: '26.16', href: '/compare/26.15/26.16#compare-belveth' });

  history.replaceState(null, '', '/compare/26.15/26.16#compare-azir');
  window.dispatchEvent(new PopStateEvent('popstate'));
  expect(query('[data-comparison-name]').textContent).toBe('Azir');
  expect(query('#compare-azir button').getAttribute('aria-pressed')).toBe('true');
  expect(query('#compare-belveth button').getAttribute('aria-pressed')).toBe('false');
});

it('preserves an explicitly empty scope and restores changed filters from browser history', async () => {
  history.replaceState(null, '', '/compare/26.16/26.15?champions=');
  comparison();
  await import('../../../src/scripts/compare-context');
  await import('../../../src/scripts/signal-comparison');
  expect(query<HTMLElement>('[data-comparison-stage]').hidden).toBe(true);
  expect(query<HTMLElement>('[data-comparison-stage]').inert).toBe(true);
  expect(query<HTMLElement>('[data-compare-all]').hidden).toBe(false);
  expect(document.querySelectorAll('[data-compare-champion]:not([hidden])')).toHaveLength(0);

  history.replaceState(null, '', '/compare/26.16/26.15?champions=Belveth#compare-belveth');
  window.dispatchEvent(new PopStateEvent('popstate'));
  expect(query<HTMLElement>('#compare-belveth').hidden).toBe(false);
  expect(query<HTMLElement>('#compare-belveth').inert).toBe(false);
  expect(query<HTMLElement>('#compare-azir').hidden).toBe(true);
  expect(query('[data-comparison-name]').textContent).toBe('Belveth');

  history.replaceState(null, '', '/compare/26.16/26.15?champions=');
  window.dispatchEvent(new PopStateEvent('popstate'));
  expect(query<HTMLElement>('[data-comparison-stage]').hidden).toBe(true);
  query<HTMLButtonElement>('[data-compare-all]').click();
  await vi.waitFor(() => expect(query<HTMLElement>('[data-comparison-stage]').hidden).toBe(false));
  expect(document.querySelectorAll('[data-compare-champion]:not([hidden])')).toHaveLength(2);
  expect(query<HTMLElement>('[data-compare-all]').hidden).toBe(true);
});

it('keeps named records actionable when comparison artwork fails and recovers for a new subject', async () => {
  const probes: HTMLImageElement[] = [];
  vi.stubGlobal('Image', function () {
    const probe = document.createElement('img');
    Object.defineProperty(probe,'naturalWidth',{value:1215});
    Object.defineProperty(probe,'decode',{value:()=>Promise.resolve()});
    probes.push(probe); return probe;
  });
  history.replaceState(null, '', '/compare/26.16/26.15');
  comparison();
  await import('../../../src/scripts/signal-comparison');
  const art = query<HTMLImageElement>('[data-comparison-art]');
  Object.defineProperty(art, 'naturalWidth', { configurable: true, value: 0 });
  probes[0]!.dispatchEvent(new Event('error'));
  await vi.waitFor(() => expect(art.hidden).toBe(true));
  expect(art.hidden).toBe(true);
  expect(query<HTMLElement>('[data-comparison-art-fallback]').hidden).toBe(false);
  expect(query('[data-comparison-name]').textContent).toBe('Azir');
  expect(query('[data-comparison-history]').getAttribute('href')).toBe('/champion/azir');
  expect(query('[data-comparison-trail] a').getAttribute('href')).toBe('/patch/26.16#azir');

  query<HTMLButtonElement>('#compare-belveth button').click();
  Object.defineProperty(art, 'naturalWidth', { configurable: true, value: 1215 });
  probes[1]!.dispatchEvent(new Event('load'));
  await vi.waitFor(() => expect(art.hidden).toBe(false));
  expect(query<HTMLElement>('[data-comparison-art-fallback]').hidden).toBe(true);
  expect(art.src).toContain('/Belveth_0.jpg');
});

it('changes focus without rewriting a long numeric source and excludes the inactive record', async () => {
  history.replaceState(null, '', '/patch/26.16#azir');
  document.body.innerHTML = `<div data-signal-lens data-signal-subject="Azir">
    <div data-signal-options hidden><button data-signal-choice="0">Damage</button><button data-signal-choice="1">Rule</button></div>
    <article data-signal-record="0"><h3>Damage</h3><strong class="before"></strong><strong class="after"></strong><div data-signal-scrub hidden><button data-signal-set="0">Before</button><input type="range" min="0" max="100" value="100" data-signal-range><button data-signal-set="100">After</button></div></article>
    <article data-signal-record="1"><h3>Rule</h3><p class="prose-text">A complete source sentence.</p></article>
    <p data-signal-status></p></div>`;
  query('.before').textContent = beforeAfter.before!;
  query('.after').textContent = beforeAfter.after!;
  const range = query<HTMLInputElement>('[data-signal-range]');
  range.dataset.beforeValue = beforeAfter.before;
  range.dataset.afterValue = beforeAfter.after;
  await import('../../../src/scripts/signal-record');
  expect(query<HTMLElement>('[data-signal-record="1"]').inert).toBe(true);
  query<HTMLButtonElement>('[data-signal-set="0"]').click();
  expect(range.getAttribute('aria-valuetext')).toBe(`Before: ${beforeAfter.before}`);
  range.value = '100'; range.dispatchEvent(new Event('input'));
  expect(range.getAttribute('aria-valuetext')).toBe(`After: ${beforeAfter.after}`);
  expect(query('.before').textContent).toBe(beforeAfter.before);
  expect(query('.after').textContent).toBe(beforeAfter.after);
  query<HTMLButtonElement>('[data-signal-choice="1"]').click();
  expect(query<HTMLElement>('[data-signal-record="0"]').hidden).toBe(true);
  expect(query<HTMLElement>('[data-signal-record="0"]').inert).toBe(true);
  expect(query<HTMLElement>('[data-signal-record="1"]').inert).toBe(false);
  expect(query('.prose-text').textContent).toBe('A complete source sentence.');
  expect(location.hash).toBe('#azir');
});

it('publishes the initial exact subject and keeps a filtered roster preview within its results', async () => {
  history.replaceState(null, '', '/champions?q=Azir');
  document.body.innerHTML = `<div data-roster-directory><input data-roster-search value="Azir">
    <div data-reader-champion-lens="arrival" data-reader-key="Azir">
      <div data-reader-lens-media><img data-reader-champion-art><p data-reader-art-fallback hidden></p></div>
      <strong data-reader-champion-name>Azir</strong><span data-reader-champion-title></span><span data-reader-champion-record></span><a data-reader-champion-link></a>
    </div>
    ${['Azir', 'Belveth'].map(id => `<div data-roster-row data-roster-key="${id}" data-roster-name="${id}" data-roster-changes="1" data-roster-latest="26.16" data-roster-splash="https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${id}_0.jpg"><a href="/champion/${id.toLowerCase()}">${id}</a></div>`).join('')}
  </div>`;
  const focus = vi.fn();
  window.addEventListener('riftscry:focus-change', focus);
  try {
    await import('../../../src/scripts/reader-lens');
    await vi.waitFor(() => expect(focus).toHaveBeenCalled());
    expect((focus.mock.calls[0]![0] as CustomEvent).detail).toEqual({ kind: 'champion', key: 'Azir' });
    const root = query('[data-roster-directory]');
    query<HTMLElement>('[data-roster-key="Azir"]').hidden = true;
    query<HTMLInputElement>('[data-roster-search]').value = 'bel';
    root.dispatchEvent(new Event('riftscry:roster-filtered'));
    expect(query('[data-reader-champion-lens]').getAttribute('data-reader-key')).toBe('Belveth');
    query<HTMLElement>('[data-roster-key="Belveth"]').hidden = true;
    root.dispatchEvent(new Event('riftscry:roster-filtered'));
    expect(query<HTMLElement>('[data-reader-champion-lens]').hidden).toBe(true);
    document.querySelectorAll<HTMLElement>('[data-roster-row]').forEach(row => { row.hidden = false; });
    query<HTMLInputElement>('[data-roster-search]').value = '';
    root.dispatchEvent(new Event('riftscry:roster-filtered'));
    expect(query<HTMLElement>('[data-reader-champion-lens]').hidden).toBe(false);
    expect(query('[data-reader-champion-lens]').getAttribute('data-reader-key')).toBe('Belveth');
  } finally { window.removeEventListener('riftscry:focus-change', focus); }
});
