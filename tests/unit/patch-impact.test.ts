import { describe, expect, it } from 'vitest';
import { buildPersonalPatchImpact, listedItemHaste, type ImpactPatch, type ImpactChange } from '../../src/lib/player/patch-impact';
import type { ItemMetadata, ItemRecord } from '../../src/lib/player/advice';
import type { Match, Participant } from '../../src/lib/player/contracts';

const puuid = 'impact-player';
const player: Participant = {
  puuid, participantId: 1, teamId: 100, championName: 'Orianna', teamPosition: 'MIDDLE', win: true,
  kills: 4, deaths: 2, assists: 7, totalMinionsKilled: 150, neutralMinionsKilled: 10, goldEarned: 12000,
  totalDamageDealtToChampions: 18000, visionScore: 15,
  item0: 3152, item1: 4628, item2: 0, item3: 0, item4: 0, item5: 0, item6: 3340,
};
function game(changes: Partial<Participant> = {}, info: Partial<Match['info']> = {}): Match {
  return { metadata: { matchId: 'EUN1_123456' }, info: {
    gameCreation: Date.UTC(2026, 9, 12), gameDuration: 1500, gameVersion: '16.20.123.456',
    queueId: 420, gameMode: 'CLASSIC', gameType: 'MATCHED_GAME', mapId: 11,
    participants: [{ ...player, ...changes }], ...info,
  } };
}
function patch(id: string, records: ImpactChange[] = []): ImpactPatch {
  return { id, version: `${Number(id.split('.')[0]) - 10}.${id.split('.')[1]}.1`, date: '2026-10-20',
    sourceUrl: `https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-${id.replace('.', '-')}-notes/`,
    champions: [...new Set(records.filter(record => record.kind === 'champion').map(record => record.targetId))], records };
}
const orianna: ImpactChange = { kind: 'champion', targetId: 'Orianna', ability: 'Q', abilityName: 'Command: Attack', label: 'Damage',
  before: '60 / 90 / 120 / 150 / 180 (+55% AP)', after: '60 / 90 / 120 / 150 / 180 (+60% AP)' };
const darius: ImpactChange = { kind: 'champion', targetId: 'Darius', ability: 'Q', abilityName: 'Decimate', label: 'Cooldown',
  before: '9 / 8 / 7 / 6 / 5s', after: '9 / 8 / 7 / 6 / 4s' };
const archive = [patch('26.21', [orianna]), patch('26.20')];
function item(name: string, ap: number, haste: number, gold: number, changes: Partial<ItemRecord> = {}): ItemRecord {
  return { name, stats: { FlatMagicDamageMod: ap }, maps: { '11': true },
    description: `<mainText><stats><attention>${ap}</attention> Ability Power<br><attention>${haste}</attention> Ability Haste</stats></mainText>`,
    gold: { total: gold, purchasable: true }, ...changes };
}
function metadata(version: string, data?: Record<string, ItemRecord>): ItemMetadata {
  return { version, data: data ?? {
    3152: item('Hextech Rocketbelt', 60, 10, 2650),
    4628: item('Horizon Focus', 75, 25, 2700),
  }, notice: 'Versioned reference fixture.' };
}
const before = () => metadata('16.20.1');
const after = () => metadata('16.21.1');

