import { describe, expect, it } from 'vitest';
import { parseHomeRoster, type HomeRosterSnapshot } from '../../src/lib/home-roster-cache';

const identity = { owner: 'alice', platform: 'euw1', puuid: 'riot-player' };
const now = 100_000_000;
const snapshot: HomeRosterSnapshot = { ...identity, savedAt: now - 1000, total: 10, failed: 0, excluded: 0,
  champions: [{ id: 'Urgot', games: 6, lastPlayed: 100 }, { id: 'Riven', games: 2, lastPlayed: 90 }, { id: 'Malphite', games: 2, lastPlayed: 80 }], latest: 'EUW1_12345' };
const known = ['Urgot', 'Riven', 'Malphite'];
const read = (value: unknown, owner = identity) => parseHomeRoster(JSON.stringify(value), owner, known, now);

describe('the homepage roster hint', () => {
  it('restores only the verified account and associated Riot player', () => {
    expect(read(snapshot)).toEqual(snapshot);
    for (const field of ['owner', 'platform', 'puuid'] as const) expect(read(snapshot, { ...identity, [field]: 'another' })).toBeNull();
  });
  it('expires old or future snapshots and ignores malformed storage', () => {
    expect(read({ ...snapshot, savedAt: now - 86_400_001 })).toBeNull();
    expect(read({ ...snapshot, savedAt: now + 1 })).toBeNull();
    expect(parseHomeRoster('{', identity, known, now)).toBeNull();
    expect(read(null)).toBeNull();
  });
  it('rejects impossible counts, duplicates, unknown champions and injected review URLs', () => {
    for (const change of [
      { total: 21 }, { total: 2 }, { failed: -1 }, { excluded: 11 }, { latest: 'https://example.com' },
      { champions: [] }, { champions: [null] }, { champions: [snapshot.champions[0], snapshot.champions[0]] },
      { champions: [{ ...snapshot.champions[0], id: 'Unknown' }] },
      { champions: [{ ...snapshot.champions[0], games: 1.5 }] },
    ]) expect(read({ ...snapshot, ...change })).toBeNull();
  });
});
