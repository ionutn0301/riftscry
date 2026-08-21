import { it, expect } from "vitest";
import { notesUrlFor, resolveAssetVersion } from "../../scripts/patch-ingestion/fetch";

it("derives the notes URL from a patch id", () => {
  expect(notesUrlFor("26.16")).toBe(
    "https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-16-notes/",
  );
});

it("derives single-digit minor URLs", () => {
  expect(notesUrlFor("26.1")).toBe(
    "https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-1-notes/",
  );
});

it("resolves the asset version by minor match", () => {
  expect(resolveAssetVersion("26.16", ["16.16.1", "16.15.1", "16.14.1"])).toBe("16.16.1");
});

it("resolves older minors", () => {
  expect(resolveAssetVersion("26.4", ["16.16.1", "16.5.1", "16.4.1", "16.3.1"])).toBe("16.4.1");
});

it("prefers the first (newest) matching build", () => {
  expect(resolveAssetVersion("26.16", ["16.16.2", "16.16.1"])).toBe("16.16.2");
});

it("returns null when no minor matches", () => {
  expect(resolveAssetVersion("26.99", ["16.16.1"])).toBeNull();
});

it("ignores non-league versions like lolpatch_ entries", () => {
  expect(resolveAssetVersion("26.16", ["lolpatch_7.20", "16.16.1"])).toBe("16.16.1");
});
