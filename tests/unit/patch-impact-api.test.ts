import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/player/server', () => ({
  limit: vi.fn(), riot: vi.fn(), getMatch: vi.fn(), getTimeline: vi.fn(), getSummoner: vi.fn(),
  ServiceError: class ServiceError extends Error {
    constructor(message: string, public status = 503, public retry = 0, public scope?: 'player' | 'review') { super(message); }
  },
}));
vi.mock('../../src/lib/player/metadata', () => ({ getItemMetadata: vi.fn() }));
vi.mock('../../src/lib/player/review', () => ({ review: vi.fn() }));
vi.mock('../../src/lib/player/impact-service', () => ({ getPersonalPatchImpact: vi.fn() }));

import { ALL } from '../../src/pages/api/player/[action]';
import { getPersonalPatchImpact } from '../../src/lib/player/impact-service';
import { getMatch, getTimeline, getSummoner, limit, riot, ServiceError } from '../../src/lib/player/server';
import { getItemMetadata } from '../../src/lib/player/metadata';
import { review } from '../../src/lib/player/review';
import type { Match, Participant } from '../../src/lib/player/contracts';
import type { PatchImpactReport } from '../../src/lib/player/patch-impact';

const puuid = 'impact-fixture-player-000000000000000000';
const player: Participant = {
  puuid, participantId: 1, teamId: 100, championName: 'Azir', teamPosition: 'MIDDLE', win: true,
  kills: 5, deaths: 2, assists: 4, totalMinionsKilled: 160, neutralMinionsKilled: 0,
  goldEarned: 10000, totalDamageDealtToChampions: 17000, visionScore: 12,
  item0: 1001, item1: 0, item2: 0, item3: 0, item4: 0, item5: 0, item6: 3340,
};
const match: Match = {
  metadata: { matchId: 'EUN1_77101' },
  info: { gameCreation: Date.parse('2026-10-19T18:00:00Z'), gameDuration: 1200, gameVersion: '16.20.1',
    queueId: 420, gameMode: 'CLASSIC', gameType: 'MATCHED_GAME', participants: [player] },
};
const impact: PatchImpactReport = {
  status: 'partial', champion: 'Azir', sourceMatchId: match.metadata.matchId,
  sourcePatch: '26.20', targetPatch: '26.21', sourceVersion: '16.20.1', targetVersion: '16.21.1',
  inventory: [], metrics: [], uncomputedChanges: 1, assumptions: [], sources: [], notice: 'Fixture result with unavailable mechanics.',
};
const params = { platform: 'eun1', puuid, id: match.metadata.matchId };

async function request(values: Record<string, string> = params, method = 'GET') {
  const url = new URL('https://protected-preview.example/api/player/impact');
  Object.entries(values).forEach(([key, value]) => url.searchParams.set(key, value));
  const context = { request: new Request(url, { method }), url, params: { action: 'impact' }, clientAddress: '127.0.0.1' };
  return await ALL(context as unknown as Parameters<typeof ALL>[0]) as Response;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('RIOT_API_KEY', 'test-only-placeholder');
  vi.stubEnv('RIOT_PUBLIC_ACCESS_APPROVED', 'false');
  vi.stubEnv('RIOT_PRIVATE_TESTING_ENABLED', 'true');
  vi.stubEnv('RIOT_PROTECTED_PRODUCTION_ENABLED', 'false');
  vi.stubEnv('VERCEL_ENV', 'preview');
  vi.stubEnv('NODE_ENV', 'production');
  vi.mocked(getMatch).mockResolvedValue(match);
  vi.mocked(getPersonalPatchImpact).mockResolvedValue(impact);
  vi.mocked(limit).mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe('personal patch impact API boundary', () => {
  it('uses the requested player from the verified source match and returns a private calculation', async () => {
    const response = await request({ ...params, champion: 'Jinx', name: 'Untrusted hint', patch: '26.1' });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toEqual(impact);
    expect(getMatch).toHaveBeenCalledExactlyOnceWith('eun1', match.metadata.matchId, expect.any(Function));
    expect(getPersonalPatchImpact).toHaveBeenCalledExactlyOnceWith(match, puuid);
    for (const fn of [getTimeline, getSummoner, getItemMetadata, riot, review, limit]) expect(fn).not.toHaveBeenCalled();
  });

  it.each(['POST', 'PUT', 'DELETE'])('rejects %s before any upstream read or calculation', async method => {
    const response = await request(params, method);
    expect(response.status).toBe(405);
    expect(getMatch).not.toHaveBeenCalled();
    expect(getPersonalPatchImpact).not.toHaveBeenCalled();
    expect(limit).not.toHaveBeenCalled();
  });

  it.each([
    { ...params, platform: 'europe' },
    { ...params, puuid: '../another-player' },
    { ...params, id: '../another-match' },
    { platform: 'eun1', puuid },
  ])('rejects malformed identifiers before source work: %j', async values => {
    const response = await request(values);
    expect(response.status).toBe(400);
    expect(getMatch).not.toHaveBeenCalled();
    expect(getPersonalPatchImpact).not.toHaveBeenCalled();
    expect(limit).not.toHaveBeenCalled();
  });

  it('keeps the existing production player-access gate', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    const response = await request();
    expect(response.status).toBe(503);
    expect(getMatch).not.toHaveBeenCalled();
    expect(getPersonalPatchImpact).not.toHaveBeenCalled();
    expect(limit).not.toHaveBeenCalled();
  });

  it('rejects a player not present in the match before calculating a report', async () => {
    vi.mocked(getMatch).mockResolvedValue({ ...match, info: { ...match.info, participants: [{ ...player, puuid: 'different-player' }] } });
    const response = await request();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Player is not in this match.' });
    expect(getPersonalPatchImpact).not.toHaveBeenCalled();
    expect(getTimeline).not.toHaveBeenCalled();
  });

  it('preserves source-read rate limits and prevents calculation after exhausted admission', async () => {
    vi.mocked(limit).mockRejectedValue(new ServiceError('Fixture source budget exhausted.', 429, 29, 'player'));
    vi.mocked(getMatch).mockImplementation(async (_platform, _id, beforeFetch) => {
      await beforeFetch!();
      return match;
    });
    const response = await request();
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('29');
    expect(response.headers.get('x-ratelimit-scope')).toBe('player');
    expect(getPersonalPatchImpact).not.toHaveBeenCalled();
    expect(getTimeline).not.toHaveBeenCalled();
    expect(limit).toHaveBeenCalledExactlyOnceWith('127.0.0.1');
  });

  it('does not charge another Riot request for a cached source match', async () => {
    vi.mocked(limit).mockRejectedValue(new ServiceError('Fixture budget exhausted.', 429, 29));
    const response = await request();
    expect(response.status).toBe(200);
    expect(getPersonalPatchImpact).toHaveBeenCalledOnce();
    expect(limit).not.toHaveBeenCalled();
  });

  it('returns a recoverable service error without exposing an internal calculation exception', async () => {
    vi.mocked(getPersonalPatchImpact).mockRejectedValue(new Error('Fixture internal mechanics failure with private diagnostics'));
    const response = await request();
    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('5');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(JSON.stringify(await response.json())).not.toContain('private diagnostics');
    expect(review).not.toHaveBeenCalled();
  });
});
