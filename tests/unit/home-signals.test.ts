import { describe, expect, it } from 'vitest';
import { getAllPatches, getChampionMeta } from '../../src/lib/data';
import { buildHomeSignals } from '../../src/lib/home-signals';
import type { Patch } from '../../src/lib/schema';

const patch = (id: string, championId: string, before: string, after: string): Patch => ({
  schemaVersion: 1, id, assetVersion: '16.21.1', releaseDate: '2026-10-20',
  sourceUrl: `https://www.leagueoflegends.com/en-us/news/game-updates/patch-${id}/`, ingestedAt: '2026-10-20T00:00:00Z',
  champions: [{ championId, classification: 'nerf', abilities: [{ ability: 'Q', name: 'Example ability', changes: [{ kind: 'numeric', label: 'Damage', before, after, direction: 'nerf' }] }] }],
  items: [], systems: [],
});

describe('buildHomeSignals', () => {
  it('uses exact values and record links from the committed archive', () => {
    const archive = getAllPatches();
    const signals = buildHomeSignals(archive, getChampionMeta());
    expect(signals).toHaveLength(3);
    expect(new Set(signals.map(signal => signal.championId)).size).toBe(3);
    for (const signal of signals) {
      const source = archive.find(item => item.id === signal.patchId)!;
      const champion = source.champions.find(item => item.championId === signal.championId)!;
      const ability = champion.abilities.find(item => item.ability === signal.ability)!;
      expect(ability.changes).toContainEqual(expect.objectContaining({ kind: 'numeric', label: signal.label, before: signal.before, after: signal.after, direction: signal.direction }));
      expect(signal.classification).toBe(champion.classification);
      expect(signal.href).toBe(`/patch/${source.id}#${signal.championId.toLowerCase()}`);
      expect(signal.sourceUrl).toBe(source.sourceUrl);
    }
  });

  it('fills sparse newest patches with labelled older examples without duplicating champions', () => {
    const archive = [patch('26.9', 'Azir', '30', '20'), patch('26.21', 'Azir', '50', '40'), patch('26.20', 'Darius', '60', '50')];
    const copy = structuredClone(archive);
    const signals = buildHomeSignals(archive, { Azir: { name: 'Azir', title: '' }, Darius: { name: 'Darius', title: '' } });
    expect(signals.map(signal => [signal.championId, signal.patchId, signal.before])).toEqual([['Azir', '26.21', '50'], ['Darius', '26.20', '60']]);
    expect(signals[1]?.href).toBe('/patch/26.20#darius');
    expect(archive).toEqual(copy);
  });

  it('omits unknown champions and unchanged numeric records without inventing examples', () => {
    expect(buildHomeSignals([patch('26.21', 'Unknown', '50', '40')], {})).toEqual([]);
    expect(buildHomeSignals([patch('26.21', '__proto__', '50', '40')], {})).toEqual([]);
    expect(buildHomeSignals([patch('26.21', 'Azir', '50', '50')], { Azir: { name: 'Azir', title: '' } })).toEqual([]);
    expect(buildHomeSignals([patch('26.21', 'Azir', '50 ', '50')], { Azir: { name: 'Azir', title: '' } })).toEqual([]);
    expect(buildHomeSignals([], {})).toEqual([]);
  });
});
