import { z } from 'zod';
import { comparisonRole, comparisonRoleLabel, participant, platforms, type Match, type Participant } from './contracts';
import { modeForMatch, queues, type MatchMode } from './modes';
import { champions as championCatalog } from '../../data/champions.json';

export const MOMENTUM_VERSION = 1;
export const MOMENTUM_CYCLE_LIMIT = 12;
export const MOMENTUM_GAME_TARGET = 3;
export const MOMENTUM_MIN_BASELINE = 3;
export const MOMENTUM_MAX_BASELINE = 5;
export const MOMENTUM_STORAGE_PREFIX = 'riftscry:momentum:v1:';

export type MomentumMetricId = 'farm' | 'vision' | 'participation';
export const momentumMetrics = {
  farm: {
    label: 'CS per minute', unit: 'per-minute' as const,
    title: 'Keep your farm moving.',
    action: 'Look for safe minion or jungle income between fights. This counts the whole game, not just lane phase.',
  },
  vision: {
    label: 'Vision score per minute', unit: 'per-minute' as const,
    title: 'Make room for useful vision.',
    action: 'Use safe windows with your team to place or clear vision. The score records activity, not whether every ward was useful.',
  },
  participation: {
    label: 'Kill participation', unit: 'percent' as const,
    title: 'Stay connected to your team.',
    action: 'Look for useful ways to join your team. More participation is not a reason to take a bad fight.',
  },
} as const;

export type MomentumContext = {
  champion: string; queueId: number; queueLabel: string;
  role: string; roleLabel: string; patch: string;
};
export type MomentumCheck = { matchId: string; startedAt: number; value: number; hit: boolean };
export type MomentumCycle = {
  id: string; context: MomentumContext; metric: MomentumMetricId;
  baseline: number; baselineMatchIds: string[]; target: number; createdAt: number;
  checks: MomentumCheck[]; status: 'active' | 'complete'; completedAt: number | null;
};
export type MomentumState = { version: 1; platform: string; puuid: string; cycles: MomentumCycle[] };
export type MomentumHighlight = {
  metric: MomentumMetricId; value: number; previousBest: number;
  sourceMatchId: string; comparisonMatchIds: string[]; context: MomentumContext;
  won: boolean | null;
};
export type MomentumSpotlight = {
  metric: MomentumMetricId; value: number; sourceMatchId: string;
  context: MomentumContext; title: string; action: string;
};
export type MomentumOptions = {
  platform: string; now: number; state?: MomentumState | null;
  available?: number; failed?: number; loading?: boolean; error?: boolean;
  queue?: string; champion?: string; canPersist?: boolean;
};
export type MomentumReport = {
  state: MomentumState; changed: boolean;
  status: 'tracking' | 'warmup' | 'unsupported' | 'waiting' | 'read-only';
  context: MomentumContext | null; active: MomentumCycle | null; completed: MomentumCycle | null;
  highlight: MomentumHighlight | null; spotlight: MomentumSpotlight | null;
  comparableCount: number; completeSample: boolean; notice: string;
};
export type MomentumParseResult = { status: 'empty' | 'valid' | 'corrupt'; state: MomentumState | null };

export function momentumStorageKey(platform: string, puuid: string): string {
  return `${MOMENTUM_STORAGE_PREFIX}${platform}:${puuid}`;
}

