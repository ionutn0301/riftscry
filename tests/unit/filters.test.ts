import { it, expect } from "vitest";
import { filterChampions } from "../../src/lib/filters";
import { EMPTY_FILTERS } from "../../src/lib/url-state";
import type { ChampionChange } from "../../src/lib/schema";
import type { Role } from "../../src/lib/data";

function champ(championId: string, classification: ChampionChange["classification"]): ChampionChange {
  return { championId, classification, abilities: [] };
}

const changes = [
  champ("Ahri", "nerf"),
  champ("Jinx", "buff"),
  champ("LeeSin", "buff"),
  champ("Thresh", "adjustment"),
];
const roles: Record<string, Role[]> = {
  Ahri: ["mid"],
  Jinx: ["adc"],
  LeeSin: ["jungle"],
  Thresh: ["support"],
};
const meta = {
  Ahri: { name: "Ahri", title: "the Nine-Tailed Fox" },
  Jinx: { name: "Jinx", title: "the Loose Cannon" },
  LeeSin: { name: "Lee Sin", title: "the Blind Monk" },
  Thresh: { name: "Thresh", title: "the Chain Warden" },
};

it("no filters returns everything", () => {
  expect(filterChampions(changes, EMPTY_FILTERS, roles, [], meta)).toHaveLength(4);
});

it("filters by explicit champion ids (case-insensitive)", () => {
  const out = filterChampions(changes, { ...EMPTY_FILTERS, champions: ["ahri", "leesin"] }, roles, [], meta);
  expect(out.map((c) => c.championId)).toEqual(["Ahri", "LeeSin"]);
});

it("filters by role overlap", () => {
  const out = filterChampions(changes, { ...EMPTY_FILTERS, role: "adc" }, roles, [], meta);
  expect(out.map((c) => c.championId)).toEqual(["Jinx"]);
});

it("filters by classification type", () => {
  const out = filterChampions(changes, { ...EMPTY_FILTERS, type: "buff" }, roles, [], meta);
  expect(out.map((c) => c.championId)).toEqual(["Jinx", "LeeSin"]);
});

it("filters by pool when enabled", () => {
  const out = filterChampions(changes, { ...EMPTY_FILTERS, pool: true }, roles, ["Thresh"], meta);
  expect(out.map((c) => c.championId)).toEqual(["Thresh"]);
});

it("pool flag with empty pool returns everything", () => {
  expect(filterChampions(changes, { ...EMPTY_FILTERS, pool: true }, roles, [], meta)).toHaveLength(4);
});

it("text query matches display names too", () => {
  const out = filterChampions(changes, { ...EMPTY_FILTERS, q: "lee" }, roles, [], meta);
  expect(out.map((c) => c.championId)).toEqual(["LeeSin"]);
});

it("filters compose (role AND type)", () => {
  const out = filterChampions(
    changes,
    { ...EMPTY_FILTERS, role: "jungle", type: "buff" },
    roles,
    [],
    meta,
  );
  expect(out.map((c) => c.championId)).toEqual(["LeeSin"]);
});
