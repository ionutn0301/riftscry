import championData from '../../data/champions.json';
import { comparisonRole, comparisonRoleLabel, participant, patchOf, type Match } from '../../lib/player/contracts';
import { modeForMatch } from '../../lib/player/modes';
import { matchLink } from './client';
import { Loadout } from './PersonalBuilds';

const metric = (value: number) => Number.isFinite(value) && value >= 0 ? value.toLocaleString() : '—';

export default function PlayerHistory({ matches, platform, puuid, back, loading, onLeave }: {
  matches: Match[]; platform: string; puuid: string; back: string; loading: boolean; onLeave: () => void;
}) {
  return <section className="player-match-history" aria-labelledby="recent-matches-heading">
    <header className="player-section-heading"><div><p className="player-kicker">FOLLOW A MOMENT</p><h2 id="recent-matches-heading">Recent matches</h2></div><p>Open a game. Find the evidence.<br />Carry a useful observation forward.</p></header>
    <div className="match-chronology">{matches.map(match => {
      const player = participant(match, puuid);
      if (!player) return null;
      const mode = modeForMatch(match);
      return <a className="match-row" key={match.metadata.matchId} data-queue={match.info.queueId} onClick={onLeave} href={matchLink(match.metadata.matchId, platform, puuid, back)}>
        <div className="match-identity">
          <span className={player.win ? 'match-win' : 'match-loss'}>{player.win ? 'WIN' : 'LOSS'}</span>
          <img src={`https://ddragon.leagueoflegends.com/cdn/${championData.assetVersion}/img/champion/${encodeURIComponent(player.championName)}.png`} alt="" width="56" height="56" loading="lazy" />
          <div><h3>{player.championName}</h3><span className="match-mode" data-match-mode>{mode.label}</span><small>{comparisonRoleLabel(comparisonRole(match, puuid))}</small></div>
        </div>
        <div className="match-record">
          <p className="match-time"><time dateTime={new Date(match.info.gameCreation).toISOString()}>{new Date(match.info.gameCreation).toLocaleString()}</time><span>{Math.floor(match.info.gameDuration / 60)}:{String(match.info.gameDuration % 60).padStart(2, '0')} · Patch {patchOf(match.info.gameVersion)}</span></p>
          <Loadout match={match} platform={platform} puuid={puuid} concise />
        </div>
        <div className="match-score"><strong>{metric(player.kills)} <span>/</span> {metric(player.deaths)} <span>/</span> {metric(player.assists)}</strong>
          {mode.roleMetrics && <p>{metric(player.totalMinionsKilled + player.neutralMinionsKilled)} CS{mode.visionMetrics ? ` · ${metric(player.visionScore)} vision` : ''}</p>}
          {!mode.roleMetrics && <p>{mode.family === 'arena' ? 'Arena match record' : 'Mode-specific match record'}</p>}
          <span className="match-open">Review this game <span aria-hidden="true">↗</span></span>
        </div>
      </a>;
    })}</div>
    {!matches.length && <div className="player-empty"><p>{loading ? 'Your match records are on their way.' : 'No matches fit the current selection.'}</p><p>Try another game mode, champion, or result. An empty history is a valid result.</p></div>}
  </section>;
}
