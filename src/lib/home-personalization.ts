import type { Match } from './player/contracts';
import { isSupportedMatchmade } from './player/modes';

export type HomeChampionCount = { id: string; games: number; lastPlayed: number };

/** Counts games, never mastery points or wins. Ties use recency, then canonical ID. */
export function homeChampionCounts(matches: readonly Match[], puuid: string, knownIds: readonly string[]) {
  const canonical = new Map(knownIds.map(id => [id.toLowerCase(), id]));
  const seen = new Set<string>();
  const counts = new Map<string, HomeChampionCount>();
  const included: Match[] = [];
  for (const match of matches) {
    if (!match?.metadata?.matchId || seen.has(match.metadata.matchId) || !match.info || !Array.isArray(match.info.participants)) continue;
    const player = match.info.participants.find(player => player.puuid === puuid);
    const id = typeof player?.championName === 'string' ? canonical.get(player.championName.toLowerCase()) : undefined;
    if (!id || !isSupportedMatchmade(match) || !Number.isFinite(match.info.gameCreation) || match.info.gameCreation <= 0 ||
      !Number.isFinite(match.info.gameDuration) || match.info.gameDuration <= 0) continue;
    seen.add(match.metadata.matchId); included.push(match);
    const previous = counts.get(id);
    counts.set(id, { id, games: (previous?.games ?? 0) + 1, lastPlayed: Math.max(previous?.lastPlayed ?? 0, match.info.gameCreation) });
  }
  return {
    champions: [...counts.values()].sort((a, b) => b.games - a.games || b.lastPlayed - a.lastPlayed || a.id.localeCompare(b.id)).slice(0, 3),
    total: included.length,
    latest: included.sort((a, b) => b.info.gameCreation - a.info.gameCreation)[0] ?? null,
  };
}
