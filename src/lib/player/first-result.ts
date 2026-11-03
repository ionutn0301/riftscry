import type { Match, Participant } from './contracts';
import { comparisonRoleLabel } from './contracts';
import { isSupportedQueue, modeForMatch, type ModeFamily } from './modes';
import { champions as championCatalog } from '../../data/champions.json';

export type FirstResultOptions = {
  queue?: string; champion?: string; loading?: boolean; available?: number;
  failed?: number; error?: boolean; now?: number;
};
export type FirstResultContext = {
  queueId: number; label: string; family: ModeFamily; count: number;
  champions: { id: string; count: number }[]; latestMatchId: string;
};
export type FirstResultMetric = {
  label: string; value: number; unit: 'per-minute' | 'percent';
  numerator?: number; denominator?: number;
};
export type FirstResultInsight = {
  sourceMatch: Match; champion: string; queueId: number; queueLabel: string; roleLabel: string;
  kind: 'farm' | 'vision' | 'participation' | 'record'; title: string; action: string;
  metric?: FirstResultMetric;
  facts: {
    kills: number | null; deaths: number | null; assists: number | null;
    durationSeconds: number | null; result: 'win' | 'loss' | 'unknown'; itemIds: number[];
  };
  limitation: string | null;
};
export type FirstResult = {
  insight: FirstResultInsight | null; contexts: FirstResultContext[];
  sample: { status: 'loading' | 'partial' | 'ready' | 'empty' | 'error'; loaded: number; available: number | null; failed: number; omitted: number; complete: boolean };
  scope: { queue: string; champion: string; valid: boolean };
  /** Explains an absent result without silently selecting another context. */
  reason: 'invalid-scope' | 'no-records' | 'scope-empty' | 'unsupported-source' | 'unavailable-source' | null;
};

const championIds = new Map(Object.keys(championCatalog).map(id => [id.toLowerCase(), id]));
const roles = new Set(['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']);
const matchIdPattern = /^[A-Z0-9]{2,5}_[0-9]{5,20}$/;
const puuidPattern = /^[A-Za-z0-9_-]{30,120}$/;
const maxDate = 8_640_000_000_000_000;
const knownCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 10_000_000;
const knownTime = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= maxDate;
const canonicalChampion = (value: unknown): string | null => typeof value === 'string' && /^[A-Za-z0-9]{1,40}$/.test(value)
  ? championIds.get(value.toLowerCase()) ?? value : null;
const round = (value: number, places = 1) => Math.round(value * 10 ** places) / 10 ** places;
const unique = <T,>(values: T[]) => new Set(values).size === values.length;

type Source = { match: Match; player: Participant; champion: string; supported: boolean; startedAt: number; conflicted: boolean };

function sourceFor(match: Match, puuid: string, now: number, conflicted = false): Source | null {
  if (!match.info || !Array.isArray(match.info.participants) || !match.info.participants.every(member => member && typeof member === 'object')) return null;
  const players = match.info.participants.filter(member => member.puuid === puuid);
  const player = players[0];
  const champion = canonicalChampion(player?.championName);
  const startedAt = match.info.gameCreation;
  if (players.length !== 1 || !player || !champion || !knownTime(startedAt) || startedAt > now) return null;
  return { match, player, champion, startedAt, conflicted,
    supported: match.info.gameType === 'MATCHED_GAME' && isSupportedQueue(match.info.queueId) };
}

/** A stable order for every field that can change this model's output. */
function fingerprint(match: Match): string | null {
  try {
    const info = match.info;
    return JSON.stringify([info?.gameCreation, info?.gameDuration, info?.queueId, info?.gameMode, info?.gameType, info?.mapId, info?.gameVersion,
      (info as (Match['info'] & { gameEndedInEarlySurrender?: unknown }) | undefined)?.gameEndedInEarlySurrender,
      Array.isArray(info?.participants) ? info.participants.map(p => [p?.puuid, p?.participantId, p?.teamId, p?.championName, p?.teamPosition,
        p?.win, p?.kills, p?.deaths, p?.assists, p?.totalMinionsKilled, p?.neutralMinionsKilled, p?.visionScore,
        p?.item0, p?.item1, p?.item2, p?.item3, p?.item4, p?.item5, p?.item6,
        (p as (Participant & { gameEndedInEarlySurrender?: unknown }) | undefined)?.gameEndedInEarlySurrender]) : null]);
  } catch { return null; }
}