const championIds = new Map(Object.keys(championCatalog).map(id => [id.toLowerCase(), id]));
const canonicalChampion = (name: unknown): string | null => typeof name === 'string' ? championIds.get(name.toLowerCase()) ?? null : null;
const laneRoles = new Set(['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']);
const laneQueues = new Set([420, 440, 400, 480, 490, 430, 700]);
const aramQueues = new Set([450, 720, 2400]);
const matchIdPattern = /^[A-Z0-9]{2,5}_[0-9]{5,20}$/;
const puuidPattern = /^[A-Za-z0-9_-]{30,120}$/;
const patchPattern = /^[1-9]\d{0,2}\.[1-9]\d{0,2}$/;
const MAX_DATE = 8_640_000_000_000_000;
const MAX_STATE_BYTES = 100_000;
const numberKnown = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const countKnown = (value: unknown): value is number => numberKnown(value) && Number.isSafeInteger(value) && value <= 10_000_000;
const validTime = (value: unknown): value is number => numberKnown(value) && Number.isSafeInteger(value) && value > 0 && value <= MAX_DATE;
const roundMetric = (value: number, metric: MomentumMetricId) => Math.round(value * (metric === 'vision' ? 100 : 10)) / (metric === 'vision' ? 100 : 10);
const unique = <T,>(values: T[]) => new Set(values).size === values.length;
const sameContext = (a: MomentumContext, b: MomentumContext) => a.champion === b.champion && a.queueId === b.queueId && a.role === b.role && a.patch === b.patch;
const metricSupported = (context: MomentumContext, metric: MomentumMetricId) => metric === 'participation'
  ? laneQueues.has(context.queueId) || aramQueues.has(context.queueId)
  : laneQueues.has(context.queueId) && laneRoles.has(context.role) && (metric !== 'farm' || context.role !== 'UTILITY');
const validMetricValue = (metric: MomentumMetricId, value: number) => numberKnown(value) && value <= (metric === 'participation' ? 100 : 1_000_000);

const timeSchema = z.number().int().positive().max(MAX_DATE);
const idSchema = z.string().regex(matchIdPattern);
const metricSchema = z.enum(['farm', 'vision', 'participation']);
const contextSchema = z.object({
  champion: z.string().max(40), queueId: z.number().int().positive(), queueLabel: z.string().min(1).max(60),
  role: z.string().min(1).max(20), roleLabel: z.string().min(1).max(60), patch: z.string().regex(patchPattern),
}).strict().refine(context => canonicalChampion(context.champion) === context.champion && queues[context.queueId] === context.queueLabel &&
  comparisonRoleLabel(context.role) === context.roleLabel &&
  ((laneQueues.has(context.queueId) && laneRoles.has(context.role)) || (aramQueues.has(context.queueId) && context.role === 'MODE:aram')),
  'Unsupported or inconsistent comparison context');
const checkSchema = z.object({
  matchId: idSchema, startedAt: timeSchema, value: z.number().nonnegative().max(1_000_000), hit: z.boolean(),
}).strict();
const cycleSchema = z.object({
  id: z.string().min(1).max(180), context: contextSchema, metric: metricSchema,
  baseline: z.number().nonnegative().max(1_000_000), baselineMatchIds: z.array(idSchema).min(MOMENTUM_MIN_BASELINE).max(MOMENTUM_MAX_BASELINE),
  target: z.number().nonnegative().max(1_000_000), createdAt: timeSchema,
  checks: z.array(checkSchema).max(MOMENTUM_GAME_TARGET), status: z.enum(['active', 'complete']), completedAt: timeSchema.nullable(),
}).strict().refine(cycle => {
  if (!metricSupported(cycle.context, cycle.metric) || !validMetricValue(cycle.metric, cycle.baseline) || !validMetricValue(cycle.metric, cycle.target)) return false;
  const increment = cycle.metric === 'participation' ? 5 : cycle.metric === 'vision' ? 0.1 : 0.2;
  if (cycle.target < cycle.baseline || cycle.target > roundMetric(cycle.baseline + increment, cycle.metric)) return false;
  if (!unique(cycle.baselineMatchIds) || !unique(cycle.checks.map(check => check.matchId))) return false;
  if (cycle.checks.some((check, index) => check.startedAt <= cycle.createdAt || cycle.baselineMatchIds.includes(check.matchId) ||
    (index > 0 && check.startedAt <= cycle.checks[index - 1]!.startedAt) || !validMetricValue(cycle.metric, check.value) || check.hit !== (check.value >= cycle.target))) return false;
  if (cycle.status === 'active') return cycle.checks.length < MOMENTUM_GAME_TARGET && cycle.completedAt === null;
  return cycle.checks.length === MOMENTUM_GAME_TARGET && cycle.completedAt !== null && cycle.completedAt >= cycle.checks.at(-1)!.startedAt;
}, 'Invalid baseline, chronology or result');
const stateSchema = z.object({
  version: z.literal(MOMENTUM_VERSION), platform: z.string().max(5).refine(value => Object.hasOwn(platforms, value)),
  puuid: z.string().regex(puuidPattern), cycles: z.array(cycleSchema).max(MOMENTUM_CYCLE_LIMIT),
}).strict().refine(state => unique(state.cycles.map(cycle => cycle.id)) && state.cycles.every((cycle, index) =>
  cycle.status !== 'active' || !state.cycles.slice(index + 1).some(other => other.status === 'active' && sameContext(cycle.context, other.context))),
  'Duplicate cycles or active contexts');

