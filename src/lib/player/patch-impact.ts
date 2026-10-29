import { participant, type Match } from './contracts';
import { modeForMatch } from './modes';
import type { ItemMetadata, ItemRecord } from './advice';
import { champions as championCatalog } from '../../data/champions.json';

export type ImpactSource = { label: string; url: string };
export type ImpactChange = {
  kind: 'champion' | 'item'; targetId: string; ability?: string; abilityName?: string;
  label: string; before: string; after: string; unit?: string;
};
export type ImpactPatch = {
  id: string; version: string; date: string; sourceUrl: string; champions: string[];
  records: ImpactChange[];
  blockers?: { kind: 'champion' | 'item'; targetId: string; ability?: string; label: string }[];
  reworkedChampions?: string[];
};
export type ImpactMetric = {
  id: string; kind: 'damage' | 'cooldown' | 'cost' | 'stat'; label: string; unit: string;
  before: number; after: number; delta: number; percent: number | null;
  summary: string; formula: string; assumptions: string[]; sources: ImpactSource[];
  ranks?: { rank: number; before: number; after: number }[];
};
export type PatchImpactReport = {
  status: 'ready' | 'partial' | 'current' | 'unchanged' | 'unknown' | 'unsupported';
  champion: string; sourceMatchId: string; sourcePatch: string | null; targetPatch: string | null;
  sourceVersion: string | null; targetVersion: string | null;
  inventory: { id: number; name: string; quantity: number }[];
  metrics: ImpactMetric[]; uncomputedChanges: number; assumptions: string[];
  sources: ImpactSource[]; notice: string; retryable?: boolean;
};

