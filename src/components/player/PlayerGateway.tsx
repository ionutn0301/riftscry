import { useEffect, useId, useState, type SubmitEvent } from 'react';
import { platforms } from '../../lib/player/contracts';
import { historyOptions } from '../../lib/player/modes';
import { rememberRecentPlayer } from '../../lib/player/identity';
import { api, fetcher, playerLink, type PlayerView } from './client';
import { usePlayerCooldown } from './usePlayerCooldown';
import PlayerIcon from './PlayerIcon';

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
    try {
      const value: unknown = JSON.parse(localStorage.getItem('riftscry:remembered-player:v1') ?? 'null');
      if (value && typeof value === 'object' && 'platform' in value && 'puuid' in value && 'name' in value &&
        typeof value.platform === 'string' && Object.hasOwn(platforms, value.platform) &&
        typeof value.puuid === 'string' && /^[A-Za-z0-9_-]{30,120}$/.test(value.puuid) &&
        typeof value.name === 'string' && value.name.length <= 150 && !/[\u0000-\u001f\u007f]/.test(value.name)) {
        setRemembered(value as RememberedPlayer);
      }
    } catch { /* Lookup still works when optional browser storage is unavailable. */ }
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

  return <section className="player-gateway" data-player-gateway aria-labelledby="player-gateway-heading" data-loading={busy}>
    <div className="player-environment gateway-environment" aria-hidden="true">
      <picture><source media="(max-width: 700px)" srcSet="/images/observatory/rift-horizon-mobile.webp" /><img src="/images/observatory/rift-horizon.webp" width="1920" height="1081" alt="" fetchPriority="high" decoding="async" /></picture>
    </div>
    <div className="gateway-composition">
      <header className="gateway-heading">
        <p className="player-kicker"><span className="observatory-section-mark" aria-hidden="true" /> YOUR GAMES</p>
        <h1 id="player-gateway-heading">Find your <em>games.</em></h1>
        <p>Your matches, your builds, your next move. Start with a Riot ID.</p>
      </header>

      {remembered && <a className="remembered-player" href={playerLink(remembered.platform, remembered.puuid, { ...filters, name: remembered.name, view })}>
        <span className="player-kicker"><PlayerIcon name="bookmark" size={15} /> CONTINUE WITH</span><strong>{remembered.name || 'Your remembered player'}</strong><span>{destinationLabel} <PlayerIcon name="arrow-right" size={16} /></span>
      </a>}

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

      <div className="gateway-destinations">
        <p className="gateway-destination-label">Open with</p>
        <div className="gateway-intents" role="group" aria-label="Start with">
          {destinations.map(destination => <button key={destination.id} type="button" aria-pressed={view === destination.id} onClick={() => setView(destination.id)}>
            <PlayerIcon name={destination.icon} /><strong>{destination.label}</strong><PlayerIcon className="intent-arrow" name="arrow-right" size={16} />
          </button>)}
        </div>
      </div>

    </div>
    <footer className="gateway-footnote"><span>LEAGUE OF LEGENDS · PLAYER RECORDS</span><details className="player-disclosure gateway-privacy"><summary><PlayerIcon name="info" size={16} />About this lookup</summary><p>Your last player stays selected on this browser when storage is available. Looking up a player does not verify account ownership.</p></details></footer>
  </section>;
}
