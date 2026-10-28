import { useEffect, useId, useState } from 'react';
import useSWR, { unstable_serialize, useSWRConfig } from 'swr';
import { participant, type SummonerProfile } from '../../lib/player/contracts';
import { historyAvailabilityForQueue, historyOptions } from '../../lib/player/modes';
import { briefingLink } from '../../lib/player/identity';
import { api, fetcher, playerLink, type PlayerInitial, type PlayerView } from './client';
import { usePlayerHistory } from './usePlayerHistory';
import { itemMetadataKey } from './useItemMetadata';
import PlayerArrival, { type PlayerRank } from './PlayerArrival';
import PlayerSample from './PlayerSample';
import PlayerHistory from './PlayerHistory';
import BuildMemory from './BuildMemory';
import PersonalBuilds from './PersonalBuilds';
import PlayerIcon from './PlayerIcon';
import { championDisplayName } from './championArtwork';
import PlayerModePicker from './PlayerModePicker';
import ChampionPortrait from './ChampionPortrait';

type Filters = { queue: string; champion: string; result: string; view: PlayerView };
type Account = { puuid: string; gameName: string; tagLine: string };
const views: { id: PlayerView; label: string; icon: 'history' | 'build' | 'bookmark' }[] = [
  { id: 'history', label: 'Matches', icon: 'history' },
  { id: 'builds', label: 'Builds', icon: 'build' },
  { id: 'memory', label: 'Build Memory', icon: 'bookmark' },
];
const viewOf = (value: string): PlayerView => value === 'builds' || value === 'memory' ? value : 'history';
const queueOf = (value: string) => historyOptions.some(option => option.value === value) ? value : 'all';