describe('personal patch impact, versioned item components', () => {
  it('uses the exact imported champion and inventory to calculate AP contribution without claiming total damage', () => {
    const source = game(), a = before(), b = after();
    const original = JSON.stringify({ source, a, b, archive });
    const report = buildPersonalPatchImpact(source, puuid, archive, a, b);
    expect(report).toMatchObject({ status: 'ready', sourcePatch: '26.20', targetPatch: '26.21',
      sourceVersion: '16.20.1', targetVersion: '16.21.1', sourceMatchId: source.metadata.matchId, uncomputedChanges: 0 });
    expect(report.metrics).toHaveLength(1);
    expect(report.metrics[0]).toMatchObject({ kind: 'damage', before: 74.25, after: 81, delta: 6.75, percent: 9.090909 });
    expect(report.metrics[0]!.label).toContain('damage from listed item AP');
    expect(report.metrics[0]!.assumptions.join(' ')).toContain('Base damage');
    expect(report.metrics[0]!.assumptions.join(' ')).toContain('passives');
    expect(report.metrics[0]!.sources.map(source => source.url)).toContain(archive[0]!.sourceUrl);
    expect(report.sources.map(source => source.url)).toContain('https://ddragon.leagueoflegends.com/cdn/16.20.1/data/en_US/item.json');
    expect(report.inventory.map(record => record.id)).toEqual([3152, 4628]);
    expect(JSON.stringify({ source, a, b, archive })).toBe(original);
  });

  it('compares listed stats and total shop prices with quantities, excluding the trinket slot', () => {
    const a = before(), b = after();
    b.data[3152]!.gold!.total = 2750;
    b.data[3152]!.stats!.FlatMagicDamageMod = 70;
    const report = buildPersonalPatchImpact(game({ item2: 3152 }), puuid, archive, a, b);
    expect(report.inventory).toContainEqual({ id: 3152, name: 'Hextech Rocketbelt', quantity: 2 });
    expect(report.metrics.find(metric => metric.kind === 'cost')).toMatchObject({ before: 8000, after: 8200, delta: 200 });
    expect(report.metrics.find(metric => metric.id === 'inventory-FlatMagicDamageMod')).toMatchObject({ before: 195, after: 215, delta: 20 });
    expect(report.metrics.find(metric => metric.id.startsWith('champion-ap'))).toMatchObject({ before: 107.25, after: 129, delta: 21.75 });
    expect(report.metrics.find(metric => metric.kind === 'cost')!.assumptions.join(' ')).toContain('not gold you spent');
  });

  it('never turns an unavailable item or endpoint into zero-valued stats, price, or AP contribution', () => {
    const b = after(); delete b.data[4628];
    const report = buildPersonalPatchImpact(game(), puuid, archive, before(), b);
    expect(report.status).toBe('partial');
    expect(report.metrics).toEqual([]);
    expect(report.uncomputedChanges).toBe(1);
    expect(report.notice).toContain('does not mean');
    expect(buildPersonalPatchImpact(game(), puuid, archive, metadata('16.19.1'), after()).metrics).toEqual([]);
    expect(buildPersonalPatchImpact(game(), puuid, archive, before(), metadata('16.21.2')).metrics).toEqual([]);
    expect(buildPersonalPatchImpact(game({ item2: Number.NaN }), puuid, archive, before(), after()).metrics).toEqual([]);
  });

  it('retains listed AP but withholds total shop cost for transformed, unpurchasable items', () => {
    const a = before(), b = after();
    a.data[3040] = item('Seraph’s Embrace', 70, 25, 2900, { inStore: false, gold: { total: 2900, purchasable: false } });
    b.data[3040] = item('Seraph’s Embrace', 70, 25, 3000, { inStore: false, gold: { total: 3000, purchasable: false } });
    const report = buildPersonalPatchImpact(game({ item2: 3040 }), puuid, archive, a, b);
    expect(report.status).toBe('partial');
    expect(report.metrics.some(metric => metric.kind === 'cost')).toBe(false);
    expect(report.metrics.find(metric => metric.kind === 'damage')).toMatchObject({ before: 112.75, after: 123 });
  });

  it('does not silently apply Deathcap or other item passives as flat AP', () => {
    const a = before(), b = after();
    for (const data of [a.data, b.data]) data[3089] = item('Rabadon’s Deathcap', 130, 0, 3500, {
      description: '<stats><attention>130</attention> Ability Power</stats><passive>Increases total Ability Power by 30%.</passive>',
    });
    const report = buildPersonalPatchImpact(game({ item0: 3089, item1: 0 }), puuid, archive, a, b);
    expect(report.metrics[0]).toMatchObject({ before: 71.5, after: 78, delta: 6.5 });
    expect(report.metrics[0]!.assumptions.join(' ')).toContain('multipliers');
  });

  it('distinguishes missing stat fields from an explicitly sparse complete stats map', () => {
    const a = before(), b = after();
    delete b.data[4628]!.stats;
    expect(buildPersonalPatchImpact(game(), puuid, archive, a, b).metrics).toEqual([]);
    b.data[4628]!.stats = { FlatMagicDamageMod: Number.NaN };
    expect(buildPersonalPatchImpact(game(), puuid, archive, a, b).metrics).toEqual([]);
    b.data[4628]!.stats = {};
    expect(buildPersonalPatchImpact(game(), puuid, archive, a, b).metrics.some(metric => metric.kind === 'damage')).toBe(true);
  });
});

