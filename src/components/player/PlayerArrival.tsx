import { useState } from 'react';
import { participant, type Match } from '../../lib/player/contracts';
import { modeForMatch } from '../../lib/player/modes';
import { matchLink, type PlayerInitial } from './client';

type Props = {
  initial: PlayerInitial;
  matches: Match[];
  scope: string;
  allModes: boolean;
  back: string;
  loading: boolean;
  retrySeconds: number;
  message: string;
  onRemember: () => void;
  onRefresh: () => void;
  onLeave: () => void;
};

export default function PlayerArrival({ initial, matches, scope, allModes, back, loading, retrySeconds, message, onRemember, onRefresh, onLeave }: Props) {
  const [highlight, setHighlight] = useState<string>();
  const recent = matches.slice(0, 7);
  const selected = recent.find(match => match.metadata.matchId === highlight) ?? recent[0];
  const selectedPlayer = selected && participant(selected, initial.puuid);
  const separator = initial.name.lastIndexOf('#');
  const name = separator > 0 ? initial.name.slice(0, separator) : initial.name || 'Player profile';
  const tag = separator > 0 ? initial.name.slice(separator) : '';
  const destination = initial.view === 'builds' ? 'Explore your builds' : initial.view === 'memory' ? 'Open Build Memory' : 'Explore your games';

  return <header className="profile-arrival" aria-labelledby="profile-identity">
    <div className="player-environment profile-environment" aria-hidden="true">
      <img src="/images/voyage/history-strata.webp" width="1672" height="941" alt="" decoding="async" />
      <span className="player-horizon" /><span className="player-coordinate player-coordinate--two" />
    </div>
    <div className="profile-arrival-top"><a className="player-text-link" href="/players">← Find another player</a><span>{initial.platform.toUpperCase()} / LEAGUE OF LEGENDS</span></div>
    <div className="profile-arrival-body">
      <div className="profile-identity-copy">
        <p className="player-kicker">PLAYER JOURNEY / A RECORD OF YOUR GAME</p>
        <h1 id="profile-identity">{name}{tag && <em>{tag}</em>}</h1>
        <p className="profile-context"><span className="player-signal" aria-hidden="true" />{scope}{allModes ? ' · modes kept in context' : ' · exact queue history'}</p>
        <div className="player-actions profile-arrival-actions">
          <a className="player-primary-link" href="#player-records">{destination} <span aria-hidden="true">↓</span></a>
          <button className="player-button-secondary" type="button" onClick={onRemember}>Remember player</button>
          <button className="player-button-text" type="button" disabled={loading || retrySeconds > 0} onClick={onRefresh}>{retrySeconds ? `Retry in ${retrySeconds}s` : loading ? 'Importing matches…' : 'Refresh recent matches'}</button>
        </div>
        <p className="profile-local-status" role="status" aria-live="polite">{message}</p>
      </div>

      <div className="profile-path">
        <div className="profile-path-heading"><span className="player-kicker">YOUR RECENT PATH</span><span>{recent.length ? `${recent.length} ${recent.length === 1 ? 'MATCH' : 'MATCHES'}` : 'AWAITING RECORDS'}</span></div>
        {recent.length ? <>
          <nav aria-label="Recent match path"><ol className="profile-match-path">{[...recent].reverse().map((match, index) => {
            const player = participant(match, initial.puuid);
            const mode = modeForMatch(match);
            if (!player) return null;
            return <li key={match.metadata.matchId}><a href={matchLink(match.metadata.matchId, initial.platform, initial.puuid, back)}
              className={player.win ? 'path-victory' : 'path-defeat'}
              data-selected={selected?.metadata.matchId === match.metadata.matchId}
              aria-label={`Open ${player.championName}, ${mode.label}, ${player.win ? 'win' : 'loss'}, ${new Date(match.info.gameCreation).toLocaleDateString()}`}
              onPointerEnter={() => setHighlight(match.metadata.matchId)} onFocus={() => setHighlight(match.metadata.matchId)} onClick={onLeave}>
              <span className="path-node" aria-hidden="true">{player.win ? 'W' : 'L'}</span><span className="path-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            </a></li>;
          })}</ol></nav>
          <div className="profile-path-reading" aria-live="polite"><strong>{selectedPlayer?.championName}</strong><span>{selected ? modeForMatch(selected).label : ''}</span><small>Follow a moment to its match review ↗</small></div>
        </> : <div className="profile-path-empty"><span aria-hidden="true">— · — · —</span><p>{loading ? 'Importing your newest records…' : 'Your match path appears when records are available.'}</p></div>}
      </div>
    </div>
    <div className="profile-arrival-foot"><span>01 / YOUR RECORDS</span><p>Recorded matches.<br />Your next decision.</p><a href="#player-records" aria-label="Continue to player records">↓</a></div>
  </header>;
}
