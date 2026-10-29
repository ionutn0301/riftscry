import reference from '../data/impact-example.json';
import { impactArchive } from './impact-archive';
import { buildPersonalPatchImpact } from './player/patch-impact';
import type { Match } from './player/contracts';

// A transparent, frozen reference scenario. This never represents a visitor,
// runs a player lookup, or pretends to be one of their imported matches.
const exampleId = 'homepage-reference-scenario';
const exampleMatch: Match = {
  metadata: { matchId: exampleId },
  info: {
    gameCreation: Date.parse('2026-10-15T12:00:00Z'), gameDuration: 1200,
    gameVersion: reference.before.version, queueId: 420, gameMode: 'CLASSIC', gameType: 'MATCHED_GAME', mapId: 11,
    participants: [{
      puuid: exampleId, participantId: 1, championName: reference.champion, teamPosition: 'MIDDLE',
      win: false, kills: 0, deaths: 0, assists: 0, totalMinionsKilled: 0, neutralMinionsKilled: 0,
      goldEarned: 0, totalDamageDealtToChampions: 0, visionScore: 0,
      item0: reference.itemIds[0]!, item1: reference.itemIds[1]!, item2: 0, item3: 0, item4: 0, item5: 0, item6: 0,
    }],
  },
};
const interval = impactArchive.filter(patch => [reference.beforePatch, reference.afterPatch].includes(patch.id));
export const homeImpactExample = {
  champion: reference.champion,
  beforePatch: reference.beforePatch,
  afterPatch: reference.afterPatch,
  itemIds: reference.itemIds,
  report: buildPersonalPatchImpact(exampleMatch, exampleId, interval, reference.before, reference.after),
};
