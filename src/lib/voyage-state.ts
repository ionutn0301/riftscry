import type { JourneyModel } from './voyage-data';

export type JourneyRecord = JourneyModel['records'][number];

/** Archive order is newest first. A comparison includes (older, newer]. */
export function voyagePeriod(model: JourneyModel, older: string, newer: string) {
  const start = model.archive.findIndex((patch) => patch.id === newer);
  const end = model.archive.findIndex((patch) => patch.id === older);
  const valid = start >= 0 && end > start;
  const patchIds = valid ? new Set(model.archive.slice(start, end).map((patch) => patch.id)) : new Set<string>();
  return { valid, records: model.records.filter((record) => patchIds.has(record.patch)), patchCount: patchIds.size };
}

export function voyageFields(records: JourneyRecord[]) {
  return [...new Map(records.map((record) => [record.field, record])).values()];
}

export function voyageSelection(records: JourneyRecord[], field = '', event = ''): JourneyRecord | undefined {
  const explicit = event ? records.find((record) => record.id === event) : undefined;
  if (explicit) return explicit;
  const focused = records.filter((record) => record.field === field || record.ability === field);
  if (focused.length) return focused[0];
  const fields = voyageFields(records);
  const repeated = fields.find((candidate) => records.filter((record) => record.field === candidate.field).length > 1);
  return records.find((record) => record.field === repeated?.field) ?? records[0];
}

export function recordText(record: JourneyRecord) {
  return record.change.kind === 'numeric'
    ? `${record.change.before} → ${record.change.after}${record.change.unit ? ` ${record.change.unit}` : ''}`
    : record.change.text;
}

/** Explain only source connections established by this field's recorded values. */
export function voyageConnection(records: JourneyRecord[]): string {
  if (!records.length) return '';
  if (records.length === 1) return 'One recorded change is available for this field. A single record cannot establish a connected trail.';
  const firstField = records[0]!.field;
  if (records.some((record) => record.field !== firstField)) return 'These records describe different fields. Read their source changes separately; they do not establish one connected trail.';

  const ordered = [...records].sort((left, right) => left.date.localeCompare(right.date));
  type NumericChange = Extract<JourneyRecord['change'], { kind: 'numeric' }>;
  const changes = ordered.map((record) => record.change).filter((change): change is NumericChange => change.kind === 'numeric');
  if (changes.length !== ordered.length) return 'These records include rule changes. Compare their complete source wording in chronological order; no numeric continuity is inferred.';

  const normalize = (value: string) => value.trim().replace(/\s+/g, ' ');
  const patchParts = (patch: string) => /^(\d+)\.(\d+)$/.exec(patch);
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1]!;
    const next = ordered[index]!;
    const previousPatch = patchParts(previous.patch);
    const nextPatch = patchParts(next.patch);
    const previousDate = Date.parse(previous.date);
    const nextDate = Date.parse(next.date);
    if (!previousPatch || !nextPatch || previousPatch[1] !== nextPatch[1]
      || Number(nextPatch[2]) !== Number(previousPatch[2]) + 1
      || !Number.isFinite(previousDate) || !Number.isFinite(nextDate) || nextDate <= previousDate) {
      return 'These source records do not establish consecutive patches in chronological order. Read each change separately; continuity across the gap is not established.';
    }
    if (normalize(changes[index - 1]!.unit ?? '') !== normalize(changes[index]!.unit ?? '')) {
      return 'The recorded units or conditions differ. Read the complete source values; these records do not establish a continuous trail.';
    }
    if (normalize(changes[index - 1]!.after) !== normalize(changes[index]!.before)) {
      return 'A later before value does not exactly match the preceding after value. The complete source records do not establish a continuous trail.';
    }
  }

  const first = ordered[0]!;
  const last = ordered[ordered.length - 1]!;
  if (normalize(changes[0]!.before) === normalize(changes[changes.length - 1]!.after)) {
    return `${first.change.label}: the recorded values returned to their starting values across ${first.patch}–${last.patch}. Consecutive source records connect exactly. This describes this field only, not the champion’s overall strength.`;
  }
  return `${first.change.label}: these ${ordered.length} records form a continuous trail across consecutive patches; each later before value matches the preceding after value. This describes the recorded field only, not the champion’s overall strength.`;
}

export function normalizeChampionName(value: string) {
  return value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '');
}
