import type { ChampionChange, Patch } from "./schema";
import rolesJson from "../data/roles.json";
import championsJson from "../data/champions.json";

/**
 * Read side of the data layer. All patch JSON is loaded at build time via
 * import.meta.glob (works in Astro and Vitest alike) — no runtime fetching.
 */

export type Role = "top" | "jungle" | "mid" | "adc" | "support";
export const ROLES: Role[] = ["top", "jungle", "mid", "adc", "support"];

const patchModules = import.meta.glob<Patch>("../data/patches/*.json", {
  eager: true,
  import: "default",
});

/** Numeric descending: "26.16" before "26.9". */
export function sortPatchIds(ids: string[]): string[] {
  const key = (id: string) => id.split(".").map(Number);
  return [...ids].sort((a, b) => {
    const [aMaj = 0, aMin = 0] = key(a);
    const [bMaj = 0, bMin = 0] = key(b);
    return bMaj - aMaj || bMin - aMin;
  });
}

let cache: Patch[] | null = null;

export function getAllPatches(): Patch[] {
  if (!cache) {
    const patches = Object.values(patchModules);
    const order = sortPatchIds(patches.map((p) => p.id));
    cache = order.map((id) => patches.find((p) => p.id === id)!);
  }
  return cache;
}

export function getLatestPatch(): Patch {
  const latest = getAllPatches()[0];
  if (!latest) throw new Error("No patch data found in src/data/patches");
  return latest;
}

export function getPatch(id: string): Patch | undefined {
  return getAllPatches().find((p) => p.id === id);
}

export type HistoryEntry = { patchId: string; releaseDate: string; change: ChampionChange };

/** Every patch that touched a champion, newest first. */
export function getChampionHistory(championId: string, patches?: Patch[]): HistoryEntry[] {
  const source = patches ?? getAllPatches();
  const entries: HistoryEntry[] = [];
  for (const p of source) {
    const change = p.champions.find((c) => c.championId === championId);
    if (change) entries.push({ patchId: p.id, releaseDate: p.releaseDate, change });
  }
  return entries;
}

export type ChampionMeta = { name: string; title: string };

export function getChampionMeta(): Record<string, ChampionMeta> {
  return championsJson.champions;
}

/** ddragon version for champion images, tracked with the data snapshot. */
export function getAssetVersion(): string {
  return championsJson.assetVersion;
}

export function getRoles(): Record<string, Role[]> {
  const { $comment: _ignored, ...rest } = rolesJson as Record<string, unknown>;
  return rest as Record<string, Role[]>;
}