/** Invalid stored documents are reported, never converted into an empty document. */
export function parseMomentumState(raw: string | null, platform: string, puuid: string): MomentumParseResult {
  if (raw === null) return { status: 'empty', state: null };
  try {
    if (raw.length > MAX_STATE_BYTES) return { status: 'corrupt', state: null };
    const result = stateSchema.safeParse(JSON.parse(raw));
    if (!result.success || result.data.platform !== platform || result.data.puuid !== puuid) return { status: 'corrupt', state: null };
    return { status: 'valid', state: result.data };
  } catch { return { status: 'corrupt', state: null }; }
}

export function serializeMomentumState(state: MomentumState): string {
  return JSON.stringify(stateSchema.parse(state));
}

type Row = { match: Match; player: Participant; mode: MatchMode; context: MomentumContext; startedAt: number };
type Observation = { row: Row; value: number };
type Candidate = { metric: MomentumMetricId; baseline: number; observations: Observation[]; latest: number; drop: number };

function contextFor(match: Match, puuid: string): MomentumContext | null {
  const p = participant(match, puuid);
  const champion = canonicalChampion(p?.championName);
  const mode = modeForMatch(match);
  const role = comparisonRole(match, puuid);
  const patch = typeof match.info.gameVersion === 'string' ? match.info.gameVersion.split('.').slice(0, 2).join('.') : '';
  if (!p || !champion || !mode.supported || !patchPattern.test(patch)) return null;
  const lane = mode.roleMetrics && laneRoles.has(role) && laneQueues.has(match.info.queueId);
  const aram = aramQueues.has(match.info.queueId) && match.info.gameMode === 'ARAM' &&
    (match.info.mapId == null || match.info.mapId === 12) && role === 'MODE:aram';
  if (!lane && !aram) return null;
  return { champion, queueId: match.info.queueId, queueLabel: mode.label, role, roleLabel: comparisonRoleLabel(role), patch };
}

function isRemake(match: Match, p: Participant): boolean {
  // Riot may expose this optional field on a participant or an older record's info.
  return (p as Participant & { gameEndedInEarlySurrender?: unknown }).gameEndedInEarlySurrender === true ||
    (match.info as Match['info'] & { gameEndedInEarlySurrender?: unknown }).gameEndedInEarlySurrender === true;
}

function metricValue(row: Row, metric: MomentumMetricId): number | null {
  if (!metricSupported(row.context, metric)) return null;
  const { player: p, match } = row;
  const minutes = match.info.gameDuration / 60;
  if (metric === 'farm') return countKnown(p.totalMinionsKilled) && countKnown(p.neutralMinionsKilled)
    ? roundMetric((p.totalMinionsKilled + p.neutralMinionsKilled) / minutes, metric) : null;
  if (metric === 'vision') return countKnown(p.visionScore) ? roundMetric(p.visionScore / minutes, metric) : null;
  if (p.teamId !== 100 && p.teamId !== 200) return null;
  const team = match.info.participants.filter(member => member.teamId === p.teamId);
  if (team.length !== 5 || !unique(team.map(member => member.participantId)) || !unique(team.map(member => member.puuid)) ||
    !team.every(member => Number.isSafeInteger(member.participantId) && member.participantId > 0 &&
      typeof member.puuid === 'string' && member.puuid.length > 0 && countKnown(member.kills)) ||
    !countKnown(p.kills) || !countKnown(p.assists)) return null;
  const teamKills = team.reduce((total, member) => total + member.kills, 0);
  if (teamKills <= 0 || p.kills + p.assists > teamKills) return null;
  return roundMetric((p.kills + p.assists) / teamKills * 100, metric);
}

