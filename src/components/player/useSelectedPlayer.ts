import { useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { $account } from '../../lib/account/storage';
import { parseRecentPlayer, readRecentPlayer, rememberRecentPlayer } from '../../lib/player/identity';

/** A direct player/match URL is a selection; a late name response is not. */
export function useSelectedPlayer(platform: string, puuid: string, verifiedName = '', enabled = true) {
  const { ready } = useStore($account, { ssr: 'initial' });
  const arrival = useRef<{ identity: string; previous: string; claimed: boolean } | null>(null);
  useEffect(() => {
    if (!ready) return;
    const previous = readRecentPlayer();
    arrival.current = { identity: `${platform}:${puuid}`, previous: previous ? `${previous.platform}:${previous.puuid}` : '', claimed: false };
  }, [platform, puuid, ready]);

  useEffect(() => {
    if (!enabled || !ready) return;
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
  }, [platform, puuid, enabled, ready]);

  useEffect(() => {
    if (!enabled || !verifiedName || !ready) return;
    const selected = readRecentPlayer();
    // Another tab or a newer lookup may have changed the selected player while
    // this request was in flight. Only refresh the name of the same identity.
    if (selected?.platform === platform && selected.puuid === puuid && selected.name !== verifiedName) {
      rememberRecentPlayer({ platform, puuid, name: verifiedName });
    }
  }, [platform, puuid, verifiedName, enabled, ready]);
}
