import { getAllPatches } from './data';
import type { RecallPatch } from './patch-context';
import { itemChangeIds } from './companion-item-identities';

/** Build-time records shared by automatic briefings and the optional legacy notebook. */
export const briefingArchive: RecallPatch[] = getAllPatches().map(patch => ({
  id: patch.id,
  version: patch.assetVersion,
  date: patch.releaseDate,
  champions: patch.champions.map(champion => champion.championId),
  items: patch.items.flatMap(item => itemChangeIds(patch.id, item).map(id => ({ id, name: item.name }))),
  records: [
    ...patch.champions.flatMap(champion => champion.abilities.flatMap(ability => ability.changes.flatMap(change => change.kind === 'numeric'
      ? [{ kind: 'champion' as const, targetId: champion.championId, label: `${ability.name} · ${change.label}`, before: change.before, after: change.after }] : []))),
    ...patch.items.flatMap(item => itemChangeIds(patch.id, item).flatMap(id => item.changes.flatMap(change => change.kind === 'numeric'
      ? [{ kind: 'item' as const, targetId: String(id), label: `${item.name} · ${change.label}`, before: change.before, after: change.after }] : []))),
  ],
}));
