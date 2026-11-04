import { describe, expect, it } from 'vitest';
import { BEFORE_ARCHIVE, catchUp } from '../../src/lib/catch-up';
import { validatePatch, type Patch } from '../../src/lib/schema';
import current from '../../src/data/patches/26.22.json';

const patch = (id: string): Patch => ({ schemaVersion: 1, id, assetVersion: '16.1.1', releaseDate: '2026-01-01', sourceUrl: 'https://www.leagueoflegends.com/', ingestedAt: '2026-01-01', champions: [], items: [], systems: [] });
const archive = [patch('26.8'), patch('26.10'), patch('26.9')];
archive[1]!.champions = [{ championId: 'Lux', classification: 'adjustment', abilities: [{ ability: 'Q', name: 'Binding', changes: [{ kind: 'prose', label: 'Change', text: 'Example behavior change.' }] }] }];

describe('returning-player ranges', () => {
  it('sorts numerically, excludes the baseline, and preserves prose alongside source provenance', () => {
    const result = catchUp(archive, 'Lux', '26.8');
    expect(result.selected.map(p => p.id)).toEqual(['26.10', '26.9']);
    expect(result.entries[0]?.change?.abilities[0]?.changes[0]?.kind).toBe('prose');
    expect(result.entries[0]?.patch.sourceUrl).toContain('leagueoflegends.com');
    expect(result.partial).toBe(false);
    expect(archive[0]?.id).toBe('26.8');
  });
  it('does not silently clamp an unknown or future baseline', () => {
    for (const id of ['26.11', '25.9', '', '<script>']) expect(catchUp(archive, 'Lux', id)).toMatchObject({ valid: false, selected: [], entries: [] });
  });
  it('marks pre-archive and missing-patch intervals as partial, and handles latest/empty/no-change states', () => {
    expect(catchUp(archive, 'Lux', BEFORE_ARCHIVE)).toMatchObject({ partial: true, selected: expect.arrayContaining([archive[0]]) });
    expect(catchUp([archive[0]!, archive[1]!], 'Lux', '26.8').partial).toBe(true);
    expect(catchUp(archive, 'Lux', '26.10').selected).toEqual([]);
    expect(catchUp(archive, 'Garen', '26.8').entries).toEqual([]);
    expect(catchUp([], 'Lux', BEFORE_ARCHIVE).latest).toBeUndefined();
  });
  it('includes champion hotfixes even without an ability change and separates wider changes', () => {
    const later = { ...patch('26.9'), hotfixes: [{ date: '2026-01-02', description: 'Targeted fix', championIds: ['Ashe'] }, { date: '2026-01-03', description: 'General fix' }] };
    const result = catchUp([patch('26.8'), later], 'Ashe', '26.8');
    expect(result.entries[0]?.hotfixes).toHaveLength(1);
    expect(result.entries[0]?.change).toBeUndefined();
    expect(result.broader).toHaveLength(1);
  });
});

it('archives 26.22 with its rework and the source paragraphs that bullet-only parsing missed', () => {
  const p = validatePatch(current);
  expect(p.assetVersion).toBe('16.22.1');
  expect(p.champions.find(c => c.championId === 'Mel')?.classification).toBe('rework');
  const labels = p.champions.flatMap(c => c.abilities.flatMap(a => a.changes.map(change => change.label)));
  expect(labels).toContain('Maximum Stack Damage');
  expect(labels).toContain('Maximum Damage Ability Power Ratio');
  expect(p.champions.find(c => c.championId === 'Zaahen')?.abilities[0]?.changes).toEqual([{ kind: 'numeric', label: 'Cooldown', before: '10 / 9 / 8 / 7 / 6s', after: '8 / 7.5 / 7 / 6.5 / 6s', direction: 'buff' }]);
  expect(p.items.find(item => item.name === "Overlord's Bloodmail")?.classification).toBe('adjustment');
});
