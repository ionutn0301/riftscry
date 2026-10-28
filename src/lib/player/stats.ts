import { participant, type Match } from './contracts';
import { modeForMatch, type MatchMode } from './modes';

export type SummaryMetric = { value: number | null; samples: number };
export type QueueStats = {
  queueId: number;
  label: string;
  mode: MatchMode;
  matchCount: number;
  outcomeCount: number;
  wins: number;
  losses: number;
  winRate: number | null;
  from: number | null;
  to: number | null;
  kills: SummaryMetric;
  deaths: SummaryMetric;
  assists: SummaryMetric;
  csPerMinute: SummaryMetric;
  goldPerMinute: SummaryMetric;
  visionScore: SummaryMetric;
  damagePerMinute: SummaryMetric;
  championCounts: { champion: string; count: number }[];
  roles: Record<string, number>;
};
const measured = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const knownRoles = new Set(['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']);
function average(values: (number | undefined)[]): SummaryMetric {
  const valid = values.filter(measured);
  return { value: valid.length ? Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length * 10) / 10 : null, samples: valid.length };
}

/** No all-mode averages. Every denominator belongs to one actual Riot queue. */
export function summarizeByQueue(matches: Match[], puuid: string): QueueStats[] {
  const seen = new Set<string>();
  const grouped = new Map<number, { match: Match; mode: MatchMode; p: NonNullable<ReturnType<typeof participant>> }[]>();
  for (const match of matches) {
    const p = participant(match, puuid);
    const mode = modeForMatch(match);
    if (!p || !mode.supported || seen.has(match.metadata.matchId)) continue;
    seen.add(match.metadata.matchId);
    const rows = grouped.get(match.info.queueId) ?? [];
    rows.push({ match, mode, p });
    grouped.set(match.info.queueId, rows);
  }
  return [...grouped.values()].map(rows => {
    const newest = [...rows].sort((a, b) => b.match.info.gameCreation - a.match.info.gameCreation)[0]!;
    const dates = rows.map(({ match }) => match.info.gameCreation).filter(value => measured(value) && value > 0);
    const outcomes = rows.filter(({ p }) => typeof p.win === 'boolean');
    const wins = outcomes.filter(({ p }) => p.win).length;
    const minutes = (match: Match) => measured(match.info.gameDuration) && match.info.gameDuration >= 300 && match.info.gameDuration <= 21600 ? match.info.gameDuration / 60 : undefined;
    const roles: Record<string, number> = {};
    const champions = new Map<string, number>();
    for (const { p, mode } of rows) {
      if (p.championName) champions.set(p.championName, (champions.get(p.championName) ?? 0) + 1);
      if (mode.roleMetrics && knownRoles.has(p.teamPosition)) roles[p.teamPosition] = (roles[p.teamPosition] ?? 0) + 1;
    }
    return {
      queueId: newest.mode.queueId, label: newest.mode.label, mode: newest.mode,
      matchCount: rows.length, outcomeCount: outcomes.length, wins, losses: outcomes.length - wins,
      winRate: outcomes.length ? Math.round(wins / outcomes.length * 1000) / 10 : null,
      from: dates.length ? Math.min(...dates) : null, to: dates.length ? Math.max(...dates) : null,
      kills: average(rows.map(({ p }) => p.kills)), deaths: average(rows.map(({ p }) => p.deaths)), assists: average(rows.map(({ p }) => p.assists)),
      csPerMinute: average(rows.map(({ match, mode, p }) => {
        const duration = minutes(match);
        return mode.roleMetrics && knownRoles.has(p.teamPosition) && p.teamPosition !== 'UTILITY' && duration && measured(p.totalMinionsKilled) && measured(p.neutralMinionsKilled)
          ? (p.totalMinionsKilled + p.neutralMinionsKilled) / duration : undefined;
      })),
      goldPerMinute: average(rows.map(({ match, mode, p }) => {
        const duration = minutes(match);
        return mode.roleMetrics && duration && measured(p.goldEarned) ? p.goldEarned / duration : undefined;
      })),
      visionScore: average(rows.map(({ mode, p }) => mode.visionMetrics ? p.visionScore : undefined)),
      damagePerMinute: average(rows.map(({ match, p }) => {
        const duration = minutes(match);
        return duration && measured(p.totalDamageDealtToChampions) ? p.totalDamageDealtToChampions / duration : undefined;
      })),
      championCounts: [...champions].map(([champion, count]) => ({ champion, count })).sort((a, b) => b.count - a.count || a.champion.localeCompare(b.champion)),
      roles,
    };
  }).sort((a, b) => (b.to ?? 0) - (a.to ?? 0) || a.queueId - b.queueId);
}
