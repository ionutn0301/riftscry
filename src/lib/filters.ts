import type { ChampionChange } from "./schema";
import type { ChampionMeta, Role } from "./data";
import type { PatchFilters } from "./url-state";

/** Apply patch-page filters to a champion change list. Pure; order-preserving. */
export function filterChampions(
  changes: ChampionChange[],
  filters: PatchFilters,
  roles: Record<string, Role[]>,
  pool: string[],
  meta: Record<string, ChampionMeta>,
): ChampionChange[] {
  const wanted = new Set(filters.champions.map((c) => c.toLowerCase()));
  const poolSet = new Set(pool.map((c) => c.toLowerCase()));
  const q = filters.q.trim().toLowerCase();

  return changes.filter((c) => {
    const id = c.championId.toLowerCase();
    if (wanted.size > 0 && !wanted.has(id)) return false;
    if (filters.role && !(roles[c.championId] ?? []).includes(filters.role)) return false;
    if (filters.type && c.classification !== filters.type) return false;
    if (filters.pool && poolSet.size > 0 && !poolSet.has(id)) return false;
    if (q) {
      const name = meta[c.championId]?.name.toLowerCase() ?? "";
      if (!id.includes(q) && !name.includes(q)) return false;
    }
    return true;
  });
}
