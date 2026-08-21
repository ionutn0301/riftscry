import type { Classification, Patch } from "./schema";
import { sortPatchIds } from "./data";

/**
 * Cross-patch compare: everything that happened in the half-open range
 * (older, newer]. Comparing 26.16 to 26.12 answers "what changed since
 * 26.12" — the baseline patch itself is excluded.
 */

export type CompareEntry = {
  championId: string;
  patches: { patchId: string; classification: Classification }[];
  net: Classification;
};

export type CompareResult = {
  newer: string;
  older: string;
  /** Patch ids inside the range, oldest → newest. */
  span: string[];
  champions: CompareEntry[];
  items: { name: string; patches: string[] }[];
  systems: { name: string; patches: string[] }[];
};

function netOf(classifications: Classification[]): Classification {
  if (classifications.includes("rework")) return "rework";
  if (classifications.every((c) => c === "buff")) return "buff";
  if (classifications.every((c) => c === "nerf")) return "nerf";
  return "adjustment";
}

export function comparePatches(aId: string, bId: string, patches: Patch[]): CompareResult {
  for (const id of [aId, bId]) {
    if (!patches.some((p) => p.id === id)) throw new Error(`Unknown patch id: ${id}`);
  }
  const [newer, older] = sortPatchIds([aId, bId]) as [string, string];

  const descending = sortPatchIds(patches.map((p) => p.id));
  const inRange = descending.filter((id) => {
    const newerIdx = descending.indexOf(newer);
    const olderIdx = descending.indexOf(older);
    const idx = descending.indexOf(id);
    return idx >= newerIdx && idx < olderIdx;
  });
  const span = [...inRange].reverse(); // oldest → newest
  const spanPatches = span.map((id) => patches.find((p) => p.id === id)!);

  const byChampion = new Map<string, { patchId: string; classification: Classification }[]>();
  const items = new Map<string, string[]>();
  const systems = new Map<string, string[]>();
  for (const p of spanPatches) {
    for (const c of p.champions) {
      const list = byChampion.get(c.championId) ?? [];
      list.push({ patchId: p.id, classification: c.classification });
      byChampion.set(c.championId, list);
    }
    for (const i of p.items) items.set(i.name, [...(items.get(i.name) ?? []), p.id]);
    for (const s of p.systems) systems.set(s.name, [...(systems.get(s.name) ?? []), p.id]);
  }

  return {
    newer,
    older,
    span,
    champions: [...byChampion.entries()]
      .map(([championId, entries]) => ({
        championId,
        patches: entries,
        net: netOf(entries.map((e) => e.classification)),
      }))
      .sort((a, b) => a.championId.localeCompare(b.championId)),
    items: [...items.entries()].map(([name, ps]) => ({ name, patches: ps })),
    systems: [...systems.entries()].map(([name, ps]) => ({ name, patches: ps })),
  };
}
