import { it, expect } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateAllPatches } from "../../scripts/patch-ingestion/validate";

it("flags malformed patch files", () => {
  const dir = mkdtempSync(join(tmpdir(), "riftscry-validate-"));
  writeFileSync(join(dir, "26.99.json"), JSON.stringify({ id: "26.99" }));
  const results = validateAllPatches(dir);
  expect(results).toHaveLength(1);
  expect(results[0]).toMatchObject({ file: "26.99.json", ok: false });
  expect(results[0]!.error).toBeTruthy();
});

it("accepts a valid patch file", () => {
  const dir = mkdtempSync(join(tmpdir(), "riftscry-validate-"));
  const valid = {
    schemaVersion: 1,
    id: "26.16",
    assetVersion: "16.16.1",
    releaseDate: "2026-08-11",
    sourceUrl: "https://example.com/notes",
    ingestedAt: "2026-08-21T00:00:00.000Z",
    champions: [],
    items: [],
    systems: [],
  };
  writeFileSync(join(dir, "26.16.json"), JSON.stringify(valid));
  expect(validateAllPatches(dir)).toEqual([{ file: "26.16.json", ok: true }]);
});

// Always-on guard: every committed patch file must be schema-valid.
// Any malformed file in src/data/patches fails the test suite (and thus CI).
it("all committed patch data is schema-valid", () => {
  const dataDir = "src/data/patches";
  if (!existsSync(dataDir) || readdirSync(dataDir).length === 0) return; // pre-ingestion
  const results = validateAllPatches(dataDir);
  const failures = results.filter((r) => !r.ok);
  expect(failures).toEqual([]);
});

// Referential integrity: every championId in every patch must exist in
// champions.json (catches ddragon junk entries like "Jade_Alistar").
it("all patch championIds resolve to known champions", () => {
  const dataDir = "src/data/patches";
  if (!existsSync(dataDir)) return;
  const known = new Set(
    Object.keys(
      (JSON.parse(readFileSync("src/data/champions.json", "utf8")) as {
        champions: Record<string, unknown>;
      }).champions,
    ),
  );
  const unknown: string[] = [];
  for (const file of readdirSync(dataDir).filter((f) => f.endsWith(".json"))) {
    const patch = JSON.parse(readFileSync(join(dataDir, file), "utf8")) as {
      champions: { championId: string }[];
    };
    for (const c of patch.champions) {
      if (!known.has(c.championId)) unknown.push(`${file}: ${c.championId}`);
    }
  }
  expect(unknown).toEqual([]);
});
