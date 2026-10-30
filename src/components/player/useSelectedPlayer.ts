import { useEffect, useRef } from 'react';
import { parseRecentPlayer, readRecentPlayer, rememberRecentPlayer } from '../../lib/player/identity';

/** A direct player/match URL is a selection; a late name response is not. */
export function useSelectedPlayer(platform: string, puuid: string, verifiedName = '', enabled = true) {
  const arrival = useRef<{ identity: string; previous: string; claimed: boolean } | null>(null);
  useEffect(() => {
    const previous = readRecentPlayer();
    arrival.current = { identity: `${platform}:${puuid}`, previous: previous ? `${previous.platform}:${previous.puuid}` : '', claimed: false };
  }, [platform, puuid]);

  useEffect(() => {
    if (!enabled) return;
    const previous = readRecentPlayer();
    const entry = arrival.current;
    const currentIdentity = previous ? `${previous.platform}:${previous.puuid}` : '';
    if (!entry || entry.claimed) return;
    entry.claimed = true;
    // Validation can finish after a different player was chosen in another tab.
    // Only claim the route if the selection is still the one seen on arrival.
    if (currentIdentity !== entry.previous && currentIdentity !== entry.identity) return;
    const samePlayer = previous?.platform === platform && previous.puuid === puuid;
    const selected = parseRecentPlayer({ platform, puuid, name: samePlayer ? previous.name : '' });
    if (selected) rememberRecentPlayer(selected);
  }, [platform, puuid, enabled]);

  useEffect(() => {
    if (!enabled || !verifiedName) return;
    const selected = readRecentPlayer();
    // Another tab or a newer lookup may have changed the selected player while
    // this request was in flight. Only refresh the name of the same identity.
    if (selected?.platform === platform && selected.puuid === puuid && selected.name !== verifiedName) {
      rememberRecentPlayer({ platform, puuid, name: verifiedName });
    }
  }, [platform, puuid, verifiedName, enabled]);
}