describe('strict listed haste extraction and cooldown scenarios', () => {
  it('parses only a complete listed stats block, including an explicit absence of haste', () => {
    expect(listedItemHaste(item('Known', 0, 20, 1000))).toBe(20);
    expect(listedItemHaste({ name: 'Boots', description: '<stats><attention>25</attention> Move Speed</stats><passive>Gain 20 Ability Haste</passive>' })).toBe(0);
    expect(listedItemHaste({ name: 'Unknown' })).toBeNull();
    expect(listedItemHaste({ name: 'Unknown', description: '<stats><attention></attention> Ability Haste</stats>' })).toBeNull();
    expect(listedItemHaste({ name: 'Unknown', description: '<stats>20 Ability Haste</stats>' })).toBeNull();
    expect(listedItemHaste({ name: 'Unknown', description: '<stats><attention>20%</attention> Ability Haste</stats>' })).toBeNull();
    expect(listedItemHaste({ name: 'Unknown', description: '<stats><attention>20</attention> Ability Haste<br><attention>10</attention> Ultimate Haste</stats>' })).toBeNull();
  });

  it('calculates cooldowns at listed item haste and shows only independently reconciled Darius rank5', () => {
    const report = buildPersonalPatchImpact(game({ championName: 'Darius' }), puuid, [patch('26.21', [darius]), patch('26.20')], before(), after());
    expect(report.status).toBe('partial');
    expect(report.metrics[0]).toMatchObject({ kind: 'cooldown', before: 3.703704, after: 2.962963, delta: -0.740741 });
    expect(report.metrics[0]!.ranks).toEqual([{ rank: 5, before: 3.703704, after: 2.962963 }]);
    expect(report.metrics[0]!.assumptions.join(' ')).toContain('disagree');
    expect(report.metrics[0]!.label).toContain('rank 5');
    expect(report.metrics[0]!.sources.some(source => source.url.endsWith('/champion/Darius.json'))).toBe(true);
  });

  it('labels a fallback as base cooldown when item haste is unknown', () => {
    const a = before(); delete a.data[3152]!.description;
    const report = buildPersonalPatchImpact(game({ championName: 'Darius' }), puuid, [patch('26.21', [darius]), patch('26.20')], a, after());
    expect(report.status).toBe('partial');
    expect(report.metrics[0]).toMatchObject({ before: 5, after: 4 });
    expect(report.metrics[0]!.label).toContain('base cooldown');
    expect(report.metrics[0]!.formula).not.toContain('haste');
  });

  it('preserves rank-specific changes when the highest rank did not change', () => {
    const change: ImpactChange = { kind: 'champion', targetId: 'Mordekaiser', ability: 'R', abilityName: 'Realm of Death', label: 'Cooldown', before: '140 / 120 / 100s', after: '120 / 110 / 100s' };
    const report = buildPersonalPatchImpact(game({ championName: 'Mordekaiser' }, { gameVersion: '16.19.1' }), puuid,
      [patch('26.21'), patch('26.20', [change]), patch('26.19')], metadata('16.19.1'), after());
    expect(report.metrics[0]!.label).toContain('rank 1');
    expect(report.metrics[0]!.ranks).toHaveLength(3);
    expect(report.metrics[0]!.ranks![2]!.before).toBe(report.metrics[0]!.ranks![2]!.after);
  });
});

