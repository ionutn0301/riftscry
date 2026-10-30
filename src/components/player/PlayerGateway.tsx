import { useEffect, useId, useState, type SubmitEvent } from 'react';
import { platforms } from '../../lib/player/contracts';
import { historyOptions } from '../../lib/player/modes';
import { readRecentPlayer, RECENT_PLAYER_EVENT, rememberRecentPlayer } from '../../lib/player/identity';
import { api, fetcher, playerLink, type PlayerView } from './client';
import { usePlayerCooldown } from './usePlayerCooldown';
import PlayerIcon from './PlayerIcon';
import '../../styles/journey-companion.css';

const platformNames: Record<string, string> = {
  eun1: 'EUNE · Nordic & East', euw1: 'EUW · Europe West', na1: 'NA · North America',
  br1: 'BR · Brazil', la1: 'LAN · Latin America North', la2: 'LAS · Latin America South',
  oc1: 'OCE · Oceania', kr: 'KR · Korea', jp1: 'JP · Japan', tr1: 'TR · Türkiye',
  ru: 'RU · Russia', sg2: 'SG · Singapore', tw2: 'TW · Taiwan', vn2: 'VN · Vietnam',
  me1: 'ME · Middle East', ph2: 'PH · Legacy server', th2: 'TH · Legacy server',
};
const destinations: { id: PlayerView; label: string; icon: 'history' | 'build' | 'bookmark' }[] = [
  { id: 'history', label: 'Matches', icon: 'history' },
  { id: 'builds', label: 'Builds', icon: 'build' },
  { id: 'memory', label: 'Build Memory', icon: 'bookmark' },
];
type RememberedPlayer = { platform: string; puuid: string; name: string };
type Props = { name?: string; platform?: string; view?: string; queue?: string; champion?: string; result?: string };

export default function PlayerGateway({ name = '', platform = '', view: initialView = '', queue = '', champion = '', result = '' }: Props) {
  const id = useId();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [view, setView] = useState<PlayerView>(initialView === 'builds' || initialView === 'memory' ? initialView : 'history');
  const [remembered, setRemembered] = useState<RememberedPlayer | null>(null);
  const retrySeconds = usePlayerCooldown();
  const filters = {
    queue: historyOptions.some(option => option.value === queue) ? queue : 'all',
    champion: champion.slice(0, 150),
    result: result === 'win' || result === 'loss' ? result : '',
  };
  const destinationLabel = destinations.find(destination => destination.id === view)!.label;

  useEffect(() => {
    setReady(true);
    const restore = () => setRemembered(readRecentPlayer());
    restore();
    window.addEventListener('storage', restore);
    window.addEventListener(RECENT_PLAYER_EVENT, restore);
    return () => { window.removeEventListener('storage', restore); window.removeEventListener(RECENT_PLAYER_EVENT, restore); };
  }, []);

  async function lookup(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || busy || retrySeconds) return;
    const form = new FormData(event.currentTarget);
    const riotId = String(form.get('riotId') ?? '').trim();
    const separator = riotId.lastIndexOf('#');
    const gameName = riotId.slice(0, separator).trim();
    const tag = riotId.slice(separator + 1).trim();
    if (separator < 1 || !gameName || !tag) {
      setMessage('Enter your full Riot ID, including #tagline.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const selectedPlatform = String(form.get('platform'));
      const account = await fetcher<{ puuid: string; gameName: string; tagLine: string }>(api('lookup', { name: gameName, tag, platform: selectedPlatform }));
      const name = `${account.gameName}#${account.tagLine}`;
      rememberRecentPlayer({ platform: selectedPlatform, puuid: account.puuid, name });
      window.location.assign(playerLink(selectedPlatform, account.puuid, { ...filters, name, view }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Lookup is unavailable. Please try again.');
      setBusy(false);
    }
  }

  return <section className="player-gateway" data-journey-deck data-player-gateway aria-labelledby="player-gateway-heading" data-loading={busy} data-has-player={Boolean(remembered)}>
    <div id="player-connect" className="gateway-composition" data-journey-panel data-journey-label="Connect" data-journey-world="players">
      <header className="gateway-heading">
        <p className="player-kicker"><span className="observatory-section-mark" aria-hidden="true" /> YOUR GAMES</p>
        <h1 id="player-gateway-heading">Find your <em>games.</em></h1>
        <p>Pick up where you left off.</p>
      </header>

      {remembered && <a className="remembered-player" href={playerLink(remembered.platform, remembered.puuid, { ...filters, name: remembered.name, view })}>
        <span className="player-kicker"><PlayerIcon name="bookmark" size={15} /> CONTINUE WITH</span><strong>{remembered.name || 'Your remembered player'}</strong><span>{destinationLabel} <PlayerIcon name="arrow-right" size={16} /></span>
      </a>}

      <details className="gateway-lookup-scene" open={!remembered || !!name}><summary>{remembered ? 'Find another player' : 'Enter your Riot ID'}<PlayerIcon name="plus" size={16} /></summary>
      <form onSubmit={lookup} className="lookup-form" aria-label="Find a League of Legends player" aria-busy={busy}>
        <div className="player-field lookup-identity">
          <label htmlFor={`${id}-riot-id`}>Riot ID</label>
          <input id={`${id}-riot-id`} name="riotId" placeholder="Game name#TAG" required maxLength={50} defaultValue={name} autoComplete="off" spellCheck={false} disabled={!ready || busy} aria-describedby={`${id}-lookup-status`} />
        </div>
        <div className="player-field lookup-server">
          <label htmlFor={`${id}-server`}>Server</label>
          <select id={`${id}-server`} name="platform" defaultValue={Object.hasOwn(platforms, platform) ? platform : 'euw1'} disabled={!ready || busy}>
            {Object.keys(platforms).map(value => <option key={value} value={value}>{platformNames[value] ?? value.toUpperCase()}</option>)}
          </select>
        </div>
        <button type="submit" disabled={!ready || busy || retrySeconds > 0}><PlayerIcon name={retrySeconds ? 'clock' : 'search'} />{retrySeconds ? `Retry in ${retrySeconds}s` : busy ? 'Looking up…' : !ready ? 'Preparing…' : 'Find player'}</button>
      </form>
      <p id={`${id}-lookup-status`} className="lookup-status" role={message ? 'alert' : 'status'} aria-live="polite">{message || (busy ? 'Finding player…' : '')}</p>

      </details>
      <details className="gateway-destinations"><summary>Start with {destinationLabel}<PlayerIcon name="plus" size={16} /></summary>
        <p className="gateway-destination-label">Open with</p>
        <div className="gateway-intents" role="group" aria-label="Start with">
          {destinations.map(destination => <button key={destination.id} type="button" aria-pressed={view === destination.id} onClick={() => setView(destination.id)}>
            <PlayerIcon name={destination.icon} /><strong>{destination.label}</strong><PlayerIcon className="intent-arrow" name="arrow-right" size={16} />
          </button>)}
        </div>
      </details>

    <footer className="gateway-footnote"><span>RIOT MATCH RECORDS</span><details className="player-disclosure gateway-privacy"><summary><PlayerIcon name="info" size={16} />About this lookup</summary><p>Your last player stays selected on this browser when storage is available. Looking up a player does not verify account ownership.</p></details></footer>
    </div>
  </section>;
}
