import { useEffect, useId, useState, type SubmitEvent } from 'react';
import { platforms } from '../../lib/player/contracts';
import { api, fetcher, playerLink, type PlayerView } from './client';
import { usePlayerCooldown } from './usePlayerCooldown';

const platformNames: Record<string, string> = {
  eun1: 'EUNE · Nordic & East', euw1: 'EUW · Europe West', na1: 'NA · North America',
  br1: 'BR · Brazil', la1: 'LAN · Latin America North', la2: 'LAS · Latin America South',
  oc1: 'OCE · Oceania', kr: 'KR · Korea', jp1: 'JP · Japan', tr1: 'TR · Türkiye',
  ru: 'RU · Russia', sg2: 'SG · Singapore', tw2: 'TW · Taiwan', vn2: 'VN · Vietnam',
  me1: 'ME · Middle East', ph2: 'PH · Legacy server', th2: 'TH · Legacy server',
};
const destinations: { id: PlayerView; label: string; detail: string }[] = [
  { id: 'history', label: 'Your matches', detail: 'Follow your latest games across modes. Open a match to examine its recorded decisions.' },
  { id: 'builds', label: 'Your builds', detail: 'Discover what you actually built, kept separate by champion, mode, role and patch.' },
  { id: 'memory', label: 'Your next game', detail: 'Return to a saved adjustment. Keep the reason, the tradeoff, and what you want to try next.' },
];
type RememberedPlayer = { platform: string; puuid: string; name: string };

export default function PlayerGateway({ name = '', platform = '' }: { name?: string; platform?: string }) {
  const id = useId();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [view, setView] = useState<PlayerView>('history');
  const [remembered, setRemembered] = useState<RememberedPlayer | null>(null);
  const retrySeconds = usePlayerCooldown();

  useEffect(() => {
    setReady(true);
    try {
      const value: unknown = JSON.parse(localStorage.getItem('riftscry:remembered-player:v1') ?? 'null');
      if (value && typeof value === 'object' && 'platform' in value && 'puuid' in value && 'name' in value &&
        typeof value.platform === 'string' && value.platform in platforms &&
        typeof value.puuid === 'string' && value.puuid.length > 0 && typeof value.name === 'string') {
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
      window.location.assign(playerLink(selectedPlatform, account.puuid, { name: `${account.gameName}#${account.tagLine}`, view }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Lookup is unavailable. Please try again.');
      setBusy(false);
    }
  }

  return <section className="player-gateway" data-player-gateway aria-labelledby="player-gateway-heading" data-loading={busy}>
    <div className="player-environment gateway-environment" aria-hidden="true">
      <picture><source media="(max-width: 700px)" srcSet="/images/voyage/rift-overlook-mobile.webp" /><img src="/images/voyage/return-basin.webp" width="1672" height="941" alt="" fetchPriority="high" decoding="async" /></picture>
      <span className="player-horizon" /><span className="player-coordinate player-coordinate--one" /><span className="player-coordinate player-coordinate--two" />
    </div>
    <div className="gateway-composition">
      <header className="gateway-heading">
        <p className="player-kicker">LEAGUE OF LEGENDS / YOUR NEXT CHAPTER</p>
        <h1 id="player-gateway-heading">The game ends.<br /><em>Your story stays.</em></h1>
        <p>Find the player. Follow the matches.<br className="gateway-mobile-break" /> Take one better decision into your next game.</p>
      </header>

      <form onSubmit={lookup} className="lookup-form" aria-label="Find a League of Legends player" aria-busy={busy}>
        <div className="player-field lookup-identity">
          <label htmlFor={`${id}-riot-id`}>Riot ID</label>
          <input id={`${id}-riot-id`} name="riotId" placeholder="Game name#TAG" required maxLength={50} defaultValue={name} autoComplete="off" spellCheck={false} disabled={!ready || busy} aria-describedby={`${id}-lookup-status`} />
        </div>
        <div className="player-field lookup-server">
          <label htmlFor={`${id}-server`}>Server</label>
          <select id={`${id}-server`} name="platform" defaultValue={platform in platforms ? platform : 'euw1'} disabled={!ready || busy}>
            {Object.keys(platforms).map(value => <option key={value} value={value}>{platformNames[value] ?? value.toUpperCase()}</option>)}
          </select>
        </div>
        <button type="submit" disabled={!ready || busy || retrySeconds > 0}>{retrySeconds ? `Retry in ${retrySeconds}s` : busy ? 'Looking up…' : !ready ? 'Preparing lookup…' : 'Find player →'}</button>
      </form>
      <p id={`${id}-lookup-status`} className="lookup-status" role={message ? 'alert' : 'status'} aria-live="polite">{message || (busy ? 'Finding this player. Your match journey is next.' : '')}</p>

      <div className="gateway-destinations">
        <div className="gateway-intents" role="group" aria-label="Start with">
          {destinations.map((destination, index) => <button key={destination.id} type="button" aria-pressed={view === destination.id} onClick={() => setView(destination.id)}>
            <span aria-hidden="true">0{index + 1}</span><strong>{destination.label}</strong><span className="intent-arrow" aria-hidden="true">↗</span>
          </button>)}
        </div>
        <p className="gateway-anticipation" aria-live="polite">{destinations.find(destination => destination.id === view)?.detail}</p>
      </div>

      {remembered && <a className="remembered-player" href={playerLink(remembered.platform, remembered.puuid, { name: remembered.name, view: 'memory' })}>
        <span className="player-kicker">PICK UP WHERE YOU LEFT OFF</span><strong>{remembered.name || 'Your remembered player'}</strong><span>Open Build Memory ↗</span>
      </a>}
    </div>
    <footer className="gateway-footnote"><span>01 / FIND YOUR PERSPECTIVE</span><p>Private beta · Recent Riot match records.<br />Notes stay on this browser. Lookup does not verify ownership.</p></footer>
  </section>;
}
