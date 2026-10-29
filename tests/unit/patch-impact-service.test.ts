import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/player/metadata', () => ({ getItemMetadata: vi.fn(), getItemMetadataForVersion: vi.fn() }));
vi.mock('../../src/lib/player/patch-impact', () => ({ buildPersonalPatchImpact: vi.fn() }));

import { getPersonalPatchImpact } from '../../src/lib/player/impact-service';
import { getItemMetadata, getItemMetadataForVersion } from '../../src/lib/player/metadata';
import { buildPersonalPatchImpact } from '../../src/lib/player/patch-impact';
import { impactArchive } from '../../src/lib/impact-archive';
import type { Match, Participant } from '../../src/lib/player/contracts';
import type { ItemMetadata } from '../../src/lib/player/advice';
import type { PatchImpactReport } from '../../src/lib/player/patch-impact';

const puuid = 'impact-reference-player-000000000000000000';
const player: Participant = {
  puuid, participantId: 1, championName: 'Azir', teamPosition: 'MIDDLE', win: true,
  kills: 5, deaths: 2, assists: 4, totalMinionsKilled: 160, neutralMinionsKilled: 0,
  goldEarned: 10000, totalDamageDealtToChampions: 17000, visionScore: 12,
  item0: 1001, item1: 0, item2: 0, item3: 0, item4: 0, item5: 0, item6: 3340,
};
const latest = impactArchive[0]!;
const previous = impactArchive[1]!;
const match: Match = {
  metadata: { matchId: 'EUN1_77201' },
  info: { gameCreation: Date.parse('2026-10-19T18:00:00Z'), gameDuration: 1200, gameVersion: previous.version,
    queueId: 420, gameMode: 'CLASSIC', gameType: 'MATCHED_GAME', mapId: 11, participants: [player] },
};
const before: ItemMetadata = { version: previous.version, notice: 'Fixture source reference.', data: { 1001: { name: 'Fixture boots', gold: { total: 300, purchasable: true } } } };
const after: ItemMetadata = { version: latest.version, notice: 'Fixture target reference.', data: { 1001: { name: 'Fixture boots', gold: { total: 350, purchasable: true } } } };
const result: PatchImpactReport = {
  status: 'partial', champion: 'Azir', sourceMatchId: match.metadata.matchId,
  sourcePatch: previous.id, targetPatch: latest.id, sourceVersion: previous.version, targetVersion: latest.version,
  inventory: [], metrics: [], uncomputedChanges: 1, assumptions: [], sources: [], notice: 'Fixture calculation result.',
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getItemMetadata).mockResolvedValue(before);
  vi.mocked(getItemMetadataForVersion).mockImplementation(async version => version === previous.version ? before : after);
  vi.mocked(buildPersonalPatchImpact).mockReturnValue(result);
});

describe('personal impact reference orchestration', () => {
  it('compares the source match reference with the exact latest archived version', async () => {
    expect(await getPersonalPatchImpact(match, puuid)).toBe(result);
    expect(getItemMetadata).not.toHaveBeenCalled();
    expect(getItemMetadataForVersion).toHaveBeenCalledTimes(2);
    expect(getItemMetadataForVersion).toHaveBeenNthCalledWith(1, previous.version);
    expect(getItemMetadataForVersion).toHaveBeenNthCalledWith(2, latest.version);
    expect(buildPersonalPatchImpact).toHaveBeenCalledExactlyOnceWith(match, puuid, impactArchive, before, after);
  });

  it('uses the archive asset version when the recorded game contains a different build suffix', async () => {
    const source = { ...match, info: { ...match.info, gameVersion: `${previous.version.split('.').slice(0, 2).join('.')}.321.9999` } };
    expect(await getPersonalPatchImpact(source, puuid)).toBe(result);
    expect(getItemMetadata).not.toHaveBeenCalled();
    expect(getItemMetadataForVersion).toHaveBeenNthCalledWith(1, previous.version);
    expect(getItemMetadataForVersion).toHaveBeenNthCalledWith(2, latest.version);
    expect(buildPersonalPatchImpact).toHaveBeenCalledExactlyOnceWith(source, puuid, impactArchive, before, after);
  });

  it('retains the source reference when the new reference is unavailable', async () => {
    vi.mocked(getItemMetadataForVersion).mockImplementation(async version => {
      if (version === latest.version) throw new Error('Fixture new reference unavailable.');
      return before;
    });
    expect(await getPersonalPatchImpact(match, puuid)).toBe(result);
    expect(buildPersonalPatchImpact).toHaveBeenCalledExactlyOnceWith(match, puuid, impactArchive, before, undefined);
  });

  it('does not substitute live values when the old reference is unavailable', async () => {
    vi.mocked(getItemMetadataForVersion).mockImplementation(async version => {
      if (version === previous.version) throw new Error('Fixture source reference unavailable.');
      return after;
    });
    expect(await getPersonalPatchImpact(match, puuid)).toBe(result);
    expect(buildPersonalPatchImpact).toHaveBeenCalledExactlyOnceWith(match, puuid, impactArchive, undefined, after);
  });

  it('keeps champion-only calculations available when both item references fail', async () => {
    vi.mocked(getItemMetadataForVersion).mockRejectedValue(new Error('Fixture new reference unavailable.'));
    expect(await getPersonalPatchImpact(match, puuid)).toBe(result);
    expect(buildPersonalPatchImpact).toHaveBeenCalledExactlyOnceWith(match, puuid, impactArchive, undefined, undefined);
  });

  it.each([
    { name: 'current archived patch', info: { ...match.info, gameVersion: latest.version } },
    { name: 'unknown source patch', info: { ...match.info, gameVersion: '1.1.1' } },
    { name: 'unsupported item rules', info: { ...match.info, queueId: 2400, gameMode: 'ARAM', mapId: 12 } },
  ])('avoids item reference requests for $name', async ({ info }) => {
    const source = { ...match, info };
    expect(await getPersonalPatchImpact(source, puuid)).toBe(result);
    expect(getItemMetadata).not.toHaveBeenCalled();
    expect(getItemMetadataForVersion).not.toHaveBeenCalled();
    expect(buildPersonalPatchImpact).toHaveBeenCalledExactlyOnceWith(source, puuid, impactArchive);
  });
});
