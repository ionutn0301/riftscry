import { describe, expect, it } from 'vitest';
import { briefingLink } from '../../src/lib/player/identity';
import { playerNavigationContext, playerReturnUrl } from '../../src/lib/player/navigation';
import { matchLink, playerBackLink, playerLink } from '../../src/components/player/client';

const origin = 'https://riftscry.example';
const player = { platform: 'eun1', puuid: 'fixture-player-000000000000000000000000000000000', name: 'Fixture Player#TEST' };
const other = { ...player, puuid: 'other-fixture-player-000000000000000000000000000', name: 'Other Player#TEST' };
const url = (path: string) => new URL(path, origin);

describe('player task continuity', () => {
  it('uses the routed player and exact queue/champion ahead of another remembered identity', () => {
    const path = playerLink(player.platform, player.puuid, { name: player.name, queue: '2400', champion: 'Ahri', view: 'builds' });
    expect(playerNavigationContext(url(path), other)).toEqual({ player, queue: '2400', champion: 'Ahri' });
    expect(playerNavigationContext(url(briefingLink(player, { queue: '450', champion: 'Ahri' })), other))
      .toEqual({ player, queue: '450', champion: 'Ahri' });
  });

  it('returns from a source match to the originating briefing scene and scope without substituting players', () => {
    const back = briefingLink(player, { queue: '2400', champion: 'Ahri' }) + '#loadout';
    const match = url(matchLink('EUN1_12345', player.platform, player.puuid, back));
    expect(playerNavigationContext(match, other)).toEqual({ player, queue: '2400', champion: 'Ahri' });
    expect(playerBackLink(match.searchParams.get('back')!, player.platform, player.puuid)).toBe(back);
    expect(playerReturnUrl(back, player, origin)?.origin).toBe(origin);
  });

  it('preserves canonical and legacy profile filters and their scene through match return', () => {
    const filters = { name: player.name, queue: '450', champion: 'Ahri', result: 'loss', view: 'builds' };
    const canonical = playerLink(player.platform, player.puuid, filters) + '#player-records';
    expect(playerBackLink(canonical, player.platform, player.puuid)).toBe(canonical);
    const legacy = `/players?${new URLSearchParams({ platform: player.platform, puuid: player.puuid, ...filters })}#player-records`;
    expect(playerBackLink(legacy, player.platform, player.puuid)).toBe(canonical);
  });

  it('rejects cross-player, external, nested-match and change-player return destinations', () => {
    const invalid = [
      briefingLink(other, { queue: '450' }),
      playerLink(other.platform, other.puuid),
      briefingLink({ ...player, platform: 'euw1' }),
      `https://elsewhere.example${briefingLink(player)}`,
      `//elsewhere.example${briefingLink(player)}`,
      `/\\elsewhere.example${briefingLink(player)}`,
      matchLink('EUN1_12346', player.platform, player.puuid),
      `${briefingLink(player)}&change=1`,
      `${briefingLink(player)}&puuid=${other.puuid}`,
      '/next-game?platform=eun1',
      '/notebook#loadouts',
    ];
    for (const back of invalid) {
      expect(playerReturnUrl(back, player, origin), back).toBeNull();
      expect(playerBackLink(back, player.platform, player.puuid), back).toBe(playerLink(player.platform, player.puuid));
      const context = playerNavigationContext(url(matchLink('EUN1_12345', player.platform, player.puuid, back)), other);
      expect(context?.player.puuid, back).toBe(player.puuid);
      expect(context?.queue, back).toBe('all');
    }
  });

  it('does not use remembered identity to repair an incomplete explicit player URL or change-player task', () => {
    for (const path of ['/next-game?platform=eun1', '/next-game?change=1', '/players/eun1/invalid', '/matches/EUN1_12345?platform=eun1']) {
      expect(playerNavigationContext(url(path), player), path).toBeNull();
    }
    expect(playerNavigationContext(url(briefingLink(player)), null)?.player).toEqual(player);
  });

  it('bounds scope to supported values and uses recent identity only where the route permits it', () => {
    expect(playerNavigationContext(url(`${briefingLink(player)}&queue=999999&champion=%3Cscript%3E`), other))
      .toEqual({ player, queue: 'all', champion: '' });
    expect(playerNavigationContext(url('/next-game?queue=2400&champion=Ahri'), player))
      .toEqual({ player, queue: '2400', champion: 'Ahri' });
    expect(playerNavigationContext(url('/champion/ahri?queue=450&champion=Ahri'), player))
      .toEqual({ player, queue: 'all', champion: '' });
    expect(playerNavigationContext(url('/'), null)).toBeNull();
  });
});
