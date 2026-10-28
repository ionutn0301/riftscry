import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => {
  const values = new Map<string, { value: unknown; expires: number }>();
  const read = (key: string) => {
    const entry = values.get(key);
    if (!entry || entry.expires <= Date.now()) { values.delete(key); return null; }
    return structuredClone(entry.value);
  };
  const get = vi.fn(async (key: string) => read(key));
  const set = vi.fn(async (key: string, value: unknown, options: { nx?: boolean; ex: number }) => {
    if (options.nx && read(key) !== null) return null;
    values.set(key, { value: structuredClone(value), expires: Date.now() + options.ex * 1000 });
    return 'OK';
  });
  const evalScript = vi.fn(async (script: string, keys: string[], args: (string | number)[]) => {
    const key = keys[0]!;
    if (script.includes('cjson.decode')) {
      const previous = read(key) as { revision: string } | null;
      if ((previous?.revision ?? '') !== args[0]) return 0;
      values.set(key, { value: JSON.parse(String(args[1])), expires: Date.now() + Number(args[2]) * 1000 });
      return 1;
    }
    if (read(key) === args[0]) { values.delete(key); return 1; }
    return 0;
  });
  const rateLimit = vi.fn();
  const rateConfig = vi.fn();
  return { values, get, set, evalScript, rateLimit, rateConfig };
});

vi.mock('@upstash/redis', () => ({ Redis: class { get = mock.get; set = mock.set; eval = mock.evalScript; } }));
vi.mock('@upstash/ratelimit', () => ({ Ratelimit: class {
  constructor(config: unknown) { mock.rateConfig(config); }
  static slidingWindow(count: number, window: string) { return { count, window }; }
  limit = mock.rateLimit;
} }));

import { cached, getMatch, getTimeline, getSummoner, hash, limit, MATCH_CACHE_SECONDS, SUMMONER_CACHE_SECONDS, riot, ServiceError } from '../../src/lib/player/server';
import { reserveRiotBudget } from '../../src/lib/player/riot-budget';

const now = 1793200000000;
const host = 'europe';
const path = '/lol/match/v5/matches/EUN1_123456';
const digest = (key: string) => `rs:v1:${hash(key)}`;
const profilePuuid = 'fixture-profile-000000000000000000000';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.clearAllMocks();
  mock.values.clear();
  mock.rateLimit.mockResolvedValue({ success: true, reset: now + 600000 });
  vi.stubEnv('KV_REST_API_URL', 'https://redis.fixture.invalid');
  vi.stubEnv('KV_REST_API_TOKEN', 'fixture-only');
  vi.stubEnv('RIOT_API_KEY', 'fixture-only');
  vi.stubEnv('RIOT_PUBLIC_ACCESS_APPROVED', 'false');
  vi.stubEnv('RIOT_PRIVATE_TESTING_ENABLED', 'true');
  vi.stubEnv('RIOT_PROTECTED_PRODUCTION_ENABLED', 'false');
  vi.stubEnv('VERCEL_ENV', 'preview');
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ value: 'from-riot' }), { status: 200 })));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('shared player cache', () => {
  it('joins concurrent fills, caches success, and retries a failed fill later', async () => {
    let resolve!: (value: { value: number }) => void;
    const fill = vi.fn(() => new Promise<{ value: number }>(done => { resolve = done; }));
    const first = cached('concurrent', 120, fill);
    const second = cached('concurrent', 120, fill);
    await vi.advanceTimersByTimeAsync(0);
    expect(fill).toHaveBeenCalledTimes(1);
    resolve({ value: 7 });
    expect(await Promise.all([first, second])).toEqual([{ value: 7 }, { value: 7 }]);
    expect(await cached('concurrent', 120, fill)).toEqual({ value: 7 });
    expect(fill).toHaveBeenCalledTimes(1);
    const failed = vi.fn().mockRejectedValueOnce(new Error('temporary')).mockResolvedValueOnce('recovered');
    await expect(cached('failed-fill', 120, failed)).rejects.toThrow('temporary');
    expect(await cached('failed-fill', 120, failed)).toBe('recovered');
    expect(failed).toHaveBeenCalledTimes(2);
  });

  it('waits for another worker and reuses its result without an upstream callback', async () => {
    const key = digest('other-worker');
    mock.values.set(`${key}:lock`, { value: 'other-owner', expires: now + 50000 });
    const fill = vi.fn().mockResolvedValue('unnecessary');
    const result = cached('other-worker', 300, fill);
    setTimeout(() => mock.values.set(key, { value: { ready: true }, expires: now + 300000 }), 250);
    await vi.advanceTimersByTimeAsync(400);
    expect(await result).toEqual({ ready: true });
    expect(fill).not.toHaveBeenCalled();
    expect(mock.values.get(`${key}:lock`)?.value).toBe('other-owner');
  });

  it('bounds a missing worker wait without duplicating its upstream work', async () => {
    const key = digest('unfinished-worker');
    mock.values.set(`${key}:lock`, { value: 'other-owner', expires: now + 50000 });
    const fill = vi.fn();
    const assertion = expect(cached('unfinished-worker', 300, fill)).rejects.toMatchObject({ status: 503, retry: 3 });
    await vi.advanceTimersByTimeAsync(26000);
    await assertion;
    expect(fill).not.toHaveBeenCalled();
  });

  it('keeps cache hits available despite caller exhaustion and an active provider cooldown', async () => {
    mock.values.set(digest(`riot:${host}${path}`), { value: { cached: true }, expires: now + 60000 });
    mock.values.set(`rs:riot-cooldown:${host}`, { value: now + 45000, expires: now + 45000 });
    const charge = vi.fn().mockRejectedValue(new ServiceError('budget exhausted', 429, 60));
    expect(await riot(host, path, 300, charge)).toEqual({ cached: true });
    expect(charge).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(mock.values.has(`rs:riot-budget:v2:${hash('fixture-only')}:${host}`)).toBe(false);
  });

  it('does not serve stale history after its two-minute TTL', async () => {
    const history = `${path}/ids`;
    const charge = vi.fn().mockResolvedValue(undefined);
    vi.mocked(fetch).mockResolvedValueOnce(new Response('["old"]')).mockResolvedValueOnce(new Response('["new"]'));
    expect(await riot(host, history, 120, charge)).toEqual(['old']);
    vi.setSystemTime(now + 119000);
    expect(await riot(host, history, 120, charge)).toEqual(['old']);
    vi.setSystemTime(now + 121000);
    expect(await riot(host, history, 120, charge)).toEqual(['new']);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(charge).toHaveBeenCalledTimes(2);
  });

  it('retains completed details and timelines for seven days', async () => {
    const match = { metadata: { matchId: 'EUN1_123456' }, info: { gameType: 'MATCHED_GAME', gameMode: 'CLASSIC', queueId: 420 } };
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(match))).mockResolvedValueOnce(new Response('{"info":{"frames":[]}}'));
    const charge = vi.fn().mockResolvedValue(undefined);
    await getMatch('eun1', 'EUN1_123456', charge);
    await getTimeline('eun1', 'EUN1_123456', charge);
    expect(mock.values.get(digest(`riot:${host}${path}`))?.expires).toBe(now + MATCH_CACHE_SECONDS * 1000);
    expect(mock.values.get(digest(`riot:${host}${path}/timeline`))?.expires).toBe(now + MATCH_CACHE_SECONDS * 1000);
    vi.setSystemTime(now + 2 * 86400000);
    await getMatch('eun1', 'EUN1_123456', charge);
    await getTimeline('eun1', 'EUN1_123456', charge);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(charge).toHaveBeenCalledTimes(2);
  });
});

