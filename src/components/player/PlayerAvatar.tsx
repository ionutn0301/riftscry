import { useState } from 'react';
import { assetVersion } from '../../data/champions.json';
import type { SummonerProfile } from '../../lib/player/contracts';
import PlayerIcon from './PlayerIcon';

/** The account's current League icon; a missing image never substitutes a champion. */
export default function PlayerAvatar({ name, summoner }: { name: string; summoner?: SummonerProfile }) {
  const [failedSource, setFailedSource] = useState('');
  const iconId = summoner?.profileIconId;
  const source = Number.isSafeInteger(iconId) && iconId! >= 0
    ? `https://ddragon.leagueoflegends.com/cdn/${assetVersion}/img/profileicon/${iconId}.png` : '';
  return <div className="player-avatar" data-player-avatar data-image-missing={!source || failedSource === source || undefined}>
    <span className="player-avatar-fallback" aria-hidden="true"><PlayerIcon name="user" size={36} /></span>
    {source && failedSource !== source && <img src={source} alt={`${name || 'Player'}'s League profile icon`} width={88} height={88} decoding="async" onError={() => setFailedSource(source)} />}
    {summoner?.summonerLevel != null && <span className="player-level">Lv. {summoner.summonerLevel}</span>}
  </div>;
}
