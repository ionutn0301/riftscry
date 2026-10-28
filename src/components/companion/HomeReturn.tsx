import { useEffect, useState } from 'react';
import { briefingLink, readRecentPlayer, RECENT_PLAYER_EVENT, RECENT_PLAYER_KEY, type RecentPlayer } from '../../lib/player/identity';

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
  if (!player) return null;
  return <a className="companion-return" href={briefingLink(player)}>
    <span><small>Ready to catch up</small><strong>Your briefing for {player.name || 'your selected player'}</strong></span><span aria-hidden="true">↗</span>
  </a>;
}
