import type { SummonerProfile } from '../../lib/player/contracts';
import type { PlayerInitial } from './client';
import PlayerAvatar from './PlayerAvatar';
import PlayerIcon from './PlayerIcon';

export type PlayerRank = { queueType: string; tier: string; rank: string; leaguePoints: number };
type Props = {
  initial: PlayerInitial; summoner?: SummonerProfile; ranks?: PlayerRank[]; rankFailed: boolean;
  loading: boolean; retrySeconds: number; message: string; onRemember: () => void; onRefresh: () => void;
};
const regionLabels: Record<string, string> = { eun1: 'EUNE', euw1: 'EUW', na1: 'NA', br1: 'BR', la1: 'LAN', la2: 'LAS', tr1: 'TR', ru: 'RU', kr: 'KR', jp1: 'JP', oc1: 'OCE', ph2: 'PH', sg2: 'SG', th2: 'TH', tw2: 'TW', vn2: 'VN', me1: 'ME' };
const tierLabel = (tier: string) => tier.charAt(0) + tier.slice(1).toLowerCase();

export default function PlayerArrival({ initial, summoner, ranks, rankFailed, loading, retrySeconds, message, onRemember, onRefresh }: Props) {
  const separator = initial.name.lastIndexOf('#');
  const name = separator > 0 ? initial.name.slice(0, separator) : initial.name || 'Player profile';
  const tag = separator > 0 ? initial.name.slice(separator) : '';
  return <header className="player-identity-header" aria-labelledby="profile-identity">
    <div className="player-environment identity-environment" aria-hidden="true"><img src="/images/observatory/rift-horizon.webp" width="1920" height="1081" alt="" decoding="async" /></div>
    <div className="player-identity-wrap">
      <div className="identity-topline"><a className="player-text-link identity-back" href="/players"><PlayerIcon name="arrow-left" size={16} />Find a player</a><span className="player-kicker">PLAYER RECORD</span></div>
      <div className="player-identity-row">
        <div className="player-identity-person">
          <PlayerAvatar name={initial.name} summoner={summoner} />
          <div className="profile-identity-copy"><h1 id="profile-identity">{name}{tag && <em>{tag}</em>}</h1>
            <span className="identity-region">{regionLabels[initial.platform] ?? initial.platform.toUpperCase()}<span aria-hidden="true"> · </span>League of Legends</span>
          </div>
        </div>
        <div className="player-identity-tools">
          <div className="player-actions identity-actions">
            <button className="player-button-secondary" type="button" aria-label="Save player on this browser" onClick={onRemember}><PlayerIcon name="bookmark" size={17} />Save player</button>
            <button className="player-button-secondary" type="button" aria-label={!retrySeconds && !loading ? 'Refresh recent matches' : undefined} disabled={loading || retrySeconds > 0} onClick={onRefresh}><PlayerIcon name={retrySeconds ? 'clock' : 'refresh'} size={17} />{retrySeconds ? `Retry in ${retrySeconds}s` : loading ? 'Loading…' : 'Refresh'}</button>
          </div>
          <p className="identity-save-status" role="status" aria-live="polite">{message}</p>
        </div>
      </div>
      <aside className="identity-ranks" aria-label="Current ranked status">
        <PlayerIcon name="trophy" size={16} />
        {ranks ? ranks.length ? ranks.map(rank => <span className="identity-rank" key={rank.queueType} title="Current Riot rank. Separate from the selected match sample.">
          <span>{rank.queueType === 'RANKED_SOLO_5x5' ? 'Solo / Duo' : rank.queueType === 'RANKED_FLEX_SR' ? 'Ranked Flex' : rank.queueType}</span>
          <strong>{tierLabel(rank.tier)} {rank.rank}</strong><span>{rank.leaguePoints} LP</span>
        </span>) : <span>Unranked</span> : <span>{rankFailed ? 'Current rank unavailable' : 'Loading rank…'}</span>}
      </aside>
    </div>
  </header>;
}
