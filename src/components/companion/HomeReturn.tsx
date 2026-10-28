import { useEffect, useState } from 'react';
import { briefingLink, readRecentPlayer, RECENT_PLAYER_EVENT, RECENT_PLAYER_KEY, type RecentPlayer } from '../../lib/player/identity';
import { playerLink } from '../player/client';

const serverLabels: Record<string, string> = {
  na1: 'NA · North America', br1: 'BR · Brazil', la1: 'LAN · Latin America North', la2: 'LAS · Latin America South',
  euw1: 'EUW · Europe West', eun1: 'EUNE · Nordic & East', tr1: 'TR · Türkiye', ru: 'RU · Russia',
  kr: 'KR · Korea', jp1: 'JP · Japan', oc1: 'OCE · Oceania', sg2: 'SG · Singapore', tw2: 'TW · Taiwan',
  vn2: 'VN · Vietnam', me1: 'ME · Middle East', ph2: 'PH · Legacy server', th2: 'TH · Legacy server',
};

export default function HomeReturn() {
  const [player, setPlayer] = useState<RecentPlayer | null>(null);
  useEffect(() => {
    const read = () => setPlayer(readRecentPlayer());
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === RECENT_PLAYER_KEY || event.key === 'riftscry:remembered-player:v1') read();
    };
    read();
    window.addEventListener('storage', onStorage);
    window.addEventListener(RECENT_PLAYER_EVENT, read);
    window.addEventListener('pageshow', read);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(RECENT_PLAYER_EVENT, read);
      window.removeEventListener('pageshow', read);
    };
  }, []);
  const briefing = player ? briefingLink(player) : '/next-game';
  return <div className="home-launcher" data-home-launcher data-player-state={player ? 'returning' : 'new'}>
    {player && <div className="home-launcher-identity">
      <span className="home-launcher-status" aria-hidden="true" />
      <div><small>YOUR SELECTED PLAYER</small><strong><span className="home-launcher-name">{player.name || 'Your selected player'}</span></strong></div>
      <span className="home-launcher-region">{serverLabels[player.platform] ?? player.platform.toUpperCase()}</span>
    </div>}
    <div className="home-launcher-actions">
      <a className="companion-action" href={briefing}>{player ? 'Open my briefing' : 'Get my briefing'} <span aria-hidden="true">↗</span></a>
      {!player && <a className="companion-action companion-action--quiet" href="/players">Find my games <span aria-hidden="true">↗</span></a>}
    </div>
    {player && <nav className="home-launcher-shortcuts" aria-label="Selected player shortcuts">
      <a className="companion-text-link" href={playerLink(player.platform, player.puuid, { name: player.name, view: 'history' })}>My matches</a>
      <a className="companion-text-link" href={playerLink(player.platform, player.puuid, { name: player.name, view: 'builds' })}>My builds</a>
      <a className="companion-text-link" href={`${briefing}#changes`}>Catch up</a>
      <a className="companion-text-link home-launcher-change" href="/next-game?change=1">Change player</a>
    </nav>}
    <p className="home-launcher-note">{player ? 'Your briefing catches up when you open it.' : 'Riot ID + server once. Remembered in this browser.'}</p>
  </div>;
}
