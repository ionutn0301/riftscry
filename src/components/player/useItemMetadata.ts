import useSWR from 'swr';
import type { ItemMetadata } from '../../lib/player/advice';
import { patchOf, type Match } from '../../lib/player/contracts';
import { api, fetcher } from './client';

/** All rows in the same player's patch share a single reference request. */
export const itemMetadataKey = (match: Match, platform: string, puuid: string) =>
  ['player-item-reference', platform, puuid, patchOf(match.info.gameVersion)] as const;

export function useItemMetadata(match: Match | undefined, platform: string, puuid: string) {
  return useSWR<ItemMetadata>(
    match ? itemMetadataKey(match, platform, puuid) : null,
    () => fetcher<ItemMetadata>(api('items', { platform, puuid, id: match!.metadata.matchId })),
    { shouldRetryOnError: false, revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 60000 },
  );
}
