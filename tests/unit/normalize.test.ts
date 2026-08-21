import { it, expect } from "vitest";
import { normalizePatch } from "../../scripts/patch-ingestion/normalize";
import type { RawPatch } from "../../scripts/patch-ingestion/parse";
import type { ChampionChange } from "../../src/lib/schema";

const meta = {
  id: "26.16",
  assetVersion: "16.16.1",
  releaseDate: "2026-08-11",
  sourceUrl: "https://example.com/notes",
  ingestedAt: "2026-08-21T00:00:00.000Z",
};
const ids = { Azir: "Azir", "Kai'Sa": "Kaisa" };
const raw: RawPatch = {
  champions: [
    {
      name: "Azir",
      summary: "Buffing his laning.",
      blocks: [
        {
          header: "Q - Conquering Sands",
          lines: [{ label: "Damage", before: "60 / 80", after: "75 / 95" }],
        },
        {
          header: "Base Stats",
          lines: [{ label: "Health Growth", before: "110", after: "105" }],
        },
      ],
    },
  ],
  items: [
    {
      name: "Eclipse",
      blocks: [{ header: "General", lines: [{ label: "Attack Damage", before: "60", after: "55" }] }],
    },
  ],
  systems: [
    {
      name: "Fleet Footwork",
      blocks: [
        {
          header: "General",
          lines: [{ label: "Healing", before: "10", after: "8" }, { label: "Note", text: "Now melee only." }],
        },
      ],
    },
  ],
};

it("produces a schema-valid patch with classified changes", () => {
  const p = normalizePatch(raw, meta, ids);
  expect(p.id).toBe("26.16");
  const azir = p.champions[0]!;
  expect(azir.championId).toBe("Azir");
  // Q damage up = buff, base HP growth down = nerf -> mixed -> adjustment
  expect(azir.classification).toBe("adjustment");
  expect(azir.summary).toBe("Buffing his laning.");
  const q = azir.abilities.find((a) => a.ability === "Q")!;
  expect(q.name).toBe("Conquering Sands");
  expect(q.changes[0]).toMatchObject({ kind: "numeric", direction: "buff" });
  const base = azir.abilities.find((a) => a.ability === "base")!;
  expect(base.changes[0]).toMatchObject({ direction: "nerf" });
});

it("normalizes items and systems", () => {
  const p = normalizePatch(raw, meta, ids);
  expect(p.items[0]).toMatchObject({ name: "Eclipse", classification: "nerf" });
  expect(p.systems[0]!.classification).toBe("system");
  expect(p.systems[0]!.changes).toHaveLength(2);
});

it("maps punctuated names to ddragon ids", () => {
  const r: RawPatch = { ...raw, champions: [{ ...raw.champions[0]!, name: "Kai'Sa" }] };
  expect(normalizePatch(r, meta, ids).champions[0]!.championId).toBe("Kaisa");
});

it("maps names with curly apostrophes (as Riot renders them)", () => {
  const r: RawPatch = { ...raw, champions: [{ ...raw.champions[0]!, name: "Kai’Sa" }] };
  expect(normalizePatch(r, meta, ids).champions[0]!.championId).toBe("Kaisa");
});

it("maps ampersand names spelled with 'and'", () => {
  const withNunu = { ...ids, "Nunu & Willump": "Nunu" };
  const r: RawPatch = { ...raw, champions: [{ ...raw.champions[0]!, name: "Nunu and Willump" }] };
  expect(normalizePatch(r, meta, withNunu).champions[0]!.championId).toBe("Nunu");
});

it("throws on unmapped champion name", () => {
  const r: RawPatch = { ...raw, champions: [{ ...raw.champions[0]!, name: "Notachamp" }] };
  expect(() => normalizePatch(r, meta, ids)).toThrow(/Notachamp/);
});

it("detects passive and R ability slots", () => {
  const r: RawPatch = {
    ...raw,
    champions: [
      {
        name: "Azir",
        blocks: [
          { header: "Passive - Shurima's Legacy", lines: [{ label: "Damage", before: "1", after: "2" }] },
          { header: "R - Emperor's Divide", lines: [{ label: "Cooldown", before: "120", after: "100" }] },
        ],
      },
    ],
  };
  const abilities = normalizePatch(r, meta, ids).champions[0]!.abilities;
  expect(abilities.map((a) => a.ability)).toEqual(["passive", "R"]);
  expect(abilities[1]!.name).toBe("Emperor's Divide");
});

it("applies classification overrides", () => {
  const p = normalizePatch(raw, meta, ids, { classificationOverrides: { Azir: "rework" } });
  expect(p.champions[0]!.classification).toBe("rework");
});

it("removes and adds champions via override", () => {
  const add: ChampionChange = { championId: "Ahri", classification: "nerf", abilities: [] };
  const p = normalizePatch(raw, meta, ids, { removeChampions: ["Azir"], addChampions: [add] });
  expect(p.champions.map((c) => c.championId)).toEqual(["Ahri"]);
});

it("replaces a champion wholesale via override", () => {
  const replacement: ChampionChange = {
    championId: "Azir",
    classification: "buff",
    abilities: [],
  };
  const p = normalizePatch(raw, meta, ids, { replaceChampions: [replacement] });
  expect(p.champions[0]!.abilities).toEqual([]);
  expect(p.champions[0]!.classification).toBe("buff");
});

it("adds hotfixes via override", () => {
  const p = normalizePatch(raw, meta, ids, {
    addHotfixes: [{ date: "2026-08-13", description: "Azir hotfix.", championIds: ["Azir"] }],
  });
  expect(p.hotfixes).toHaveLength(1);
});
