import { describe, expect, it } from 'vitest';
import { buildSuggestions, compatibleItems, CONDITIONAL_COMPARISON, type ItemMetadata } from '../../src/lib/player/advice';
import { evidence, fallbackReview, type Match, type Participant, type Timeline } from '../../src/lib/player/contracts';

const player: Participant = {
  puuid: 'tester', participantId: 1, teamId: 100, championName: 'Jhin', teamPosition: 'BOTTOM',
  win: true, kills: 5, deaths: 2, assists: 5, totalMinionsKilled: 160, neutralMinionsKilled: 0,
  goldEarned: 10000, totalDamageDealtToChampions: 20000, visionScore: 12,
  item0: 3009, item1: 3031, item2: 0, item3: 0, item4: 0, item5: 0, item6: 3340,
};
const match: Match = {
  metadata: { matchId: 'EUN1_12345' },
  info: { gameCreation: 1700000000000, gameDuration: 1200, gameVersion: '16.21.1.123',
    queueId: 420, gameMode: 'CLASSIC', gameType: 'MATCHED_GAME',
    participants: [player, ...Array.from({ length: 4 }, (_, i) => ({ ...player, puuid: `ally-${i}`, participantId: i + 2, kills: 5, assists: 0, totalDamageDealtToChampions: 10000 }))],
  },
};
const metadata: ItemMetadata = {
  version: '16.21.1', notice: 'Test fixture, not production data.', data: {
    3009: { name: 'Boots of Swiftness', tags: ['Boots'], from: ['1001'], maps: { 11: true }, gold: { total: 1000, purchasable: true }, stats: { FlatMovementSpeedMod: 55 } },
    3047: { name: 'Plated Steelcaps', tags: ['Boots', 'Armor'], from: ['1001', '1029'], maps: { 11: true }, gold: { total: 1200, purchasable: true }, stats: { FlatArmorMod: 25, FlatMovementSpeedMod: 45 } },
    3111: { name: "Mercury's Treads", tags: ['Boots', 'SpellBlock'], from: ['1001', '1033'], maps: { 11: true }, gold: { total: 1250, purchasable: true }, stats: { FlatSpellBlockMod: 20, FlatMovementSpeedMod: 45 } },
    3031: { name: 'Infinity Edge', tags: ['Damage'], maps: { 11: true }, gold: { total: 3400, purchasable: true }, stats: { FlatPhysicalDamageMod: 70 } },
  },
};
const timeline: Timeline = { info: { frames: [{ timestamp: 0, events: [
  { type: 'ITEM_PURCHASED', participantId: 1, itemId: 3009, timestamp: 300000 },
  { type: 'ITEM_UNDO', participantId: 1, beforeId: 3009, afterId: 0, timestamp: 301000 },
  { type: 'ITEM_PURCHASED', participantId: 1, itemId: 3009, timestamp: 400000 },
  { type: 'CHAMPION_KILL', victimId: 1, timestamp: 1100000 },
] }] } };

describe('match evidence', () => {
  it('computes factual team participation with complete team data and guarded denominators', () => {
    const facts = evidence(match, 'tester');
    expect(facts.find(f => f.id === 'participation')?.metric?.value).toBe(40);
    expect(facts.find(f => f.id === 'farm-rate')?.metric?.value).toBe(8);
    const noKills = { ...match, info: { ...match.info, participants: match.info.participants.map(p => ({ ...p, kills: 0, assists: 0 })) } };
    expect(evidence(noKills, 'tester').some(f => f.id === 'participation')).toBe(false);
    const incomplete = { ...match, info: { ...match.info, participants: [player] } };
    expect(evidence(incomplete, 'tester').some(f => f.id === 'participation')).toBe(false);
  });

  it('does not turn support farm or short/invalid duration into a farming benchmark', () => {
    const support = { ...match, info: { ...match.info, participants: [{ ...player, teamPosition: 'UTILITY' }] } };
    expect(evidence(support, 'tester').some(f => f.id === 'farm-rate')).toBe(false);
    for (const duration of [0, 120, Number.NaN]) {
      const facts = evidence({ ...match, info: { ...match.info, gameDuration: duration } }, 'tester');
      expect(facts.some(f => f.id === 'farm-rate' || f.id === 'gold-rate')).toBe(false);
      expect(facts.map(f => f.text).join(' ')).not.toMatch(/NaN|Infinity/);
    }
  });

  it('resolves item names only for compatible metadata and retains typed undo evidence', () => {
    const facts = evidence(match, 'tester', timeline, metadata);
    expect(facts.find(f => f.id === 'inventory')?.text).toContain('Boots of Swiftness');
    expect(facts.find(f => f.eventType === 'ITEM_UNDO')).toMatchObject({ beforeId: 3009, afterId: 0 });
    const incompatible = evidence(match, 'tester', timeline, { ...metadata, version: '16.20.1' });
    expect(incompatible.find(f => f.id === 'inventory')?.text).toContain('item 3009');
    expect(incompatible.find(f => f.id === 'inventory')?.text).not.toContain('Boots of Swiftness');
  });

  it('retains late events in long timelines', () => {
    const long: Timeline = { info: { frames: [{ timestamp: 0, events: Array.from({ length: 80 }, (_, i) => ({ type: 'ITEM_PURCHASED', participantId: 1, itemId: 3031, timestamp: i * 10000 })) }] } };
    const facts = evidence(match, 'tester', long);
    expect(facts.find(f => f.id === 'event-79')?.timestamp).toBe(790000);
  });
});

