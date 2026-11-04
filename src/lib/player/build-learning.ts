import { compatibleItems, type ItemMetadata, type ItemRecord } from './advice';
import { participant, type Match } from './contracts';
import { modeForMatch } from './modes';

const statGuide: Record<string, { label: string; meaning: string; percent?: boolean }> = {
  FlatPhysicalDamageMod: { label: 'Attack damage', meaning: 'Adds damage to basic attacks and abilities that scale with attack damage.' },
  FlatMagicDamageMod: { label: 'Ability power', meaning: 'Strengthens abilities with ability-power scaling. Check your champion’s ability descriptions.' },
  FlatHPPoolMod: { label: 'Health', meaning: 'Adds to your health pool. The value of defenses also depends on the damage you face.' },
  FlatArmorMod: { label: 'Armor', meaning: 'Reduces incoming physical damage. It does not reduce magic or true damage.' },
  FlatSpellBlockMod: { label: 'Magic resistance', meaning: 'Reduces incoming magic damage. It does not reduce physical or true damage.' },
  PercentAttackSpeedMod: { label: 'Attack speed', meaning: 'Increases attack frequency, subject to your champion’s rules and limits.', percent: true },
  FlatCritChanceMod: { label: 'Critical strike chance', meaning: 'Increases the chance of critical strikes. Champion-specific interactions can differ.', percent: true },
  PercentLifeStealMod: { label: 'Life steal', meaning: 'Restores health from qualifying basic-attack damage; it does not apply to every source of damage.', percent: true },
  FlatMovementSpeedMod: { label: 'Move speed', meaning: 'Contributes to movement speed. Slows, caps and other movement effects still apply.' },
  PercentMovementSpeedMod: { label: 'Move speed', meaning: 'Contributes percentage movement speed. Other bonuses and movement rules affect the final value.', percent: true },
  FlatMPPoolMod: { label: 'Mana', meaning: 'Adds mana capacity for champions that use mana; it does not itself reduce spell costs.' },
};

/** Render reference prose as text only; never insert provider HTML into the page. */
export function itemText(value?: string): string {
  if (typeof value !== 'string') return '';
  return value.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?\s*>/gi, ' · ').replace(/<[^>]*>/g, ' ')
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g, entity => ({ '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" })[entity] ?? entity)
    .replace(/\s+/g, ' ').trim().slice(0, 2400);
}

const formatStat = (key: string, value: number) => `${Number((value * (statGuide[key]?.percent ? 100 : 1)).toFixed(2))}${statGuide[key]?.percent ? '%' : ''}`;
const price = (item: ItemRecord) => Number.isFinite(item.gold?.total) && item.gold!.total >= 0 ? item.gold!.total : null;
const knownStat = (item: ItemRecord, key: string) => Object.hasOwn(item.stats ?? {}, key) && Number.isFinite(item.stats?.[key]) && item.stats![key]! >= 0 ? item.stats![key]! : null;

/** Reviewed identities, not a recommendation ranking. Availability and all
 * values still come from the match's historical reference. Checked 16.22.1. */
const comparisonFamilies = [
  { label: 'Boot choices', ids: [3006, 3009, 3020, 3047, 3111, 3158], question: 'Which threat or action matters most? Read the passives as well as the move speed and defenses.' },
  { label: 'Mage damage and defense', ids: [3089, 3102, 3157], question: 'Do you need more damage, a spell shield, or an active defensive window? Consider when you can use that effect and what you delay.' },
];
const eligible = (item?: ItemRecord): item is ItemRecord => !!item && item.maps?.['11'] === true &&
  item.inStore !== false && item.gold?.purchasable === true && !item.requiredChampion && !item.requiredAlly;

export function buildAlternatives(match: Match, puuid: string, metadata: ItemMetadata | undefined, itemId: number) {
  if (!modeForMatch(match).standardItems || !compatibleItems(match, metadata)) return null;
  const player = participant(match, puuid);
  if (!player || ![player.item0, player.item1, player.item2, player.item3, player.item4, player.item5, player.item6].includes(itemId)) return null;
  const family = comparisonFamilies.find(group => group.ids.includes(itemId));
  const recorded = metadata.data[itemId];
  if (!family || !eligible(recorded)) return null;
  const alternatives = family.ids.filter(id => id !== itemId).flatMap(id => {
    const alternative = metadata.data[id];
    if (!eligible(alternative)) return [];
    return [{ id, name: alternative.name, description: itemText(alternative.description), price: price(alternative),
      priceDifference: price(alternative) !== null && price(recorded) !== null ? price(alternative)! - price(recorded)! : null,
      stats: Object.entries(statGuide).flatMap(([key, guide]) => {
        const before = knownStat(recorded, key), after = knownStat(alternative, key);
        if (before === null && after === null) return [];
        const difference = before !== null && after !== null ? after - before : null;
        return [{ key, label: guide.label, before: before === null ? 'Not listed' : formatStat(key, before),
          after: after === null ? 'Not listed' : formatStat(key, after),
          difference: difference === null ? null : `${difference > 0 ? '+' : ''}${guide.percent ? `${Number((difference * 100).toFixed(2))} percentage points` : formatStat(key, difference)}` }];
      }),
    }];
  });
  return alternatives.length ? { label: family.label, question: family.question, recordedName: recorded.name, alternatives } : null;
}

export function explainBuild(match: Match, puuid: string, metadata?: ItemMetadata) {
  const player = participant(match, puuid);
  const mode = modeForMatch(match);
  const inventory = player ? [player.item0, player.item1, player.item2, player.item3, player.item4, player.item5, player.item6]
    .filter(id => Number.isSafeInteger(id) && id > 0) : [];
  const compatible = compatibleItems(match, metadata);
  const supported = mode.standardItems;
  return {
    version: compatible ? metadata.version : null,
    source: compatible ? `https://ddragon.leagueoflegends.com/cdn/${metadata.version}/data/en_US/item.json` : null,
    notice: !player ? 'This player is not present in the match.' : !supported
      ? `${mode.label} can change item behavior. Standard Summoner’s Rift item explanations are withheld here.`
      : !compatible ? 'A matching historical item reference is needed. Recorded item IDs remain available.'
        : 'Patch reference, not a live recommendation. Hotfixes, passives, stacks and champion interactions can change the result.',
    items: [...new Set(inventory)].map(id => {
      const item = compatible && supported ? metadata.data[id] : undefined;
      return {
        id, name: item?.name || `Item ${id}`, known: !!item,
        summary: itemText(item?.plaintext), description: itemText(item?.description),
        price: item?.gold && Number.isFinite(item.gold.total) && item.gold.total >= 0 ? item.gold.total : null,
        stats: Object.entries(item?.stats ?? {}).flatMap(([key, value]) => {
          const guide = statGuide[key];
          if (!guide || !Number.isFinite(value) || value <= 0) return [];
          return [{ key, label: guide.label, value: `${Number((value * (guide.percent ? 100 : 1)).toFixed(2))}${guide.percent ? '%' : ''}`, meaning: guide.meaning }];
        }),
      };
    }),
  };
}
