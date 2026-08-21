import { it, expect } from "vitest";
import { deriveNextPatchIds } from "../../scripts/check-new-patch";

it("maps missing ddragon minors to player-facing ids", () => {
  expect(deriveNextPatchIds(["26.16", "26.15"], ["16.17.1", "16.16.1", "16.15.1"])).toEqual([
    "26.17",
  ]);
});

it("returns empty when data is current", () => {
  expect(deriveNextPatchIds(["26.16"], ["16.16.1"])).toEqual([]);
});

it("ignores non-standard version strings and dedupes builds", () => {
  expect(deriveNextPatchIds([], ["lolpatch_7.20", "16.17.2", "16.17.1"])).toEqual(["26.17"]);
});
