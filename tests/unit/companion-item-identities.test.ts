import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import reviewed from '../../src/data/companion-item-identities.json';
import { itemChangeIds } from '../../src/lib/companion-item-identities';
import { patchReview, type RecallPatch } from '../../src/lib/companion';

describe('reviewed companion item identities', () => {
  it('uses explicit numeric archive identities ahead of the reviewed supplement', () => {
    expect(itemChangeIds('26.21', { name: 'Dawncore', itemId: 326621 })).toEqual([326621]);
    expect(itemChangeIds('26.21', { name: 'Dawncore', itemId: -1 })).toEqual([]);
    expect(itemChangeIds('26.21', { name: 'Dawncore', itemId: 1.5 })).toEqual([]);
  });

  it('does not infer adjacent patches, mode variants, aliases or combined headings', () => {
    expect(itemChangeIds('26.21', { name: 'Dawncore' })).toEqual([6621]);
    expect(itemChangeIds('26.20', { name: 'Dawncore' })).toEqual([]);
    expect(itemChangeIds('26.21', { name: 'dawncore' })).toEqual([]);
    expect(itemChangeIds('26.16', { name: 'Sunfire Cape' })).toEqual([]);
    expect(itemChangeIds('26.19', { name: 'World Atlas and Runic Compass' })).toEqual([]);
    expect(itemChangeIds('26.20', { name: 'Hextech Rocketbelt' })).toEqual([]);
    const ids = itemChangeIds('26.21', { name: 'Hubris' });
    expect(ids).toEqual([6697]);
    ids.push(126697);
    expect(itemChangeIds('26.21', { name: 'Hubris' })).toEqual([6697]);
  });

  it('keeps every reviewed heading and catalog version tied to the actual archive source', () => {
    const keys = new Set<string>();
    for (const entry of reviewed.entries) {
      const patch = JSON.parse(readFileSync(new URL(`../../src/data/patches/${entry.patch}.json`, import.meta.url), 'utf8'));
      expect(patch.items.some((item: { name: string }) => item.name === entry.heading)).toBe(true);
      expect(entry.catalogName).toBe(entry.heading);
      expect(entry.assetVersion).toBe(patch.assetVersion);
      expect(entry.sourceUrl).toBe(patch.sourceUrl);
      expect(entry.catalogUrl).toBe(`https://ddragon.leagueoflegends.com/cdn/${patch.assetVersion}/data/en_US/item.json`);
      expect(new URL(entry.sourceImageUrl).origin).toBe('https://ddragon.leagueoflegends.com');
      expect(entry.ids).toHaveLength(1);
      expect(new URL(entry.sourceImageUrl).pathname).toMatch(new RegExp(`/img/item/${entry.ids[0]}\\.png$`));
      expect(keys.has(`${entry.patch}:${entry.heading}`)).toBe(false);
      keys.add(`${entry.patch}:${entry.heading}`);
    }
  });

  it('surfaces a verified item change without a champion change and excludes same-name mode variants', () => {
    const archive: RecallPatch[] = [
      { id: '26.21', version: '16.21.1', date: '2026-10-20', champions: [],
        items: itemChangeIds('26.21', { name: 'Hubris' }).map(id => ({ id, name: 'Hubris' })) },
      { id: '26.20', version: '16.20.1', date: '2026-10-07', champions: [], items: [] },
    ];
    const record = { champion: 'Ahri', patch: '16.20', reviewedPatch: null, items: [{ id: 6697, name: 'Hubris' }] };
    expect(patchReview(record, archive).changes.map(patch => patch.id)).toEqual(['26.21']);
    expect(patchReview({ ...record, items: [{ id: 126697, name: 'Hubris' }] }, archive).changes).toEqual([]);
    expect(patchReview({ ...record, items: [{ id: 226697, name: 'Hubris' }] }, archive).changes).toEqual([]);
  });
});
