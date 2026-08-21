import { it, expect } from "vitest";
import { buildSearchIndex } from "../../src/lib/search-index";
import type { Patch, ChampionChange } from "../../src/lib/schema";

function champ(championId: string, classification: ChampionChange["classification"]): ChampionChange {
  return { championId, classification, abilities: [] };
}
function patch(id: string, champions: ChampionChange[], extras?: Partial<Patch>): Patch {
  return {
    schemaVersion: 1,
    id,
    assetVersion: "16.16.1",
    releaseDate: "2026-08-11",
    sourceUrl: "https://example.com",
    ingestedAt: "2026-08-21T00:00:00.000Z",
    champions,
    items: [],
    systems: [],
    ...extras,
  };
}

const meta = {
  Ahri: { name: "Ahri", title: "the Nine-Tailed Fox" },
  Jinx: { name: "Jinx", title: "the Loose Cannon" },
};
const patches = [
  patch("26.16", [champ("Ahri", "nerf")], {
    items: [{ name: "Eclipse", classification: "nerf", changes: [] }],
    systems: [{ name: "Fleet Footwork", classification: "system", changes: [] }],
  }),
  patch("26.15", [champ("Ahri", "buff"), champ("Jinx", "buff")]),
];

const index = buildSearchIndex(patches, meta);

it("contains a champion entry with history href", () => {
  const ahri = index.find((e) => e.type === "champion" && e.label === "Ahri");
  expect(ahri).toMatchObject({ href: "/champion/ahri" });
});

it("contains per-patch champion entries only where changed", () => {
  const entries = index.filter((e) => e.label.startsWith("Patch") && e.label.includes("Ahri"));
  expect(entries.map((e) => e.href).sort()).toEqual([
    "/patch/26.15#ahri",
    "/patch/26.16#ahri",
  ]);
  expect(index.find((e) => e.href === "/patch/26.16#jinx")).toBeUndefined();
});

it("contains patch entries sorted newest first", () => {
  const ids = index.filter((e) => e.type === "patch").map((e) => e.href);
  expect(ids).toEqual(["/patch/26.16", "/patch/26.15"]);
});

it("contains item and system entries pointing at their newest patch", () => {
  expect(index.find((e) => e.type === "item" && e.label === "Eclipse")?.href).toBe("/patch/26.16");
  expect(index.find((e) => e.type === "system")?.label).toBe("Fleet Footwork");
});

it("champion entries carry search keywords", () => {
  const ahri = index.find((e) => e.type === "champion" && e.label === "Ahri")!;
  expect(ahri.keywords.join(" ")).toContain("ahri");
});