export default function PlayerProfile({ initial }: { initial: PlayerInitial }) {
  const filterId = useId();
  const { platform, puuid } = initial;
  const [filters, setFilters] = useState<Filters>({ queue: queueOf(initial.queue), champion: initial.champion, result: initial.result, view: viewOf(initial.view) });
  const [message, setMessage] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const { cache, mutate } = useSWRConfig();
  const query = { platform, puuid };
  const { data: account, error: accountError, mutate: retryAccount } = useSWR<Account>(api('account', query), fetcher, { shouldRetryOnError: false, revalidateOnFocus: false });
  const { data: ranks, error: rankError, mutate: retryRanks } = useSWR<PlayerRank[]>(api('rank', query), fetcher, { shouldRetryOnError: false, revalidateOnFocus: false });
  const { data: summoner, error: summonerError, mutate: retrySummoner } = useSWR<SummonerProfile>(api('summoner', query), fetcher, { shouldRetryOnError: false, revalidateOnFocus: false, revalidateOnReconnect: false });
  const history = usePlayerHistory(platform, puuid, filters.queue);
  // Availability depends on the imported sample, before champion/result filters.
  const historyAvailability = !history.loading && history.matches.length === 0
    ? historyAvailabilityForQueue(filters.queue) : undefined;
  const name = account?.puuid === puuid && account.gameName && account.tagLine ? `${account.gameName}#${account.tagLine}` : '';
  const profile = { ...initial, ...filters, name };
  const back = playerLink(platform, puuid, { ...filters, name });
  const nextGameHref = briefingLink({ platform, puuid, name }, { champion: filters.champion, queue: filters.queue });
  const advancedFilterCount = Number(!!filters.champion) + Number(!!filters.result);
  const matches = history.matches.filter(match => {
    const player = participant(match, puuid);
    return player && (!filters.champion || player.championName === filters.champion) &&
      (!filters.result || (filters.result === 'win') === player.win);
  });
  const champions = [...new Set(history.matches.flatMap(match => {
    const player = participant(match, puuid);
    return player ? [player.championName] : [];
  }))].sort();

  useEffect(() => {
    if (name) document.title = `${name} · RiftScry`;
  }, [name]);

  useEffect(() => {
    const restore = () => {
      const params = new URLSearchParams(window.location.search);
      setFilters({ queue: queueOf(params.get('queue') ?? ''), champion: params.get('champion') ?? '', result: params.get('result') ?? '', view: viewOf(params.get('view') ?? '') });
    };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);

  useEffect(() => {
    if (history.loading) return;
    let frame = 0;
    try {
      const key = `riftscry:scroll:${platform}:${puuid}`;
      const saved = sessionStorage.getItem(key);
      if (saved && Number.isFinite(Number(saved))) {
        frame = requestAnimationFrame(() => {
          window.scrollTo({ top: Number(saved), behavior: 'instant' });
          sessionStorage.removeItem(key);
        });
      }
    } catch { /* Scroll restoration is optional when browser storage is blocked. */ }
    return () => cancelAnimationFrame(frame);
  }, [history.loading, platform, puuid]);

  function change(next: Partial<Filters>) {
    const updated = { ...filters, ...next };
    setFilters(updated);
    window.history.replaceState(window.history.state, '', playerLink(platform, puuid, { ...updated, name }));
  }

  function remember() {
    try {
      localStorage.setItem('riftscry:remembered-player:v1', JSON.stringify({ platform, puuid, name }));
      setMessage('Saved on this browser.');
    } catch {
      setMessage('Saving is unavailable in this browser.');
    }
  }

  function leave() {
    try { sessionStorage.setItem(`riftscry:scroll:${platform}:${puuid}`, String(window.scrollY)); }
    catch { /* Match navigation remains available without browser storage. */ }
  }

  async function refresh() {
    if (refreshing || history.retrySeconds) return;
    setRefreshing(true);
    // Only references already requested and failed are retried. Successful or
    // unopened item views keep their cache and do not create extra requests.
    const references = new Map<string, string | readonly string[]>();
    for (const match of history.matches) {
      for (const key of [itemMetadataKey(match, platform, puuid), api('items', { platform, puuid, id: match.metadata.matchId })]) {
        references.set(unstable_serialize(key), key);
      }
    }
    const failedReferences = [...references].filter(([key]) => cache.get(key)?.error).map(([, key]) => key);
    try {
      await Promise.allSettled([
        history.refresh(),
        ...(accountError ? [retryAccount()] : []),
        ...(rankError ? [retryRanks()] : []),
        ...(summonerError ? [retrySummoner()] : []),
        ...failedReferences.map(key => mutate(key)),
      ]);
    } finally { setRefreshing(false); }
  }

  return <div className="player-profile profile-hub" data-player-profile data-view={filters.view}>
    <PlayerArrival initial={profile} summoner={summoner?.puuid === puuid ? summoner : undefined} ranks={ranks} rankFailed={!!rankError} loading={history.loading || refreshing} retrySeconds={history.retrySeconds} message={message} onRemember={remember} onRefresh={() => void refresh()} />
    <div className="player-records" id="player-records">
      {accountError && <p className="player-help" role="status">Name unavailable. Your matches are still here.</p>}
      <div className="player-view-navigation">
        <nav className="player-tabs" aria-label="Player views">
          {views.map(view => <button type="button" key={view.id} aria-pressed={filters.view === view.id} aria-controls="player-view" onClick={() => change({ view: view.id })}><PlayerIcon name={view.icon} />{view.label}</button>)}
        </nav>
        <a className="player-text-link player-next-game-link" href={nextGameHref}><PlayerIcon name="target" />Automatic briefing<PlayerIcon name="arrow-right" size={16} /></a>
      </div>
      <div className="profile-controls" role="group" aria-label="Filter match sample">
        <PlayerModePicker value={filters.queue} onChange={queue => change({ queue })} />
        {filters.view !== 'memory' && <details className="profile-filter-details">
          <summary><PlayerIcon name="filter" size={17} />Filters{advancedFilterCount > 0 && <span className="filter-count">{advancedFilterCount}</span>}</summary>
          <div className="profile-filter-fields">
          <div className="player-field"><label htmlFor={`${filterId}-champion`}>Champion</label><select id={`${filterId}-champion`} value={filters.champion} onChange={event => change({ champion: event.target.value })}><option value="">All champions</option>{filters.champion && !champions.includes(filters.champion) && <option value={filters.champion}>{championDisplayName(filters.champion)} · not loaded</option>}{champions.map(champion => <option key={champion} value={champion}>{championDisplayName(champion)}</option>)}</select></div>
          <div className="player-field"><label htmlFor={`${filterId}-result`}>Result</label><select id={`${filterId}-result`} value={filters.result} onChange={event => change({ result: event.target.value })}><option value="">All results</option><option value="win">Win</option><option value="loss">Loss</option></select></div>
          {advancedFilterCount > 0 && <button type="button" className="player-button-text" onClick={() => change({ champion: '', result: '' })}><PlayerIcon name="close" size={16} />Clear filters</button>}
          </div>
        </details>}
      </div>
      {filters.view !== 'memory' && advancedFilterCount > 0 && <div className="profile-active-filters" aria-label="Active filters">
        {filters.champion && <button type="button" aria-label={`Remove champion filter: ${championDisplayName(filters.champion)}`} onClick={() => change({ champion: '' })}><ChampionPortrait champion={filters.champion} size={22} />{championDisplayName(filters.champion)}<PlayerIcon name="close" size={13} /></button>}
        {filters.result && <button type="button" aria-label={`Remove ${filters.result === 'win' ? 'Wins' : 'Losses'} filter`} onClick={() => change({ result: '' })}>{filters.result === 'win' ? 'Wins' : 'Losses'}<PlayerIcon name="close" size={13} /></button>}
      </div>}
      {filters.view === 'memory' && <p className="player-help">Mode filters your follow-up games.</p>}
      <PlayerSample matches={matches} puuid={puuid} imported={history.matches.length} available={history.available} loading={history.loading} failed={history.failed} error={history.error} retrySeconds={history.retrySeconds} showBreakdown={filters.view === 'history'} availability={historyAvailability} onChangeQueue={queue => change({ queue, champion: '', result: '' })} />
      <div className="player-view" id="player-view" key={filters.view}>
        {filters.view === 'memory' ? <BuildMemory player={`${platform}:${puuid}`} platform={platform} puuid={puuid} matches={history.matches} matchesLoading={history.loading} back={back} onLeave={leave} /> :
          historyAvailability ? null : filters.view === 'history'
            ? <PlayerHistory matches={matches} platform={platform} puuid={puuid} back={back} loading={history.loading} onLeave={leave} />
            : <PersonalBuilds matches={matches} platform={platform} puuid={puuid} back={back} onLeave={leave} />}
      </div>
    </div>
  </div>;
}
