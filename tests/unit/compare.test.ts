import { it, expect } from "vitest";
import { comparePatches } from "../../src/lib/compare";
import type { Patch, ChampionChange } from "../../src/lib/schema";

function patch(id: string, champions: ChampionChange[], extras?: Partial<Patch>): Patch {
  return {
    schemaVersion: 1,
    id,
    assetVersion: `16.${id.split(".")[1]}.1`,
    releaseDate: "2026-01-01",
    sourceUrl: "https://example.com",
    ingestedAt: "2026-08-21T00:00:00.000Z",
    champions,
    items: [],
    systems: [],
    ...extras,
  };
}
function champ(championId: string, classification: ChampionChange["classification"]): ChampionChange {
  return { championId, classification, abilities: [] };
}

const patches: Patch[] = [
  patch("26.12", [champ("Ahri", "buff"), champ("Jinx", "nerf")]),
  patch("26.13", [champ("Ahri", "nerf")], {
    items: [{ name: "Eclipse", classification: "nerf", changes: [] }],
  }),
  patch("26.14", [champ("Ahri", "nerf"), champ("Camille", "rework")], {
    systems: [{ name: "Fleet Footwork", classification: "system", changes: [] }],
  }),
];

it("aggregates changes in (older, newer]", () => {
  const r = comparePatches("26.14", "26.12", patches);
  expect(r.span).toEqual(["26.13", "26.14"]);
  const ahri = r.champions.find((c) => c.championId === "Ahri")!;
  expect(ahri.patches).toEqual([
    { patchId: "26.13", classification: "nerf" },
    { patchId: "26.14", classification: "nerf" },
  ]);
  expect(ahri.net).toBe("nerf");
  // Jinx changed only in 26.12 (the baseline) — excluded.
  expect(r.champions.find((c) => c.championId === "Jinx")).toBeUndefined();
});

it("net classification: rework dominates, mixed becomes adjustment", () => {
  const r = comparePatches("26.14", "26.12", patches);
  expect(r.champions.find((c) => c.championId === "Camille")!.net).toBe("rework");
  const r2 = comparePatches("26.13", "26.12", [
    patch("26.12", []),
    patch("26.13", [champ("Ahri", "buff")]),
  ]);
  expect(r2.champions[0]!.net).toBe("buff");
});

it("collects items and systems with their patches", () => {
  const r = comparePatches("26.14", "26.12", patches);
  expect(r.items).toEqual([{ name: "Eclipse", patches: ["26.13"] }]);
  expect(r.systems).toEqual([{ name: "Fleet Footwork", patches: ["26.14"] }]);
});

it("swaps reversed arguments deterministically", () => {
  const r = comparePatches("26.12", "26.14", patches);
  expect(r.newer).toBe("26.14");
  expect(r.older).toBe("26.12");
});

it("throws on unknown patch ids", () => {
  expect(() => comparePatches("26.14", "1.1", patches)).toThrow(/1\.1/);
});
