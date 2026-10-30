/** Compact client-side contracts. This module deliberately imports no archive data. */
export type BriefingPatch = { id: string; date: string; championIds: string[] };
export type BriefingChampion = { name: string; icon: string };
export type BriefingInsight = {
  id: string;
  championId: string;
  championName: string;
  patch: string;
  date: string;
  ability: string;
  label: string;
  source: string;
} & (
  | { kind: "numeric"; before: string; after: string; unit?: string }
  | { kind: "prose"; text: string }
);
export type ReadingResume = { href: string; label: string; updatedAt: string };
export type ReturnState = {
  reviewedPatch: string | null;
  resume: ReadingResume | null;
  storageAvailable: boolean;
};

export const REVIEWED_PATCH_KEY = "riftscry:last-reviewed-patch";
export const RESUME_KEY = "riftscry:resume";
export const RETURN_STATE_EVENT = "riftscry:briefing-change";

/** Accept local paths only, including ordinary query strings and fragments. */
export function safeInternalHref(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048 || !value.startsWith("/") || value.startsWith("//") || /[\u0000-\u0020\\]/.test(value)) return null;
  try {
    const base = "https://riftscry.invalid";
    const url = new URL(value, base);
    return url.origin === base ? url.pathname + url.search + url.hash : null;
  } catch { return null; }
}

/** A reading place never carries player identity, match review, or authoring state. */
export function safeReadingHref(value: unknown): string | null {
  const href = safeInternalHref(value);
  if (!href) return null;
  const url = new URL(href, "https://riftscry.invalid");
  if (!/^(?:\/champion\/[a-z0-9]+|\/patch\/\d+\.\d+|\/compare\/\d+\.\d+\/\d+\.\d+|\/explore)\/?$/.test(url.pathname)) return null;
  // Public archive URLs do not use these identity fields. Do not retain them
  // if a stale or externally supplied URL happens to append them to a reader.
  if ([...url.searchParams.keys()].some(key => /^(?:puuid|player|playerid|platform|match|matchid|review|ai)$/i.test(key))) return null;
  return href;
}

export function parseReadingResume(raw: string | null): ReadingResume | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<ReadingResume>;
    const href = safeReadingHref(value.href);
    if (!href || typeof value.label !== "string" || !value.label.trim() || typeof value.updatedAt !== "string" || !Number.isFinite(Date.parse(value.updatedAt))) return null;
    return { href, label: value.label.trim().slice(0, 120), updatedAt: value.updatedAt };
  } catch { return null; }
}

export function readReturnState(): ReturnState {
  const empty = { reviewedPatch: null, resume: null, storageAvailable: true };
  if (typeof window === "undefined") return empty;
  try {
    const reviewed = window.localStorage.getItem(REVIEWED_PATCH_KEY);
    return {
      reviewedPatch: reviewed && /^\d+\.\d+$/.test(reviewed) ? reviewed : null,
      resume: parseReadingResume(window.localStorage.getItem(RESUME_KEY)),
      storageAvailable: true,
    };
  } catch { return { ...empty, storageAvailable: false }; }
}

/** The scene controller can call this on a real reading destination. Device-local only. */
export function rememberReading(href: string, label: string): boolean {
  const safeHref = safeReadingHref(href);
  if (typeof window === "undefined" || !safeHref || !label.trim()) return false;
  try {
    const resume: ReadingResume = { href: safeHref, label: label.trim().slice(0, 120), updatedAt: new Date().toISOString() };
    window.localStorage.setItem(RESUME_KEY, JSON.stringify(resume));
    window.dispatchEvent(new Event(RETURN_STATE_EVENT));
    return true;
  } catch { return false; }
}

/** Call only following the visitor's explicit mark-reviewed action. */
export function markPatchReviewed(patchId: string): boolean {
  if (typeof window === "undefined" || !/^\d+\.\d+$/.test(patchId)) return false;
  try {
    window.localStorage.setItem(REVIEWED_PATCH_KEY, patchId);
    window.dispatchEvent(new Event(RETURN_STATE_EVENT));
    return true;
  } catch { return false; }
}

export type BriefingMode = "empty-archive" | "unpersonalized" | "first-visit" | "missing-baseline" | "caught-up" | "quiet-interval" | "new-records";

/** Archive entries arrive newest first, exactly as returned by getAllPatches(). */
export function deriveReturnBriefing(archive: BriefingPatch[], pool: string[], reviewedPatch: string | null) {
  const latest = archive[0];
  const poolIds = [...new Set(pool)];
  const baselineIndex = reviewedPatch ? archive.findIndex((patch) => patch.id === reviewedPatch) : -1;
  const newerPatches = baselineIndex >= 0 ? archive.slice(0, baselineIndex) : latest ? [latest] : [];
  const relevantPatches = newerPatches.filter((patch) => patch.championIds.some((id) => poolIds.includes(id)));
  const affectedChampionIds = poolIds.filter((id) => relevantPatches.some((patch) => patch.championIds.includes(id)));
  const mode: BriefingMode = !latest ? "empty-archive"
    : !poolIds.length ? "unpersonalized"
    : !reviewedPatch ? "first-visit"
    : baselineIndex < 0 ? "missing-baseline"
    : baselineIndex === 0 ? "caught-up"
    : !affectedChampionIds.length ? "quiet-interval"
    : "new-records";
  return { mode, latest, poolIds, newerPatches, relevantPatches, affectedChampionIds, reviewedPatch };
}

/** A daily archive selection, never a claim that the source record is new. */
export function dailyArchiveInsight(insights: BriefingInsight[], at = new Date()): BriefingInsight | undefined {
  if (!insights.length) return undefined;
  const time = at.getTime();
  const day = Number.isFinite(time) ? Math.floor(time / 86_400_000) : 0;
  return insights[((day % insights.length) + insights.length) % insights.length];
}
