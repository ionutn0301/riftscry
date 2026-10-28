import { participant, type Match } from '../../lib/player/contracts';
import { modeForMatch } from '../../lib/player/modes';
import { matchLink } from './client';
import { useItemMetadata } from './useItemMetadata';
import { ItemLabel } from './ItemPicker';
import ChampionPortrait from './ChampionPortrait';
import PlayerIcon from './PlayerIcon';
import MatchModeBadge from './MatchModeBadge';
import { championDisplayName } from './championArtwork';

const metric = (value: number) => Number.isFinite(value) && value >= 0 ? value.toLocaleString() : '—';

function MatchInventory({ match, platform, puuid }: { match: Match; platform: string; puuid: string }) {
  const { data } = useItemMetadata(match, platform, puuid);
  const player = participant(match, puuid);
  if (!player) return null;
  const items = [player.item0, player.item1, player.item2, player.item3, player.item4, player.item5, player.item6].filter(Boolean);
  return <div className="match-inventory loadout loadout--concise">
    {items.length ? <ul className="loadout-items" aria-label="Final inventory">{items.map((id, index) =>
      <li key={`${id}:${index}`}><ItemLabel id={id} metadata={data} compact /></li>,
    )}</ul> : <span className="match-no-items">No items recorded</span>}
  </div>;
}

export default function PlayerHistory({ matches, platform, puuid, back, loading, onLeave }: {
  matches: Match[]; platform: string; puuid: string; back: string; loading: boolean; onLeave: () => void;
}) {
  return <section className="player-match-history" aria-labelledby="recent-matches-heading">
    <header className="player-section-heading"><h2 id="recent-matches-heading">Recent matches</h2><span className="player-section-caption">Newest first</span></header>
    <div className="match-chronology">{matches.map(match => {
      const player = participant(match, puuid);
      if (!player) return null;
      const mode = modeForMatch(match);
      const outcome = typeof player.win !== 'boolean' ? 'unknown' : player.win ? 'win' : 'loss';
      const playedAt = new Date(match.info.gameCreation);
      const knownDate = Number.isFinite(playedAt.getTime());
      const seconds = Math.floor(match.info.gameDuration);
      const duration = Number.isFinite(seconds) && seconds > 0 && seconds <= 21600
        ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : 'Time unavailable';
      return <a className="match-row" key={match.metadata.matchId} data-queue={match.info.queueId} data-outcome={outcome} onClick={onLeave} href={matchLink(match.metadata.matchId, platform, puuid, back)}>
        <div className="match-identity">
          <ChampionPortrait className="match-champion" champion={player.championName} size={48} />
          <div><h3>{championDisplayName(player.championName)}</h3><MatchModeBadge mode={mode} /></div>
        </div>
        <div className="match-score"><strong aria-label={`${metric(player.kills)} kills, ${metric(player.deaths)} deaths, ${metric(player.assists)} assists`}>{metric(player.kills)} <span>/</span> {metric(player.deaths)} <span>/</span> {metric(player.assists)}</strong><small>K / D / A</small></div>
        <div className="match-record">
          <MatchInventory match={match} platform={platform} puuid={puuid} />
        </div>
        <div className="match-status">
          <span className={`match-result match-${outcome}`}><PlayerIcon name={outcome === 'win' ? 'check' : outcome === 'loss' ? 'close' : 'info'} size={13} />{outcome === 'win' ? 'Win' : outcome === 'loss' ? 'Loss' : 'Unknown result'}</span>
          <p className="match-time"><time dateTime={knownDate ? playedAt.toISOString() : undefined} title={knownDate ? playedAt.toLocaleString() : undefined}>{knownDate ? playedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date unavailable'}</time><span><PlayerIcon name="clock" size={12} />{duration}</span></p>
        </div>
        <span className="match-open">Review <PlayerIcon name="chevron-right" size={16} /></span>
      </a>;
    })}</div>
    {!matches.length && <div className="player-empty"><PlayerIcon name="history" size={28} /><p>{loading ? 'Loading your games…' : 'No matching games. Try another filter.'}</p></div>}
  </section>;
}
