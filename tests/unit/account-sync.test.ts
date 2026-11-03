import { describe, expect, it } from 'vitest';
import { acknowledgeRecord, reconcileRecords } from '../../src/lib/account/sync';

describe('account sync conflict safety', () => {
  it('hydrates cloud records without destroying unsent edits', () => {
    expect(reconcileRecords({ pool: { value: 'local', revision: 1, dirty: true } }, [
      { record_key: 'pool', value: 'cloud', revision: 1 }, { record_key: 'notes', value: 'notes', revision: 2 },
    ])).toEqual({ pool: { value: 'local', revision: 1, dirty: true }, notes: { value: 'notes', revision: 2, dirty: false } });
  });
  it('preserves both versions when another device edited the same record', () => {
    const remote = { record_key: 'pool', value: 'cloud', revision: 2 };
    expect(reconcileRecords({ pool: { value: 'local', revision: 1, dirty: true } }, [remote]).pool)
      .toEqual({ value: 'local', revision: 1, dirty: true, conflict: remote });
  });
  it('acknowledges a committed upload even if its response was lost', () => {
    expect(reconcileRecords({ pool: { value: 'same', revision: 0, dirty: true } }, [{ record_key: 'pool', value: 'same', revision: 1 }]).pool)
      .toEqual({ value: 'same', revision: 1, dirty: false });
  });
  it('retains an edit made while an upload was in flight', () => {
    expect(acknowledgeRecord({ value: 'newer', revision: 2, dirty: true }, { value: 'sent', revision: 2, dirty: true }, 3))
      .toEqual({ value: 'newer', revision: 3, dirty: true, conflict: undefined });
  });
  it('propagates tombstones and detects conflicts with deleted records', () => {
    const remote = { record_key: 'pool', value: null, revision: 2 };
    expect(reconcileRecords({ pool: { value: 'old', revision: 1, dirty: false } }, [remote]).pool?.value).toBeNull();
    expect(reconcileRecords({ pool: { value: 'local', revision: 1, dirty: true } }, [remote]).pool?.conflict).toEqual(remote);
  });
});
