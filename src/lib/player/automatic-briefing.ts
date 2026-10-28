import { comparisonRole, evidence, participant, patchOf, type Match, type Participant } from './contracts';
import { isSupportedQueue, modeForMatch, type MatchMode } from './modes';
import { summarizeByQueue, type QueueStats } from './stats';
import { patchReview, type RecallPatch } from '../patch-context';
import { champions as championCatalog } from '../../data/champions.json';

export const SESSION_GAP_MINUTES = 90;
export const AUTOMATIC_CONTEXT_LIMIT = 5;
export type AutomaticBriefingOptions = { available?: number; failed?: number; loading?: boolean; queue?: string; champion?: string };
export type AutomaticChampionContext = {
  key: string;
  champion: string;
  queueId: number;
  queueLabel: string;
  count: number;
  latestMatch: Match;
  sourcePatch: string;
  resolvedPatch: string | null;
  patchStatus: 'current' | 'changed' | 'unchanged' | 'unknown';
  changes: ReturnType<typeof patchReview>['changes'];
};
export type AutomaticFocus = {
  kind: 'patch' | 'farm' | 'participation' | 'latest-game';
  title: string;
  body: string;
  evidenceMatchIds: string[];
  sourceMatch: Match;
  champion: string;
  queueId: number;
  patchId?: string;
  metric?: { label: string; latest: number; baseline: number; unit: 'per-minute' | 'percent'; samples: number };
};
export type AutomaticBriefing = {
  latest: Match | null;
  sample: { loaded: number; available: number | null; failed: number; partial: boolean; omitted: number };
  session: {
    matches: Match[];
    from: number | null;
    to: number | null;
    playSeconds: number;
    queues: QueueStats[];
    boundary: 'gap' | 'sample-edge' | 'invalid';
    gapMinutes: number;
  };
  champions: AutomaticChampionContext[];
  focus: AutomaticFocus | null;
};

type Row = { match: Match; player: Participant; mode: MatchMode };
const championIds = new Map(Object.keys(championCatalog).map(id => [id.toLowerCase(), id]));
/** Only case variants of known IDs are equivalent; display names are not aliases. */
const canonicalChampionId = (value: string) => championIds.get(value.toLowerCase()) ?? value;
const measured = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const validDate = (value: unknown): value is number => measured(value) && value > 0 && value <= 8_640_000_000_000_000;
const validDuration = (value: unknown): value is number => measured(value) && value > 0 && value <= 21600;
const rounded = (value: number) => Math.round(value * 10) / 10;
const patchFor = (match: Match) => /^\d+\.\d+(?:\.|$)/.test(match.info.gameVersion) ? patchOf(match.info.gameVersion) : 'Unknown';
const inventory = (player: Participant) => [player.item0, player.item1, player.item2, player.item3, player.item4, player.item5, player.item6]
  .filter(value => Number.isInteger(value) && value > 0).map(id => ({ id, name: `Item ${id}` }));

function sessionFor(rows: Row[], puuid: string): AutomaticBriefing['session'] {
  const first = rows[0];
  if (!first) return { matches: [], from: null, to: null, playSeconds: 0, queues: [], boundary: 'sample-edge', gapMinutes: SESSION_GAP_MINUTES };
  const members = [first.match];
  let boundary: AutomaticBriefing['session']['boundary'] = 'sample-edge';
  if (!validDuration(first.match.info.gameDuration)) boundary = 'invalid';
  else for (const { match } of rows.slice(1)) {
    const newer = members.at(-1)!;
    if (!validDuration(match.info.gameDuration)) { boundary = 'invalid'; break; }
    const previousEnd = match.info.gameCreation + match.info.gameDuration * 1000;
    const gap = newer.info.gameCreation - previousEnd;
    // Overlap cannot establish time played, even if the timestamps are sortable.
    if (!validDate(previousEnd) || gap < 0) { boundary = 'invalid'; break; }
    if (gap > SESSION_GAP_MINUTES * 60_000) { boundary = 'gap'; break; }
    members.push(match);
  }
  const end = first.match.info.gameCreation + first.match.info.gameDuration * 1000;
  const queues = summarizeByQueue(members, puuid).map(stats => {
    const counts = new Map<string, number>();
    for (const entry of stats.championCounts) {
      const champion = canonicalChampionId(entry.champion);
      counts.set(champion, (counts.get(champion) ?? 0) + entry.count);
    }
    return { ...stats, championCounts: [...counts].map(([champion, count]) => ({ champion, count }))
      .sort((a, b) => b.count - a.count || a.champion.localeCompare(b.champion)) };
  });
  return {
    matches: members,
    from: members.at(-1)!.info.gameCreation,
    to: validDuration(first.match.info.gameDuration) && validDate(end) ? end : null,
    playSeconds: members.reduce((sum, match) => sum + (validDuration(match.info.gameDuration) ? match.info.gameDuration : 0), 0),
    queues,
    boundary,
    gapMinutes: SESSION_GAP_MINUTES,
  };
}

