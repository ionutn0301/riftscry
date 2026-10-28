import { useState } from 'react';
import { participant, type Match } from '../../lib/player/contracts';
import { modeForMatch } from '../../lib/player/modes';
import { matchLink, type PlayerInitial } from './client';
import ChampionPortrait from './ChampionPortrait';
import PlayerIcon from './PlayerIcon';
import { championDisplayName } from './championArtwork';

type Props = {
  initial: PlayerInitial;
  matches: Match[];
  scope: string;
  back: string;
  loading: boolean;
  retrySeconds: number;
  message: string;
  onRemember: () => void;
  onRefresh: () => void;
  onLeave: () => void;
};

export default function PlayerArrival({ initial, matches, scope, back, loading, retrySeconds, message, onRemember, onRefresh, onLeave }: Props) {
  const [highlight, setHighlight] = useState<string>();
  const recent = matches.slice(0, 7);
  const selected = recent.find(match => match.metadata.matchId === highlight) ?? recent[0];
  const selectedPlayer = selected && participant(selected, initial.puuid);
  const separator = initial.name.lastIndexOf('#');
  const name = separator > 0 ? initial.name.slice(0, separator) : initial.name || 'Player profile';
  const tag = separator > 0 ? initial.name.slice(separator) : '';
  const destinationLabel = initial.view === 'builds' ? 'View builds' : initial.view === 'memory' ? 'Build Memory' : 'View matches';

  return <header className="profile-arrival" aria-labelledby="profile-identity">
    <div className="player-environment profile-environment" aria-hidden="true">
      <img src="/images/voyage/history-strata.webp" width="1672" height="941" alt="" decoding="async" />
      <span className="player-horizon" /><span className="player-coordinate player-coordinate--two" />
    </div>
    <div className="profile-arrival-top"><a className="player-text-link" href="/players"><PlayerIcon name="search" size={16} />Find a player</a><span>{initial.platform.toUpperCase()}</span></div>
    <div className="profile-arrival-body">
      <div className="profile-identity-copy">
        <p className="player-kicker">PLAYER PROFILE</p>
        <h1 id="profile-identity">{name}{tag && <em>{tag}</em>}</h1>
        <p className="profile-context"><span className="player-signal" aria-hidden="true" />{scope}</p>
        <div className="player-actions profile-arrival-actions">
          <a className="player-primary-link" href="#player-records">{destinationLabel}<PlayerIcon name="arrow-down" size={16} /></a>
          <button className="player-button-secondary" type="button" aria-label="Save player on this browser" onClick={onRemember}><PlayerIcon name="bookmark" size={16} />Save player</button>
          <button className="player-button-text" type="button" aria-label={!retrySeconds && !loading ? 'Refresh recent matches' : undefined} disabled={loading || retrySeconds > 0} onClick={onRefresh}><PlayerIcon name={retrySeconds ? 'clock' : 'refresh'} size={16} />{retrySeconds ? `Retry in ${retrySeconds}s` : loading ? 'Loading…' : 'Refresh'}</button>
        </div>
        <p className="profile-local-status" role="status" aria-live="polite">{message}</p>
      </div>

      <div className="profile-path">
        <div className="profile-path-heading"><span className="player-kicker">RECENT GAMES</span><span>{recent.length ? `${recent.length} ${recent.length === 1 ? 'GAME' : 'GAMES'}` : ''}</span></div>
        {recent.length ? <>
          <nav aria-label="Recent match path"><ol className="profile-match-path">{[...recent].reverse().map(match => {
            const player = participant(match, initial.puuid);
            const mode = modeForMatch(match);
            if (!player) return null;
            return <li key={match.metadata.matchId}><a href={matchLink(match.metadata.matchId, initial.platform, initial.puuid, back)}
              className={player.win ? 'path-victory' : 'path-defeat'}
              data-selected={selected?.metadata.matchId === match.metadata.matchId}
              aria-label={`Open ${championDisplayName(player.championName)}, ${mode.label}, ${player.win ? 'win' : 'loss'}, ${new Date(match.info.gameCreation).toLocaleDateString()}`}
              onPointerEnter={() => setHighlight(match.metadata.matchId)} onFocus={() => setHighlight(match.metadata.matchId)} onClick={onLeave}>
              <span className="path-node path-portrait"><ChampionPortrait champion={player.championName} size={40} /><span className="path-outcome" aria-hidden="true">{player.win ? 'W' : 'L'}</span></span>
            </a></li>;
          })}</ol></nav>
          {selected && <a className="profile-path-reading" href={matchLink(selected.metadata.matchId, initial.platform, initial.puuid, back)} onClick={onLeave} aria-live="polite"><strong>{selectedPlayer && championDisplayName(selectedPlayer.championName)}</strong><span>{modeForMatch(selected).label}</span><PlayerIcon name="arrow-right" size={16} /></a>}
        </> : <div className="profile-path-empty"><PlayerIcon name="history" size={28} /><p>{loading ? 'Loading your games…' : 'No recent games yet.'}</p></div>}
      </div>
    </div>
  </header>;
}
