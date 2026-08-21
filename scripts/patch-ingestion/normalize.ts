import type {
  Ability,
  Change,
  ChampionChange,
  Classification,
  Hotfix,
  ItemChange,
  Patch,
  SystemChange,
} from "../../src/lib/schema";
import { validatePatch } from "../../src/lib/schema";
import { classifyChange, rollupChampion } from "./classify";
import type { RawBlock, RawPatch, RawSection } from "./parse";

/**
 * Normalizer: raw parse tree → schema-valid Patch.
 *
 * Overrides (src/data/overrides/<id>.json) merge over parser output so a
 * wrong classification or missed change is a small data PR, never a parser
 * patch. Merge order: remove → replace → add → classificationOverrides →
 * addHotfixes. The result always passes validatePatch.
 */

export type PatchOverride = {
  classificationOverrides?: Record<string, Classification>;
  replaceChampions?: ChampionChange[];
  addChampions?: ChampionChange[];
  removeChampions?: string[];
  /** Match by name — corrections for parser residue in items/systems. */
  removeItems?: string[];
  removeSystems?: string[];
  replaceSystems?: SystemChange[];
  addHotfixes?: Hotfix[];
};

export type PatchMeta = {
  id: string;
  assetVersion: string;
  releaseDate: string;
  sourceUrl: string;
  ingestedAt: string;
};

/** "Q - Conquering Sands" → { ability: "Q", name: "Conquering Sands" } */
function parseBlockHeader(header: string): { ability: Ability; name: string } {
  const slotMatch = header.match(/^(Passive|Q|W|E|R)\s*-\s*(.+)$/i);
  if (slotMatch) {
    const slot = slotMatch[1]!.toLowerCase();
    return {
      ability: slot === "passive" ? "passive" : (slot.toUpperCase() as Ability),
      name: slotMatch[2]!.trim(),
    };
  }
  if (/^base stats?$/i.test(header)) return { ability: "base", name: "Base Stats" };
  return { ability: "other", name: header };
}

function toChanges(block: RawBlock): { changes: Change[]; directions: ("buff" | "nerf" | "neutral")[] } {
  const changes: Change[] = [];
  const directions: ("buff" | "nerf" | "neutral")[] = [];
  for (const line of block.lines) {
    if (line.before !== undefined && line.after !== undefined) {
      const { direction } = classifyChange(line.label, line.before, line.after);
      directions.push(direction);
      changes.push({
        kind: "numeric",
        label: line.label,
        before: line.before,
        after: line.after,
        direction,
      });
    } else if (line.text) {
      changes.push({ kind: "prose", label: line.label, text: line.text });
    }
  }
  return { changes, directions };
}

/**
 * Lowercase alphanumerics only, with "&" → "and" — so "Kha’Zix"/"Kha'Zix"
 * and "Nunu & Willump"/"Nunu and Willump" each collapse to one key.
 */
function canonicalName(name: string): string {
  return name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
}

/**
 * Compliance: we keep only a concise excerpt of Riot's context paragraph —
 * the first sentence, capped — and link to the source for the rest. Full
 * prose is never republished (spec §14, docs/DATA.md).
 */
export function summarizeContext(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const clean = text.trim();
  const firstSentence = clean.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? clean;
  if (firstSentence.length <= 220) return firstSentence;
  return `${firstSentence.slice(0, 200).replace(/\s+\S*$/, "")}…`;
}

function toChampion(section: RawSection, championIds: Record<string, string>): ChampionChange {
  const canon = new Map(Object.entries(championIds).map(([n, id]) => [canonicalName(n), id]));
  const championId = canon.get(canonicalName(section.name));
  if (!championId) {
    throw new Error(`Unmapped champion name from patch notes: "${section.name}"`);
  }
  const abilities = [];
  const allDirections: ("buff" | "nerf" | "neutral")[] = [];
  for (const block of section.blocks) {
    const { ability, name } = parseBlockHeader(block.header);
    const { changes, directions } = toChanges(block);
    allDirections.push(...directions);
    if (changes.length > 0) abilities.push({ ability, name, changes });
  }
  return {
    championId,
    classification: rollupChampion(allDirections),
    summary: summarizeContext(section.summary),
    abilities,
  };
}

function toItem(section: RawSection): ItemChange {
  const allChanges: Change[] = [];
  const allDirections: ("buff" | "nerf" | "neutral")[] = [];
  for (const block of section.blocks) {
    const { changes, directions } = toChanges(block);
    allChanges.push(...changes);
    allDirections.push(...directions);
  }
  return { name: section.name, classification: rollupChampion(allDirections), changes: allChanges };
}

function toSystem(section: RawSection): SystemChange {
  const allChanges: Change[] = [];
  for (const block of section.blocks) {
    allChanges.push(...toChanges(block).changes);
  }
  return { name: section.name, classification: "system", changes: allChanges };
}

export function normalizePatch(
  raw: RawPatch,
  meta: PatchMeta,
  championIds: Record<string, string>,
  override?: PatchOverride,
): Patch {
  let champions = raw.champions.map((c) => toChampion(c, championIds));

  if (override?.removeChampions) {
    const remove = new Set(override.removeChampions);
    champions = champions.filter((c) => !remove.has(c.championId));
  }
  if (override?.replaceChampions) {
    const byId = new Map(override.replaceChampions.map((c) => [c.championId, c]));
    champions = champions.map((c) => byId.get(c.championId) ?? c);
  }
  if (override?.addChampions) {
    champions = [...champions, ...override.addChampions];
  }
  if (override?.classificationOverrides) {
    champions = champions.map((c) => {
      const forced = override.classificationOverrides![c.championId];
      return forced ? { ...c, classification: forced } : c;
    });
  }

  let items = raw.items.map(toItem);
  if (override?.removeItems) {
    const remove = new Set(override.removeItems);
    items = items.filter((i) => !remove.has(i.name));
  }

  let systems = raw.systems.map(toSystem);
  if (override?.removeSystems) {
    const remove = new Set(override.removeSystems);
    systems = systems.filter((s) => !remove.has(s.name));
  }
  if (override?.replaceSystems) {
    const byName = new Map(override.replaceSystems.map((s) => [s.name, s]));
    systems = systems.map((s) => byName.get(s.name) ?? s);
  }

  const patch: Patch = {
    schemaVersion: 1,
    ...meta,
    champions,
    items,
    systems,
    ...(override?.addHotfixes ? { hotfixes: override.addHotfixes } : {}),
  };
  return validatePatch(patch);
}
