// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { itemMetadata, puuid, sourceMatch } from '../player-e2e/fixtures';
import type { Match } from '../../src/lib/player/contracts';

const now = Date.parse('2026-10-28T12:00:00Z');
const params = { platform: 'eun1', puuid, id: sourceMatch.metadata.matchId };
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', ...headers },
});
const freshClient = () => import('../../src/components/player/client');
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
let pageHideListeners: EventListenerOrEventListenerObject[];

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(now);
  sessionStorage.clear();
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fetchMock);
  // A fresh module simulates a fresh document. Remove its lifecycle listeners
  // at teardown so old module instances cannot write into the next test's tab.
  pageHideListeners = [];
  const addListener = window.addEventListener.bind(window);
  vi.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
    if (type === 'pagehide') pageHideListeners.push(listener);
    addListener(type, listener, options);
  });
});

afterEach(() => {
  for (const listener of pageHideListeners) window.removeEventListener('pagehide', listener);
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe('player request reuse and bounded imports', () => {
  it('coalesces simultaneous canonical GETs and reuses the completed summary despite query ordering', async () => {
    const { api, fetcher } = await freshClient();
    let release!: (response: Response) => void;
    fetchMock.mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const first = api('match', params);
    const reordered = api('match', { id: params.id, puuid: params.puuid, platform: params.platform });
    const requests = [fetcher<Match>(first), fetcher<Match>(reordered), fetcher<Match>(first)];
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    release(json(sourceMatch));
    const results = await Promise.all(requests);
    for (const result of results) expect(result).toMatchObject(sourceMatch);
    for (let index = 0; index < 3; index++) expect(await fetcher(reordered)).toMatchObject(sourceMatch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('restores completed details across document reloads without sharing player or server keys', async () => {
    let client = await freshClient();
    fetchMock.mockImplementation(async input => {
      const url = new URL(String(input), location.origin);
      return json({ ...sourceMatch, info: { ...sourceMatch.info,
        participants: sourceMatch.info.participants.map(player => ({ ...player, puuid: url.searchParams.get('puuid') })),
      } });
    });
    const identities = [params, { ...params, puuid: `${puuid}-other` }, { ...params, platform: 'euw1' }];
    for (const identity of identities) {
      const match = await client.fetcher<Match>(client.api('match', identity));
      expect(match.info.participants[0]?.puuid).toBe(identity.puuid);
    }
    expect(fetchMock).toHaveBeenCalledTimes(3);
    window.dispatchEvent(new Event('pagehide'));
    vi.resetModules();
    client = await freshClient();
    for (const identity of identities) {
      const match = await client.fetcher<Match>(client.api('match', identity));
      expect(match.info.participants[0]?.puuid).toBe(identity.puuid);
    }
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('keeps at most four network requests active while draining distinct match imports', async () => {
    const { api, fetcher } = await freshClient();
    let active = 0;
    let peak = 0;
    const releases: (() => void)[] = [];
    fetchMock.mockImplementation(input => {
      active++;
      peak = Math.max(peak, active);
      const id = new URL(String(input), location.origin).searchParams.get('id');
      return new Promise(resolve => releases.push(() => {
        active--;
        resolve(json({ ...sourceMatch, metadata: { matchId: id } }));
      }));
    });
    const pending = Promise.all(Array.from({ length: 9 }, (_, index) => fetcher(api('match', { ...params, id: `EUN1_${30000 + index}` }))));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    let released = 0;
    while (released < 9) {
      const batch = releases.slice(released);
      expect(batch.length).toBeGreaterThan(0);
      released += batch.length;
      batch.forEach(release => release());
      await vi.advanceTimersByTimeAsync(0);
    }
    expect(await pending).toHaveLength(9);
    expect(fetchMock).toHaveBeenCalledTimes(9);
    expect(peak).toBe(4);
    expect(active).toBe(0);
  });

  it('does not retain failed summaries and retries their shared request without refetching successful ones', async () => {
    const { api, fetcher } = await freshClient();
    const warm = api('match', params);
    const failed = api('match', { ...params, id: 'EUN1_30001' });
    fetchMock.mockResolvedValueOnce(json(sourceMatch)).mockResolvedValueOnce(json({ error: 'Fixture detail unavailable.' }, 503))
      .mockResolvedValueOnce(json({ ...sourceMatch, metadata: { matchId: 'EUN1_30001' } }));
    await fetcher(warm);
    const failures = await Promise.allSettled([fetcher(failed), fetcher(failed)]);
    expect(failures.every(result => result.status === 'rejected')).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await fetcher(warm);
    expect(await fetcher<Match>(failed)).toMatchObject({ metadata: { matchId: 'EUN1_30001' } });
    await fetcher(failed);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('refreshes mutable history while reusing version-compatible item metadata across completed matches', async () => {
    const { api, fetcher } = await freshClient();
    fetchMock.mockImplementation(async input => {
      const url = new URL(String(input), location.origin);
      if (url.pathname.endsWith('/history')) return json([params.id]);
      const id = url.searchParams.get('id') ?? params.id;
      const version = id === 'EUN1_30002' ? '16.22.1' : '16.21.1';
      if (url.pathname.endsWith('/items')) return json({ ...itemMetadata, version });
      return json({ ...sourceMatch, metadata: { matchId: id }, info: { ...sourceMatch.info, gameVersion: version } });
    });
    for (const id of [params.id, 'EUN1_30001', 'EUN1_30002']) {
      await fetcher(api('match', { ...params, id }));
      const metadata = await fetcher<typeof itemMetadata>(api('items', { ...params, id }));
      expect(metadata.version).toBe(id === 'EUN1_30002' ? '16.22.1' : '16.21.1');
    }
    const itemRequests = fetchMock.mock.calls.filter(([input]) => new URL(String(input), location.origin).pathname.endsWith('/items'));
    expect(itemRequests).toHaveLength(2);
    const history = api('history', { platform: params.platform, puuid, queue: 'all' });
    await fetcher(history);
    await fetcher(history);
    expect(fetchMock.mock.calls.filter(([input]) => new URL(String(input), location.origin).pathname.endsWith('/history'))).toHaveLength(2);
  });

  it('retains in-memory cache reuse when optional session storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage blocked.'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage full.'); });
    const { api, fetcher } = await freshClient();
    fetchMock.mockResolvedValue(json(sourceMatch));
    const url = api('match', params);
    expect(await fetcher(url)).toMatchObject(sourceMatch);
    expect(() => window.dispatchEvent(new Event('pagehide'))).not.toThrow();
    expect(await fetcher(url)).toMatchObject(sourceMatch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('player Retry-After cooldown', () => {
  it.each([
    ['seconds', '60'],
    ['HTTP date', new Date(now + 60_000).toUTCString()],
  ])('honors a %s Retry-After while keeping cached matches available and retrying only after expiry', async (_label, retryAfter) => {
    const { api, fetcher, getPlayerCooldown, subscribePlayerCooldown } = await freshClient();
    const changed = vi.fn();
    const unsubscribe = subscribePlayerCooldown(changed);
    const warm = api('match', params);
    const history = api('history', { platform: params.platform, puuid, queue: 'all' });
    const cold = api('match', { ...params, id: 'EUN1_30003' });
    fetchMock.mockResolvedValueOnce(json(sourceMatch))
      .mockResolvedValueOnce(json({ error: 'Fixture Riot quota reached.' }, 429, { 'Retry-After': retryAfter }))
      .mockResolvedValueOnce(json({ ...sourceMatch, metadata: { matchId: 'EUN1_30003' } }));
    await fetcher(warm);
    await expect(fetcher(history)).rejects.toMatchObject({ status: 429, retryAt: now + 60_000, scope: 'player' });
    expect(getPlayerCooldown()).toBe(now + 60_000);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(await fetcher(warm)).toMatchObject(sourceMatch);
    await expect(fetcher(cold)).rejects.toMatchObject({ status: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.setSystemTime(now + 59_999);
    await expect(fetcher(cold)).rejects.toMatchObject({ status: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.setSystemTime(now + 60_001);
    expect(await fetcher<Match>(cold)).toMatchObject({ metadata: { matchId: 'EUN1_30003' } });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    unsubscribe();
  });

  it('keeps the smaller AI cooldown separate from reading uncached player records', async () => {
    const { api, fetcher, getPlayerCooldown } = await freshClient();
    const review = api('review', params);
    fetchMock.mockResolvedValueOnce(json({ error: 'Fixture AI allowance reached.' }, 429, {
      'Retry-After': '60', 'X-RateLimit-Scope': 'review',
    })).mockResolvedValueOnce(json(sourceMatch));
    await expect(fetcher(review, { method: 'POST' })).rejects.toMatchObject({ status: 429, scope: 'review' });
    expect(getPlayerCooldown('review')).toBe(now + 60_000);
    expect(getPlayerCooldown('player')).toBe(0);
    expect(await fetcher(api('match', params))).toMatchObject(sourceMatch);
    await expect(fetcher(review, { method: 'POST' })).rejects.toMatchObject({ status: 429, scope: 'review' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('preserves an active cooldown across a document reload instead of immediately retrying', async () => {
    let client = await freshClient();
    const history = client.api('history', { platform: params.platform, puuid, queue: 'all' });
    fetchMock.mockResolvedValueOnce(json({ error: 'Fixture Riot quota reached.' }, 429, { 'Retry-After': '60' }));
    await expect(client.fetcher(history)).rejects.toMatchObject({ status: 429 });
    window.dispatchEvent(new Event('pagehide'));
    vi.resetModules();
    client = await freshClient();
    expect(client.getPlayerCooldown()).toBe(now + 60_000);
    await expect(client.fetcher(history)).rejects.toMatchObject({ status: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