function resultFor(source: Source, now: number): FirstResultInsight {
  const { match, player: p, champion } = source;
  const mode = modeForMatch(match);
  const duration = match.info.gameDuration;
  const durationKnown = typeof duration === 'number' && Number.isFinite(duration) && duration > 0 && duration <= 21600 &&
    source.startedAt + duration * 1000 <= now;
  const remake = (p as Participant & { gameEndedInEarlySurrender?: unknown }).gameEndedInEarlySurrender === true ||
    (match.info as Match['info'] & { gameEndedInEarlySurrender?: unknown }).gameEndedInEarlySurrender === true;
  const slots = [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6];
  const inventoryKnown = slots.every(value => knownCount(value) && value <= 999999);
  const facts: FirstResultInsight['facts'] = {
    kills: knownCount(p.kills) ? p.kills : null,
    deaths: knownCount(p.deaths) ? p.deaths : null,
    assists: knownCount(p.assists) ? p.assists : null,
    durationSeconds: durationKnown ? duration : null,
    result: typeof p.win === 'boolean' ? p.win ? 'win' : 'loss' : 'unknown',
    itemIds: slots.filter(value => knownCount(value) && value > 0 && value <= 999999),
  };
  const limitations: string[] = [];
  if (!durationKnown) limitations.push('A valid completed-game duration is unavailable; rates are withheld.');
  if (facts.result === 'unknown') limitations.push('The match outcome is unavailable.');
  if ([facts.kills, facts.deaths, facts.assists].includes(null)) limitations.push('Some scoreboard values are unavailable.');
  if (!inventoryKnown) limitations.push('Only known final inventory slots are shown.');
  const knownRole = mode.roleMetrics && roles.has(p.teamPosition);
  const standardAram = (match.info.queueId === 450 || match.info.queueId === 720) &&
    match.info.gameMode === 'ARAM' && (match.info.mapId == null || match.info.mapId === 12);
  let kind: FirstResultInsight['kind'] = 'record';
  let title = 'Your recorded game.';
  let action = 'Open the match to inspect its recorded facts and final inventory.';
  let metric: FirstResultMetric | undefined;

  if (remake) limitations.push('This record is marked as an early-ended game; coaching rates are withheld.');
  else if (durationKnown && duration < 300) limitations.push('This game lasted less than five minutes; coaching rates are withheld.');
  else if (durationKnown && (knownRole || standardAram)) {
    const minutes = duration / 60;
    if (knownRole && p.teamPosition === 'UTILITY' && knownCount(p.visionScore)) {
      kind = 'vision'; title = 'Your vision activity.';
      action = 'Place or clear vision in safe windows with your team.';
      metric = { label: 'Vision score per minute', value: round(p.visionScore / minutes, 2), unit: 'per-minute' };
      limitations.push('Recorded vision activity does not show whether each ward was useful.');
    } else if (knownRole && p.teamPosition !== 'UTILITY' && knownCount(p.totalMinionsKilled) && knownCount(p.neutralMinionsKilled)) {
      kind = 'farm'; title = 'Your farm through the game.';
      action = p.teamPosition === 'JUNGLE' ? 'Look for safe camp and minion income between team plays.' : 'Keep safe minion income moving between fights.';
      metric = { label: 'CS per minute', value: round((p.totalMinionsKilled + p.neutralMinionsKilled) / minutes), unit: 'per-minute' };
      limitations.push('This is a whole-match rate, not a lane-phase score or a rank benchmark.');
    } else {
      const participation = participationFor(match, p);
      if (participation) {
        kind = 'participation'; title = 'Your team involvement.';
        action = 'Stay connected to teammates when a fight is worth joining.';
        metric = participation;
        limitations.push('Recorded involvement does not establish which fights were good decisions.');
      } else limitations.push('A reliable role-appropriate measure is unavailable; the recorded facts remain useful.');
    }
  } else if (mode.family === 'summoners-rift' && !mode.roleMetrics || mode.family === 'aram' && match.info.queueId !== 2400 && !standardAram) {
    limitations.push('The map or game-mode fields do not establish the expected queue context; coaching measures are withheld.');
  } else if (mode.roleMetrics && !knownRole) {
    limitations.push('The recorded role is unknown; lane and role-based measures are withheld.');
  } else if (mode.family === 'arena') {
    limitations.push('Arena uses separate round and augment rules. The recorded result is not an inferred placement.');
  } else if (mode.family === 'rotating' || match.info.queueId === 2400) {
    limitations.push('This mode uses different rules; standard lane, vision and farming advice is not applied.');
  }

  return {
    sourceMatch: match, champion, queueId: match.info.queueId, queueLabel: mode.label,
    roleLabel: knownRole ? comparisonRoleLabel(p.teamPosition) : standardAram ? 'No assigned lane' : 'Role comparison unavailable',
    kind, title, action, ...(metric ? { metric } : {}), facts,
    limitation: limitations.length ? limitations.join(' ') : null,
  };
}

