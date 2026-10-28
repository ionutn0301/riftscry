import { useEffect, useState } from 'react';

type SavedPlayer = { platform: string; puuid: string; name: string };
const key = 'riftscry:remembered-player:v1';

export default function HomeReturn({ platforms }: { platforms: string[] }) {
  const [player, setPlayer] = useState<SavedPlayer | null>(null);
  useEffect(() => {
    const read = () => {
      try {
        const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
        if (value && typeof value === 'object' && !Array.isArray(value) &&
          'platform' in value && typeof value.platform === 'string' && platforms.includes(value.platform) &&
          'puuid' in value && typeof value.puuid === 'string' && /^[A-Za-z0-9_-]{30,120}$/.test(value.puuid) &&
          'name' in value && typeof value.name === 'string' && value.name.trim().length > 0 && value.name.length <= 150 &&
          !/[\u0000-\u001f\u007f]/.test(value.name)) {
          setPlayer({ platform: value.platform, puuid: value.puuid, name: value.name.trim() });
        } else setPlayer(null);
      } catch { setPlayer(null); }
    };
    const onStorage = (event: StorageEvent) => { if (event.key === null || event.key === key) read(); };
    read();
    window.addEventListener('storage', onStorage);
    window.addEventListener('pageshow', read);
    return () => { window.removeEventListener('storage', onStorage); window.removeEventListener('pageshow', read); };
  }, [platforms]);
  if (!player) return null;
  return <a className="companion-return" href={`/players/${player.platform}/${encodeURIComponent(player.puuid)}?view=history`}>
    <span><small>Saved on this browser</small><strong>Return to {player.name}</strong></span><span aria-hidden="true">↗</span>
  </a>;
}
