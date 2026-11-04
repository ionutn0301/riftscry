import { describe, expect, it } from 'vitest';
import { buildAlternatives, explainBuild, itemText } from '../../src/lib/player/build-learning';
import { reviewMoments } from '../../src/lib/player/quick-review';
import { evidence, type Fact } from '../../src/lib/player/contracts';
import type { ItemMetadata } from '../../src/lib/player/advice';
import { sourceMatch, puuid, timeline } from '../player-e2e/fixtures';

const reference: ItemMetadata = { version: '16.21.1', notice: 'Test data', data: {
  1001: { name: 'Boots', stats: { FlatMovementSpeedMod: 25 }, gold: { total: 300 } },
  3006: { name: 'Attack-speed boots', stats: { PercentAttackSpeedMod: .3, UnknownStat: 88 }, gold: { total: 1100 } },
} };
const match = structuredClone(sourceMatch);
Object.assign(match.info.participants[0]!, { item0: 1001, item1: 3006, item2: 1001, item3: 9999, item4: 0, item5: 0, item6: 0 });

describe('patch-grounded build learning', () => {
  it('preserves recorded order, deduplicates selectors, and explains only recognized finite stats', () => {
    const model = explainBuild(match, puuid, reference);
    expect(model.items.map(item => item.id)).toEqual([1001, 3006, 9999]);
    expect(model.items[1]?.stats).toMatchObject([{ label: 'Attack speed', value: '30%' }]);
    expect(model.items[1]?.stats).toHaveLength(1);
    expect(model.items[2]).toMatchObject({ name: 'Item 9999', known: false, price: null, stats: [] });
    expect(model.source).toContain('/16.21.1/');
  });
  it.each(['16.20.1', '17.21.1', null])('never borrows details from an incompatible reference: %s', version => {
    const model = explainBuild(match, puuid, { ...reference, version });
    expect(model.items.every(item => !item.known && !item.stats.length && item.price === null)).toBe(true);
    expect(model.source).toBeNull();
  });
  it.each([450, 2400, 1700, 900, 9999])('withholds standard-item explanations for queue %i', queueId => {
    const model = explainBuild({ ...match, info: { ...match.info, queueId } }, puuid, reference);
    expect(model.items.every(item => !item.known && !item.stats.length)).toBe(true);
    expect(model.notice).toContain('withheld');
  });
  it('does not turn missing players, empty slots or invalid measurements into facts', () => {
    expect(explainBuild(match, 'someone-else', reference).items).toEqual([]);
    const corrupt = { ...reference, data: { 1001: { name: 'Boots', stats: { FlatMovementSpeedMod: NaN, FlatArmorMod: -10, FlatHPPoolMod: Infinity }, gold: { total: NaN } } } };
    expect(explainBuild(match, puuid, corrupt).items[0]).toMatchObject({ price: null, stats: [] });
  });
  it('renders provider markup as bounded plain text without executable content', () => {
    expect(itemText('<mainText>Armor<br>Health &amp; mana</mainText><script>alert(1)</script>')).toBe('Armor · Health & mana');
    expect(itemText('<img src=x onerror=alert(1)>Safe')).toBe('Safe');
    expect(itemText('a'.repeat(3000))).toHaveLength(2400);
  });
});