describe('optional summoner profile', () => {
  it('coalesces icon reads, reuses the five-minute shared cache, and refreshes after expiry', async () => {
    const data = { puuid: profilePuuid, profileIconId: 685, summonerLevel: 340, revisionDate: now, unused: 'not returned' };
    vi.mocked(fetch).mockImplementation(async () => new Response(JSON.stringify(data)));
    const charge = vi.fn().mockResolvedValue(undefined);
    const expected = { puuid: profilePuuid, profileIconId: 685, summonerLevel: 340 };
    expect(await Promise.all([getSummoner('eun1', profilePuuid, charge), getSummoner('eun1', profilePuuid, charge)])).toEqual([expected, expected]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(charge).toHaveBeenCalledTimes(1);
    const key = digest(`riot:eun1/lol/summoner/v4/summoners/by-puuid/${profilePuuid}`);
    expect(mock.values.get(key)?.expires).toBe(now + SUMMONER_CACHE_SECONDS * 1000);
    vi.setSystemTime(now + 299_999);
    expect(await getSummoner('eun1', profilePuuid, charge)).toEqual(expected);
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.setSystemTime(now + 300_001);
    expect(await getSummoner('eun1', profilePuuid, charge)).toEqual(expected);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(charge).toHaveBeenCalledTimes(2);
  });

  it('keeps different platform and player profiles separate', async () => {
    vi.mocked(fetch).mockImplementation(async input => {
      const url = new URL(String(input));
      return new Response(JSON.stringify({ puuid: url.pathname.split('/').at(-1), profileIconId: url.host.startsWith('eun1.') ? 685 : 686, summonerLevel: 25 }));
    });
    expect((await getSummoner('eun1', profilePuuid)).profileIconId).toBe(685);
    expect((await getSummoner('euw1', profilePuuid)).profileIconId).toBe(686);
    expect((await getSummoner('eun1', `${profilePuuid}-other`)).puuid).toBe(`${profilePuuid}-other`);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(String(vi.mocked(fetch).mock.calls[0]![0])).toBe(`https://eun1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${profilePuuid}`);
  });

  it.each([
    null,
    { puuid: `${profilePuuid}-other`, profileIconId: 685 },
    { puuid: profilePuuid, profileIconId: -1 },
    { puuid: profilePuuid, profileIconId: 1.5 },
    { puuid: profilePuuid, profileIconId: '685' },
    { puuid: profilePuuid, profileIconId: 2147483648 },
    { puuid: profilePuuid },
  ])('rejects a mismatched identity or malformed icon payload without exposing it (%j)', async value => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(value)));
    await expect(getSummoner('eun1', profilePuuid)).rejects.toMatchObject({ status: 502, message: 'Player icon is temporarily unavailable.' });
  });

  it.each([undefined, null, -1, 0, '340', 1.5, Number.MAX_SAFE_INTEGER + 1])('retains a valid default icon without inventing an optional level (%s)', async level => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ puuid: profilePuuid, profileIconId: 0, summonerLevel: level })));
    expect(await getSummoner('eun1', profilePuuid)).toEqual({ puuid: profilePuuid, profileIconId: 0 });
  });

  it('does not cache a missing League profile or prevent a separate history request', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response('["EUN1_123456"]'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ puuid: profilePuuid, profileIconId: 685 })));
    await expect(getSummoner('eun1', profilePuuid)).rejects.toMatchObject({ status: 404 });
    expect(await riot('europe', `/lol/match/v5/matches/by-puuid/${profilePuuid}/ids?start=0&count=20`, 120)).toEqual(['EUN1_123456']);
    expect(await getSummoner('eun1', profilePuuid)).toEqual({ puuid: profilePuuid, profileIconId: 685 });
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});

