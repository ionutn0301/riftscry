import type { LocalRecord, Records, RemoteRecord } from './storage';

/** Keep local edits until the exact server revision they were based on is saved. */
export function reconcileRecords(local: Records, remote: RemoteRecord[]): Records {
  const next = structuredClone(local);
  for (const row of remote) {
    const current = next[row.record_key];
    if (current?.dirty && current.revision !== row.revision) {
      // A successful upload whose response was lost can safely acknowledge itself.
      next[row.record_key] = current.value === row.value
        ? { value: row.value, revision: row.revision, dirty: false }
        : { ...current, conflict: row };
    } else if (!current?.dirty) {
      next[row.record_key] = { value: row.value, revision: row.revision, dirty: false };
    }
  }
  return next;
}
export function acknowledgeRecord(current: LocalRecord, sent: LocalRecord, revision: number): LocalRecord {
  return { ...current, revision, dirty: current.value !== sent.value, conflict: undefined };
}
