import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../src/lib/player/server', () => ({
  limit: vi.fn(), riot: vi.fn(), getMatch: vi.fn(), getTimeline: vi.fn(),
  ServiceError: class ServiceError extends Error { constructor(message: string, public status = 503, public retry = 0) { super(message); } },
}));
vi.mock('../../src/lib/player/metadata', () => ({ getItemMetadata: vi.fn() }));
vi.mock('../../src/lib/player/review', () => ({ review: vi.fn() }));
import { ALL } from '../../src/pages/api/player/[action]';
import { getMatch, getTimeline, limit, riot } from '../../src/lib/player/server';
import { getItemMetadata } from '../../src/lib/player/metadata';
import { review } from '../../src/lib/player/review';
import { fallbackReview, type Match, type Participant } from '../../src/lib/player/contracts';
import type { ItemMetadata } from '../../src/lib/player/advice';

const puuid = 'fixture-player-000000000000000000000';
const player: Participant = { puuid, participantId: 1, teamId: 100, championName: 'Jhin', teamPosition: 'BOTTOM', win: true, kills: 5, deaths: 2, assists: 4, totalMinionsKilled: 160, neutralMinionsKilled: 0, goldEarned: 10000, totalDamageDealtToChampions: 17000, visionScore: 12, item0: 3009, item1: 0, item2: 0, item3: 0, item4: 0, item5: 0, item6: 3340 };
const match: Match = { metadata: { matchId: 'EUN1_123456' }, info: { gameCreation: 1700000000000, gameDuration: 1200, gameVersion: '16.21.1', queueId: 420, gameMode: 'CLASSIC', gameType: 'MATCHED_GAME', participants: [player] } };
const metadata: ItemMetadata = { version: '16.21.1', notice: 'Test fixture.', data: {
  3009: { name: 'Boots of Swiftness', tags: ['Boots'], maps: { 11: true }, from: ['1001'], gold: { total: 1000, purchasable: true }, stats: { FlatMovementSpeedMod: 55 } },
  3047: { name: 'Plated Steelcaps', tags: ['Boots', 'Armor'], maps: { 11: true }, from: ['1001'], gold: { total: 1200, purchasable: true }, stats: { FlatArmorMod: 25, FlatMovementSpeedMod: 45 } },
} };

async function request(action: string, params: Record<string, string> = {}, method = 'GET') {
  const url = new URL(`https://private-preview.example/api/player/${action}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const request = new Request(url, { method, headers: method === 'POST' ? { origin: url.origin } : {} });
  const context: Pick<Parameters<typeof ALL>[0], 'request' | 'url' | 'params' | 'clientAddress'> = {
    request, url, params: { action }, clientAddress: '127.0.0.1',
  };
  // This handler only consumes these fields; Astro supplies the remaining context in production.
  return await ALL(context as unknown as Parameters<typeof ALL>[0]) as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('RIOT_API_KEY', 'test-only-placeholder');
  vi.stubEnv('RIOT_PUBLIC_ACCESS_APPROVED', 'false');
  vi.stubEnv('RIOT_PRIVATE_TESTING_ENABLED', 'true');
  vi.stubEnv('VERCEL_ENV', 'preview');
  vi.stubEnv('NODE_ENV', 'production');
  vi.mocked(getMatch).mockResolvedValue(match);
  vi.mocked(getTimeline).mockResolvedValue({ info: { frames: [] } });
  vi.mocked(getItemMetadata).mockResolvedValue(metadata);
  vi.mocked(review).mockImplementation(async (facts, suggestions) => fallbackReview(facts, undefined, suggestions));
});
afterEach(() => vi.unstubAllEnvs());

describe('player API access and review integration', () => {
  it('denies private production access before Redis, Riot, metadata or AI work', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('NODE_ENV', 'development');
    const result = await request('lookup', { platform: 'eun1', name: 'Test player', tag: 'EUNE' });
    expect(result.status).toBe(503);
    expect(result.headers.get('cache-control')).toBe('private, no-store');
    for (const fn of [limit, riot, getMatch, getTimeline, getItemMetadata, review]) expect(fn).not.toHaveBeenCalled();
  });

  it('rejects an unknown endpoint without parsing a player or doing upstream work', async () => {
    const result = await request('unknown');
    expect(result.status).toBe(404);
    for (const fn of [limit, riot, getMatch, getTimeline, getItemMetadata, review]) expect(fn).not.toHaveBeenCalled();
  });

  it('passes compatible item names and bounded suggestions into a protected review', async () => {
    const result = await request('review', { platform: 'eun1', puuid, id: match.metadata.matchId }, 'POST');
    expect(result.status).toBe(200);
    const body = await result.json();
    expect(body.facts.find((fact: { id: string }) => fact.id === 'inventory').text).toContain('Boots of Swiftness');
    expect(body.suggestions).toEqual(expect.arrayContaining([expect.objectContaining({ targetItem: 3047 })]));
    expect(limit).toHaveBeenCalledWith('127.0.0.1', true);
    expect(review).toHaveBeenCalledTimes(1);
  });

  it('retains the factual review when timeline and item providers are unavailable', async () => {
    vi.mocked(getTimeline).mockRejectedValueOnce(new Error('Timeline unavailable'));
    vi.mocked(getItemMetadata).mockRejectedValueOnce(new Error('Reference unavailable'));
    const result = await request('review', { platform: 'eun1', puuid, id: match.metadata.matchId }, 'POST');
    expect(result.status).toBe(200);
    const body = await result.json();
    expect(body.facts.some((fact: { id: string }) => fact.id === 'result')).toBe(true);
    expect(body.facts.find((fact: { id: string }) => fact.id === 'inventory').text).toContain('item 3009');
    expect(body.suggestions).toEqual([]);
  });
});
