// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HomeSignal } from '../../../src/lib/home-signals';
import type { Evidence } from '../../../src/lib/investigation';
import type { RiftCinemaWorld } from '../../../src/lib/rift-cinema-world';
import { FINDINGS_KEY, readFindings } from '../../../src/lib/kept-findings';
import { rememberSignal, SIGNAL_CONTEXT_EVENT, SIGNAL_CONTEXT_KEY, type SignalContext } from '../../../src/lib/signal-context';
import { rememberReading, RESUME_KEY, RETURN_STATE_EVENT, REVIEWED_PATCH_KEY, readReturnState } from '../../../src/lib/return-briefing';
import { rememberRecentPlayer, RECENT_PLAYER_KEY } from '../../../src/lib/player/identity';

const graphics = vi.hoisted(() => ({
  create: vi.fn(),
  world: {
    setChampion: vi.fn(), setStage: vi.fn(), setReducedMotion: vi.fn(),
    setPointer: vi.fn(), resize: vi.fn(), dispose: vi.fn(),
  },
}));
// Continuity belongs to the shipped controller. Only the decorative GPU boundary is mocked.
vi.mock('../../../src/lib/rift-cinema-world', () => ({ createRiftCinemaWorld: graphics.create }));

type CinemaSignal = HomeSignal & {
  record: Evidence;
  explore: string;
  world: { id: string; region: string; character: string; primary: string; secondary: string; word: string; number: string; figure: string };
};
const signals: CinemaSignal[] = [
  { id: 'Akali', name: 'Akali', before: '10s', after: '8s' },
  { id: 'Yasuo', name: 'Yasuo', before: '12s', after: '9s' },
].map(({ id, name, before, after }, index) => ({
  championId: id, championName: name, patchId: '26.21', releaseDate: '2026-10-20',
  icon: `/images/${id}.png`, ability: 'Q', abilityName: 'Recorded ability',
  classification: 'buff', direction: 'buff', label: 'Cooldown', before, after,
  href: `/patch/26.21#${id.toLowerCase()}`, sourceUrl: 'https://www.leagueoflegends.com/patch',
  record: { id: `26.21:${id}:0:Q:0`, field: 'Cooldown', patch: '26.21', date: '2026-10-20',
    source: 'https://www.leagueoflegends.com/patch', ability: 'Q', abilityName: 'Recorded ability',
    change: { kind: 'numeric', label: 'Cooldown', before, after, direction: 'buff' } },
  explore: `/explore?champion=${id}&event=26.21%3A${id}%3A0%3AQ%3A0#change`,
  world: { id, region: 'IONIA', character: `${name}'s world`, primary: '#83cdb2', secondary: '#38656d', word: 'RIFT', number: String(index + 1), figure: `/images/${id}-figure.png` },
}));
const first = signals[0]!;
const second = signals[1]!;
const prior: SignalContext = { championId: 'Ahri', name: 'Ahri', href: '/champion/ahri?mode=reader#record-26-3', patch: '26.3' };
const other: SignalContext = { championId: 'Ashe', name: 'Ashe', href: '/explore?champion=Ashe&older=26.14&newer=26.16&event=ashe-q#change', patch: '26.16', event: 'ashe-q' };
const player = { platform: 'eun1', puuid: 'fixture-player-000000000000000000000000000000000', name: 'Returning Player#TEST' };
const query = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const host = () => query('[data-rift-cinema]');
const evidence = () => query<HTMLDialogElement>('[data-cinema-evidence]');
const contextLink = () => query<HTMLAnchorElement>('[data-home-context]');
const readingLink = () => query<HTMLAnchorElement>('[data-home-reading]');
const keep = () => query<HTMLButtonElement>('[data-home-keep]');
const stored = () => JSON.parse(localStorage.getItem(SIGNAL_CONTEXT_KEY) ?? 'null') as SignalContext | null;
const expected = (signal: CinemaSignal): SignalContext => ({ championId: signal.championId, name: signal.championName, href: signal.explore, patch: signal.patchId, event: signal.record.id });