describe('bounded historical item tradeoffs', () => {
  const items: ItemMetadata = { ...reference, data: {
    3006: { name: 'Speed boots', maps: { '11': true }, stats: { PercentAttackSpeedMod: .3, FlatMovementSpeedMod: 45 }, gold: { total: 1100, purchasable: true } },
    3047: { name: 'Armor boots', maps: { '11': true }, stats: { FlatArmorMod: 25, FlatMovementSpeedMod: 45 }, gold: { total: 1200, purchasable: true }, description: '<passive>Test passive</passive>' },
    3111: { name: 'Resist boots', maps: { '11': true }, stats: { FlatSpellBlockMod: 20, FlatMovementSpeedMod: 40 }, gold: { total: 1000, purchasable: true } },
    3117: { name: 'Removed boots', maps: { '11': true }, gold: { total: 1000, purchasable: false }, inStore: false },
  } };
  it('compares only supplied base stats, keeps omitted values unknown, and preserves passive text', () => {
    const model = buildAlternatives(match, puuid, items, 3006)!;
    expect(model.alternatives.map(item => item.id)).toEqual([3047, 3111]);
    const armor = model.alternatives[0]!;
    expect(armor.priceDifference).toBe(100);
    expect(armor.stats.find(stat => stat.key === 'PercentAttackSpeedMod')).toMatchObject({ before: '30%', after: 'Not listed', difference: null });
    expect(armor.stats.find(stat => stat.key === 'FlatArmorMod')).toMatchObject({ before: 'Not listed', after: '25', difference: null });
    expect(armor.stats.find(stat => stat.key === 'FlatMovementSpeedMod')?.difference).toBe('0');
    expect(armor.description).toBe('Test passive');
    expect(model.alternatives[1]?.stats.find(stat => stat.key === 'FlatMovementSpeedMod')?.difference).toBe('-5');
    expect(model.alternatives[1]?.priceDifference).toBe(-100);
  });
  it.each([{ inStore: false }, { gold: { total: 1, purchasable: false } }, { maps: { '11': false } }, { maps: undefined }, { requiredChampion: 'Ornn' }, { requiredAlly: 'Ornn' }])('excludes an unavailable or restricted alternative: %o', restriction => {
    const data = { ...items.data, 3047: { ...items.data[3047]!, ...restriction } };
    expect(buildAlternatives(match, puuid, { ...items, data }, 3006)?.alternatives.map(item => item.id)).toEqual([3111]);
  });
  it('declines other modes, incompatible data, missing players and items outside the recorded family', () => {
    expect(buildAlternatives({ ...match, info: { ...match.info, queueId: 450 } }, puuid, items, 3006)).toBeNull();
    expect(buildAlternatives(match, puuid, { ...items, version: '16.20.1' }, 3006)).toBeNull();
    expect(buildAlternatives(match, 'missing', items, 3006)).toBeNull();
    expect(buildAlternatives(match, puuid, items, 3047)).toBeNull();
    expect(buildAlternatives(match, puuid, items, 1001)).toBeNull();
  });
  it('offers the reviewed mage family without adding passive multipliers or substituting missing prices', () => {
    const mage = structuredClone(match); mage.info.participants[0]!.item0 = 3089;
    const data = {
      3089: { name: 'Damage item', maps: { '11': true }, gold: { total: 3500, purchasable: true }, stats: { FlatMagicDamageMod: 130 } },
      3102: { name: 'Defensive item', maps: { '11': true }, gold: { total: NaN, purchasable: true }, stats: { FlatMagicDamageMod: 105 } },
    };
    const alternative = buildAlternatives(mage, puuid, { ...items, data }, 3089)?.alternatives[0];
    expect(alternative?.priceDifference).toBeNull();
    expect(alternative?.stats[0]).toMatchObject({ before: '130', after: '105', difference: '-25' });
  });
  it('keeps a reported zero distinct from an omitted stat and labels percentage-point differences', () => {
    const data = { ...items.data, 3047: { ...items.data[3047]!, stats: { PercentAttackSpeedMod: 0 } } };
    expect(buildAlternatives(match, puuid, { ...items, data }, 3006)?.alternatives[0]?.stats.find(stat => stat.key === 'PercentAttackSpeedMod'))
      .toMatchObject({ before: '30%', after: '0%', difference: '-30 percentage points' });
  });
});

describe('review starting points', () => {
  it('uses only recorded deaths and purchases, preserving source IDs and chronological order', () => {
    const moments = reviewMoments(evidence(sourceMatch, puuid, timeline), sourceMatch.info.gameDuration);
    expect(moments).toMatchObject([{ id: 'event-0', kind: 'purchase', start: 0 }, { id: 'event-2', kind: 'death', start: 30000 }]);
  });
  it('excludes missing, invalid, out-of-game and fabricated event references', () => {
    const facts: Fact[] = [
      { id: 'event-0', kind: 'death', timestamp: NaN, text: '' },
      { id: 'event-1', kind: 'death', timestamp: -1, text: '' },
      { id: 'event-2', kind: 'death', timestamp: 100000, text: '' },
      { id: 'not-an-event', kind: 'death', timestamp: 1000, text: '' },
      { id: 'event-4', kind: 'death', text: '' },
    ];
    expect(reviewMoments(facts, 60)).toEqual([]);
    expect(reviewMoments([{ id: 'event-0', kind: 'death', timestamp: 0, text: '' }], 60)[0]?.start).toBe(0);
  });
  it.each([0, -1, NaN, Infinity, 21601])('declines an invalid duration: %s', duration => {
    expect(reviewMoments([{ id: 'event-0', kind: 'death', timestamp: 10, text: '' }], duration)).toEqual([]);
  });
});
