import { it, expect, describe } from "vitest";
import {
  sortPatchIds,
  getAllPatches,
  getLatestPatch,
  getPatch,
  getChampionHistory,
  getChampionMeta,
  getRoles,
} from "../../src/lib/data";

describe("sortPatchIds", () => {
  it("sorts numerically descending", () => {
    expect(sortPatchIds(["26.9", "26.16", "26.10", "26.1"])).toEqual([
      "26.16",
      "26.10",
      "26.9",
      "26.1",
    ]);
  });
});

describe("real dataset", () => {
  it("loads all season patches sorted desc", () => {
    const all = getAllPatches();
    expect(all.length).toBeGreaterThanOrEqual(16);
    const ids = all.map((patch) => patch.id);
    expect(ids).toEqual(sortPatchIds(ids));
    expect(all[all.length - 1]!.id).toBe("26.1");
  });

  it("getLatestPatch returns the first patch", () => {
    expect(getLatestPatch()).toEqual(getAllPatches()[0]);
  });

  it("getPatch finds by id and misses gracefully", () => {
    expect(getPatch("26.8")?.assetVersion).toBe("16.8.1");
    expect(getPatch("99.9")).toBeUndefined();
  });

  it("champion history is chronological desc and only contains real changes", () => {
    const history = getChampionHistory("Camille");
    expect(history.length).toBeGreaterThanOrEqual(1);
    const ids = history.map((h) => h.patchId);
    expect(ids).toEqual(sortPatchIds(ids));
    expect(ids).toContain("26.16");
    for (const h of history) expect(h.change.championId).toBe("Camille");
  });

  it("champion meta and roles are loaded", () => {
    expect(getChampionMeta()["Ahri"]!.name).toBe("Ahri");
    expect(getRoles()["Jinx"]).toContain("adc");
  });
});
