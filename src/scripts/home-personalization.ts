import { $account, getAccountScope } from '../lib/account/storage';
import { readRiotAssociation } from '../lib/account/riot-account';
import { homeChampionCounts, type HomeChampionCount } from '../lib/home-personalization';
import { HOME_ROSTER_CACHE_KEY, parseHomeRoster, type HomeRosterSnapshot } from '../lib/home-roster-cache';
import type { CinemaSignal } from '../lib/home-champions';
import type { Match } from '../lib/player/contracts';
import { api, fetcher, getPlayerCooldown, matchLink } from '../components/player/client';

export function personalizeHome(root: HTMLElement, catalogue: () => Promise<CinemaSignal[]>,
  show: (champions: HomeChampionCount[]) => boolean, pending: () => void, reset: () => void, lifetime: AbortSignal) {
  const status = root.querySelector<HTMLElement>('[data-home-roster-status]')!;
  const label = root.querySelector<HTMLElement>('[data-home-roster-label]')!;
  const retry = root.querySelector<HTMLButtonElement>('[data-home-roster-retry]')!;
  const association = root.querySelector<HTMLAnchorElement>('[data-home-associate]')!;
  const review = root.querySelector<HTMLAnchorElement>('[data-home-review]')!;
  const roster = root.querySelector<HTMLElement>('.cinema-roster')!;
  let identity: string | undefined, revision = 0, timer = 0, initialSyncFinished = false;
  let displayed: HomeRosterSnapshot | null = null;
  let retryAt = 0;
  function retryLabel() {
    const seconds = Math.max(0, Math.ceil((Math.max(retryAt, getPlayerCooldown()) - Date.now()) / 1000));
    retry.disabled = seconds > 0;
    retry.textContent = seconds ? `Retry in ${seconds}s` : 'Retry';
    clearTimeout(timer);
    if (seconds && !lifetime.aborted) timer = window.setTimeout(retryLabel, 1000);
  }
  function refresh(force = false) {
    const account = $account.get();
    let player = null;
    try { if (account.ready && account.userId) player = readRiotAssociation(); }
    catch { /* An unreadable optional association is never replaced by a recent lookup. */ }
    // A restored session can precede the first cloud association download.
    // Keep the neutral scene until that first sync has had its chance to finish.
    if (!account.ready || (account.userId && !player && !initialSyncFinished)) {
      if (identity !== undefined) { identity = undefined; revision++; displayed = null; }
      pending(); return;
    }
    const next = account.ready && account.userId && player ? `${account.userId}:${player.platform}:${player.puuid}` : '';
    if (next === identity && !force) {
      if (account.ready && account.userId && !player) {
        association.hidden = false; status.textContent = 'Personalize with your Riot ID.';
      }
      return;
    }
    const changed = next !== identity;
    identity = next; const ticket = ++revision;
    if (changed) { displayed = null; pending(); }
    retry.hidden = true; association.hidden = !account.userId;
    roster.removeAttribute('aria-busy');
    label.textContent = 'Featured champions';
    status.textContent = account.userId ? 'Personalize with your Riot ID.' : 'Choose a champion to explore.';
    if (!next || !player) { reset(); return; }
    association.hidden = true;
    label.textContent = 'Your champions'; status.textContent = 'Finding your most played…';
    roster.setAttribute('aria-busy', 'true');
    const selected = player;
    const cacheIdentity = { owner: account.userId!, platform: selected.platform, puuid: selected.puuid };
    function display(snapshot: HomeRosterSnapshot, refreshing = false) {
      displayed = snapshot; const personal = show(snapshot.champions);
      label.textContent = personal ? 'Most played recently' : 'Featured champions';
      status.textContent = personal ? `${snapshot.total} recent game${snapshot.total === 1 ? '' : 's'}${snapshot.failed ? ` · ${snapshot.failed} unavailable` : ''}${snapshot.excluded ? ` · ${snapshot.excluded} excluded` : ''}${refreshing ? ' · Refreshing…' : ''}` : 'Your briefing still uses your recent games.';
      if (snapshot.latest) {
        review.href = matchLink(snapshot.latest, selected.platform, selected.puuid);
        review.dataset.latestReview = review.href;
        review.querySelector('strong')!.textContent = 'Review latest game';
      }
    }
    const stillCurrent = () => !lifetime.aborted && ticket === revision && getAccountScope() === account.userId &&
      (() => { try { const value = readRiotAssociation(); return value?.puuid === selected.puuid && value.platform === selected.platform; } catch { return false; } })();
    void (async () => {
      const entries = await catalogue();
      if (!stillCurrent()) return;
      if (!displayed) {
        let cached: HomeRosterSnapshot | null = null;
        try { cached = parseHomeRoster(localStorage.getItem(HOME_ROSTER_CACHE_KEY), cacheIdentity, entries.map(entry => entry.championId)); } catch { /* Storage is optional. */ }
        if (cached) display(cached, true);
      }
      const history = await fetcher<unknown>(api('history', { platform: selected.platform, puuid: selected.puuid, queue: 'all' }));
      if (!stillCurrent()) return;
      if (!Array.isArray(history) || history.some(id => typeof id !== 'string' || !/^[A-Z0-9]{2,5}_[0-9]{5,20}$/.test(id))) throw new Error('Recent games could not be read.');
      const ids = [...new Set(history as string[])].slice(0, 20);
      const matches: Match[] = []; let failed = 0;
      for (let index = 0; index < ids.length; index += 4) {
        if (!stillCurrent()) return;
        const batch = await Promise.allSettled(ids.slice(index, index + 4).map(id => fetcher<Match>(api('match', { platform: selected.platform, puuid: selected.puuid, id }))));
        for (let offset = 0; offset < batch.length; offset++) {
          const result = batch[offset]!;
          if (result.status === 'fulfilled' && result.value?.metadata?.matchId === ids[index + offset]) matches.push(result.value);
          else failed++;
        }
      }
      if (!stillCurrent()) return;
      const result = homeChampionCounts(matches, selected.puuid, entries.map(entry => entry.championId));
      if (result.champions.length) {
        const snapshot: HomeRosterSnapshot = { ...cacheIdentity, savedAt: Date.now(), champions: result.champions,
          total: result.total, failed, excluded: matches.length - result.total, latest: result.latest?.metadata.matchId ?? null };
        display(snapshot);
        try { localStorage.setItem(HOME_ROSTER_CACHE_KEY, JSON.stringify(snapshot)); } catch { /* The current roster still works without storage. */ }
      } else {
        if (!failed) {
          displayed = null; pending();
          try { localStorage.removeItem(HOME_ROSTER_CACHE_KEY); } catch { /* Optional cache. */ }
        }
        label.textContent = displayed ? (root.dataset.homeRosterMode === 'personal' ? 'Most played recently' : 'Featured champions') : 'Your champions';
        status.textContent = failed ? (displayed ? 'Saved games · Refresh unavailable.' : 'Games unavailable. Try again.') : 'No supported recent games yet.';
      }
      retry.hidden = !failed; retryAt = 0; retryLabel();
    })().catch(error => {
      if (!stillCurrent()) return;
      label.textContent = displayed ? (root.dataset.homeRosterMode === 'personal' ? 'Most played recently' : 'Featured champions') : 'Your champions';
      status.textContent = displayed ? 'Saved games · Refresh unavailable.' : 'Your games could not load.';
      retryAt = typeof error?.retryAt === 'number' ? error.retryAt : 0;
      retry.hidden = false; retryLabel();
    }).finally(() => { if (ticket === revision) roster.removeAttribute('aria-busy'); });
  }
  const unsubscribe = $account.subscribe(() => refresh());
  void import('../lib/account/client').then(({ initializeAccount }) => initializeAccount()).finally(() => {
    if (lifetime.aborted) return;
    initialSyncFinished = true; refresh();
  });
  window.addEventListener('storage', () => refresh(), { signal: lifetime });
  window.addEventListener('pageshow', () => refresh(), { signal: lifetime });
  retry.addEventListener('click', () => { if (!retry.disabled) refresh(true); }, { signal: lifetime });
  lifetime.addEventListener('abort', () => { revision++; clearTimeout(timer); unsubscribe(); }, { once: true });
}