function participationFor(match: Match, p: Participant): FirstResultMetric | null {
  if (p.teamId !== 100 && p.teamId !== 200 || !knownCount(p.kills) || !knownCount(p.assists)) return null;
  const team = match.info.participants.filter(member => member.teamId === p.teamId);
  if (team.length !== 5 || !unique(team.map(member => member.puuid)) || !unique(team.map(member => member.participantId)) ||
    !team.every(member => typeof member.puuid === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(member.puuid) &&
      Number.isSafeInteger(member.participantId) && member.participantId >= 1 && member.participantId <= 10 && knownCount(member.kills))) return null;
  const denominator = team.reduce((sum, member) => sum + member.kills, 0);
  const numerator = p.kills + p.assists;
  if (denominator <= 0 || numerator > denominator) return null;
  return { label: 'Kill participation', value: round(numerator / denominator * 100), unit: 'percent', numerator, denominator };
}

/**
 * One useful observation from the existing import; never a target or an aggregate
 * performance comparison. Partial results are usable but remain explicitly partial.
 */
export function buildFirstResult(matches: Match[], puuid: string, options: FirstResultOptions = {}): FirstResult {
  const now = options.now ?? Date.now();
  const queue = options.queue == null || options.queue === 'all' ? 'all' : options.queue;
  const queueValid = queue === 'all' || /^\d+$/.test(queue) && isSupportedQueue(Number(queue));
  const champion = options.champion ? canonicalChampion(options.champion) : '';
  const scope = { queue, champion: champion ?? options.champion ?? '', valid: queueValid && champion !== null && puuidPattern.test(puuid) && knownTime(now) };
  const records = new Map<string, { versions: Match[]; signature: string | null }>();
  const sources: Source[] = [];
  let omitted = 0;
  for (const match of matches) {
    if (!match?.metadata || !matchIdPattern.test(match.metadata.matchId ?? '')) { omitted++; continue; }
    const signature = fingerprint(match);
    const existing = records.get(match.metadata.matchId);
    if (!existing) records.set(match.metadata.matchId, { versions: [match], signature });
    else if (signature === null || signature !== existing.signature) existing.versions.push(match);
  }
  for (const record of records.values()) {
    const conflicted = record.signature === null || record.versions.length > 1;
    if (conflicted) {
      omitted++;
      // Retain each known conflicting anchor so neither input order nor a
      // changed queue/champion can silently expose an older, unrelated result.
      for (const match of record.versions) {
        const source = sourceFor(match, puuid, now, true);
        if (source) sources.push(source);
      }
      continue;
    }
    const source = sourceFor(record.versions[0]!, puuid, now);
    if (source) sources.push(source);
    if (!source || !source.supported) omitted++;
  }
  sources.sort((a, b) => b.startedAt - a.startedAt || a.match.metadata.matchId.localeCompare(b.match.metadata.matchId));
  const supported = sources.filter(source => source.supported && !source.conflicted);
  const groups = new Map<number, Source[]>();
  for (const source of supported) groups.set(source.match.info.queueId, [...(groups.get(source.match.info.queueId) ?? []), source]);
  const contexts: FirstResultContext[] = [...groups].map(([queueId, rows]) => {
    const mode = modeForMatch(rows[0]!.match);
    const champions = new Map<string, number>();
    for (const row of rows) champions.set(row.champion, (champions.get(row.champion) ?? 0) + 1);
    return { queueId, label: mode.label, family: mode.family, count: rows.length,
      champions: [...champions].map(([id, count]) => ({ id, count })), latestMatchId: rows[0]!.match.metadata.matchId };
  });
  const requested = sources.filter(source => (queue === 'all' || source.match.info.queueId === Number(queue)) && (!champion || source.champion === champion));
  const anchor = scope.valid ? requested[0] : undefined;
  const insight = anchor?.supported && !anchor.conflicted ? resultFor(anchor, now) : null;
  const available = Number.isSafeInteger(options.available) && options.available! >= 0 ? options.available! : null;
  const failed = Number.isSafeInteger(options.failed) && options.failed! >= 0 ? options.failed! : 0;
  const complete = !options.loading && !options.error && failed === 0 && omitted === 0 && available !== null && available === supported.length &&
    (options.failed === undefined || options.failed === failed);
  const status: FirstResult['sample']['status'] = options.loading ? 'loading' : options.error ? 'error' :
    !complete ? 'partial' : supported.length ? 'ready' : 'empty';
  const reason: FirstResult['reason'] = !scope.valid ? 'invalid-scope' : anchor?.conflicted ? 'unavailable-source' : anchor && !anchor.supported ? 'unsupported-source' :
    insight ? null : sources.length && (queue !== 'all' || champion) ? 'scope-empty' : omitted ? 'unavailable-source' : 'no-records';
  return { insight, contexts, sample: { status, loaded: supported.length, available, failed, omitted, complete }, scope, reason };
}
