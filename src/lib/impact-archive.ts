import { getAllPatches } from './data';
import { itemChangeIds } from './companion-item-identities';
import type { ImpactPatch } from './player/patch-impact';

/** Keep ability identity and prose blockers: numeric text alone is not a mechanic. */
export const impactArchive: ImpactPatch[] = getAllPatches().map(patch => ({
  id: patch.id,
  version: patch.assetVersion,
  date: patch.releaseDate,
  sourceUrl: patch.sourceUrl,
  champions: patch.champions.map(champion => champion.championId),
  reworkedChampions: patch.champions.filter(champion => champion.classification === 'rework').map(champion => champion.championId),
  records: [
    ...patch.champions.flatMap(champion => champion.abilities.flatMap(ability => ability.changes.flatMap(change => change.kind === 'numeric'
      ? [{ kind: 'champion' as const, targetId: champion.championId, ability: ability.ability, abilityName: ability.name,
        label: change.label, before: change.before, after: change.after, unit: change.unit }] : []))),
    ...patch.items.flatMap(item => itemChangeIds(patch.id, item).flatMap(id => item.changes.flatMap(change => change.kind === 'numeric'
      ? [{ kind: 'item' as const, targetId: String(id), label: change.label,
        before: change.before, after: change.after, unit: change.unit }] : []))),
  ],
  blockers: [
    ...patch.champions.flatMap(champion => champion.abilities.flatMap(ability => ability.changes.flatMap(change => change.kind === 'prose'
      ? [{ kind: 'champion' as const, targetId: champion.championId, ability: ability.ability, label: change.label }] : []))),
    ...patch.items.flatMap(item => itemChangeIds(patch.id, item).flatMap(id => item.changes.flatMap(change => change.kind === 'prose'
      ? [{ kind: 'item' as const, targetId: String(id), label: `${item.name} · ${change.label}` }] : []))),
  ],
}));
