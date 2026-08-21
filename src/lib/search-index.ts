import type { Patch } from "./schema";
import type { ChampionMeta } from "./data";
import { sortPatchIds } from "./data";

/**
 * Build-time search index for the command palette. Small, flat, serialized
 * into the island's props — no runtime fetching.
 */

export type SearchEntry = {
  type: "champion" | "patch" | "item" | "system";
  label: string;
  sub?: string;
  href: string;
  keywords: string[];
};

export function buildSearchIndex(
  patches: Patch[],
  meta: Record<string, ChampionMeta>,
): SearchEntry[] {
  const ordered = sortPatchIds(patches.map((p) => p.id)).map(
    (id) => patches.find((p) => p.id === id)!,
  );
  const entries: SearchEntry[] = [];

  // Champions (history pages) + per-patch champion jumps.
  for (const [id, m] of Object.entries(meta)) {
    entries.push({
      type: "champion",
      label: m.name,
      sub: m.title,
      href: `/champion/${id.toLowerCase()}`,
      keywords: [id.toLowerCase(), m.name.toLowerCase()],
    });
  }
  for (const p of ordered) {
    for (const c of p.champions) {
      const name = meta[c.championId]?.name ?? c.championId;
      entries.push({
        type: "champion",
        label: `Patch ${p.id}: ${name}`,
        sub: c.classification,
        href: `/patch/${p.id}#${c.championId.toLowerCase()}`,
        keywords: [name.toLowerCase(), p.id, c.classification],
      });
    }
  }

  // Patches.
  for (const p of ordered) {
    entries.push({
      type: "patch",
      label: `Patch ${p.id}`,
      sub: p.releaseDate,
      href: `/patch/${p.id}`,
      keywords: [p.id, "patch"],
    });
  }

  // Items and systems point at the newest patch that touched them.
  const seenItems = new Set<string>();
  const seenSystems = new Set<string>();
  for (const p of ordered) {
    for (const i of p.items) {
      if (seenItems.has(i.name)) continue;
      seenItems.add(i.name);
      entries.push({
        type: "item",
        label: i.name,
        sub: `last changed ${p.id}`,
        href: `/patch/${p.id}`,
        keywords: [i.name.toLowerCase(), "item"],
      });
    }
    for (const s of p.systems) {
      if (seenSystems.has(s.name)) continue;
      seenSystems.add(s.name);
      entries.push({
        type: "system",
        label: s.name,
        sub: `last changed ${p.id}`,
        href: `/patch/${p.id}`,
        keywords: [s.name.toLowerCase(), "system"],
      });
    }
  }

  return entries;
}