describe('outbound Riot protection', () => {
  it('preserves an older deployment cooldown and never calls Riot before it expires', async () => {
    mock.values.set(`rs:riot-cooldown:${host}`, { value: now + 23000, expires: now + 23000 });
    const charge = vi.fn();
    await expect(riot(host, path, 300, charge)).rejects.toMatchObject({ status: 429, retry: 23 });
    expect(charge).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('persists Retry-After across different misses and never caches the 429 body', async () => {
    const charge = vi.fn().mockResolvedValue(undefined);
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'Retry-After': '42' } }));
    await expect(riot(host, path, 300, charge)).rejects.toMatchObject({ status: 429, retry: 42 });
    await expect(riot(host, `${path}/timeline`, 300, charge)).rejects.toMatchObject({ status: 429, retry: 42 });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(charge).toHaveBeenCalledTimes(1);
    expect(mock.values.has(digest(`riot:${host}${path}`))).toBe(false);
  });

  it('rejects an exhausted shared long window before consuming the caller allowance or fetching', async () => {
    const state = reserveRiotBudget(null, 'match-details', now).state;
    state.application.find(value => value.seconds === 120)!.count = 90;
    mock.values.set(`rs:riot-budget:v2:${hash('fixture-only')}:${host}`, { value: state, expires: now + 86400000 });
    const charge = vi.fn();
    await expect(riot(host, path, 300, charge)).rejects.toMatchObject({ status: 429, retry: 121 });
    expect(charge).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not drain shared Riot counters when the caller allowance denies a cache miss', async () => {
    const charge = vi.fn().mockRejectedValue(new ServiceError('client allowance exhausted', 429, 60));
    for (const suffix of ['1', '2', '3']) {
      await expect(riot(host, `${path}${suffix}`, 300, charge)).rejects.toMatchObject({ status: 429, retry: 60 });
    }
    expect(mock.values.has(`rs:riot-budget:v2:${hash('fixture-only')}:${host}`)).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('retries a competing budget revision without losing its count or charging the client twice', async () => {
    const originalEval = mock.evalScript.getMockImplementation()!;
    mock.evalScript.mockImplementationOnce(async (script, keys, args) => {
      if (!script.includes('cjson.decode')) return originalEval(script, keys, args);
      const competing = JSON.parse(String(args[1]));
      competing.revision = 'another-worker-reserved-first';
      mock.values.set(keys[0]!, { value: competing, expires: now + 86400000 });
      return 0;
    });
    const charge = vi.fn().mockResolvedValue(undefined);
    const result = riot(host, path, 300, charge);
    await vi.advanceTimersByTimeAsync(100);
    expect(await result).toEqual({ value: 'from-riot' });
    expect(charge).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    const state = await mock.get(`rs:riot-budget:v2:${hash('fixture-only')}:${host}`) as { application: { count: number }[] };
    expect(state.application.every(value => value.count === 2)).toBe(true);
  });

  it('charges only the network leader and isolates limits from the old cache-hit counters', async () => {
    const charge = vi.fn(() => limit('fixture-ip'));
    await Promise.all([riot(host, path, 300, charge), riot(host, path, 300, charge)]);
    await riot(host, path, 300, charge);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(charge).toHaveBeenCalledTimes(1);
    expect(mock.rateConfig).toHaveBeenCalledWith(expect.objectContaining({ prefix: 'rs:riot-fill-limit:v2', limiter: { count: 90, window: '10 m' } }));
    await limit('fixture-ip', true);
    expect(mock.rateConfig).toHaveBeenLastCalledWith(expect.objectContaining({ prefix: 'rs:review-fill-limit:v2', limiter: { count: 4, window: '10 m' } }));
  });

  it('denies disabled access before reading even a warm cache', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    await expect(riot(host, path)).rejects.toMatchObject({ status: 503 });
    expect(mock.get).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
