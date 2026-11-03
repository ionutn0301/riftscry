import { useStore } from '@nanostores/react';
import { $account, accountsConfigured } from '../../lib/account/storage';

export default function SyncStatus() {
  const state = useStore($account, { ssr: 'initial' });
  if (!accountsConfigured || (state.ready && !state.userId && !state.error)) return null;
  const message = !state.ready ? state.error ? 'Account needs attention' : 'Opening account…'
    : state.conflicts.length ? 'Resolve sync conflicts'
    : state.error ? 'Changes saved on device · Retry sync'
    : state.syncing || state.pending ? 'Syncing workspace…' : 'Workspace synced';
  return <a className="account-sync-status" href="/account" role="status">{message}</a>;
}
