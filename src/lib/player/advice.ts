import type { Fact, Match } from './contracts';

/** Reference data, not a complete combat or item-eligibility model. */
export type ItemRecord = {
  name: string;
  plaintext?: string;
  description?: string;
  image?: { full: string };
  stats?: Record<string, number>;
  tags?: string[];
  from?: string[];
  into?: string[];
  maps?: Record<string, boolean>;
  depth?: number;
  inStore?: boolean;
  requiredChampion?: string;
  requiredAlly?: string;
  gold?: { total: number; purchasable?: boolean; base?: number; sell?: number };
};

export type ItemMetadata = {
  version: string | null;
  data: Record<string, ItemRecord>;
  runes?: Record<string, { name: string; icon: string }>;
  notice: string;
};

export type AdjustmentDraft = {
  id: string;
  condition: string;
  original: string;
  alternative: string;
  targetItem: number;
  reason: string;
  tradeoff: string;
  evidence: string[];
  source?: { label: string; url: string };
  ruleVersion?: string;
};

export const ITEM_ADVICE_VERSION = 'item-observations-1';
export const STRUCTURAL_CONDITION = 'Same champion, role, queue and patch';
export const CONDITIONAL_COMPARISON = 'Specific matchup or replay condition — requires confirmation';

const patch = (version: string) => version.split('.').slice(0, 2).join('.');
const inventory = (p: Match['info']['participants'][number]) => [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5].filter(Boolean);

export function compatibleItems(match: Match, metadata?: ItemMetadata): metadata is ItemMetadata & { version: string } {
  return !!metadata?.version && /^\d+\.\d+\.\d+$/.test(metadata.version) &&
    /^\d+\.\d+/.test(match.info.gameVersion) && patch(metadata.version) === patch(match.info.gameVersion);
}

function available(item: ItemRecord | undefined, champion: string): item is ItemRecord {
  return !!item && !!item.name && item.gold?.purchasable === true &&
    Number.isFinite(item.gold.total) && item.gold.total > 0 && item.inStore !== false &&
    item.maps?.['11'] === true && !item.requiredAlly &&
    (!item.requiredChampion || item.requiredChampion === champion);
}

const statNames: Record<string, { label: string; multiplier: number }> = {
  FlatArmorMod: { label: 'armor', multiplier: 1 },
  FlatSpellBlockMod: { label: 'magic resistance', multiplier: 1 },
  FlatMovementSpeedMod: { label: 'move speed', multiplier: 1 },
  PercentAttackSpeedMod: { label: '% attack speed', multiplier: 100 },
};

function statTradeoff(from: ItemRecord, to: ItemRecord): string | null {
  if (!from.stats || !to.stats) return null;
  const pieces: string[] = [];
  for (const [key, { label, multiplier }] of Object.entries(statNames)) {
    const a = from.stats[key] ?? 0;
    const b = to.stats[key] ?? 0;
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    const delta = Math.round((b - a) * multiplier * 100) / 100;
    if (delta) pieces.push(`${delta > 0 ? '+' : '−'}${Math.abs(delta)}${label.startsWith('%') ? '' : ' '}${label}`);
  }
  if (!pieces.length) return null;
  const cost = (to.gold?.total ?? 0) - (from.gold?.total ?? 0);
  const price = cost ? `${Math.abs(cost)} gold ${cost > 0 ? 'higher' : 'lower'} total shop price` : 'the same total shop price';
  return `${pieces.join(', ')}; ${price}. Only the listed stats are compared. Other properties, passives, upgrades and champion interactions can differ. This is not a swap-cost or affordability estimate.`;
}

/**
 * A deliberately small catalogue: observe an actual purchase, or compare the
 * base stats of recorded tier-two boots with the two defensive alternatives.
 * Source shape and item identities checked against Riot Data Dragon 16.21.1
 * on 2026-10-28; values are always read from the match-compatible payload.
 * No matchup verdict or combat outcome is inferred from these rules.
 */
