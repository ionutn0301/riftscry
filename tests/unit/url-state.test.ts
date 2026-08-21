import { it, expect } from "vitest";
import { EMPTY_FILTERS, parseFilters, serializeFilters } from "../../src/lib/url-state";

it("empty filters serialize to empty string", () => {
  expect(serializeFilters(EMPTY_FILTERS)).toBe("");
});

it("round-trips a full filter set", () => {
  const f = {
    champions: ["ahri", "jinx"],
    role: "mid" as const,
    type: "nerf" as const,
    pool: true,
    q: "orb",
  };
  expect(parseFilters(serializeFilters(f))).toEqual(f);
});

it("serializes with stable param order and omits defaults", () => {
  const s = serializeFilters({ ...EMPTY_FILTERS, role: "adc", champions: ["jinx"] });
  expect(s).toBe("champions=jinx&role=adc");
});

it("parses tolerantly: unknown params ignored, bad values dropped", () => {
  const f = parseFilters("?role=goalkeeper&type=nerf&x=1&champions=");
  expect(f.role).toBeNull();
  expect(f.type).toBe("nerf");
  expect(f.champions).toEqual([]);
});

it("accepts a leading question mark or none", () => {
  expect(parseFilters("pool=1").pool).toBe(true);
  expect(parseFilters("?pool=1").pool).toBe(true);
});

it("champion ids are lowercased and deduped", () => {
  expect(parseFilters("champions=Ahri,ahri,JINX").champions).toEqual(["ahri", "jinx"]);
});