function preferredMetrics(context: MomentumContext): MomentumMetricId[] {
  if (context.role === 'MODE:aram') return ['participation'];
  return context.role === 'UTILITY' ? ['vision', 'participation'] : ['farm', 'participation', 'vision'];
}

function median(values: number[], metric: MomentumMetricId): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return roundMetric(sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2, metric);
}

function observations(rows: Row[], context: MomentumContext, metric: MomentumMetricId): Observation[] {
  return rows.flatMap(row => {
    if (!sameContext(row.context, context)) return [];
    const value = metricValue(row, metric);
    return value === null || !validMetricValue(metric, value) ? [] : [{ row, value }];
  });
}

function candidatesFor(latest: Row, rows: Row[]): Candidate[] {
  return preferredMetrics(latest.context).flatMap(metric => {
    const value = metricValue(latest, metric);
    if (value === null || !validMetricValue(metric, value)) return [];
    const values = observations(rows, latest.context, metric).slice(0, MOMENTUM_MAX_BASELINE);
    if (values.length < MOMENTUM_MIN_BASELINE) return [];
    const baseline = median(values.map(observation => observation.value), metric);
    const minimumDrop = metric === 'farm' ? 0.5 : metric === 'vision' ? 0.15 : 5;
    const drop = baseline - value >= minimumDrop ? (baseline - value) / Math.max(baseline, minimumDrop) : 0;
    return [{ metric, baseline, observations: values, latest: value, drop }];
  }).sort((a, b) => b.drop - a.drop);
}

function highlightFor(latest: Row | undefined, rows: Row[]): MomentumHighlight | null {
  if (!latest) return null;
  const candidates = preferredMetrics(latest.context).flatMap(metric => {
    const value = metricValue(latest, metric);
    if (value === null || !validMetricValue(metric, value)) return [];
    const prior = observations(rows, latest.context, metric).filter(record => record.row.startedAt < latest.startedAt);
    if (prior.length < MOMENTUM_MIN_BASELINE) return [];
    const previousBest = Math.max(...prior.map(record => record.value));
    if (value <= previousBest) return [];
    return [{ metric, value, previousBest, sourceMatchId: latest.match.metadata.matchId,
      comparisonMatchIds: prior.map(record => record.row.match.metadata.matchId), context: latest.context,
      won: typeof latest.player.win === 'boolean' ? latest.player.win : null }];
  });
  return candidates.sort((a, b) => (b.value - b.previousBest) / Math.max(b.previousBest, 1) -
    (a.value - a.previousBest) / Math.max(a.previousBest, 1))[0] ?? null;
}

function createCycle(candidate: Candidate, context: MomentumContext, now: number): MomentumCycle {
  const increment = candidate.metric === 'participation' ? 5 : candidate.metric === 'vision' ? 0.1 : 0.2;
  const target = roundMetric(candidate.latest < candidate.baseline ? candidate.baseline : Math.min(candidate.metric === 'participation' ? 100 : 1_000_000, candidate.baseline + increment), candidate.metric);
  return {
    id: `${context.champion}:${context.queueId}:${context.role}:${context.patch}:${now}`,
    context: { ...context }, metric: candidate.metric, baseline: candidate.baseline,
    baselineMatchIds: candidate.observations.map(observation => observation.row.match.metadata.matchId), target, createdAt: now,
    checks: [], status: 'active', completedAt: null,
  };
}

/**
 * Automatic, prospective and bounded. No history or note is authored here.
 * Callers must persist only after a successful compare-with-current-storage check.
 */
