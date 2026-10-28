import { useEffect, useId, useState } from 'react';
import useSWR from 'swr';
import { participant } from '../../lib/player/contracts';
import { historyOptions } from '../../lib/player/modes';
import { api, fetcher, playerLink, type PlayerInitial, type PlayerView } from './client';
import { usePlayerHistory } from './usePlayerHistory';
import PlayerArrival from './PlayerArrival';
import PlayerSample from './PlayerSample';
import PlayerHistory from './PlayerHistory';
import BuildMemory from './BuildMemory';
import PersonalBuilds from './PersonalBuilds';

type Filters = { queue: string; champion: string; result: string; view: PlayerView };
type Rank = { queueType: string; tier: string; rank: string; leaguePoints: number };
type Account = { puuid: string; gameName: string; tagLine: string };
const views: { id: PlayerView; label: string }[] = [
  { id: 'history', label: 'Match history' },
  { id: 'builds', label: 'Personal builds' },
  { id: 'memory', label: 'Build Memory' },
];
const viewOf = (value: string): PlayerView => value === 'builds' || value === 'memory' ? value : 'history';
const queueOf = (value: string) => historyOptions.some(option => option.value === value) ? value : 'all';

function CurrentRanks({ ranks, failed }: { ranks?: Rank[]; failed: boolean }) {
  return <aside className="player-ranks" aria-label="Current ranked status">
    <p className="player-kicker">CURRENT RANKED STATUS</p>
    <div>{ranks ? ranks.length ? ranks.map(rank => <p key={rank.queueType}><span>{rank.queueType === 'RANKED_SOLO_5x5' ? 'Solo / Duo' : rank.queueType === 'RANKED_FLEX_SR' ? 'Ranked Flex' : rank.queueType}</span><strong>{rank.tier} {rank.rank}</strong><span>{rank.leaguePoints} LP</span></p>) : <p>No ranked entry returned</p> : <p>{failed ? 'Current rank unavailable' : 'Loading current rank…'}</p>}</div>
    <small>Current official rank, separate from this match sample. No historical LP changes inferred.</small>
  </aside>;
}

export default function PlayerProfile({ initial }: { initial: PlayerInitial }) {
  const filterId = useId();
  const { platform, puuid } = initial;
  const [filters, setFilters] = useState<Filters>({ queue: queueOf(initial.queue), champion: initial.champion, result: initial.result, view: viewOf(initial.view) });
  const [message, setMessage] = useState('');
  const query = { platform, puuid };
  const { data: account, error: accountError } = useSWR<Account>(api('account', query), fetcher, { shouldRetryOnError: false, revalidateOnFocus: false });
  const { data: ranks, error: rankError } = useSWR<Rank[]>(api('rank', query), fetcher, { shouldRetryOnError: false, revalidateOnFocus: false });
  const history = usePlayerHistory(platform, puuid, filters.queue);
  const name = account?.puuid === puuid && account.gameName && account.tagLine ? `${account.gameName}#${account.tagLine}` : '';
  const profile = { ...initial, name };
  const back = playerLink(platform, puuid, { ...filters, name });
  const scope = historyOptions.find(option => option.value === filters.queue)?.label ?? 'All recent';
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
      setMessage('Player remembered on this browser only. Return here from the player gateway.');
    } catch {
      setMessage('Could not remember this player. Browser storage is unavailable.');
    }
  }

  function leave() {
    try { sessionStorage.setItem(`riftscry:scroll:${platform}:${puuid}`, String(window.scrollY)); }
    catch { /* Match navigation remains available without browser storage. */ }
  }

  return <div className="player-profile" data-player-profile data-view={filters.view}>
    <PlayerArrival initial={profile} matches={history.matches} scope={scope} allModes={filters.queue === 'all'} back={back} loading={history.loading} message={message} onRemember={remember} onRefresh={() => void history.refresh()} onLeave={leave} />
    <div className="player-records" id="player-records">
      {accountError && <p className="player-help" role="status">The Riot identity is unavailable right now. This canonical player’s match records can still be explored.</p>}
      <nav className="player-tabs" aria-label="Player views">
        {views.map((view, index) => <button type="button" key={view.id} aria-pressed={filters.view === view.id} aria-controls="player-view" onClick={() => change({ view: view.id })}><span aria-hidden="true">0{index + 1}</span>{view.label}<span className="player-tab-mark" aria-hidden="true">↗</span></button>)}
      </nav>
      <div className="player-filters" role="group" aria-label="Filter match sample">
        <div className="player-field"><label htmlFor={`${filterId}-queue`}>Game mode</label><select id={`${filterId}-queue`} value={filters.queue} onChange={event => change({ queue: event.target.value })}>{historyOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
        <div className="player-field"><label htmlFor={`${filterId}-champion`}>Champion</label><select id={`${filterId}-champion`} value={filters.champion} onChange={event => change({ champion: event.target.value })}><option value="">All in loaded sample</option>{filters.champion && !champions.includes(filters.champion) && <option value={filters.champion}>{filters.champion} · outside this sample</option>}{champions.map(champion => <option key={champion}>{champion}</option>)}</select></div>
        <div className="player-field"><label htmlFor={`${filterId}-result`}>Result</label><select id={`${filterId}-result`} value={filters.result} onChange={event => change({ result: event.target.value })}><option value="">All results</option><option value="win">Win</option><option value="loss">Loss</option></select></div>
        {(filters.champion || filters.result || filters.queue !== 'all') && <button type="button" className="player-button-text" onClick={() => change({ queue: 'all', champion: '', result: '' })}>Reset sample filters</button>}
      </div>
      <PlayerSample matches={matches} puuid={puuid} imported={history.matches.length} available={history.available} loading={history.loading} failed={history.failed} error={history.error} />
      <div className="player-view" id="player-view" key={filters.view}>
        {filters.view === 'history' ? <PlayerHistory matches={matches} platform={platform} puuid={puuid} back={back} loading={history.loading} onLeave={leave} /> :
          filters.view === 'builds' ? <PersonalBuilds matches={matches} platform={platform} puuid={puuid} back={back} onLeave={leave} /> :
            <BuildMemory player={`${platform}:${puuid}`} platform={platform} puuid={puuid} matches={history.matches} matchesLoading={history.loading} back={back} onLeave={leave} />}
      </div>
      <CurrentRanks ranks={ranks} failed={!!rankError} />
      <div className="profile-next-step"><p className="player-kicker">ONE GAME BECOMES THE NEXT</p><h2>Keep the lesson.<br /><em>Leave the guesswork.</em></h2><p>A match review connects recorded facts to a question worth asking. Build Memory keeps the adjustment you choose to revisit.</p><button className="player-button-secondary" onClick={() => { change({ view: filters.view === 'memory' ? 'history' : 'memory' }); document.getElementById('player-records')?.scrollIntoView({ behavior: 'auto', block: 'start' }); }}>{filters.view === 'memory' ? 'Choose a match to review ↑' : 'Open Build Memory ↑'}</button></div>
    </div>
  </div>;
}