describe('bounded item suggestions', () => {
  it('derives comparison numbers from the supplied compatible reference and states the missing properties', () => {
    const facts = evidence(match, 'tester', timeline, metadata);
    const suggestions = buildSuggestions(match, 'tester', facts, metadata);
    const armor = suggestions.find(s => s.targetItem === 3047)!;
    expect(armor.tradeoff).toContain('+25 armor');
    expect(armor.tradeoff).toContain('−10 move speed');
    expect(armor.tradeoff).toContain('200 gold higher');
    expect(armor.tradeoff).toContain('Other properties');
    expect(armor.condition).toBe(CONDITIONAL_COMPARISON);
    expect(armor.source?.url).toBe('https://ddragon.leagueoflegends.com/cdn/16.21.1/data/en_US/item.json');
    const changed = { ...metadata, data: { ...metadata.data, 3047: { ...metadata.data[3047]!, stats: { FlatArmorMod: 17, FlatMovementSpeedMod: 45 } } } };
    expect(buildSuggestions(match, 'tester', facts, changed).find(s => s.targetItem === 3047)?.tradeoff).toContain('+17 armor');
  });

  it('keeps a purchase observation separate from retention or optimal-build claims', () => {
    const facts = evidence(match, 'tester', timeline, metadata);
    const observation = buildSuggestions(match, 'tester', facts, metadata)[0]!;
    expect(observation.id).toBe('purchase-observation-3009');
    expect(observation.original).toContain('5:00');
    expect(observation.tradeoff).toContain('undo and sale');
    expect(observation.evidence).toContain('event-0');
  });

  it('declines incompatible, unsupported-mode, unavailable and champion-restricted recommendations', () => {
    const facts = evidence(match, 'tester', timeline);
    expect(compatibleItems(match, { ...metadata, version: '16.20.1' })).toBe(false);
    expect(buildSuggestions(match, 'tester', facts, { ...metadata, version: '16.20.1' })).toEqual([]);
    expect(buildSuggestions({ ...match, info: { ...match.info, queueId: 450 } }, 'tester', facts, metadata)).toEqual([]);
    const unavailable = { ...metadata, data: { ...metadata.data, 3047: { ...metadata.data[3047]!, inStore: false }, 3111: { ...metadata.data[3111]!, requiredChampion: 'OtherChampion' } } };
    expect(buildSuggestions(match, 'tester', facts, unavailable).some(s => s.targetItem === 3047 || s.targetItem === 3111)).toBe(false);
  });

  it('keeps suggestion evidence inspectable in a deterministic review', () => {
    const facts = evidence(match, 'tester', timeline, metadata);
    const suggestions = buildSuggestions(match, 'tester', facts, metadata);
    const report = fallbackReview(facts, undefined, suggestions);
    expect(report.suggestions).toEqual(suggestions);
    for (const section of report.sections) {
      expect(section.evidence.length).toBeGreaterThan(0);
      for (const id of section.evidence) expect(report.facts.some(f => f.id === id)).toBe(true);
    }
    expect(report.sections[3]?.text).toContain('Boots of Swiftness');
  });
});
