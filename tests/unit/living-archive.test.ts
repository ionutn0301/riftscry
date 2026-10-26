import { describe, expect, it } from "vitest";
import { getAllPatches, getChampionHistory } from "../../src/lib/data";
import {
  recordsBetween,
  archiveDate,
  type ArchiveChampion,
} from "../../src/lib/living-archive";
import { comparePatches } from "../../src/lib/compare";
const patches = getAllPatches();
const index = patches.map((patch) => ({
  id: patch.id,
  date: patch.releaseDate,
  count: patch.champions.length,
}));
const champion: ArchiveChampion = {
  id: "Azir",
  name: "Azir",
  title: "",
  records: getChampionHistory("Azir").map((entry) => ({
    patchId: entry.patchId,
    date: entry.releaseDate,
    source: patches.find((patch) => patch.id === entry.patchId)!.sourceUrl,
    change: entry.change,
  })),
};
describe("Living Archive record interval", () => {
  it("uses the existing half-open comparison semantics in either endpoint order", () => {
    for (const a of index)
      for (const b of index) {
        const result = recordsBetween(champion, index, a.id, b.id);
        const expected = comparePatches(a.id, b.id, patches).span.filter((id) =>
          champion.records.some((record) => record.patchId === id),
        );
        expect(result.map((record) => record.patchId)).toEqual(expected);
      }
  });
  it("does not infer missing data for unknown or identical endpoints", () => {
    expect(recordsBetween(champion, index, "invalid", "26.16")).toEqual([]);
    expect(recordsBetween(champion, index, "26.16", "26.16")).toEqual([]);
  });
  it("keeps full rank values and provenance on records", () => {
    const record = recordsBetween(champion, index, "26.15", "26.16")[0]!;
    expect(record.change.abilities[0]!.changes[0]).toMatchObject({
      before: "60 / 80 / 100 / 120 / 140 (+35 / 40 / 45 / 50 / 55% AP)",
      after: "75 / 95 / 115 / 135 / 155 (+35 / 40 / 45 / 50 / 55% AP)",
    });
    expect(record.source).toContain("leagueoflegends.com");
    expect(archiveDate(record.date)).toBe("11 Aug 2026");
  });
});