export function buildMomentum(matches: Match[], puuid: string, options: MomentumOptions): MomentumReport {
  const empty: MomentumState = { version: MOMENTUM_VERSION, platform: options.platform, puuid, cycles: [] };
  let previous = empty;
  let stateValid = true;
  if (options.state) {
    try {
      const parsed = parseMomentumState(JSON.stringify(options.state), options.platform, puuid);
      stateValid = parsed.status === 'valid';
      previous = parsed.state ?? empty;
    } catch { stateValid = false; }
  }
  const scopeValid = Object.hasOwn(platforms, options.platform) && puuidPattern.test(puuid) && validTime(options.now);
  const seen = new Set<string>();
  const allRows: Row[] = [];
  const allStarts: { matchId: string; startedAt: number; queueId: number }[] = [];
  const sources: { matchId: string; startedAt: number; queueId: number; champion: string | null }[] = [];
  let malformed = false;
  for (const match of matches) {
    if (!match?.metadata || !match?.info || !Array.isArray(match.info.participants) ||
      !match.info.participants.every(member => member && typeof member === 'object') ||
      !matchIdPattern.test(match.metadata.matchId ?? '')) { malformed = true; continue; }
    if (seen.has(match.metadata.matchId)) continue;
    seen.add(match.metadata.matchId);
    const startedAt = match.info.gameCreation;
    if (!validTime(startedAt) || startedAt > options.now) { malformed = true; continue; }
    allStarts.push({ matchId: match.metadata.matchId, startedAt, queueId: match.info.queueId });
    const p = participant(match, puuid);
    if (!p || match.info.participants.filter(member => member.puuid === puuid).length !== 1) { malformed = true; continue; }
    sources.push({ matchId: match.metadata.matchId, startedAt, queueId: match.info.queueId, champion: canonicalChampion(p.championName) });
    const duration = match.info.gameDuration;
    if (!numberKnown(duration) || duration <= 0 || duration > 21600 || startedAt + duration * 1000 > options.now) { malformed = true; continue; }
    if (duration < 300 || isRemake(match, p)) continue;
    const context = contextFor(match, puuid);
    if (!context) continue;
    allRows.push({ match, player: p, mode: modeForMatch(match), context, startedAt });
  }
  allRows.sort((a, b) => b.startedAt - a.startedAt || a.match.metadata.matchId.localeCompare(b.match.metadata.matchId));
  const queue = options.queue == null || options.queue === 'all' ? null : /^\d+$/.test(options.queue) ? Number(options.queue) : Number.NaN;
  const queueValid = queue === null || Number.isSafeInteger(queue) && Object.hasOwn(queues, queue);
  const queueRows = queue === null ? allRows : allRows.filter(row => row.context.queueId === queue);
  const requestedChampion = options.champion ? canonicalChampion(options.champion) : null;
  const rows = options.champion ? queueRows.filter(row => row.context.champion === requestedChampion) : queueRows;
  const source = sources.filter(record => (queue === null || record.queueId === queue) &&
    (!options.champion || requestedChampion !== null && record.champion === requestedChampion))
    .sort((a, b) => b.startedAt - a.startedAt || a.matchId.localeCompare(b.matchId))[0];
  // An unsupported newest game must not silently inherit an older lane's advice.
  const latest = source ? rows.find(row => row.match.metadata.matchId === source.matchId) : undefined;
  const context = latest?.context ?? null;
  const completeSample = scopeValid && queueValid && !malformed && !options.loading && !options.error &&
    (options.failed ?? 0) === 0 && Number.isSafeInteger(options.available) && options.available! >= 0 && options.available === seen.size;
  const canWrite = options.canPersist !== false && stateValid && completeSample;
  const candidates = latest ? candidatesFor(latest, rows) : [];
  const candidate = candidates[0];
  const spotlightMetric = latest ? candidate?.metric ?? preferredMetrics(latest.context).find(metric => {
    const value = metricValue(latest, metric);
    return value !== null && validMetricValue(metric, value);
  }) : undefined;
  const spotlight: MomentumSpotlight | null = latest && spotlightMetric ? {
    metric: spotlightMetric, value: metricValue(latest, spotlightMetric)!, sourceMatchId: latest.match.metadata.matchId,
    context: latest.context, title: momentumMetrics[spotlightMetric].title, action: momentumMetrics[spotlightMetric].action,
  } : null;
  const comparableCount = latest && spotlightMetric ? observations(rows, latest.context, spotlightMetric).length : 0;
  const span = queue === null ? allStarts : allStarts.filter(row => row.queueId === queue);
  const reachesStart = (cycle: MomentumCycle) => span.some(row => row.startedAt <= cycle.createdAt);
  let cycles = previous.cycles;
  if (canWrite) {
    cycles = previous.cycles.map(cycle => {
      if (cycle.status !== 'active' || !reachesStart(cycle)) return cycle;
      const baselineIds = new Set(cycle.baselineMatchIds);
      const oldChecks = new Map(cycle.checks.map(check => [check.matchId, check]));
      const eligible = observations(queueRows, cycle.context, cycle.metric).filter(record =>
        record.row.startedAt > cycle.createdAt && !baselineIds.has(record.row.match.metadata.matchId));
      // A previously checked game remains frozen even when it rolls out of history.
      for (const record of eligible) if (!oldChecks.has(record.row.match.metadata.matchId)) oldChecks.set(record.row.match.metadata.matchId, {
        matchId: record.row.match.metadata.matchId, startedAt: record.row.startedAt, value: record.value, hit: record.value >= cycle.target,
      });
      const checks = [...oldChecks.values()].sort((a, b) => a.startedAt - b.startedAt || a.matchId.localeCompare(b.matchId))
        .filter((check, index, checks) => index === 0 || check.startedAt !== checks[index - 1]!.startedAt).slice(0, MOMENTUM_GAME_TARGET);
      if (checks.length === cycle.checks.length && checks.every((check, index) => check.matchId === cycle.checks[index]?.matchId)) return cycle;
      const completed = checks.length === MOMENTUM_GAME_TARGET;
      return { ...cycle, checks, status: completed ? 'complete' as const : 'active' as const, completedAt: completed ? options.now : null };
    });
    if (context && candidate && !cycles.some(cycle => cycle.status === 'active' && sameContext(cycle.context, context)) &&
      !cycles.some(cycle => sameContext(cycle.context, context) && cycle.createdAt >= options.now)) {
      cycles = [...cycles, createCycle(candidate, context, options.now)].slice(-MOMENTUM_CYCLE_LIMIT);
    }
  }
  const state = cycles === previous.cycles ? previous : { ...previous, cycles };
  const changed = JSON.stringify(state) !== JSON.stringify(previous);
  const active = context ? cycles.findLast(cycle => cycle.status === 'active' && sameContext(cycle.context, context)) ?? null : null;
  const completed = [...cycles].filter(cycle => cycle.status === 'complete').sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))[0] ?? null;
  const coverageGap = active !== null && !reachesStart(active);
  let status: MomentumReport['status'];
  let notice: string;
  if (!stateValid || options.canPersist === false) {
    status = 'read-only'; notice = 'Your latest recorded measure is available. Automatic focus tracking needs working browser storage.';
  } else if (!completeSample || coverageGap) {
    status = 'waiting'; notice = coverageGap
      ? 'This import no longer reaches the start of your focus. Progress is paused so unseen games are not skipped.'
      : 'Waiting for a complete import before starting or checking a focus. Previously recorded progress stays unchanged.';
  } else if (active) {
    status = 'tracking'; notice = 'Only later games with this champion, mode, role and patch count. Your baseline stays fixed for three eligible games.';
  } else if (spotlight) {
    status = 'warmup'; notice = 'Your latest recorded measure is ready. Three comparable games are needed to set a personal target.';
  } else {
    status = 'unsupported'; notice = 'A reliable measure is not available for this game context. Your match records and patch briefing remain available.';
  }
  return { state, changed, status, context, active, completed, highlight: highlightFor(latest, rows), spotlight, comparableCount, completeSample, notice };
}