/** This is a versioned reference calculation, not a combat simulator. */
export const PATCH_IMPACT_MODEL = 'listed-item-components-v1';
const itemRoot = 'https://ddragon.leagueoflegends.com/cdn';
const hasteSource: ImpactSource = {
  label: 'Riot · ability haste mechanics',
  url: 'https://www.leagueoflegends.com/en-us/news/game-updates/patch-10-23-notes/',
};
const canonicalIds = new Map(Object.keys(championCatalog).map(id => [id.toLowerCase(), id]));
const canonicalChampion = (value: string) => canonicalIds.get(value.toLowerCase()) ?? value;
const numeric = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10_000_000;
const rounded = (value: number) => Number(value.toFixed(6));
const show = (value: number) => Number(value.toFixed(2)).toLocaleString('en-US', { maximumFractionDigits: 2 });
const signed = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${show(Math.abs(value))}`;
const shortVersion = (version: string) => /^\d+\.\d+(?:\.\d+)*$/.test(version) ? version.split('.').slice(0, 2).join('.') : null;
const uniqueSources = (sources: ImpactSource[]) => [...new Map(sources.map(source => [source.url, source])).values()];
const sourcesFor = (patches: ImpactPatch[]) => uniqueSources(patches.map(patch => ({ label: `Riot patch ${patch.id}`, url: patch.sourceUrl })));
const referenceSource = (version: string): ImpactSource => ({ label: `Riot item reference ${version}`, url: `${itemRoot}/${version}/data/en_US/item.json` });
const normalized = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

type StatDefinition = { key: string; label: string; unit: string; labels: string[] };
const statDefinitions: readonly StatDefinition[] = [
  { key: 'FlatMagicDamageMod', label: 'Listed item ability power', unit: 'AP', labels: ['ability power'] },
  { key: 'FlatPhysicalDamageMod', label: 'Listed item attack damage', unit: 'AD', labels: ['attack damage'] },
  { key: 'FlatHPPoolMod', label: 'Listed item health', unit: 'health', labels: ['health'] },
  { key: 'FlatMPPoolMod', label: 'Listed item mana', unit: 'mana', labels: ['mana'] },
  { key: 'FlatArmorMod', label: 'Listed item armor', unit: 'armor', labels: ['armor'] },
  { key: 'FlatSpellBlockMod', label: 'Listed item magic resistance', unit: 'MR', labels: ['magic resistance', 'magic resist'] },
];

/**
 * A missing stats block is unknown. A complete block with no haste line lists
 * zero haste; a passive mentioning haste never becomes a listed flat stat.
 */
export function listedItemHaste(item: ItemRecord): number | null {
  if (typeof item.description !== 'string') return null;
  const blocks = [...item.description.matchAll(/<stats>([\s\S]*?)<\/stats>/gi)];
  if (blocks.length !== 1) return null;
  const block = blocks[0]![1]!;
  const mentions = block.match(/\b(?:ability\s+)?haste\b/gi) ?? [];
  if (!mentions.length) return 0;
  const match = block.match(/<attention>\s*(\d+(?:\.\d+)?)\s*<\/attention>\s*Ability Haste\s*(?:<br\s*\/?\s*>|$)/i);
  if (mentions.length !== 1 || !match) return null;
  const value = Number(match[1]);
  return numeric(value) && value <= 500 ? value : null;
}

type ItemTotals = { stats: Record<string, number> | null; haste: number | null; cost: number | null };
function itemTotals(inventory: PatchImpactReport['inventory'], metadata: ItemMetadata | undefined, expectedVersion: string, champion: string): ItemTotals {
  const unavailable = { stats: null, haste: null, cost: null };
  // Every endpoint has an explicit version. Do not replace a historical item
  // reference with whatever happens to be live, even within the same patch.
  if (!metadata || metadata.version !== expectedVersion || !metadata.data || Array.isArray(metadata.data)) return unavailable;
  const stats: Record<string, number> = Object.fromEntries(statDefinitions.map(stat => [stat.key, 0]));
  let statsKnown = true, hasteKnown = true, costKnown = true, haste = 0, cost = 0;
  for (const { id, quantity } of inventory) {
    const item = metadata.data[id];
    if (!item || !item.name || item.maps?.['11'] !== true || item.requiredAlly ||
      item.requiredChampion && canonicalChampion(item.requiredChampion) !== champion) return unavailable;
    if (!item.stats || typeof item.stats !== 'object' || Array.isArray(item.stats)) statsKnown = false;
    else for (const stat of statDefinitions) {
      const amount = Object.hasOwn(item.stats, stat.key) ? item.stats[stat.key] : 0;
      if (!numeric(amount)) statsKnown = false;
      else stats[stat.key] = stats[stat.key]! + amount * quantity;
    }
    const itemHaste = listedItemHaste(item);
    if (itemHaste == null) hasteKnown = false;
    else haste += itemHaste * quantity;
    // An upgrade's reference value is not necessarily an obtainable shop price.
    if (item.gold?.purchasable !== true || item.inStore === false || !numeric(item.gold.total) || item.gold.total <= 0 || item.requiredAlly) costKnown = false;
    else cost += item.gold.total * quantity;
  }
  return {
    stats: statsKnown && Object.values(stats).every(numeric) ? stats : null,
    haste: hasteKnown && numeric(haste) && haste <= 500 ? haste : null,
    cost: costKnown && numeric(cost) ? cost : null,
  };
}

const componentAssumptions = [
  'The same final inventory is compared at both reference versions; this is not purchase order.',
  'Listed item stats only. Runes, stacks, item passives, multipliers, champion passives and temporary effects are excluded.',
];
function metric(input: Omit<ImpactMetric, 'delta' | 'percent'>): ImpactMetric | null {
  if (![input.before, input.after].every(numeric)) return null;
  const delta = rounded(input.after - input.before);
  if (Math.abs(delta) < 0.000001) return null;
  return { ...input, before: rounded(input.before), after: rounded(input.after), delta,
    percent: input.before === 0 ? null : rounded((input.after - input.before) / input.before * 100) };
}

type Formula = { base: number[]; ap: number[] | null };
const numberPattern = '(?:\\d+(?:\\.\\d+)?|\\.\\d+)';
const arrayPattern = `${numberPattern}(?:\\s*\\/\\s*${numberPattern})*`;
const plainPattern = new RegExp(`^(${arrayPattern})\\s*(?:s|seconds?)?$`, 'i');
const damagePattern = new RegExp(`^(${arrayPattern})(?:\\s*\\(\\s*\\+\\s*(${arrayPattern})%\\s*AP\\s*\\))?$`, 'i');
function parseSeries(value: string): number[] | null {
  const values = value.split('/').map(Number);
  return [1, 3, 5].includes(values.length) && values.every(numeric) ? values : null;
}
function parseFormula(value: string, cooldown: boolean): Formula | null {
  const match = value.trim().match(cooldown ? plainPattern : damagePattern);
  if (!match) return null;
  const base = parseSeries(match[1]!);
  const ap = match[2] ? parseSeries(match[2]) : null;
  if (!base || (match[2] && !ap) || (ap && ap.length !== 1 && ap.length !== base.length)) return null;
  return { base, ap: ap?.map(value => value / 100) ?? null };
}
const expand = (values: number[], length: number) => values.length === 1 ? Array.from({ length }, () => values[0]!) : values;
function equalFormula(a: Formula, b: Formula): boolean {
  const length = Math.max(a.base.length, b.base.length, a.ap?.length ?? 1, b.ap?.length ?? 1);
  const equal = (left: number[], right: number[]) => {
    const x = expand(left, length), y = expand(right, length);
    return x.length === y.length && x.every((value, index) => value === y[index]);
  };
  return equal(a.base, b.base) && (a.ap === null && b.ap === null || !!a.ap && !!b.ap && equal(a.ap, b.ap));
}

/**
 * Reviewed mechanics only. Labels such as "Damage" do not establish whether
 * an arbitrary ability is a charge, reset, recast, health ratio or stack.
 * Entries refer to the source's damage component, never a full combo.
 */
const reviewedDamage = new Set([
  'Caitlyn:Q:base damage', 'Orianna:Q:damage', 'Orianna:W:damage',
  'MissFortune:E:damage', 'Nunu:R:maximum damage', 'Taliyah:E:damage',
  'Taliyah:E:detonation damage', 'Neeko:E:base damage', 'Aurora:E:base damage',
  'Nautilus:Q:damage', 'Leblanc:W:damage', 'Thresh:E:active damage', 'Xerath:Q:damage',
]);
const reviewedCooldown = new Set([
  'Darius:Q:cooldown', 'LeeSin:W:cooldown', 'Mordekaiser:R:cooldown',
  'Swain:W:cooldown', 'Aatrox:W:cooldown', 'Nocturne:R:cooldown',
  'Seraphine:E:cooldown', 'Syndra:W:cooldown',
]);

type ChangeAtPatch = { change: ImpactChange; patch: ImpactPatch };
function isContiguous(patches: ImpactPatch[]): boolean {
  return patches.every((patch, index) => {
    if (!index) return true;
    const previous = patches[index - 1]!.id.split('.').map(Number), current = patch.id.split('.').map(Number);
    return current[0] === previous[0] && current[1] === previous[1]! + 1;
  });
}
function compose(group: ChangeAtPatch[], cooldown: boolean): { before: Formula; after: Formula } | null {
  let first: Formula | null = null, previous: Formula | null = null;
  let previousPatch = '';
  for (const { change, patch } of group) {
    const before = parseFormula(change.before, cooldown), after = parseFormula(change.after, cooldown);
    if (!before || !after || previousPatch === patch.id || previous && !equalFormula(previous, before)) return null;
    const length = Math.max(before.base.length, after.base.length);
    if (![1, 3, 5].includes(length) || ![1, length].includes(before.base.length) || ![1, length].includes(after.base.length)) return null;
    first ??= before;
    previous = after;
    previousPatch = patch.id;
  }
  return first && previous ? { before: first, after: previous } : null;
}
function bestRank(ranks: { rank: number; before: number; after: number }[]) {
  return [...ranks].sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before) || b.rank - a.rank)[0]!;
}

/** Pure, bounded personal report from an imported match and explicit references. */
export function buildPersonalPatchImpact(
  match: Match, puuid: string, archive: ImpactPatch[], beforeItems?: ItemMetadata, afterItems?: ItemMetadata,
): PatchImpactReport {
  const player = participant(match, puuid);
  const champion = player?.championName ? canonicalChampion(player.championName) : '';
  const patches = [...archive].sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
  const latest = patches.at(-1);
  const baseline = patches.find(patch => shortVersion(patch.version) === shortVersion(match.info.gameVersion) && shortVersion(match.info.gameVersion) !== null);
  const counts = new Map<number, number>();
  let validInventory = !!player;
  if (player) for (const id of [player.item0, player.item1, player.item2, player.item3, player.item4, player.item5]) {
    if (!Number.isInteger(id) || id < 0 || id > 999999) validInventory = false;
    else if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const inventory = [...counts].map(([id, quantity]) => ({ id, quantity,
    name: beforeItems?.data?.[id]?.name ?? afterItems?.data?.[id]?.name ?? `Item ${id}` }));
  const report: PatchImpactReport = {
    status: 'unknown', champion, sourceMatchId: match.metadata.matchId,
    sourcePatch: baseline?.id ?? null, targetPatch: latest?.id ?? null,
    sourceVersion: baseline?.version ?? null, targetVersion: latest?.version ?? null,
    inventory, metrics: [], uncomputedChanges: 0, assumptions: [
      'The baseline is this champion and queue’s latest imported game, not a claim about complete match history.',
      'Patch references can differ from a mid-patch hotfix. No fight outcome or build recommendation is inferred.',
    ], sources: [], notice: '',
  };
  if (!player || !champion || !latest || !baseline || new Set(patches.map(patch => patch.id)).size !== patches.length ||
    !patches.every(patch => /^\d+\.\d+$/.test(patch.id) && /^\d+\.\d+\.\d+$/.test(patch.version))) {
    report.notice = 'A supported archived game version and recorded player are needed before calculating patch impact.';
    return report;
  }
  if (!modeForMatch(match).standardItems) {
    report.status = 'unsupported';
    report.notice = 'These calculations cover standard Summoner’s Rift item rules. This queue’s modifiers and augments are not reconstructed; its archived changes remain available in your briefing.';
    return report;
  }
  if (baseline.id === latest.id) {
    report.status = 'current';
    report.notice = `This imported game already uses patch ${latest.id}, the newest patch in the archive.`;
    report.sources = sourcesFor([latest]);
    return report;
  }
  const baselineIndex = patches.indexOf(baseline);
  const interval = patches.slice(baselineIndex + 1);
  const itemIds = new Set(inventory.map(item => String(item.id)));
  const relevant = (record: Pick<ImpactChange, 'kind' | 'targetId'>) => record.kind === 'champion'
    ? canonicalChampion(record.targetId) === champion : itemIds.has(record.targetId);
  const records = interval.flatMap(patch => patch.records.filter(relevant).map(change => ({ change, patch })));
  const blockers = interval.flatMap(patch => (patch.blockers ?? []).filter(relevant));
  report.uncomputedChanges = records.length + blockers.length;
  report.sources = sourcesFor(interval.filter(patch => patch.records.some(relevant) || patch.blockers?.some(relevant)));
  const before = validInventory ? itemTotals(inventory, beforeItems, baseline.version, champion) : { stats: null, haste: null, cost: null };
  const after = validInventory ? itemTotals(inventory, afterItems, latest.version, champion) : { stats: null, haste: null, cost: null };
  const itemSources = uniqueSources([referenceSource(baseline.version), referenceSource(latest.version)]);
  const sourceMatches = beforeItems?.version === baseline.version && afterItems?.version === latest.version;
  report.retryable = !sourceMatches;
  if (sourceMatches) report.sources = uniqueSources([...report.sources, ...itemSources]);
  const add = (entry: ImpactMetric | null) => { if (entry) report.metrics.push(entry); };

  if (before.cost !== null && after.cost !== null) add(metric({
    id: 'inventory-shop-cost', kind: 'cost', label: 'Same inventory · total shop price', unit: 'gold',
    before: before.cost, after: after.cost,
    summary: `Buying these same listed items costs ${show(Math.abs(after.cost - before.cost))} gold ${after.cost > before.cost ? 'more' : 'less'} at the new reference prices.`,
    formula: `Sum of item shop prices × recorded quantities: ${show(before.cost)} → ${show(after.cost)} gold`,
    assumptions: [componentAssumptions[0]!, 'Total shop price, not gold you spent, a sale refund, swap cost, or time needed to earn it.'], sources: itemSources,
  }));
  if (before.stats && after.stats) for (const stat of statDefinitions) {
    const a = before.stats[stat.key]!, b = after.stats[stat.key]!;
    add(metric({ id: `inventory-${stat.key}`, kind: 'stat', label: stat.label, unit: stat.unit,
      before: a, after: b, summary: `${signed(b - a)} ${stat.unit} in the same inventory’s listed flat stats.`,
      formula: `Sum of listed ${stat.unit} × recorded quantities: ${show(a)} → ${show(b)}`,
      assumptions: componentAssumptions, sources: itemSources,
    }));
  }
  if (before.haste !== null && after.haste !== null) add(metric({
    id: 'inventory-haste', kind: 'stat', label: 'Listed item ability haste', unit: 'haste',
    before: before.haste, after: after.haste,
    summary: `${signed(after.haste - before.haste)} ability haste in your recorded items’ listed stats.`,
    formula: `Sum of listed ability haste: ${show(before.haste)} → ${show(after.haste)}`,
    assumptions: componentAssumptions, sources: itemSources,
  }));
  // Numeric item passives are deliberately not treated as flat stats.
  for (const { change } of records.filter(record => record.change.kind === 'item')) {
    const label = normalized(change.label);
    const scalar = /^\s*\d+(?:\.\d+)?\s*(?:g|gold)?\s*$/i;
    const represented = scalar.test(change.before) && scalar.test(change.after) && (
      label === 'ability haste' && before.haste !== null && after.haste !== null ||
      ['total cost', 'total price', 'total gold cost'].includes(label) && before.cost !== null && after.cost !== null ||
      statDefinitions.some(stat => stat.labels.includes(label)) && before.stats !== null && after.stats !== null);
    if (represented) report.uncomputedChanges--;
  }

  const groups = new Map<string, ChangeAtPatch[]>();
  for (const record of records.filter(record => record.change.kind === 'champion')) {
    const change = record.change;
    const key = `${champion}:${change.ability ?? ''}:${normalized(change.label)}`;
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  const continuous = isContiguous([baseline, ...interval]);
  const reworked = interval.some(patch => patch.reworkedChampions?.some(id => canonicalChampion(id) === champion));
  for (const [key, group] of groups) {
    const record = group[0]!.change;
    const cooldown = reviewedCooldown.has(key), damage = reviewedDamage.has(key);
    if ((!cooldown && !damage) || !continuous || reworked || blockers.some(blocker => blocker.kind === 'champion' &&
      (!blocker.ability || blocker.ability === record.ability || blocker.ability === 'base' || blocker.ability === 'passive'))) continue;
    // A renamed/separate coefficient can change the same mechanic without
    // joining this textual chain (for example Lee Sin's earlier "Flat
    // Cooldown"). Unknown sibling mechanics must not leave an older baseline
    // looking current. Reviewed independent damage components may coexist.
    const conflict = records.some(({ change }) => change.kind === 'champion' && change.ability === record.ability &&
      normalized(change.label) !== normalized(record.label) && (cooldown
        ? /cooldown|recharge|refund|reset|cast interval/i.test(change.label)
        : /damage|ratio|scaling|\bAP\b|amplif|ability power/i.test(change.label) &&
          !reviewedDamage.has(`${champion}:${change.ability}:${normalized(change.label)}`)));
    if (conflict) continue;
    const composed = compose(group, cooldown);
    if (!composed) continue;
    const { before: a, after: b } = composed;
    const length = Math.max(a.base.length, b.base.length);
    const basesBefore = expand(a.base, length), basesAfter = expand(b.base, length);
    if (basesBefore.length !== basesAfter.length) continue;
    const name = record.abilityName ?? `${champion} ${record.ability}`;
    const patchSources = sourcesFor(group.map(entry => entry.patch));
    const rankNotice = 'Ability ranks are not inferred from your match. Each rank shown is a reference comparison.';
    let fullyComputed = true;
    if (cooldown) {
      const hasteKnown = before.haste !== null && after.haste !== null;
      let ranks = basesBefore.map((base, index) => ({ rank: index + 1,
        before: rounded(hasteKnown ? base * 100 / (100 + before.haste!) : base),
        after: rounded(hasteKnown ? basesAfter[index]! * 100 / (100 + after.haste!) : basesAfter[index]!),
      }));
      const extra: string[] = [];
      // The 26.21 article and Data Dragon disagree at ranks 2–4. Their rank-5
      // values agree (5s → 4s), so only that independently checked point ships.
      if (key === 'Darius:Q:cooldown' && group.some(entry => entry.patch.id === '26.21')) {
        ranks = ranks.filter(rank => rank.rank === 5);
        if (!ranks.length) continue;
        fullyComputed = false;
        extra.push('Only rank 5 is shown: Riot’s 26.21 notes and champion reference disagree at intermediate ranks.');
        patchSources.push({ label: 'Riot Darius reference 16.21.1', url: `${itemRoot}/16.21.1/data/en_US/champion/Darius.json` });
      }
      const selected = bestRank(ranks);
      add(metric({ id: `champion-${key}`, kind: 'cooldown', label: `${name} · rank ${selected.rank} ${hasteKnown ? 'item-haste cooldown' : 'base cooldown'}`,
        unit: 'seconds', before: selected.before, after: selected.after, ranks,
        summary: `${show(Math.abs(selected.after - selected.before))}s ${selected.after < selected.before ? 'shorter' : 'longer'} at reference rank ${selected.rank}${hasteKnown ? ', using only your listed item haste' : ', before any haste'}.`,
        formula: hasteKnown ? `Base cooldown × 100 ÷ (100 + listed item haste): ${show(basesBefore[selected.rank - 1]!)} × 100 ÷ ${show(100 + before.haste!)} → ${show(basesAfter[selected.rank - 1]!)} × 100 ÷ ${show(100 + after.haste!)}` : `Base cooldown: ${show(selected.before)} → ${show(selected.after)} seconds`,
        assumptions: [rankNotice, ...(hasteKnown ? componentAssumptions : ['Listed item haste is unavailable. This shows base cooldowns only.']),
          'Cooldown resets, refunds, cast time and other haste sources are not simulated.', ...extra],
        sources: uniqueSources([...patchSources, ...(hasteKnown ? [...itemSources, hasteSource] : [])]),
      }));
      if (!hasteKnown) fullyComputed = false;
    } else {
      const ranks = basesBefore.map((base, index) => ({ rank: index + 1, before: base, after: basesAfter[index]! }));
      const selected = bestRank(ranks);
      add(metric({ id: `champion-base-${key}`, kind: 'damage', label: `${name} · rank ${selected.rank} base damage`, unit: 'raw damage',
        before: selected.before, after: selected.after, ranks,
        summary: `${signed(selected.after - selected.before)} base damage at reference rank ${selected.rank}, before stat scaling and damage reduction.`,
        formula: `Source base-damage term at rank ${selected.rank}: ${show(selected.before)} → ${show(selected.after)}`,
        assumptions: [rankNotice, 'This is the documented base-damage component, not total ability damage or damage actually dealt.'], sources: patchSources,
      }));
      if (a.ap || b.ap) {
        if (!a.ap || !b.ap || !before.stats || !after.stats) fullyComputed = false;
        else {
          const apBefore = before.stats.FlatMagicDamageMod!, apAfter = after.stats.FlatMagicDamageMod!;
          const ratiosBefore = expand(a.ap, length), ratiosAfter = expand(b.ap, length);
          const apRanks = ratiosBefore.map((ratio, index) => ({ rank: index + 1,
            before: rounded(ratio * apBefore), after: rounded(ratiosAfter[index]! * apAfter) }));
          const selectedAP = bestRank(apRanks);
          const sameRatioAcrossRanks = ratiosBefore.every(ratio => ratio === ratiosBefore[0]) && ratiosAfter.every(ratio => ratio === ratiosAfter[0]);
          add(metric({ id: `champion-ap-${key}`, kind: 'damage', label: `${name} · damage from listed item AP`, unit: 'raw damage',
            before: selectedAP.before, after: selectedAP.after, ...(sameRatioAcrossRanks ? {} : { ranks: apRanks }),
            summary: `${signed(selectedAP.after - selectedAP.before)} raw damage in this ability’s AP component${sameRatioAcrossRanks ? ' at every ability rank' : ` at reference rank ${selectedAP.rank}`}, using ${show(apBefore)} → ${show(apAfter)} listed item AP.`,
            formula: `${show(apBefore)} item AP × ${show(ratiosBefore[selectedAP.rank - 1]! * 100)}% = ${show(selectedAP.before)} → ${show(apAfter)} item AP × ${show(ratiosAfter[selectedAP.rank - 1]! * 100)}% = ${show(selectedAP.after)}`,
            assumptions: [...componentAssumptions, rankNotice, 'Only the AP-scaling contribution is calculated. Base damage, other scaling terms, target defenses and damage multipliers are excluded.'],
            sources: uniqueSources([...patchSources, ...itemSources]),
          }));
        }
      }
    }
    if (fullyComputed) report.uncomputedChanges -= group.length;
  }

  const completeItems = before.stats !== null && after.stats !== null && before.haste !== null && after.haste !== null && before.cost !== null && after.cost !== null;
  const partial = report.uncomputedChanges > 0 || !completeItems || !continuous || reworked;
  report.status = partial ? 'partial' : report.metrics.length ? 'ready' : 'unchanged';
  if (!completeItems) report.assumptions.push('One or more complete item-reference totals are unavailable. Missing values are withheld, not treated as zero.');
  if (!continuous) report.assumptions.push('The archived interval is incomplete. Champion mechanics are withheld across missing patches.');
  if (reworked) report.assumptions.push('A champion rework crosses this interval. Its ability calculations are withheld.');
  report.sources = uniqueSources([...report.sources, ...report.metrics.flatMap(entry => entry.sources)]);
  report.notice = report.metrics.length
    ? `${report.metrics.length} calculated ${report.metrics.length === 1 ? 'difference' : 'differences'} for the same recorded setup, from patch ${baseline.id} to ${latest.id}.${partial ? ' Some effects remain outside this calculation.' : ''}`
    : partial ? 'No supported numeric difference could be calculated with the available references. This does not mean the patch has no effect.'
      : 'No difference was found in the supported calculations for this recorded setup. Unmodeled interactions may still change.';
  return report;
}