function contextsFor(rows: Row[], archive: RecallPatch[], selectedChampion?: string): AutomaticChampionContext[] {
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const key = `${row.player.championName}:${row.match.info.queueId}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups].sort((a, b) => Number(b[1][0]!.player.championName === selectedChampion) - Number(a[1][0]!.player.championName === selectedChampion))
    .slice(0, AUTOMATIC_CONTEXT_LIMIT).map(([key, group]) => {
    const { match, player, mode } = group[0]!;
    const sourcePatch = patchFor(match);
    const review = patchReview({ champion: player.championName, patch: sourcePatch, reviewedPatch: null, items: inventory(player) }, archive);
    return {
      key, champion: player.championName, queueId: match.info.queueId, queueLabel: mode.label,
      count: group.length, latestMatch: match, sourcePatch, resolvedPatch: review.baseline,
      patchStatus: review.status === 'unknown' ? 'unknown' : review.status === 'current' ? 'current' : review.changes.length ? 'changed' : 'unchanged',
      changes: review.changes,
    };
  });
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return rounded(sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2);
}

function ownBaselineFocus(rows: Row[], puuid: string): AutomaticFocus | null {
  const latest = rows[0];
  if (!latest || !validDuration(latest.match.info.gameDuration) || latest.match.info.gameDuration < 300) return null;
  const role = comparisonRole(latest.match, puuid);
  const patch = patchFor(latest.match);
  if (!role || patch === 'Unknown') return null;
  const comparable = rows.slice(1).filter(row => row.match.info.gameCreation < latest.match.info.gameCreation &&
    row.player.championName === latest.player.championName &&
    row.match.info.queueId === latest.match.info.queueId && comparisonRole(row.match, puuid) === role &&
    patchFor(row.match) === patch && validDuration(row.match.info.gameDuration) && row.match.info.gameDuration >= 300);
  const currentFacts = evidence(latest.match, puuid);
  const priorFacts = comparable.map(row => ({ row, facts: evidence(row.match, puuid) }));
  // Personal differences are prompts to watch, never a rank benchmark or cause.
  for (const definition of [
    { id: 'farm-rate', kind: 'farm' as const, label: 'CS per minute', unit: 'per-minute' as const, minimumDrop: 1, title: 'Keep your farm moving between fights.', action: 'Keep minion and monster income in mind between fights. The comparison covers the whole match, not lane phase.' },
    { id: 'participation', kind: 'participation' as const, label: 'Kill participation', unit: 'percent' as const, minimumDrop: 15, title: 'Watch your teamfight involvement.', action: 'Watch when you can join your team. Recorded involvement does not establish whether a fight was appropriate.' },
  ]) {
    const current = currentFacts.find(fact => fact.id === definition.id)?.metric?.value;
    if (!measured(current)) continue;
    const previous = priorFacts.flatMap(({ row, facts }) => {
      const value = facts.find(fact => fact.id === definition.id)?.metric?.value;
      return measured(value) ? [{ row, value }] : [];
    }).slice(0, 5);
    if (previous.length < 3) continue;
    const baseline = median(previous.map(record => record.value));
    if (baseline <= 0 || baseline - current < definition.minimumDrop || current > baseline * 0.8) continue;
    const suffix = definition.unit === 'percent' ? '%' : '/min';
    return {
      kind: definition.kind, title: definition.title,
      body: `Your latest game recorded ${current}${suffix}; your previous ${previous.length} comparable games had a median of ${baseline}${suffix}. These are the same champion, mode, role and patch. ${definition.action}`,
      sourceMatch: latest.match, champion: latest.player.championName, queueId: latest.match.info.queueId,
      evidenceMatchIds: [latest.match.metadata.matchId, ...previous.map(record => record.row.match.metadata.matchId)],
      metric: { label: definition.label, latest: current, baseline, unit: definition.unit, samples: previous.length },
    };
  }
  return null;
}

function focusFor(rows: Row[], contexts: AutomaticChampionContext[], puuid: string): AutomaticFocus | null {
  const changed = contexts.find(context => context.patchStatus === 'changed');
  if (changed) {
    const patch = changed.changes[0]!;
    const record = patch.records?.[0];
    return {
      kind: 'patch', title: 'Changes since your latest imported game.',
      body: record ? `Patch ${patch.id}: ${record.label} changed from ${record.before} to ${record.after}. This is a recorded change to your champion or an item in that loadout.`
        : `Patch ${patch.id} includes your champion or a verified item from that loadout. The relevant archived changes are ready below.`,
      evidenceMatchIds: [changed.latestMatch.metadata.matchId], sourceMatch: changed.latestMatch,
      champion: changed.champion, queueId: changed.queueId, patchId: patch.id,
    };
  }
  const baseline = ownBaselineFocus(rows, puuid);
  if (baseline) return baseline;
  const latest = rows[0];
  if (!latest) return null;
  const score = [latest.player.kills, latest.player.deaths, latest.player.assists].every(measured)
    ? ` Recorded K / D / A: ${latest.player.kills} / ${latest.player.deaths} / ${latest.player.assists}.` : '';
  const result = typeof latest.player.win === 'boolean' ? ` ${latest.player.win ? 'Win' : 'Loss'}.` : '';
  return {
    kind: 'latest-game', title: 'Your latest game, already collected.',
    body: `${latest.mode.label}.${result}${score} Your recorded loadout and match facts are ready. No clear personal comparison is available in this sample.`,
    evidenceMatchIds: [latest.match.metadata.matchId], sourceMatch: latest.match,
    champion: latest.player.championName, queueId: latest.match.info.queueId,
  };
}

/** Derive useful preparation from actual imports; never read or author browser notes. */
export function buildAutomaticBriefing(matches: Match[], puuid: string, archive: RecallPatch[], options: AutomaticBriefingOptions = {}): AutomaticBriefing {
  const seen = new Set<string>();
  const allRows: Row[] = [];
  let omitted = 0;
  for (const match of matches) {
    if (seen.has(match.metadata.matchId)) continue;
    seen.add(match.metadata.matchId);
    const player = participant(match, puuid);
    const mode = modeForMatch(match);
    if (!player || !player.championName || !mode.supported || !validDate(match.info.gameCreation)) { omitted++; continue; }
    const championName = canonicalChampionId(player.championName);
    allRows.push({ match, player: championName === player.championName ? player : { ...player, championName }, mode });
  }
  allRows.sort((a, b) => b.match.info.gameCreation - a.match.info.gameCreation || a.match.metadata.matchId.localeCompare(b.match.metadata.matchId));
  const requestedQueue = options.queue == null || options.queue === 'all' ? null : Number(options.queue);
  const rows = requestedQueue === null ? allRows : Number.isInteger(requestedQueue) && isSupportedQueue(requestedQueue)
    ? allRows.filter(row => row.match.info.queueId === requestedQueue) : [];
  const available = Number.isInteger(options.available) && options.available! >= 0 ? options.available! : null;
  const failed = Number.isInteger(options.failed) && options.failed! >= 0 ? options.failed! : 0;
  const selectedChampion = options.champion ? canonicalChampionId(options.champion) : undefined;
  const champions = contextsFor(rows, archive, selectedChampion);
  const focusRows = selectedChampion ? rows.filter(row => row.player.championName === selectedChampion) : rows;
  const focusContexts = selectedChampion ? champions.filter(context => context.champion === selectedChampion) : champions;
  return {
    latest: rows[0]?.match ?? null,
    sample: { loaded: allRows.length, available, failed, omitted, partial: !!options.loading || failed > 0 || omitted > 0 || available === null || allRows.length !== available },
    session: sessionFor(rows, puuid), champions, focus: focusFor(focusRows, focusContexts, puuid),
  };
}
