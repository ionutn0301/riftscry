import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  fetchChampionIndex,
  fetchDdragonVersions,
  fetchWithCache,
  notesUrlCandidatesFor,
  resolveAssetVersion,
} from "./fetch";
import { parsePatchHtml } from "./parse";
import { normalizePatch, type PatchOverride } from "./normalize";
import { classifyChange } from "./classify";
import { validateAllPatches } from "./validate";

/**
 * Ingestion CLI.
 *
 *   pnpm ingest 26.16          ingest one patch
 *   pnpm ingest 26.1 26.2 …    ingest several
 *   pnpm ingest --all          ingest every 26.x patch ddragon knows about
 *   pnpm ingest --validate     re-validate committed patch files (no network)
 *
 * Raw HTML is cached in .cache/ (gitignored); normalized JSON lands in
 * src/data/patches/<id>.json. Overrides in src/data/overrides/<id>.json are
 * merged during normalization.
 */

const PATCHES_DIR = "src/data/patches";
const OVERRIDES_DIR = "src/data/overrides";
const CHAMPIONS_FILE = "src/data/champions.json";
const SEASON_MAJOR = 26;

function extractReleaseDate(html: string): string {
  const m = html.match(/"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})/);
  if (!m) throw new Error("No datePublished found in notes page");
  return m[1]!;
}

function loadOverride(id: string): PatchOverride | undefined {
  const p = join(OVERRIDES_DIR, `${id}.json`);
  if (!existsSync(p)) return undefined;
  return JSON.parse(readFileSync(p, "utf8")) as PatchOverride;
}

async function ingestPatch(id: string, versions: string[]): Promise<boolean> {
  const assetVersion = resolveAssetVersion(id, versions);
  if (!assetVersion) {
    console.error(`✗ ${id}: no matching Data Dragon version`);
    return false;
  }
  // Riot used two slug forms in 2026; per-candidate cache keys keep the
  // recorded sourceUrl truthful.
  let html: string | null = null;
  let url = "";
  const errors: string[] = [];
  for (const candidate of notesUrlCandidatesFor(id)) {
    const slug = candidate.split("/").filter(Boolean).pop()!;
    try {
      html = await fetchWithCache(candidate, `${slug}.html`);
      url = candidate;
      break;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  if (html === null) {
    console.error(`✗ ${id}: ${errors.join(" | ")}`);
    return false;
  }

  const { raw, report } = parsePatchHtml(html);
  const championIndex = await fetchChampionIndex(assetVersion);
  const championIds = Object.fromEntries(Object.entries(championIndex).map(([name, e]) => [name, e.id]));

  const patch = normalizePatch(
    raw,
    {
      id,
      assetVersion,
      releaseDate: extractReleaseDate(html),
      sourceUrl: url,
      ingestedAt: new Date().toISOString(),
    },
    championIds,
    loadOverride(id),
  );

  mkdirSync(PATCHES_DIR, { recursive: true });
  writeFileSync(join(PATCHES_DIR, `${id}.json`), JSON.stringify(patch, null, 2) + "\n", "utf8");

  // Coverage report — unknown labels & unparsed blocks must be visible.
  const unknownLabels = new Set<string>();
  for (const section of [...raw.champions, ...raw.items, ...raw.systems]) {
    for (const block of section.blocks) {
      for (const line of block.lines) {
        if (line.before !== undefined && line.after !== undefined) {
          if (!classifyChange(line.label, line.before, line.after).known) unknownLabels.add(line.label);
        }
      }
    }
  }
  const skipped = Object.entries(report.skippedSections)
    .map(([k, v]) => `${k}(${v})`)
    .join(" ");
  console.log(
    `✓ ${id} → ${assetVersion} | champs ${report.championCount}, items ${patch.items.length}, ` +
      `systems ${patch.systems.length} | arrows ${report.arrowLines}, prose ${report.proseLines}` +
      (report.unparsedBlocks.length ? ` | UNPARSED: ${report.unparsedBlocks.join("; ")}` : "") +
      (unknownLabels.size ? ` | UNKNOWN LABELS: ${[...unknownLabels].join("; ")}` : "") +
      (skipped ? ` | skipped: ${skipped}` : ""),
  );
  return true;
}

async function refreshChampionsFile(versions: string[]): Promise<void> {
  const latest = versions.find((v) => /^\d+\.\d+\.\d+$/.test(v));
  if (!latest) throw new Error("No ddragon versions available");
  const index = await fetchChampionIndex(latest);
  const champions: Record<string, { name: string; title: string }> = {};
  for (const entry of Object.values(index).sort((a, b) => a.id.localeCompare(b.id))) {
    champions[entry.id] = { name: entry.name, title: entry.title };
  }
  mkdirSync("src/data", { recursive: true });
  writeFileSync(CHAMPIONS_FILE, JSON.stringify({ assetVersion: latest, champions }, null, 2) + "\n", "utf8");
  console.log(`✓ champions.json refreshed (${Object.keys(champions).length} champions @ ${latest})`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--validate")) {
    const results = validateAllPatches(PATCHES_DIR);
    for (const r of results) {
      console.log(`${r.ok ? "✓" : "✗"} ${r.file}${r.error ? ` — ${r.error}` : ""}`);
    }
    process.exitCode = results.some((r) => !r.ok) ? 1 : 0;
    return;
  }

  const versions = await fetchDdragonVersions();

  let ids: string[];
  if (args.includes("--all")) {
    // Every ddragon 16.x minor maps to a player-facing 26.x patch this season.
    const minors = [
      ...new Set(
        versions
          .filter((v) => /^16\.\d+\.\d+$/.test(v))
          .map((v) => Number(v.split(".")[1])),
      ),
    ].sort((a, b) => a - b);
    ids = minors.map((m) => `${SEASON_MAJOR}.${m}`);
  } else {
    ids = args.filter((a) => /^\d+\.\d+$/.test(a));
  }
  if (ids.length === 0) {
    console.error("Usage: pnpm ingest <id…> | --all | --validate");
    process.exitCode = 1;
    return;
  }

  let failures = 0;
  for (const id of ids) {
    const ok = await ingestPatch(id, versions);
    if (!ok) failures += 1;
  }
  await refreshChampionsFile(versions);

  const results = validateAllPatches(PATCHES_DIR);
  const invalid = results.filter((r) => !r.ok);
  for (const r of invalid) console.error(`✗ INVALID ${r.file}: ${r.error}`);
  process.exitCode = failures > 0 || invalid.length > 0 ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
