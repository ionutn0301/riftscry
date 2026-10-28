export type RecallChange = { kind: 'champion' | 'item'; targetId: string; label: string; before: string; after: string };
export type RecallPatch = { id: string; version: string; date: string; champions: string[]; items: { id?: number; name: string }[]; records?: RecallChange[] };

/** Resolve actual archive metadata, including Riot's 16.x game / 26.x public naming. */
export function archivePatchForVersion(version: string, archive: RecallPatch[]): string | null {
  const prefix = version.split('.').slice(0, 2).join('.');
  return archive.find(entry => entry.id === version || entry.version.split('.').slice(0, 2).join('.') === prefix)?.id ?? null;
}
export function patchReview(record: { champion: string; patch: string; reviewedPatch: string | null; items?: { id: number; name: string }[] }, archive: RecallPatch[]) {
  const latest = archive[0]?.id ?? '';
  const baseline = archivePatchForVersion(record.reviewedPatch ?? record.patch, archive);
  const baselineIndex = baseline ? archive.findIndex(entry => entry.id === baseline) : -1;
  const status: 'current' | 'review' | 'unknown' = !latest || baselineIndex < 0 ? 'unknown' : baselineIndex === 0 ? 'current' : 'review';
  // Item IDs are authoritative. Names alone do not establish an affected-item match.
  const itemIds = new Set(record.items?.map(item => item.id) ?? []);
  const changes = baselineIndex > 0 ? archive.slice(0, baselineIndex).filter(entry =>
    (!!record.champion && entry.champions.includes(record.champion)) || entry.items.some(item => item.id != null && itemIds.has(item.id)))
    .map(entry => ({ ...entry, records: entry.records?.filter(change => change.kind === 'champion'
      ? !!record.champion && change.targetId === record.champion : itemIds.has(Number(change.targetId))) })) : [];
  return { status, baseline, latest, changes };
}