function transition(type: 'pagehide' | 'pageshow', persisted: boolean) {
  // Happy DOM aliases PageTransitionEvent to Event and drops its persisted option.
  const event = new Event(type);
  Object.defineProperty(event, 'persisted', { value: persisted });
  window.dispatchEvent(event);
}
function trackStorage() {
  const device = window.localStorage;
  // Happy DOM binds Storage methods onto its proxy; prototype spies miss those calls.
  const access = {
    getItem: vi.fn((key: string) => device.getItem(key)),
    setItem: vi.fn((key: string, value: string) => device.setItem(key, value)),
    removeItem: (key: string) => device.removeItem(key),
    clear: () => device.clear(),
    key: (index: number) => device.key(index),
    get length() { return device.length; },
  } satisfies Storage;
  vi.spyOn(window, 'localStorage', 'get').mockReturnValue(access);
  vi.stubGlobal('localStorage', access);
  return access;
}

async function mount(href = '/') {
  transition('pagehide', false);
  vi.resetModules();
  history.replaceState(null, '', href);
  document.body.innerHTML = `
    <main data-rift-cinema data-home-signals data-cinema-state="world">
      <canvas data-cinema-canvas></canvas><img data-cinema-poster alt="">
      <a data-home-briefing data-home-personal href="/next-game"><span data-home-briefing-label></span></a>
      <a data-home-review href="/players"><strong>Review a game</strong></a>
      <button data-cinema-menu-open>Open navigation menu</button>
      <a data-home-reading hidden href="/explore#change"><span data-home-reading-label></span></a>
      <p data-home-return hidden></p><a data-home-context hidden href="/explore#change"></a>
      <h2 data-home-subject></h2><a data-cinema-inspect href="${first.explore}">Scry this champion</a>
      ${signals.map(signal => `<a data-home-choice="${signal.championId}" href="${signal.explore}">${signal.championName}</a>`).join('')}
      <dialog data-cinema-evidence>
        <button data-cinema-close>Close change</button><h2 data-cinema-evidence-name></h2>
        ${signals.map(signal => `<div data-home-record="${signal.championId}"><span class="before">${signal.before}</span><span class="after">${signal.after}</span></div>`).join('')}
        <button data-home-keep hidden aria-pressed="false"><span>Keep this finding</span><span>+</span></button>
        <a data-home-explore href="${first.explore}">Explore the full record</a><p data-home-keep-status></p>
      </dialog>
      <dialog data-cinema-menu>
        <button data-cinema-menu-close>Close navigation</button>
        <a data-home-personal href="/next-game">Briefing</a><a data-station-link="players" href="/players">Games</a>
      </dialog>
      <button data-cinema-motion aria-pressed="false"><span data-cinema-motion-label></span></button>
      <p data-cinema-status></p>
    </main>
    <script type="application/json" id="home-signals-data">${JSON.stringify(signals)}</script>
    <script type="application/json" id="home-legacy-signals">${JSON.stringify([{ championId: prior.championId, explore: prior.href }])}</script>`;
  await import('../../../src/scripts/rift-cinema');
  expect(host().dataset.homeReady).toBe('true');
}
function expectContext(context: SignalContext) {
  expect(contextLink().hidden).toBe(false);
  expect(contextLink().getAttribute('href')).toBe(context.href);
  expect(contextLink().textContent).toBe(`Continue following ${context.name} ↗`);
}
function expectNoContext() {
  expect(contextLink().hidden).toBe(true);
  expect(contextLink().textContent).toBe('');
  expect(contextLink().getAttribute('href')).toBe('/explore#change');
}
function expectNoSavedWork() {
  expect(localStorage.getItem(FINDINGS_KEY)).toBeNull();
  expect(localStorage.getItem(REVIEWED_PATCH_KEY)).toBeNull();
  expect(localStorage.getItem(RESUME_KEY)).toBeNull();
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.dataset.motion = 'reduced';
  vi.clearAllMocks();
  graphics.create.mockReturnValue(graphics.world satisfies RiftCinemaWorld);
});
afterEach(() => {
  transition('pagehide', false);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('home continuity in the shipped cinema controller', () => {
  it('offers an exact reading place alongside the returning player briefing without creating saved work', async () => {
    localStorage.setItem(RECENT_PLAYER_KEY, JSON.stringify(player));
    localStorage.setItem(SIGNAL_CONTEXT_KEY, JSON.stringify(other));
    localStorage.setItem(RESUME_KEY, JSON.stringify({ href: prior.href, label: 'Ahri — exact historical record', updatedAt: '2026-10-31T12:00:00Z' }));
    const write = trackStorage().setItem;
    await mount('/');
    expect(readingLink().hidden).toBe(false);
    expect(readingLink().getAttribute('href')).toBe(prior.href);
    expect(readingLink().textContent).toContain('exact historical record');
    expectNoContext();
    const briefing = query<HTMLAnchorElement>('[data-home-briefing]');
    expect(briefing.hidden).toBe(false);
    const destination = new URL(briefing.href);
    expect(destination.pathname).toBe('/next-game');
    expect(destination.searchParams.get('puuid')).toBe(player.puuid);
    expect(destination.searchParams.get('name')).toBe(player.name);
    expect(stored()).toEqual(other);
    expect(write).not.toHaveBeenCalled();
    expect(localStorage.getItem(FINDINGS_KEY)).toBeNull();
    expect(localStorage.getItem(REVIEWED_PATCH_KEY)).toBeNull();

    localStorage.removeItem(RECENT_PLAYER_KEY);
    window.dispatchEvent(new StorageEvent('storage', { key: RECENT_PLAYER_KEY }));
    expect(briefing.hidden).toBe(false);
    expect(briefing.getAttribute('href')).toBe('/next-game');
    expect(readingLink().hidden).toBe(false);
    expect(readingLink().getAttribute('href')).toBe(prior.href);
    localStorage.clear();
    window.dispatchEvent(new StorageEvent('storage', { key: null }));
    expect(readingLink().hidden).toBe(true);
    expectNoContext();
  });

  it.each(['https://another.example', '//another.example/record', '/explore?puuid=private-player#change'])('ignores an unsafe stored resume: %s', async href => {
    localStorage.setItem(RESUME_KEY, JSON.stringify({ href, label: 'Unsafe', updatedAt: '2026-10-31T12:00:00Z' }));
    localStorage.setItem(SIGNAL_CONTEXT_KEY, JSON.stringify({ ...prior, href }));
    await mount('/');
    expect(readingLink().hidden).toBe(true);
    expectNoContext();
    expect(query('[data-home-personal]').getAttribute('href')).toBe('/next-game');
    expect(query('[data-cinema-inspect]').getAttribute('href')).toBe(first.explore);
    expect(localStorage.getItem(FINDINGS_KEY)).toBeNull();
    expect(localStorage.getItem(REVIEWED_PATCH_KEY)).toBeNull();
  });

  it('keeps exact record actions usable and reports a failed save when browser storage is blocked', async () => {
    const access = trackStorage();
    access.getItem.mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    const write = access.setItem.mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    await mount('/');
    expect(readingLink().hidden).toBe(true);
    expect(query('[data-home-personal]').getAttribute('href')).toBe('/next-game');
    query<HTMLAnchorElement>(`[data-home-choice="${second.championId}"]`).click();
    query<HTMLAnchorElement>('[data-cinema-inspect]').click();
    expect(evidence().open).toBe(true);
    expect(query('[data-home-explore]').getAttribute('href')).toBe(second.explore);
    keep().click();
    expect(keep().getAttribute('aria-pressed')).toBe('false');
    expect(query('[data-home-keep-status]').textContent).toContain('could not save');
    expect(evidence().open).toBe(true);
    expect(write.mock.calls.some(([key]) => key === RESUME_KEY || key === REVIEWED_PATCH_KEY)).toBe(false);
  });

  it('preserves a prior record through bare arrival, reload and world history restoration', async () => {
    localStorage.setItem(SIGNAL_CONTEXT_KEY, JSON.stringify(prior));
    const write = trackStorage().setItem;
    await mount('/');
    expect(host().dataset.homeSubject).toBe(first.championId);
    expect(location.search).toBe('');
    expect(location.hash).toBe('');
    expect(stored()).toEqual(prior); expectContext(prior);

    await mount(location.pathname + location.search + location.hash);
    expect(stored()).toEqual(prior); expectContext(prior);
    history.replaceState(null, '', `/?signal=${second.championId}#signal`);
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(host().dataset.homeSubject).toBe(second.championId);
    expect(host().dataset.cinemaState).toBe('world');
    expect(evidence().open).toBe(false);
    expect(stored()).toEqual(prior); expectContext(prior);
    expect(write).not.toHaveBeenCalled();
    expectNoSavedWork();
  });

  it('offers an earlier interval even when its champion matches the displayed subject', async () => {
    const earlier: SignalContext = { championId: first.championId, name: first.championName, href: `/explore?champion=${first.championId}&older=26.14&newer=26.16#change`, patch: '26.16' };
    localStorage.setItem(SIGNAL_CONTEXT_KEY, JSON.stringify(earlier));
    await mount(`/?signal=${first.championId}`);
    expect(host().dataset.homeSubject).toBe(first.championId);
    expect(stored()).toEqual(earlier); expectContext(earlier);
    expectNoSavedWork();
  });

  it('refreshes context on local events, external storage changes and BFCache restoration', async () => {
    localStorage.setItem(SIGNAL_CONTEXT_KEY, JSON.stringify(prior));
    await mount('/');
    rememberSignal(other); expectContext(other);
    rememberSignal(expected(first)); expectNoContext();
    localStorage.setItem(SIGNAL_CONTEXT_KEY, JSON.stringify(prior));
    window.dispatchEvent(new StorageEvent('storage', { key: SIGNAL_CONTEXT_KEY }));
    expectContext(prior);
    localStorage.removeItem(SIGNAL_CONTEXT_KEY);
    window.dispatchEvent(new StorageEvent('storage', { key: SIGNAL_CONTEXT_KEY }));
    expectNoContext();

    transition('pagehide', true);
    expect(graphics.world.dispose).not.toHaveBeenCalled();
    localStorage.setItem(SIGNAL_CONTEXT_KEY, JSON.stringify(other));
    transition('pageshow', true);
    expectContext(other);
    expect(graphics.world.resize).toHaveBeenCalledOnce();
    localStorage.clear();
    transition('pageshow', true);
    expectNoContext();

    rememberSignal(prior); expectContext(prior);
    localStorage.clear();
    window.dispatchEvent(new StorageEvent('storage', { key: null }));
    expectNoContext();
    window.dispatchEvent(new CustomEvent(SIGNAL_CONTEXT_EVENT, { detail: null }));
    expectNoContext();
    expectNoSavedWork();
  });

  it('retains a validated in-session context event if writing that context is blocked', async () => {
    localStorage.setItem(SIGNAL_CONTEXT_KEY, JSON.stringify(prior));
    await mount('/');
    trackStorage().setItem.mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    expect(rememberSignal(other)).toBe(false);
    expect(stored()).toEqual(prior);
    expectContext(other);
    expectNoSavedWork();
  });

  it('refreshes reading and player shortcuts without replacing one with the other', async () => {
    localStorage.setItem(SIGNAL_CONTEXT_KEY, JSON.stringify(prior));
    await mount('/');
    expectContext(prior);
    rememberReading(other.href, 'Ashe — exact interval');
    expect(readingLink().hidden).toBe(false);
    expect(readingLink().getAttribute('href')).toBe(other.href);
    expectNoContext();
    rememberRecentPlayer(player);
    for (const personal of document.querySelectorAll<HTMLAnchorElement>('[data-home-personal]')) {
      const destination = new URL(personal.href);
      expect(destination.pathname).toBe('/next-game');
      expect(destination.searchParams.get('puuid')).toBe(player.puuid);
    }
    const games = new URL(query<HTMLAnchorElement>('[data-station-link="players"]').href);
    expect(games.pathname).toBe(`/players/${player.platform}/${player.puuid}`);
    expect(games.searchParams.get('view')).toBe('history');
    expect(readingLink().hidden).toBe(false);
    localStorage.removeItem(RESUME_KEY);
    window.dispatchEvent(new Event(RETURN_STATE_EVENT));
    expect(readingLink().hidden).toBe(true);
    expectContext(prior);
    expectNoSavedWork();
  });

  it('changes subject and opens exact evidence deliberately without keeping or marking anything reviewed', async () => {
    localStorage.setItem(SIGNAL_CONTEXT_KEY, JSON.stringify(prior));
    await mount('/');
    query<HTMLAnchorElement>(`[data-home-choice="${second.championId}"]`).click();
    expect(host().dataset.homeSubject).toBe(second.championId);
    expect(host().dataset.cinemaState).toBe('world');
    expect(location.search).toBe(`?signal=${second.championId}`);
    expect(stored()).toEqual(expected(second)); expectNoContext();
    expectNoSavedWork();
    rememberSignal(other); expectContext(other);
    query<HTMLAnchorElement>('[data-cinema-inspect]').click();
    expect(evidence().open).toBe(true);
    expect(host().dataset.cinemaState).toBe('inspect');
    expect(location.hash).toBe('#inspect');
    expect(query('[data-home-record]:not([hidden]) .before').textContent).toBe(second.before);
    expect(query('[data-home-record]:not([hidden]) .after').textContent).toBe(second.after);
    expect(query('[data-home-explore]').getAttribute('href')).toBe(second.explore);
    expect(stored()).toEqual(expected(second)); expectNoContext();
    expectNoSavedWork();

    history.replaceState(null, '', `/?signal=${first.championId}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(evidence().open).toBe(false);
    expect(host().dataset.cinemaState).toBe('world');
    expect(host().dataset.homeSubject).toBe(first.championId);
    expect(stored()).toEqual(expected(second)); expectContext(expected(second));
    expectNoSavedWork();
  });

  it('keeps only an explicitly chosen finding, preserves its exact URL and leaves the evidence open', async () => {
    await mount(`/?signal=${second.championId}#inspect`);
    expectNoSavedWork();
    keep().click();
    expect(readFindings()).toEqual([{
      id: second.record.id, champion: second.championId, name: second.championName,
      patch: second.patchId, date: second.releaseDate, label: `${second.abilityName} / ${second.label}`,
      text: `${second.before} → ${second.after}`, href: second.explore,
    }]);
    expect(keep().getAttribute('aria-pressed')).toBe('true');
    expect(evidence().open).toBe(true);
    expect(location.hash).toBe('#inspect');
    expect(readReturnState().resume).toMatchObject({ href: second.explore, label: `${second.championName} — ${second.label}` });
    expect(readingLink().getAttribute('href')).toBe(second.explore);
    expectNoContext();
    keep().click();
    expect(readFindings()).toHaveLength(1);
    expect(localStorage.getItem(REVIEWED_PATCH_KEY)).toBeNull();
    localStorage.removeItem(FINDINGS_KEY);
    window.dispatchEvent(new StorageEvent('storage', { key: FINDINGS_KEY }));
    expect(keep().getAttribute('aria-pressed')).toBe('false');
    expect(evidence().open).toBe(true);
  });

  it.each(['inspect', 'reveal', 'carry'])('opens a direct #%s link as exact evidence and closes it without saving', async fragment => {
    localStorage.setItem(SIGNAL_CONTEXT_KEY, JSON.stringify(prior));
    await mount(`/?signal=${second.championId}#${fragment}`);
    expect(host().dataset.homeSubject).toBe(second.championId);
    expect(host().dataset.cinemaState).toBe('inspect');
    expect(evidence().open).toBe(true);
    expect(query('[data-home-explore]').getAttribute('href')).toBe(second.explore);
    expect(stored()).toEqual(expected(second)); expectNoContext();
    expectNoSavedWork();
    evidence().dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(evidence().open).toBe(false);
    expect(host().dataset.cinemaState).toBe('world');
    expect(location.search).toBe(`?signal=${second.championId}`);
    expect(location.hash).toBe('');
    expectNoSavedWork();
  });

  it.each(['inspect', 'reveal', 'carry'])('preserves an earlier featured champion’s exact archive destination from #%s', async fragment => {
    const replace = vi.spyOn(location, 'replace').mockImplementation(() => {});
    localStorage.setItem(SIGNAL_CONTEXT_KEY, JSON.stringify(other));
    await mount(`/?signal=${prior.championId}#${fragment}`);
    expect(replace).toHaveBeenCalledExactlyOnceWith(prior.href);
    expect(stored()).toEqual(other);
    expectNoSavedWork();
  });
});
