import { describe, it, expect } from "vitest";
import { validatePatch } from "../../src/lib/schema";

const minimal = {
  schemaVersion: 1,
  id: "26.16",
  assetVersion: "16.16.1",
  releaseDate: "2026-08-11",
  sourceUrl:
    "https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-16-notes/",
  ingestedAt: "2026-08-21T00:00:00.000Z",
  champions: [],
  items: [],
  systems: [],
};

describe("PatchSchema", () => {
  it("accepts a minimal valid patch", () => {
    expect(validatePatch(minimal).id).toBe("26.16");
  });

  it("accepts a full champion change", () => {
    const p = {
      ...minimal,
      champions: [
        {
          championId: "Ahri",
          classification: "nerf",
          abilities: [
            {
              ability: "Q",
              name: "Orb of Deception",
              changes: [
                {
                  kind: "numeric",
                  label: "AP Ratio",
                  before: "45%",
                  after: "40%",
                  unit: "%",
                  direction: "nerf",
                },
              ],
            },
          ],
        },
      ],
    };
    expect(validatePatch(p).champions[0]!.abilities[0]!.changes[0]).toMatchObject({
      kind: "numeric",
      direction: "nerf",
    });
  });

  it("accepts prose changes, items, systems and hotfixes", () => {
    const p = {
      ...minimal,
      champions: [
        {
          championId: "Sylas",
          classification: "rework",
          summary: "Kit adjusted around W sustain.",
          abilities: [
            {
              ability: "W",
              name: "Kingslayer",
              changes: [{ kind: "prose", label: "Healing", text: "Now scales with missing health." }],
            },
          ],
        },
      ],
      items: [
        {
          itemId: 3153,
          name: "Blade of the Ruined King",
          classification: "buff",
          changes: [
            { kind: "numeric", label: "Attack Damage", before: "40", after: "45", direction: "buff" },
          ],
        },
      ],
      systems: [
        {
          name: "Baron Nashor",
          classification: "system",
          changes: [{ kind: "prose", label: "Spawn", text: "Spawn timer adjusted." }],
        },
      ],
      hotfixes: [
        { date: "2026-08-13", description: "Azir Q damage hotfixed down.", championIds: ["Azir"] },
      ],
    };
    const parsed = validatePatch(p);
    expect(parsed.items[0]!.itemId).toBe(3153);
    expect(parsed.hotfixes?.[0]!.championIds).toEqual(["Azir"]);
  });

  it("rejects a bad patch id", () => {
    expect(() => validatePatch({ ...minimal, id: "sixteen" })).toThrow();
  });

  it("rejects an unknown classification", () => {
    const p = {
      ...minimal,
      champions: [{ championId: "Ahri", classification: "mega-buff", abilities: [] }],
    };
    expect(() => validatePatch(p)).toThrow();
  });

  it("rejects missing provenance fields", () => {
    const { sourceUrl: _dropped, ...rest } = minimal;
    expect(() => validatePatch(rest)).toThrow();
  });

  it("rejects a numeric change without direction", () => {
    const p = {
      ...minimal,
      champions: [
        {
          championId: "Ahri",
          classification: "nerf",
          abilities: [
            {
              ability: "Q",
              name: "Orb of Deception",
              changes: [{ kind: "numeric", label: "AP Ratio", before: "45%", after: "40%" }],
            },
          ],
        },
      ],
    };
    expect(() => validatePatch(p)).toThrow();
  });
});
