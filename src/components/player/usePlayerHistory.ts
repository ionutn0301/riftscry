import { useEffect, useMemo } from 'react';
import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';
import type { Match } from '../../lib/player/contracts';
import { api, fetcher } from './client';
import { usePlayerCooldown } from './usePlayerCooldown';

type MatchBatch = { matches: Match[]; failedIds: string[]; requestedIds: string[]; revision: string };
const BATCH_SIZE = 4;

/** Keep Riot detail requests bounded while progressively exposing real records. */
export function usePlayerHistory(platform: string, puuid: string, queue: string) {
  const retrySeconds = usePlayerCooldown();
  const { data: ids, error, isLoading: idsLoading, isValidating: idsRefreshing, mutate: refreshIds } = useSWR<string[]>(
    api('history', { platform, puuid, queue }), fetcher,
    { shouldRetryOnError: false, revalidateOnFocus: false },
  );
  // The complete ordered list identifies the sample, including tail-only changes.
  const revision = JSON.stringify([platform, puuid, queue, ids ?? []]);
  const { data: batches, size, setSize, isValidating, mutate: refreshBatches } = useSWRInfinite<MatchBatch>(
    index => ids && index * BATCH_SIZE < ids.length
      ? JSON.stringify({ ids: ids.slice(index * BATCH_SIZE, (index + 1) * BATCH_SIZE), platform, puuid, revision })
      : null,
    async key => {
      const request = JSON.parse(key) as { ids: string[]; platform: string; puuid: string; revision: string };
      const results = await Promise.allSettled(request.ids.map(id => fetcher<Match>(api('match', { platform: request.platform, puuid: request.puuid, id }))));
      return {
        matches: results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []),
        failedIds: results.flatMap((result, index) => result.status === 'rejected' ? [request.ids[index]!] : []),
        requestedIds: request.ids,
        revision: request.revision,
      };
    },
    { shouldRetryOnError: false, revalidateOnFocus: false, revalidateFirstPage: false, persistSize: false },
  );
  const currentBatches = useMemo(() => (batches ?? []).filter(batch => batch.revision === revision), [batches, revision]);

  useEffect(() => {
    if (ids && currentBatches.length === size && size * BATCH_SIZE < ids.length && !isValidating && !idsRefreshing && !retrySeconds) void setSize(size + 1);
  }, [ids, currentBatches, size, isValidating, idsRefreshing, retrySeconds, setSize]);

  const matches = useMemo(() => {
    const requestedIds = new Set(ids ?? []);
    return [...new Map(currentBatches.flatMap(batch => batch.matches)
      .filter(match => requestedIds.has(match.metadata.matchId))
      .map(match => [match.metadata.matchId, match])).values()]
      .sort((a, b) => b.info.gameCreation - a.info.gameCreation);
  }, [currentBatches, ids]);
  const failed = new Set(currentBatches.flatMap(batch => batch.failedIds)).size;
  const attempted = new Set(currentBatches.flatMap(batch => batch.requestedIds)).size;
  const loading = idsLoading || idsRefreshing || isValidating || (!!ids?.length && attempted < ids.length && !error && !retrySeconds);

  async function refresh() {
    if (retrySeconds) return;
    try {
      const nextIds = await refreshIds();
      // A changed key starts a fresh import automatically. Revalidating an old
      // mutate closure here would refetch the previous sample instead.
      if (nextIds && JSON.stringify([platform, puuid, queue, nextIds]) === revision && failed > 0) await refreshBatches();
    } catch { /* SWR exposes the request error while the previous data remains available. */ }
  }

  return { matches, available: ids?.length, failed, loading, error, retrySeconds, refresh };
}
