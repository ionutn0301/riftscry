import { readdirSync } from "node:fs";
import { fetchDdragonVersions } from "./patch-ingestion/fetch";

/**
 * Detect League patches that Data Dragon knows about but src/data/patches
 * lacks. Used by .github/workflows/check-new-patch.yml; prints GitHub
 * Actions outputs.
 *
 *   pnpm exec tsx scripts/check-new-patch.ts
 */

const SEASON_OFFSET = 10; // ddragon 16.x ↔ player-facing 26.x

/** Pure derivation, unit-tested: which player-facing ids are missing? */
export function deriveNextPatchIds(existing: string[], ddragonVersions: string[]): string[] {
  const have = new Set(existing);
  const missing: string[] = [];
  for (const v of ddragonVersions) {
    const m = v.match(/^(\d+)\.(\d+)\.\d+$/);
    if (!m) continue;
    const id = `${Number(m[1]) + SEASON_OFFSET}.${m[2]}`;
    if (!have.has(id) && !missing.includes(id)) missing.push(id);
  }
  return missing;
}

async function main() {
  const existing = readdirSync("src/data/patches")
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
  const versions = await fetchDdragonVersions();
  // Only consider the current season's major (the newest version's major).
  const newestMajor = versions.find((v) => /^\d+\.\d+\.\d+$/.test(v))?.split(".")[0];
  const candidates = versions.filter((v) => v.startsWith(`${newestMajor}.`));
  const missing = deriveNextPatchIds(existing, candidates);

  console.log(missing.length > 0 ? `New patches: ${missing.join(", ")}` : "No new patches.");
  const out = process.env.GITHUB_OUTPUT;
  if (out) {
    const { appendFileSync } = await import("node:fs");
    appendFileSync(out, `new_patches=${missing.join(" ")}\n`);
    appendFileSync(out, `has_new=${missing.length > 0}\n`);
  }
}

if (process.argv[1]?.includes("check-new-patch")) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
