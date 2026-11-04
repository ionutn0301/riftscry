import { describe, it, expect } from 'vitest';
import { homeChampionCounts } from '../../src/lib/home-personalization';
import { buildCinemaCatalogue } from '../../src/lib/home-champions';
import { getChampionMeta } from '../../src/lib/data';
import type { Match } from '../../src/lib/player/contracts';

const game = (id: string, champion: string, time = 1000, queueId = 420): Match => ({
  metadata: { matchId: id }, info: { gameCreation: time, gameDuration: 1200, queueId, gameType: 'MATCHED_GAME', gameMode: 'CLASSIC',
    gameVersion: '16.22.1', participants: [{ puuid: 'owner', championName: champion }] as Match['info']['participants'] },
});
const known = ['Lux', 'Chogath', 'Fiddlesticks', 'Lulu', 'Ashe'];
describe('homepage recent champion selection', () => {
  it('ranks by games across supported queues, deduplicates, and breaks ties by recency', () => {
    const games = [game('1', 'Lux'), game('2', 'Lux', 3000, 450), game('3', 'Chogath', 2000), game('4', 'Chogath'), game('5', 'Lulu'), game('6', 'Ashe', 900)];
    const before = JSON.stringify(games);
    const result = homeChampionCounts([...games, games[0]!], 'owner', known);
    expect(result.champions.map(({ id, games }) => [id, games])).toEqual([['Lux', 2], ['Chogath', 2], ['Lulu', 1]]);
    expect(result.total).toBe(6); expect(result.latest?.metadata.matchId).toBe('2');
    expect(JSON.stringify(games)).toBe(before);
  });
  it('normalizes canonical casing without guessing names and shows only real played champions', () => {
    const result = homeChampionCounts([game('1', 'FiddleSticks'), game('2', 'Fiddlesticks'), game('3', 'Cho’Gath')], 'owner', known);
    expect(result.champions).toEqual([{ id: 'Fiddlesticks', games: 2, lastPlayed: 1000 }]);
    expect(result.total).toBe(2);
  });
  it('excludes another player, unsupported/custom games, unknown champions and invalid records', () => {
    const custom = game('1', 'Lux'); custom.info.gameType = 'CUSTOM_GAME';
    const missing = game('2', 'Lux'); missing.info.participants = [];
    const duration = game('3', 'Lux'); duration.info.gameDuration = NaN;
    const date = game('4', 'Lux'); date.info.gameCreation = 0;
    const result = homeChampionCounts([custom, missing, duration, date, game('5', 'Lux', 1000, 0), game('6', 'Unknown')], 'owner', known);
    expect(result).toEqual({ champions: [], total: 0, latest: null });
  });
});
describe('cinematic artwork and evidence coverage', () => {
  const catalogue = buildCinemaCatalogue();
  it('covers every canonical champion with matching official artwork and native routes', () => {
    expect(catalogue.map(c => c.championId).sort()).toEqual(Object.keys(getChampionMeta()).sort());
    for (const champion of catalogue) {
      expect(champion.world.figure).toBe(`https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champion.championId}_0.jpg`);
      expect(champion.world.kind).toBe('splash');
      expect(champion.explore).toMatch(/^\/(champion|explore)/);
    }
  });
  it('preserves prose evidence and explicit absence instead of inventing numeric changes', () => {
    const prose = catalogue.find(c => c.record?.change.kind === 'prose');
    const empty = catalogue.find(c => !c.record);
    expect(prose).toBeDefined(); expect(empty).toBeDefined();
    expect(prose!.before).toBe(''); expect(prose!.after).toBe('');
    expect(empty!.classification).toBeNull(); expect(empty!.sourceUrl).toBe('');
    expect(empty!.explore).toBe(`/champion/${empty!.championId.toLowerCase()}`);
  });
});
