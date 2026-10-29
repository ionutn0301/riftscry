import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../src/lib/player/server', () => ({
  cached: vi.fn((_key, _ttl, fn) => fn()),
  ServiceError: class ServiceError extends Error { constructor(message: string, public status = 503) { super(message); } },
}));
import { cached } from '../../src/lib/player/server';
import { getItemMetadata, getItemMetadataForVersion } from '../../src/lib/player/metadata';
import type { Match } from '../../src/lib/player/contracts';

const match = (gameVersion: string) => ({ info: { gameVersion } }) as Match;
const fetchMock = vi.fn<typeof fetch>();
const items = { '3009': { name: 'Boots of Swiftness', stats: { FlatMovementSpeedMod: 55 } } };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
beforeEach(() => { vi.clearAllMocks(); fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => vi.unstubAllGlobals());

describe('patch-compatible item metadata', () => {
  it('loads the matching patch version without using a newer live patch', async () => {
    fetchMock.mockImplementation(async input => {
      const url = String(input);
      if (url.endsWith('/api/versions.json')) return response(['16.22.1', '16.21.2', '16.21.1']);
      if (url.endsWith('/16.21.2/data/en_US/item.json')) return response({ data: items });
      if (url.endsWith('/16.21.2/data/en_US/runesReforged.json')) return response([{ slots: [{ runes: [{ id: 8005, name: 'Press the Attack', icon: 'perk-images/Styles/Precision/PressTheAttack/PressTheAttack.png' }] }] }]);
      throw new Error(`Unexpected reference request: ${url}`);
    });
    const result = await getItemMetadata(match('16.21.999.1'));
    expect(result.version).toBe('16.21.2');
    expect(result.data).toEqual(items);
    expect(result.runes?.[8005]?.name).toBe('Press the Attack');
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/cdn/16.22'))).toBe(false);
  });

  it('returns identifiers-only metadata when no historical version matches', async () => {
    fetchMock.mockResolvedValue(response(['16.22.1', '16.20.1', null, '16.21.invalid']));
    const result = await getItemMetadata(match('16.21.1'));
    expect(result).toMatchObject({ version: null, data: {} });
    expect(result.notice).toContain('No compatible historical');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('declines a malformed recorded patch before cache or provider work', async () => {
    const result = await getItemMetadata(match('invalid-version'));
    expect(result).toMatchObject({ version: null, data: {} });
    expect(cached).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('preserves valid item details when the rune request fails', async () => {
    fetchMock.mockImplementation(async input => {
      const url = String(input);
      if (url.endsWith('/api/versions.json')) return response(['16.21.1']);
      if (url.endsWith('/item.json')) return response({ data: items });
      return response({ error: 'Temporary rune outage' }, 503);
    });
    const result = await getItemMetadata(match('16.21.1'));
    expect(result.data).toEqual(items);
    expect(result.runes).toEqual({});
    expect(result.notice).toContain('Rune details are temporarily unavailable');
  });
});

describe('exact archived references for personal patch impact', () => {
  it('fetches only the pinned item version without a live-version lookup or rune request', async () => {
    const url = 'https://ddragon.leagueoflegends.com/cdn/16.20.1/data/en_US/item.json';
    fetchMock.mockImplementation(async input => {
      if (String(input) !== url) throw new Error('An exact comparison must not fetch a substitute reference.');
      return response({ data: items });
    });
    const result = await getItemMetadataForVersion('16.20.1');
    expect(result).toMatchObject({ version: '16.20.1', data: items });
    expect(result.runes).toBeUndefined();
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([url]);
    expect(cached).toHaveBeenCalledWith('impact-items-v1:16.20.1', 86400, expect.any(Function));
  });

  it('returns an unknown reference for malformed or non-exact versions before any fetch', async () => {
    for (const version of ['16.20', 'latest', '16.20.1.999', '../16.20.1', '16.20.1?version=16.21.1']) {
      expect(await getItemMetadataForVersion(version)).toMatchObject({ version: null, data: {} });
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cached).not.toHaveBeenCalled();
  });

  it('rejects unavailable or malformed exact references without falling forward to live data', async () => {
    const failures = [
      response({ error: 'Missing historical reference' }, 404),
      response({ error: 'Temporary outage' }, 503),
      response({}), response({ data: null }), response({ data: [] }),
      new Response('{invalid JSON', { status: 200 }),
    ];
    for (const failure of failures) {
      fetchMock.mockResolvedValueOnce(failure);
      await expect(getItemMetadataForVersion('16.20.1')).rejects.toThrow();
    }
    expect(fetchMock.mock.calls.map(([input]) => String(input)))
      .toEqual(Array(failures.length).fill('https://ddragon.leagueoflegends.com/cdn/16.20.1/data/en_US/item.json'));
  });
});
