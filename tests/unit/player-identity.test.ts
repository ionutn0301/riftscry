// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { briefingLink, parseRecentPlayer, readRecentPlayer, rememberRecentPlayer, RECENT_PLAYER_KEY, RECENT_PLAYER_EVENT } from '../../src/lib/player/identity';

const player = { platform: 'eun1', puuid: 'fixture-player-000000000000000000000000000000000', name: 'Azir Player#TEST' };
beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('automatic player identity', () => {
  it('accepts routed identities while rejecting inherited platforms, malformed IDs and unsafe names', () => {
    expect(parseRecentPlayer(player)).toEqual(player);
    expect(parseRecentPlayer({ ...player, name: undefined })).toEqual({ ...player, name: '' });
    for (const bad of [{ ...player, platform: '__proto__' }, { ...player, puuid: '../another-player' }, { ...player, name: 'name\nspoof' }, { ...player, name: {} }, [], null]) expect(parseRecentPlayer(bad)).toBeNull();
  });
  it('builds a bounded local briefing URL with validated context and escaped names', () => {
    const url = new URL(briefingLink({ ...player, name: 'Name & more#EUW' }, { queue: '2400', champion: 'Ahri', redirect: 'https://other.invalid' }), 'https://riftscry.invalid');
    expect(url.pathname).toBe('/next-game');
    expect(Object.fromEntries(url.searchParams)).toEqual({ platform: player.platform, puuid: player.puuid, name: 'Name & more#EUW', queue: '2400', champion: 'Ahri' });
    expect(briefingLink({ ...player, puuid: '../invalid' })).toBe('/next-game');
    const invalid = new URL(briefingLink(player, { queue: '999999', champion: '<script>' }), 'https://riftscry.invalid');
    expect(invalid.searchParams.has('queue')).toBe(false);
    expect(invalid.searchParams.has('champion')).toBe(false);
  });
  it('automatically persists a successful selection and gives it priority over the old shortcut', () => {
    localStorage.setItem('riftscry:remembered-player:v1', JSON.stringify({ ...player, name: 'Previous#TEST' }));
    expect(readRecentPlayer()?.name).toBe('Previous#TEST');
    const listener = vi.fn(); window.addEventListener(RECENT_PLAYER_EVENT, listener);
    expect(rememberRecentPlayer(player)).toBe(true);
    expect(readRecentPlayer()).toEqual(player);
    expect(JSON.parse(localStorage.getItem(RECENT_PLAYER_KEY)!)).toEqual(player);
    expect(listener).toHaveBeenCalledOnce(); window.removeEventListener(RECENT_PLAYER_EVENT, listener);
  });
  it('ignores corrupt optional shortcuts and reports storage failure without throwing', () => {
    localStorage.setItem(RECENT_PLAYER_KEY, '{corrupt');
    localStorage.setItem('riftscry:remembered-player:v1', JSON.stringify(player));
    expect(readRecentPlayer()).toEqual(player);
    vi.stubGlobal('localStorage', { getItem: () => { throw new DOMException('blocked', 'SecurityError'); }, setItem: () => { throw new DOMException('full', 'QuotaExceededError'); } });
    expect(readRecentPlayer()).toBeNull();
    expect(rememberRecentPlayer(player)).toBe(false);
    expect(briefingLink(player)).toContain(player.puuid);
  });
});
