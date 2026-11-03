import { useEffect, useState } from 'react';
import PracticePlan from './PracticePlan';
import { safeAccountReturn } from '../../lib/account/return-to';
import { useStore } from '@nanostores/react';
import { $account, accountsConfigured, guestRecords, loadRecords } from '../../lib/account/storage';
import { importGuestData, resolveConflict, signIn, signOut, socialProviders, syncAccount } from '../../lib/account/client';

const names = { google: 'Google', github: 'GitHub', discord: 'Discord' };
export default function AccountPanel() {
  const account = useStore($account, { ssr: 'initial' });
  const [busy, setBusy] = useState(false);
  const [returnTo, setReturnTo] = useState<string | null>(null);
  useEffect(() => { setReturnTo(safeAccountReturn(new URLSearchParams(location.search).get('returnTo'))); }, []);
  const [message, setMessage] = useState('');
  async function act(action: () => Promise<unknown>) {
    setBusy(true); setMessage('');
    try { await action(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  function exportWorkspace() {
    try {
      const records = account.userId ? loadRecords(account.userId) : guestRecords();
      const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), records }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = 'riftscry-workspace.json'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Workspace exported, including any unsynced versions. Notebook backups can be imported from Notebook.');
    } catch { setMessage('The workspace could not be exported. Your data has not changed.'); }
  }
  return <section id="workspace" className="account-panel" data-journey-panel data-journey-label="Account" aria-labelledby="account-title">
    <p className="account-eyebrow">YOUR RIFTSCRY</p>
    <h1 id="account-title">One account.<br />Your next game, anywhere.</h1>
    <p>Keep your champion pool, notes, loadouts, Build Memory, Momentum, saved findings, and reading progress together.</p>
    {returnTo && <p><a href={returnTo}>{account.userId ? 'Return to your match →' : 'Back to your match’s recorded summary →'}</a></p>}
    {!accountsConfigured ? <div className="account-card"><h2>Guest workspace</h2><p>Accounts are not enabled on this deployment yet. Your existing browser features and backups still work.</p></div>
      : !account.ready ? <div className="account-card" role="status">{account.error ? <><p>Your account could not be opened.</p><a href="/account">Reload Account</a></> : 'Opening your account…'}</div>
      : !account.userId ? <div className="account-card"><h2>Sign in or create your account</h2><p>Use a social account. No new password to remember. Your browser data is imported only when you choose. Sign-in unlocks AI match analysis and your synced practice plan.</p>
        <div className="account-actions">{socialProviders.map(provider => <button key={provider} disabled={busy} onClick={() => void act(() => signIn(provider))}>Continue with {names[provider]}</button>)}</div>
        {!socialProviders.length && <p>Social sign-in is being set up. You can continue using your guest workspace.</p>}
        <a href="/next-game">Continue as a guest →</a>
      </div> : <>
        <div className="account-card"><h2>Your account</h2><p className="account-email">{account.email || 'Signed in'}</p>
          <p role="status">{account.syncing ? 'Syncing your workspace…' : account.conflicts.length ? 'Some records changed on another device. Choose which version to keep below.' : account.pending ? `${account.pending} record(s) waiting to sync.` : account.error ? 'Sync needs attention.' : 'Your workspace is synced.'}</p>
          <div className="account-actions"><button disabled={busy || account.syncing} onClick={() => void act(syncAccount)}>Retry sync</button><button disabled={busy || account.syncing} onClick={() => void act(signOut)}>Sign out</button></div>
          <a href="/next-game">Open your briefing →</a>
        </div>
        <div id="practice-plan"><PracticePlan /></div>
        <div className="account-card"><h2>Bring your browser data</h2><p>Import guest records from this device. Existing account records are kept, and the guest originals remain on this device. Records saved under the same category in both workspaces are skipped; use Notebook’s merge import for notes and loadouts.</p><button disabled={busy || account.syncing} onClick={() => void act(async () => { const count = await importGuestData(); setMessage(`${count} record(s) copied to your account workspace. Check sync status above.`); })}>Import this browser’s data</button></div>
        {account.conflicts.map(key => <div className="account-card" key={key}><h2>Choose a saved version</h2><p className="account-record-key">{key.replace('riftscry:', '')}</p><p>Both versions are preserved until you choose. Export your workspace first to keep a backup of both.</p><div className="account-actions"><button disabled={busy} onClick={() => void act(() => resolveConflict(key, 'cloud'))}>Use cloud version</button><button disabled={busy} onClick={() => void act(() => resolveConflict(key, 'local'))}>Keep this device’s version</button></div></div>)}
      </>}
    <div className="account-card"><h2>Start with one game</h2><ol className="account-getting-started"><li><a href="/next-game">Find your Riot ID</a><p>Choose the correct region to open your recent games and automatic briefing.</p></li><li><a href="/pool#edit-pool">Choose your champion pool</a><p>Keep the champions you want to follow close at hand.</p></li><li><a href="/notebook">Keep one useful observation</a><p>Save a note or loadout, then revisit it before your next game.</p></li></ol><p>Recorded match summaries work as a guest. AI analysis requires sign-in.</p></div>
    <div className="account-card"><h2>Keep a copy</h2><p>Export your workspace, including pending edits and conflicting versions. This export is a recovery archive; Notebook has a separate importable backup.</p><button disabled={busy || !account.ready} onClick={exportWorkspace}>Export workspace</button></div>
    {(message || account.error) && <p role="alert" className="account-message">{message || account.error}</p>}
    <p className="account-fineprint">Your RiftScry account is separate from your Riot account. Selecting a Riot ID does not verify that you own it. Theme and motion preferences stay on this device.</p>
  </section>;
}
