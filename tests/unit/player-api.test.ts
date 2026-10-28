import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../src/lib/player/server', () => ({
  limit: vi.fn(), riot: vi.fn(), getMatch: vi.fn(), getTimeline: vi.fn(),
  ServiceError: class ServiceError extends Error { constructor(message: string, public status = 503, public retry = 0, public scope?: 'player' | 'review') { super(message); } },
}));
vi.mock('../../src/lib/player/metadata', () => ({ getItemMetadata: vi.fn() }));
vi.mock('../../src/lib/player/review', () => ({ review: vi.fn() }));
import { ALL } from '../../src/pages/api/player/[action]';
import { getMatch, getTimeline, limit, riot, ServiceError } from '../../src/lib/player/server';
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
  vi.resetAllMocks();
  vi.stubEnv('RIOT_API_KEY', 'test-only-placeholder');
  vi.stubEnv('RIOT_PUBLIC_ACCESS_APPROVED', 'false');
  vi.stubEnv('RIOT_PRIVATE_TESTING_ENABLED', 'true');
  vi.stubEnv('RIOT_PROTECTED_PRODUCTION_ENABLED', 'false');
  vi.stubEnv('VERCEL_ENV', 'preview');
  vi.stubEnv('NODE_ENV', 'production');
  vi.mocked(limit).mockResolvedValue(undefined);
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

  it('allows account and history reads only after the protected Vercel production opt-in is explicitly enabled', async () => {
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('RIOT_PROTECTED_PRODUCTION_ENABLED', 'true');
    vi.mocked(riot).mockResolvedValueOnce({ puuid, gameName: 'Fixture Player', tagLine: 'TEST' }).mockResolvedValueOnce([match.metadata.matchId]);
    const account = await request('account', { platform: 'eun1', puuid });
    const history = await request('history', { platform: 'eun1', puuid, queue: 'all' });
    expect(account.status).toBe(200);
    expect((await account.json()).puuid).toBe(puuid);
    expect(history.status).toBe(200);
    expect(await history.json()).toEqual([match.metadata.matchId]);
    expect(process.env.RIOT_PUBLIC_ACCESS_APPROVED).toBe('false');
  });

  it('resolves canonical account identity from PUUID rather than trusting a profile name query', async () => {
    vi.mocked(riot).mockResolvedValue({ puuid, gameName: 'Canonical Player', tagLine: 'EUNE' });
    const result = await request('account', { platform: 'eun1', puuid, name: 'Untrusted display hint' });
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ puuid, gameName: 'Canonical Player', tagLine: 'EUNE' });
    expect(riot).toHaveBeenCalledWith('europe', `/riot/account/v1/accounts/by-puuid/${puuid}`, 300, expect.any(Function));
    expect(getMatch).not.toHaveBeenCalled();
  });

  it.each([undefined, '', 'all'])('requests a bounded unfiltered recent history for queue %s', async queue => {
    vi.mocked(riot).mockResolvedValue(['EUN1_123456']);
    const result = await request('history', { platform: 'eun1', puuid, ...(queue == null ? {} : { queue }) });
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual(['EUN1_123456']);
    expect(riot).toHaveBeenCalledWith('europe', `/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=20`, 120, expect.any(Function));
    expect(getMatch).not.toHaveBeenCalled();
    expect(review).not.toHaveBeenCalled();
  });

  it.each(['420', '480', '490', '720', '2400'])('retrieves selected queue %s from Riot rather than filtering a ranked sample', async queue => {
    vi.mocked(riot).mockResolvedValue([]);
    const result = await request('history', { platform: 'eun1', puuid, queue });
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual([]);
    expect(riot).toHaveBeenCalledWith('europe', `/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=20&queue=${queue}`, 120, expect.any(Function));
  });

  it.each(['0', '870', '999999', 'aram', '-450', '4.5e2'])('rejects unsupported or ambiguous queue %s without Riot work', async queue => {
    const result = await request('history', { platform: 'eun1', puuid, queue });
    expect(result.status).toBe(400);
    expect(riot).not.toHaveBeenCalled();
    expect(limit).not.toHaveBeenCalled();
  });

  it('caps recent imports and does not accept client pagination as a way to exceed the bound', async () => {
    vi.stubEnv('RIOT_IMPORT_LIMIT', '100');
    vi.mocked(riot).mockResolvedValue([]);
    const result = await request('history', { platform: 'eun1', puuid, count: '100', start: '20' });
    expect(result.status).toBe(200);
    expect(riot).toHaveBeenCalledWith('europe', `/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=20`, 120, expect.any(Function));
  });

  it('passes compatible item names and bounded suggestions into a protected review', async () => {
    const result = await request('review', { platform: 'eun1', puuid, id: match.metadata.matchId }, 'POST');
    expect(result.status).toBe(200);
    const body = await result.json();
    expect(body.facts.find((fact: { id: string }) => fact.id === 'inventory').text).toContain('Boots of Swiftness');
    expect(body.suggestions).toEqual(expect.arrayContaining([expect.objectContaining({ targetItem: 3047 })]));
    expect(review).toHaveBeenCalledWith(expect.any(Array), expect.any(Array), expect.any(Function));
    // The cached/factual result does not generate another AI response.
    expect(limit).not.toHaveBeenCalled();
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

describe('player API budgets apply to upstream work rather than cached reads', () => {
  it('keeps more than 90 cached match reads available even when the upstream-fill quota is exhausted', async () => {
    vi.mocked(limit).mockRejectedValue(new ServiceError('Fixture upstream-fill quota reached.', 429, 37));
    // The server owns Redis cache behavior. This route-level stub models a
    // successful cache hit, which must not call its beforeFetch callback.
    for (let index = 0; index < 96; index++) {
      const result = await request('match', { platform: 'eun1', puuid, id: match.metadata.matchId });
      expect(result.status).toBe(200);
      expect((await result.json()).metadata.matchId).toBe(match.metadata.matchId);
      expect(result.headers.get('cache-control')).toBe('private, no-store');
    }
    expect(getMatch).toHaveBeenCalledTimes(96);
    expect(limit).not.toHaveBeenCalled();
  });

  it.each(['lookup', 'account', 'history', 'rank', 'match', 'timeline', 'items', 'review'])('does not charge cached %s responses before the server checks its cache', async action => {
    vi.mocked(limit).mockRejectedValue(new ServiceError('Fixture upstream-fill quota reached.', 429, 37));
    vi.mocked(riot).mockResolvedValue([]);
    const result = await request(action, { platform: 'eun1', puuid, id: match.metadata.matchId, name: 'Fixture Player', tag: 'TEST' }, action === 'review' ? 'POST' : 'GET');
    expect(result.status).toBe(200);
    expect(limit).not.toHaveBeenCalled();
  });

  it.each(['lookup', 'account', 'history', 'rank'])('passes an enforced caller budget to an uncached %s request and retains Retry-After', async action => {
    vi.mocked(limit).mockRejectedValue(new ServiceError('Fixture upstream-fill quota reached.', 429, 37, 'player'));
    vi.mocked(riot).mockImplementation(async (_host, _path, _ttl, beforeFetch) => {
      expect(beforeFetch).toEqual(expect.any(Function));
      await beforeFetch!();
      throw new Error('An exhausted budget must stop the upstream request.');
    });
    const result = await request(action, { platform: 'eun1', puuid, name: 'Fixture Player', tag: 'TEST' });
    expect(result.status).toBe(429);
    expect(result.headers.get('retry-after')).toBe('37');
    expect(result.headers.get('x-ratelimit-scope')).toBe('player');
    expect(await result.json()).toEqual({ error: 'Fixture upstream-fill quota reached.' });
    expect(limit).toHaveBeenCalledExactlyOnceWith('127.0.0.1');
  });

  it.each(['match', 'timeline', 'items', 'review'])('protects the uncached summary required by %s before downstream processing', async action => {
    vi.mocked(limit).mockRejectedValue(new ServiceError('Fixture upstream-fill quota reached.', 429, 19));
    vi.mocked(getMatch).mockImplementation(async (_platform, _id, beforeFetch) => {
      expect(beforeFetch).toEqual(expect.any(Function));
      await beforeFetch!();
      return match;
    });
    const result = await request(action, { platform: 'eun1', puuid, id: match.metadata.matchId }, action === 'review' ? 'POST' : 'GET');
    expect(result.status).toBe(429);
    expect(result.headers.get('retry-after')).toBe('19');
    expect(limit).toHaveBeenCalledExactlyOnceWith('127.0.0.1');
    expect(getTimeline).not.toHaveBeenCalled();
    expect(getItemMetadata).not.toHaveBeenCalled();
    expect(review).not.toHaveBeenCalled();
  });

  it('charges a missing timeline separately while preserving a warm match summary', async () => {
    vi.mocked(limit).mockRejectedValue(new ServiceError('Fixture timeline budget reached.', 429, 23));
    vi.mocked(getTimeline).mockImplementation(async (_platform, _id, beforeFetch) => {
      expect(beforeFetch).toEqual(expect.any(Function));
      await beforeFetch!();
      return { info: { frames: [] } };
    });
    const result = await request('timeline', { platform: 'eun1', puuid, id: match.metadata.matchId });
    expect(result.status).toBe(429);
    expect(result.headers.get('retry-after')).toBe('23');
    expect(limit).toHaveBeenCalledExactlyOnceWith('127.0.0.1');
    expect((await request('match', { platform: 'eun1', puuid, id: match.metadata.matchId })).status).toBe(200);
    expect(limit).toHaveBeenCalledTimes(1);
  });

  it('keeps generation on its smaller independent budget after cached evidence is read', async () => {
    vi.mocked(review).mockImplementation(async (facts, suggestions, beforeGenerate) => {
      expect(beforeGenerate).toEqual(expect.any(Function));
      await beforeGenerate!();
      return fallbackReview(facts, undefined, suggestions);
    });
    const result = await request('review', { platform: 'eun1', puuid, id: match.metadata.matchId }, 'POST');
    expect(result.status).toBe(200);
    expect(limit).toHaveBeenCalledExactlyOnceWith('127.0.0.1', true);
  });
});