export function buildSuggestions(match: Match, puuid: string, facts: Fact[], metadata?: ItemMetadata): AdjustmentDraft[] {
  if (!compatibleItems(match, metadata) || ![420, 440, 400, 430].includes(match.info.queueId)) return [];
  const p = match.info.participants.find(p => p.puuid === puuid);
  if (!p) return [];
  const source = {
    label: `Riot Data Dragon ${metadata.version} · item reference`,
    url: `https://ddragon.leagueoflegends.com/cdn/${metadata.version}/data/en_US/item.json`,
  };
  const drafts: AdjustmentDraft[] = [];

  const observed = facts.find(f => f.kind === 'item' && f.eventType === 'ITEM_PURCHASED' &&
    f.itemId && inventory(p).includes(f.itemId) &&
    available(metadata.data[f.itemId], p.championName) &&
    !metadata.data[f.itemId]!.tags?.includes('Consumable') &&
    (metadata.data[f.itemId]!.gold?.total ?? 0) >= 700);

  if (observed?.itemId && observed.timestamp != null) {
    const item = metadata.data[observed.itemId]!;
    const clock = `${Math.floor(observed.timestamp / 60000)}:${String(Math.floor(observed.timestamp / 1000) % 60).padStart(2, '0')}`;
    drafts.push({
      id: `purchase-observation-${observed.itemId}`,
      condition: STRUCTURAL_CONDITION,
      original: `A purchase of ${item.name} was recorded at ${clock}; the item also appears in the final inventory.`,
      alternative: `Review my ${item.name} purchase timing in the next comparable game.`,
      targetItem: observed.itemId,
      reason: 'This gives you a concrete purchase to revisit. Before your next game, decide what you want this item to help you do, then review the recorded purchase and your plan together.',
      tradeoff: 'This is an observation task, not an instruction to buy the item again. A different game may call for a different purchase; undo and sale events still need inspection.',
      evidence: [observed.id, 'inventory'], source, ruleVersion: ITEM_ADVICE_VERSION,
    });
  }

  const bootIds = [3006, 3009, 3020, 3047, 3111, 3117, 3158];
  const originalId = inventory(p).find(id => bootIds.includes(id) &&
    available(metadata.data[id], p.championName) && metadata.data[id]!.tags?.includes('Boots'));
  if (originalId == null) return drafts;
  const original = metadata.data[originalId]!;
  for (const [target, stat, purpose] of [
    [3047, 'FlatArmorMod', 'armor'],
    [3111, 'FlatSpellBlockMod', 'magic resistance'],
  ] as const) {
    const alternative = metadata.data[target];
    if (target === originalId || !available(alternative, p.championName) ||
      !alternative.tags?.includes('Boots') || !alternative.from?.includes('1001') ||
      !(Number.isFinite(alternative.stats?.[stat]) && alternative.stats![stat]! > 0)) continue;
    const tradeoff = statTradeoff(original, alternative);
    if (!tradeoff) continue;
    drafts.push({
      id: `boots-${originalId}-${target}`,
      condition: CONDITIONAL_COMPARISON,
      original: `${original.name} appears in your final inventory.`,
      alternative: `Compare ${alternative.name} with ${original.name} when I decide ${purpose} is a priority.`,
      targetItem: target,
      reason: `The compatible item reference lists ${alternative.stats![stat]} ${purpose} on ${alternative.name}. Decide from the matchup and replay whether that property is worth the tradeoff; the match record alone does not make that decision.`,
      tradeoff,
      evidence: ['inventory'], source, ruleVersion: ITEM_ADVICE_VERSION,
    });
  }
  return drafts;
}

export function suggestionFacts(suggestions: AdjustmentDraft[]): Fact[] {
  return suggestions.map(suggestion => ({
    id: `suggestion-${suggestion.id}`,
    kind: 'rule' as const,
    text: `${suggestion.alternative} ${suggestion.reason} ${suggestion.tradeoff} Source: ${suggestion.source?.url ?? 'user observation'}; rule ${suggestion.ruleVersion ?? 'unversioned'}.`,
  }));
}
