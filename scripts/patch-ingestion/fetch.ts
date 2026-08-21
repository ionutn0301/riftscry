import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";

/**
 * Network layer for ingestion. Raw responses are cached in .cache/ (gitignored)
 * so re-runs are offline and Riot prose is never committed to the repo.
 */

const CACHE_DIR = ".cache";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) RiftScry-ingestion (+https://github.com/riftscry)";

/** "26.16" → official patch notes URL (dots become dashes). */
export function notesUrlFor(id: string): string {
  const slug = id.replace(".", "-");
  return `https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-${slug}-notes/`;
}

/**
 * Riot has used two slug forms in 2026: the long
 * "league-of-legends-patch-26-16-notes" and (early season) the short
 * "patch-26-1-notes". Try in order.
 */
export function notesUrlCandidatesFor(id: string): string[] {
  const slug = id.replace(".", "-");
  return [
    notesUrlFor(id),
    `https://www.leagueoflegends.com/en-us/news/game-updates/patch-${slug}-notes/`,
  ];
}

/**
 * Map a player-facing patch id ("26.16") to the Data Dragon version that
 * shares its minor ("16.16.1"). ddragon versions are sorted newest-first;
 * the first match wins.
 */
export function resolveAssetVersion(id: string, ddragonVersions: string[]): string | null {
  const minor = id.split(".")[1];
  if (!minor) return null;
  for (const v of ddragonVersions) {
    const parts = v.split(".");
    if (parts.length === 3 && parts[1] === minor && /^\d+$/.test(parts[0] ?? "")) return v;
  }
  return null;
}

export async function fetchWithCache(url: string, cacheKey: string): Promise<string> {
  await mkdir(CACHE_DIR, { recursive: true });
  const cachePath = join(CACHE_DIR, cacheKey);
  try {
    await access(cachePath);
    return await readFile(cachePath, "utf8");
  } catch {
    // not cached yet
  }
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status} ${res.statusText} for ${url}`);
  }
  const body = await res.text();
  await writeFile(cachePath, body, "utf8");
  return body;
}

export async function fetchDdragonVersions(): Promise<string[]> {
  const body = await fetchWithCache("https://ddragon.leagueoflegends.com/api/versions.json", "versions.json");
  return JSON.parse(body) as string[];
}

export type ChampionIndexEntry = { id: string; name: string; title: string };

/** ddragon champion.json → keyed by display name ("Kai'Sa" → { id: "Kaisa", … }). */
export async function fetchChampionIndex(
  assetVersion: string,
): Promise<Record<string, ChampionIndexEntry>> {
  const url = `https://ddragon.leagueoflegends.com/cdn/${assetVersion}/data/en_US/champion.json`;
  const body = await fetchWithCache(url, `champion-${assetVersion}.json`);
  const json = JSON.parse(body) as {
    data: Record<string, { id: string; name: string; title: string }>;
  };
  const byName: Record<string, ChampionIndexEntry> = {};
  for (const entry of Object.values(json.data)) {
    byName[entry.name] = { id: entry.id, name: entry.name, title: entry.title };
  }
  return byName;
}
