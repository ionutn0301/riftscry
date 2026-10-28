import { comparisonRole, comparisonRoleLabel, participant, patchOf, type Match } from '../../lib/player/contracts';
import { modeForMatch } from '../../lib/player/modes';
import { matchLink } from './client';
import { Loadout } from './PersonalBuilds';
import ChampionPortrait from './ChampionPortrait';
import PlayerIcon from './PlayerIcon';
import { championDisplayName } from './championArtwork';

const metric = (value: number) => Number.isFinite(value) && value >= 0 ? value.toLocaleString() : '—';

export default function PlayerHistory({ matches, platform, puuid, back, loading, onLeave }: {
  matches: Match[]; platform: string; puuid: string; back: string; loading: boolean; onLeave: () => void;
}) {
  return <section className="player-match-history" aria-labelledby="recent-matches-heading">
    <header className="player-section-heading"><h2 id="recent-matches-heading">Recent matches</h2><span className="player-section-caption">Newest first</span></header>
    <div className="match-chronology">{matches.map(match => {
      const player = participant(match, puuid);
      if (!player) return null;
      const mode = modeForMatch(match);
      return <a className="match-row" key={match.metadata.matchId} data-queue={match.info.queueId} onClick={onLeave} href={matchLink(match.metadata.matchId, platform, puuid, back)}>
        <div className="match-identity">
          <span className={player.win ? 'match-win' : 'match-loss'}>{player.win ? 'WIN' : 'LOSS'}</span>
          <ChampionPortrait className="match-champion" champion={player.championName} size={56} />
          <div><h3>{championDisplayName(player.championName)}</h3><span className="match-mode" data-match-mode>{mode.label}</span>{mode.roleMetrics && <small>{comparisonRoleLabel(comparisonRole(match, puuid))}</small>}</div>
        </div>
        <div className="match-record">
          <p className="match-time"><time dateTime={new Date(match.info.gameCreation).toISOString()} title={new Date(match.info.gameCreation).toLocaleString()}>{new Date(match.info.gameCreation).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</time><span><PlayerIcon name="clock" size={12} />{Math.floor(match.info.gameDuration / 60)}:{String(match.info.gameDuration % 60).padStart(2, '0')} · Patch {patchOf(match.info.gameVersion)}</span></p>
          <Loadout match={match} platform={platform} puuid={puuid} concise />
        </div>
        <div className="match-score"><strong aria-label={`${metric(player.kills)} kills, ${metric(player.deaths)} deaths, ${metric(player.assists)} assists`}>{metric(player.kills)} <span>/</span> {metric(player.deaths)} <span>/</span> {metric(player.assists)}</strong>
          {mode.roleMetrics && <p>{metric(player.totalMinionsKilled + player.neutralMinionsKilled)} CS{mode.visionMetrics ? ` · ${metric(player.visionScore)} vision` : ''}</p>}
          <span className="match-open">Review <PlayerIcon name="arrow-right" size={16} /></span>
        </div>
      </a>;
    })}</div>
    {!matches.length && <div className="player-empty"><PlayerIcon name="history" size={28} /><p>{loading ? 'Loading your games…' : 'No matching games. Try another filter.'}</p></div>}
  </section>;
}