describe('temporal composition and coverage', () => {
  it('composes consecutive compatible changes rather than summing percentages', () => {
    const change20 = { ...orianna, before: orianna.before.replace('55%', '50%'), after: orianna.before };
    const report = buildPersonalPatchImpact(game({}, { gameVersion: '16.19.1' }), puuid,
      [patch('26.21', [orianna]), patch('26.19'), patch('26.20', [change20])], metadata('16.19.1'), after());
    expect(report.status).toBe('ready');
    expect(report.metrics[0]).toMatchObject({ before: 67.5, after: 81, delta: 13.5, percent: 20 });
    expect(report.metrics[0]!.sources.filter(source => source.label.startsWith('Riot patch'))).toHaveLength(2);
  });

  it('handles a full reversion without pretending that changed source lines imply a net gain', () => {
    const reversion = { ...orianna, before: orianna.after, after: orianna.before };
    const report = buildPersonalPatchImpact(game({}, { gameVersion: '16.19.1' }), puuid,
      [patch('26.21', [reversion]), patch('26.20', [orianna]), patch('26.19')], metadata('16.19.1'), after());
    expect(report.status).toBe('unchanged');
    expect(report.uncomputedChanges).toBe(0);
    expect(report.metrics).toEqual([]);
  });

  it('withholds ability calculations across missing patches, conflicting chains, prose changes, and reworks', () => {
    const source = game({}, { gameVersion: '16.19.1' });
    const badChain = { ...orianna, before: orianna.before.replace('55%', '40%') };
    for (const patches of [
      [patch('26.21', [orianna]), patch('26.19')],
      [patch('26.21', [badChain]), patch('26.20', [orianna]), patch('26.19')],
      [{ ...patch('26.21', [orianna]), blockers: [{ kind: 'champion' as const, targetId: 'Orianna', ability: 'Q', label: 'Recast behavior' }] }, patch('26.20'), patch('26.19')],
      [{ ...patch('26.21', [orianna]), reworkedChampions: ['Orianna'] }, patch('26.20'), patch('26.19')],
    ]) {
      const report = buildPersonalPatchImpact(source, puuid, patches, metadata('16.19.1'), after());
      expect(report.status).toBe('partial');
      expect(report.metrics).toEqual([]);
      expect(report.uncomputedChanges).toBeGreaterThan(0);
    }
  });

  it('fails closed for unknown formulas, conditional item effects, and unreviewed champions', () => {
    const unknown = { ...orianna, after: '60 / 90 / 120 / 150 / 180 (+60% AP) (+3% bonus mana)' };
    expect(buildPersonalPatchImpact(game(), puuid, [patch('26.21', [unknown]), patch('26.20')], before(), after()).metrics).toEqual([]);
    const unfamiliar = { ...orianna, targetId: 'Locke' };
    expect(buildPersonalPatchImpact(game({ championName: 'Locke' }), puuid, [patch('26.21', [unfamiliar]), patch('26.20')], before(), after()).metrics).toEqual([]);
    const passive: ImpactChange = { kind: 'item', targetId: '3152', label: 'Ability Power per 100% Base Mana Regeneration', before: '10', after: '15' };
    const report = buildPersonalPatchImpact(game(), puuid, [patch('26.21', [passive]), patch('26.20')], before(), after());
    expect(report.uncomputedChanges).toBe(1); expect(report.status).toBe('partial');
  });

  it('does not carry a stale mechanic across a renamed cooldown or separately changed AP ratio', () => {
    const apRatio: ImpactChange = { ...orianna, label: 'Ability Power Ratio', before: '60%', after: '80%' };
    const damage = buildPersonalPatchImpact(game({}, { gameVersion: '16.19.1' }), puuid,
      [patch('26.21', [apRatio]), patch('26.20', [orianna]), patch('26.19')], metadata('16.19.1'), after());
    expect(damage.status).toBe('partial'); expect(damage.metrics).toEqual([]); expect(damage.uncomputedChanges).toBe(2);
    const oldCooldown: ImpactChange = { kind: 'champion', targetId: 'LeeSin', ability: 'W', label: 'Flat Cooldown',
      before: '12s when used on non-champions and 6 when used on champions', after: '7s at all points' };
    const newCooldown = { ...oldCooldown, label: 'Cooldown', before: '7s', after: '8s' };
    const cooldown = buildPersonalPatchImpact(game({ championName: 'LeeSin' }, { gameVersion: '16.19.1' }), puuid,
      [patch('26.21', [newCooldown]), patch('26.20', [oldCooldown]), patch('26.19')], metadata('16.19.1'), after());
    expect(cooldown.status).toBe('partial'); expect(cooldown.metrics).toEqual([]); expect(cooldown.uncomputedChanges).toBe(2);
  });

  it('does not count a conditional ratio as covered just because its label names a flat stat', () => {
    const conditional: ImpactChange = { kind: 'item', targetId: '3152', label: 'Ability Power', before: '10% bonus health', after: '15% bonus health' };
    const report = buildPersonalPatchImpact(game(), puuid, [patch('26.21', [conditional]), patch('26.20')], before(), after());
    expect(report.uncomputedChanges).toBe(1);
    expect(report.status).toBe('partial');
  });

  it('keeps a zero baseline percentage undefined while preserving the actual delta', () => {
    const change = { ...orianna, before: '60 / 90 / 120 / 150 / 180 (+0% AP)' };
    const report = buildPersonalPatchImpact(game(), puuid, [patch('26.21', [change]), patch('26.20')], before(), after());
    expect(report.metrics[0]).toMatchObject({ before: 0, after: 81, delta: 81, percent: null });
  });
});

describe('context boundaries', () => {
  it('recognizes archive metadata, current versions, unknown future versions, and missing players', () => {
    expect(buildPersonalPatchImpact(game({}, { gameVersion: '16.21.100.200' }), puuid, archive).status).toBe('current');
    expect(buildPersonalPatchImpact(game({}, { gameVersion: '16.22.1' }), puuid, archive).status).toBe('unknown');
    expect(buildPersonalPatchImpact(game({}, { gameVersion: 'unknown' }), puuid, archive).status).toBe('unknown');
    expect(buildPersonalPatchImpact(game(), 'another-player', archive).status).toBe('unknown');
    expect(buildPersonalPatchImpact(game({ championName: 'orianna' }), puuid, archive, before(), after()).champion).toBe('Orianna');
  });

  it.each([450, 2400, 1700, 1900, 480])('withholds standard-item calculations for queue%s', queueId => {
    const report = buildPersonalPatchImpact(game({}, { queueId, gameMode: queueId === 480 ? 'SWIFTPLAY' : 'ARAM' }), puuid, archive, before(), after());
    expect(report.status).toBe('unsupported'); expect(report.metrics).toEqual([]);
  });

  it('does not conflate a mode item variant or expose another player’s inventory', () => {
    const report = buildPersonalPatchImpact(game({ item0: 223152 }), puuid, archive, before(), after());
    expect(report.status).toBe('partial'); expect(report.metrics).toEqual([]);
    const missing = buildPersonalPatchImpact(game(), 'another-player', archive, before(), after());
    expect(missing.inventory).toEqual([]); expect(missing.champion).toBe('');
  });
});
