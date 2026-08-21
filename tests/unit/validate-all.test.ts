import { it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { existsSync, readdirSync } from "node:fs";
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
