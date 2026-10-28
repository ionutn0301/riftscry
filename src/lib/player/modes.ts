import type { Match } from './contracts';

/** Riot's published queue catalogue, checked 2026-10-28. Queue identity is not gameMode. */
export const QUEUE_SOURCE = 'https://static.developer.riotgames.com/docs/lol/queues.json';
export const MODE_CATALOG_VERSION = 'riot-queues-2026-10-28';
export type ModeFamily = 'summoners-rift' | 'aram' | 'arena' | 'rotating' | 'unknown';
export type MatchMode = {
  queueId: number;
  label: string;
  family: ModeFamily;
  supported: boolean;
  ranked: boolean;
  roleMetrics: boolean;
  visionMetrics: boolean;
  standardItems: boolean;
  runeSetup: boolean;
  context: string;
};

type QueueDefinition = { id: number; label: string; family: Exclude<ModeFamily, 'unknown'>; ranked?: boolean };
// Public PvP queues supported by this reader. Custom, tutorial, bots, TFT and
// unrecognized queues are deliberately not relabelled as normal/ranked games.
export const queueCatalog: readonly QueueDefinition[] = [
  { id: 420, label: 'Ranked Solo/Duo', family: 'summoners-rift', ranked: true },
  { id: 440, label: 'Ranked Flex', family: 'summoners-rift', ranked: true },
  { id: 400, label: 'Normal Draft', family: 'summoners-rift' },
  { id: 480, label: 'Swiftplay', family: 'summoners-rift' },
  { id: 490, label: 'Quickplay', family: 'summoners-rift' },
  { id: 430, label: 'Normal Blind', family: 'summoners-rift' },
  { id: 700, label: "Summoner's Rift Clash", family: 'summoners-rift' },
  { id: 450, label: 'ARAM', family: 'aram' },
  { id: 2400, label: 'ARAM: Mayhem', family: 'aram' },
  { id: 720, label: 'ARAM Clash', family: 'aram' },
  { id: 1700, label: 'Arena', family: 'arena' },
  { id: 1710, label: 'Arena (16-player lobby)', family: 'arena' },
  { id: 900, label: 'ARURF', family: 'rotating' },
  { id: 1900, label: 'Pick URF', family: 'rotating' },
  { id: 1020, label: 'One for All', family: 'rotating' },
  { id: 1300, label: 'Nexus Blitz', family: 'rotating' },
  { id: 1400, label: 'Ultimate Spellbook', family: 'rotating' },
  { id: 2300, label: 'Brawl', family: 'rotating' },
];
export const queues: Record<number, string> = Object.fromEntries(queueCatalog.map(queue => [queue.id, queue.label]));
export const historyOptions = [
  { value: 'all', label: 'All recent games' },
  ...queueCatalog.map(queue => ({ value: String(queue.id), label: queue.label })),
];

export type HistoryAvailability = Readonly<{
  status: 'private';
  label: string;
  sourceUrl: string;
}>;

// A published queue ID describes the mode, not whether Riot exposes its history.
// Riot marked Mayhem records private on 2025-12-18 (checked 2026-10-28).
// This metadata explains empty imports; it never blocks requests or real records.
const mayhemHistoryAvailability: HistoryAvailability = {
  status: 'private',
  label: 'ARAM: Mayhem',
  sourceUrl: 'https://github.com/RiotGames/developer-relations/issues/1109#issuecomment-3671793822',
};

export function historyAvailabilityForQueue(queue: string): HistoryAvailability | undefined {
  return queue === '2400' ? mayhemHistoryAvailability : undefined;
}

export function isSupportedQueue(queueId: number): boolean {
  return Number.isInteger(queueId) && Object.hasOwn(queues, queueId);
}
export function isSupportedMatchmade(match: Match): boolean {
  return match.info.gameType === 'MATCHED_GAME' && isSupportedQueue(match.info.queueId);
}

export function modeForMatch(match: Match): MatchMode {
  const { queueId, gameMode, mapId } = match.info;
  const queue = queueCatalog.find(candidate => candidate.id === queueId);
  const supported = isSupportedMatchmade(match);
  if (!queue || !supported) return {
    queueId, label: queue?.label ?? `Queue ${queueId}`, family: 'unknown', supported: false,
    ranked: false, roleMetrics: false, visionMetrics: false, standardItems: false, runeSetup: false,
    context: 'This is not a supported public matchmade queue. It is excluded from mode statistics and gameplay advice.',
  };

  // Older stored records may not include mapId. A contradictory map or gameMode
  // must not enable lane metrics simply because the queue number looks familiar.
  const expectedMode = queueId === 480 ? 'SWIFTPLAY' : 'CLASSIC';
  const roleMetrics = queue.family === 'summoners-rift' &&
    (mapId == null || mapId === 11) && gameMode === expectedMode;
  const standardItems = roleMetrics && queueId !== 480;
  let context: string;
  if (queue.family === 'aram') {
    context = queueId === 2400
      ? 'ARAM: Mayhem is a separate augments queue. Augment effects are not reconstructed here, and standard rune settings are not used. Lane roles, Summoner\'s Rift farming/vision benchmarks and standard item alternatives do not apply. Compare this sample only with the same queue.'
      : `${queue.label} uses ARAM rules. Lane roles and Summoner's Rift farming/vision benchmarks do not apply. Recorded combat, inventory and timeline events can be reviewed within this queue; deaths alone do not establish a mistake.`;
  } else if (queue.family === 'arena') {
    context = `${queue.label} has its own round, team and augment rules. The recorded win flag is not inferred placement. Lane, farming, vision and standard Summoner's Rift item advice are withheld; this sample stays separate from other queues.`;
  } else if (queue.family === 'rotating') {
    context = `${queue.label} uses a separate ruleset. Recorded results and events are available; standard lane, farming, vision and item benchmarks are withheld. Only this exact queue belongs in its sample.`;
  } else if (!roleMetrics) {
    context = `${queue.label} was recorded, but its map or game-mode fields do not match the expected context. Lane-based metrics and item advice are withheld.`;
  } else if (queueId === 480) {
    // https://support.riotgames.com/en-us/league-of-legends/gameplay/swiftplay-game-mode
    context = 'Swiftplay uses Summoner\'s Rift with altered progression, objectives and items. Recorded roles and rates describe this Swiftplay sample only; do not compare them with normal draft or ranked benchmarks. Standard item alternatives are withheld.';
  } else {
    context = `${queue.label} is a Summoner's Rift queue. Role-aware rates describe this match and this exact queue, not a skill grade or a benchmark across other modes. Current official rank is a separate record.`;
  }
  return {
    queueId, label: queue.label, family: queue.family, supported, ranked: queue.ranked === true,
    roleMetrics, visionMetrics: roleMetrics, standardItems,
    runeSetup: queue.family === 'summoners-rift' || (queue.family === 'aram' && queueId !== 2400),
    context,
  };
}
