import { describe, it, expect } from "vitest";
import {
  parseExperience,
  experienceUrl,
  getBranch,
  comparableDeltas,
} from "../../src/components/home/incision-data";
describe("incision experience contract", () => {
  it("subtracts comparable ranks and refuses mismatched context", () => {
    expect(
      comparableDeltas(
        "15 / 14 / 13 / 12 / 11s",
        "12 / 11.5 / 11 / 10.5 / 10s",
      ),
    ).toEqual([-3, -2.5, -2, -1.5, -1]);
    expect(
      comparableDeltas(
        "20% Maximum Health",
        "10 / 15 / 20 / 25% Maximum Health (levels 1 / 7 / 13 / 19)",
      ),
    ).toBeNull();
    expect(comparableDeltas("10 (+20% AP)", "15 (+30% AP)")).toBeNull();
  });
  it("defaults to an honest archived overview", () =>
    expect(parseExperience("")).toEqual({
      patch: "26.16",
      champion: "Azir",
      change: null,
      view: "patch",
    }));
  it("normalizes unknown records without inventing content", () =>
    expect(parseExperience("?champion=Camille&change=made-up").view).toBe(
      "champion",
    ));
  it("preserves selected identity on return", () =>
    expect(parseExperience("?champion=Camille&view=patch").champion).toBe(
      "Camille",
    ));
  it("round-trips every real featured change", () => {
    for (const id of ["Azir", "Camille"] as const)
      for (const change of getBranch(id).records) {
        const state = {
          patch: "26.16",
          champion: id,
          change: change.id,
          view: "record",
        } as const;
        expect(parseExperience(experienceUrl(state).split("?")[1]!)).toEqual(
          state,
        );
      }
  });
  it("exposes one Azir record and five real Camille records", () => {
    expect(getBranch("Azir").records).toHaveLength(1);
    expect(getBranch("Camille").records).toHaveLength(5);
  });
});
