import useSWR from 'swr';
import type { ItemMetadata } from '../../lib/player/advice';
import { patchOf, type Match } from '../../lib/player/contracts';
import { api, fetcher } from './client';

/** All rows in the same player's patch share a single reference request. */
export function useItemMetadata(match: Match | undefined, platform: string, puuid: string) {
  return useSWR<ItemMetadata>(
    match ? ['player-item-reference', platform, puuid, patchOf(match.info.gameVersion)] : null,
    () => fetcher<ItemMetadata>(api('items', { platform, puuid, id: match!.metadata.matchId })),
    { shouldRetryOnError: false, revalidateOnFocus: false, dedupingInterval: 60000 },
  );
}
