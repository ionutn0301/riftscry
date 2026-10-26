import type { ChampionChange, Patch } from "./schema";

export type ArchiveRecord = {
  patchId: string;
  date: string;
  source: string;
  change: ChampionChange;
};
export type ArchiveChampion = {
  id: string;
  name: string;
  title: string;
  roles?: string[];
  records: ArchiveRecord[];
};
export type ArchivePatch = { id: string; date: string; count: number };
export type ArchiveData = {
  champions: ArchiveChampion[];
  patches: ArchivePatch[];
  patchDetails?: Patch[];
};

export function recordsBetween(
  champion: ArchiveChampion,
  patches: ArchivePatch[],
  a: string,
  b: string,
): ArchiveRecord[] {
  const first = patches.findIndex((patch) => patch.id === a);
  const second = patches.findIndex((patch) => patch.id === b);
  if (first < 0 || second < 0 || first === second) return [];
  const included = new Set(
    patches
      .slice(Math.min(first, second), Math.max(first, second))
      .map((patch) => patch.id),
  );
  return champion.records
    .filter((record) => included.has(record.patchId))
    .reverse();
}

export function archiveDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
