import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import PracticePlan from './PracticePlan';
import AccountTabs, { type AccountSection } from './AccountTabs';
import SocialSignIn from './SocialSignIn';
import ProfilePhoto from './ProfilePhoto';
import RiotAssociation from './RiotAssociation';
import { safeAccountReturn } from '../../lib/account/return-to';
import { $account, accountsConfigured, guestRecords, loadRecords } from '../../lib/account/storage';
import { getProfileIdentity, importGuestData, resolveConflict, signOut, syncAccount, type ProfileIdentity } from '../../lib/account/client';
import { readPracticePlan, PRACTICE_PLAN_KEY } from '../../lib/account/practice-plan';

export default function AccountPanel({ profileView = false }: { profileView?: boolean }) {
  const account = useStore($account, { ssr: 'initial' });
  const [section, setSection] = useState<AccountSection>('profile');
  const [busy, setBusy] = useState(false);
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const [reauthenticate, setReauthenticate] = useState(false);
  const [message, setMessage] = useState('');
  const [identity, setIdentity] = useState<ProfileIdentity | null>(null);
  const [profile, setProfile] = useState<{ owner: string; name: string } | null>(null);
  const [profileError, setProfileError] = useState('');
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setReturnTo(safeAccountReturn(params.get('returnTo')));
    setReauthenticate(params.get('reauth') === '1');
    const followHash = () => setSection(params.get('reauth') === '1' && !location.hash ? 'account-data' : location.hash === '#riot-id' ? 'riot-id' : location.hash === '#account-data' ? 'account-data' : 'profile');
    followHash(); window.addEventListener('hashchange', followHash); window.addEventListener('popstate', followHash);
    return () => { window.removeEventListener('hashchange', followHash); window.removeEventListener('popstate', followHash); };
  }, []);
  useEffect(() => {
    if (!account.ready || !account.userId) return;
    const owner = account.userId;
    let active = true;
    const reload = () => {
      try { setProfile({ owner, name: readPracticePlan().profile.displayName }); }
      catch { setProfileError('Your saved profile could not be read. Export your workspace before making changes.'); }
    };
    const changed = (event: StorageEvent) => { if (!event.key || event.key === PRACTICE_PLAN_KEY) reload(); };
    reload(); window.addEventListener('storage', changed);
    getProfileIdentity(owner).then(value => { if (active) setIdentity(value); }).catch(() => { if (active) setProfileError('Your sign-in details could not be refreshed. Reconnect in Settings.'); });
    return () => { active = false; window.removeEventListener('storage', changed); };
  }, [account.ready, account.userId]);
  const name = profile?.owner === account.userId ? profile.name : '';
  const providers = identity?.userId === account.userId ? identity.providers : [];
  const signedIn = account.ready && !!account.userId;
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
  function selectSection(next: AccountSection) {
    setSection(next);
    history.pushState(history.state, '', `#${next}`);
  }
  return <section id="workspace" className="account-panel account-hub" data-journey-panel data-journey-label="Account" aria-labelledby="account-title">
    <header className="account-heading"><div><h1 id="account-title">{profileView ? 'My profile.' : 'My account.'}</h1><p>{signedIn ? account.email || 'Your private workspace' : 'Your player. Your space.'}</p></div>
      {signedIn && <span className="account-sync-line" role="status">{account.syncing ? 'Syncing…' : account.conflicts.length || account.error ? 'Sync needs attention' : account.pending ? 'Sync pending' : 'Synced'}</span>}
    </header>
    {returnTo && <a className="account-return" href={returnTo}>{returnTo.startsWith('/profile') ? 'Back to My profile →' : 'Back to your match →'}</a>}
    {!accountsConfigured ? <div className="account-card"><h2>Guest workspace</h2><p>Accounts are not enabled here. Your browser saves and backups still work.</p></div>
      : !account.ready ? <div className="account-card" role="status">{account.error ? <><p>Your account could not be opened.</p><a href="/account">Reload Account</a></> : 'Opening your account…'}</div>
      : !account.userId ? <div className="account-guest-intro"><h2>Pick up where you left off.</h2><p>Sign in to save your profile and Riot ID across devices.</p><SocialSignIn /><a className="account-primary-link" href="/next-game">Continue as a guest →</a><details className="account-guest-backup"><summary>Guest backup</summary><button disabled={busy || !account.ready} onClick={exportWorkspace}>Export workspace</button>{message && <p role="status">{message}</p>}</details></div>
      : <div className="account-layout"><AccountTabs selected={section} onSelect={selectSection} /><div className="account-sections">
        <section id="profile" role="tabpanel" aria-labelledby="tab-profile" tabIndex={0} hidden={section !== 'profile'} className="account-section">
          <div className="profile-details"><ProfilePhoto key={account.userId} owner={account.userId} name={name} /><PracticePlan /></div>
          {profileError && <p role="status" className="account-message">{profileError}</p>}
        </section>
        <section id="riot-id" role="tabpanel" aria-labelledby="tab-riot-id" tabIndex={0} hidden={section !== 'riot-id'} className="account-section"><h2 className="sr-only">Your League player</h2><RiotAssociation key={account.userId} owner={account.userId} /></section>
        <section id="account-data" role="tabpanel" aria-labelledby="tab-account-data" tabIndex={0} hidden={section !== 'account-data'} className="account-section">
          {reauthenticate ? <section className="account-card" id="account-reauth"><h2>Reconnect your sign-in</h2><p>Use the same account. Your pending edits stay saved.</p><SocialSignIn reauthenticate /><button onClick={() => setReauthenticate(false)}>Cancel</button></section> : <>
          <div className="account-settings-row"><div><h3>Sign-in & sync</h3><p>{providers.length ? providers.join(', ') : 'Your account'} · Edits sync across devices.</p></div><button disabled={busy || account.syncing} onClick={() => void act(signOut)}>Sign out</button></div><details className="account-sync-options"><summary>Sync options</summary><div className="account-actions"><button disabled={busy || account.syncing} onClick={() => void act(syncAccount)}>Retry sync</button><button disabled={busy} aria-expanded={reauthenticate} aria-controls="account-reauth" onClick={() => setReauthenticate(true)}>Reconnect account</button></div></details>
          <div className="account-settings-row"><div><h3>Browser saves</h3><p>Copy guest saves; keep both originals.</p></div><button disabled={busy || account.syncing} onClick={() => void act(async () => { const count = await importGuestData(); setMessage(`${count} record(s) copied to your account.`); })}>Import guest saves</button></div>
          {account.conflicts.map(key => <div className="account-settings-row" key={key}><div><h3>Choose a saved version</h3><p className="account-record-key">{key.replace('riftscry:', '')}</p><p>Export first to keep both versions.</p></div><div className="account-actions"><button disabled={busy} onClick={() => void act(() => resolveConflict(key, 'cloud'))}>Use cloud version</button><button disabled={busy} onClick={() => void act(() => resolveConflict(key, 'local'))}>Keep this device’s version</button></div></div>)}
          <div className="account-settings-row"><div><h3>Backup</h3><p>All saved records, including unsynced edits.</p></div><button disabled={busy || !account.ready} onClick={exportWorkspace}>Export workspace</button></div>
          <p className="account-fineprint">Photos excluded. Note backups: <a href="/notebook">Notebook</a>.</p>
          </>}
          {(message || account.error) && <p role="alert" className="account-message">{message || account.error}</p>}
        </section>
      </div></div>}
  </section>;
}
