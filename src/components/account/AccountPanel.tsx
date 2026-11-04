import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import PracticePlan from './PracticePlan';
import AccountTabs from './AccountTabs';
import SocialSignIn from './SocialSignIn';
import ProfilePhoto from './ProfilePhoto';
import RiotAssociation from './RiotAssociation';
import { safeAccountReturn } from '../../lib/account/return-to';
import { $account, accountsConfigured, guestRecords, loadRecords } from '../../lib/account/storage';
import { getProfileIdentity, importGuestData, resolveConflict, signOut, syncAccount, type ProfileIdentity } from '../../lib/account/client';
import { readPracticePlan, PRACTICE_PLAN_KEY } from '../../lib/account/practice-plan';

export default function AccountPanel({ profileView = false }: { profileView?: boolean }) {
  const account = useStore($account, { ssr: 'initial' });
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
    getProfileIdentity(owner).then(value => { if (active) setIdentity(value); }).catch(() => { if (active) setProfileError('Your sign-in details could not be refreshed. Reconnect under Data & sign-in.'); });
    const frame = requestAnimationFrame(() => {
      const target = ['#profile', '#riot-id', '#practice-plan', '#account-data'].includes(location.hash) ? document.getElementById(location.hash.slice(1)) : null;
      target?.scrollIntoView({ block: 'start' });
    });
    return () => { active = false; cancelAnimationFrame(frame); window.removeEventListener('storage', changed); };
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
  return <section id="workspace" className="account-panel account-hub" data-journey-panel data-journey-label="Account" aria-labelledby="account-title">
    <header className="account-heading"><p className="account-eyebrow">YOUR RIFTSCRY</p><h1 id="account-title">{profileView ? 'My profile.' : 'My account.'}</h1>
      <p>Your photo, Riot ID, practice goals, and saved workspace. Everything personal, in one place.</p>
      {signedIn && <p className="account-sync-line" role="status">{account.syncing ? 'Syncing your workspace…' : account.conflicts.length ? 'Some records changed on another device. Choose which version to keep under Data & sign-in.' : account.pending ? `${account.pending} record(s) waiting to sync.` : account.error ? 'Sync needs attention.' : 'Your workspace is synced.'}</p>}
    </header>
    {returnTo && <p><a href={returnTo}>{returnTo.startsWith('/profile') ? 'Back to My profile →' : account.userId ? 'Return to your match →' : 'Back to your match’s recorded summary →'}</a></p>}
    {!accountsConfigured ? <div className="account-card"><h2>Guest workspace</h2><p>Accounts are not enabled on this deployment yet. Your existing browser features and backups still work.</p></div>
      : !account.ready ? <div className="account-card" role="status">{account.error ? <><p>Your account could not be opened.</p><a href="/account">Reload Account</a></> : 'Opening your account…'}</div>
      : !account.userId ? <div className="account-guest-intro"><div className="account-card"><h2>Make this space yours</h2><p>Sign in with Google to add a photo, associate your Riot ID, and keep your notes and practice plan across devices. Sign-in also unlocks AI match analysis.</p><SocialSignIn /><a className="account-primary-link" href="/next-game">Continue as a guest →</a></div>
        <ol className="account-benefits"><li><strong>Your profile</strong><span>A photo, display name, and preferred role.</span></li><li><strong>Your Riot ID</strong><span>A saved route to your matches and briefing.</span></li><li><strong>Your practice</strong><span>A focus and checklist for your next session.</span></li><li><strong>Your data</strong><span>Sync, backups, and control over guest imports.</span></li></ol>
      </div> : <div className="account-layout"><AccountTabs /><div className="account-sections">
        {reauthenticate && <section className="account-card" id="account-reauth"><h2>Reconnect your sign-in</h2><p>Sign in again with the same social account to continue using AI and sync. Your saved workspace and pending edits stay on this device.</p><SocialSignIn reauthenticate /></section>}
        <section id="profile" className="account-section" aria-label="My profile"><p className="account-eyebrow">01 / MY PROFILE</p>
          <div className="profile-overview"><div><h2>{name || 'Your RiftScry profile'}</h2><p className="account-email">{account.email || 'Signed in'}</p><p className="account-fineprint">{providers.length ? `Sign-in: ${providers.join(', ')}` : 'Your private account workspace.'}</p></div></div>
          <ProfilePhoto key={account.userId} owner={account.userId} name={name} />
          {profileError && <p role="status" className="account-message">{profileError}</p>}
          <PracticePlan section="profile" />
        </section>
        <section id="riot-id" className="account-section" aria-labelledby="account-riot-heading"><p className="account-eyebrow">02 / RIOT ID</p><h2 id="account-riot-heading">Your League of Legends player.</h2><RiotAssociation key={account.userId} owner={account.userId} /></section>
        <section id="practice-plan" className="account-section" aria-label="Practice plan"><p className="account-eyebrow">03 / PRACTICE</p><PracticePlan section="goals" /></section>
        <section id="account-data" className="account-section" aria-labelledby="account-data-heading"><p className="account-eyebrow">04 / DATA & SIGN-IN</p><h2 id="account-data-heading">Keep your workspace yours.</h2>
          <div className="account-settings-row"><div><h3>Sign-in and sync</h3><p>Use the same Google account on each device. Pending edits stay on this device until they sync.</p></div><div className="account-actions"><button disabled={busy || account.syncing} onClick={() => void act(syncAccount)}>Retry sync</button><button disabled={busy} aria-expanded={reauthenticate} aria-controls="account-reauth" onClick={() => { setReauthenticate(true); requestAnimationFrame(() => document.getElementById('account-reauth')?.scrollIntoView({ block: 'start' })); }}>Reconnect account</button><button disabled={busy || account.syncing} onClick={() => void act(signOut)}>Sign out</button></div></div>
          <div className="account-settings-row"><div><h3>Bring your browser data</h3><p>Copy guest records from this device into your account. Existing account records and the guest originals are kept. Use Notebook’s merge import for notes and loadouts saved in both workspaces.</p></div><button disabled={busy || account.syncing} onClick={() => void act(async () => { const count = await importGuestData(); setMessage(`${count} record(s) copied to your account workspace. Check sync status above.`); })}>Import this browser’s data</button></div>
          {account.conflicts.map(key => <div className="account-settings-row" key={key}><h3>Choose a saved version</h3><p className="account-record-key">{key.replace('riftscry:', '')}</p><p>Both versions are preserved until you choose. Export your workspace first to keep a backup of both.</p><div className="account-actions"><button disabled={busy} onClick={() => void act(() => resolveConflict(key, 'cloud'))}>Use cloud version</button><button disabled={busy} onClick={() => void act(() => resolveConflict(key, 'local'))}>Keep this device’s version</button></div></div>)}
          <div className="account-settings-row"><h3>Keep a copy</h3><p>Export your saved records, including pending edits and conflicting versions. This recovery archive does not include your profile photo; Notebook has a separate importable backup.</p><button disabled={busy || !account.ready} onClick={exportWorkspace}>Export workspace</button></div>
          {(message || account.error) && <p role="alert" className="account-message">{message || account.error}</p>}
        </section>
        <nav className="profile-shortcuts" aria-label="Your workspace"><a href="/next-game"><strong>Build a briefing</strong><span>Review recent games and choose one focus.</span></a><a href="/pool#edit-pool"><strong>Save your champions</strong><span>Follow changes to your regular picks.</span></a><a href="/notebook"><strong>Open your notebook</strong><span>Keep notes, builds, and match reflections.</span></a></nav>
      </div></div>}
    {!signedIn && <section className="account-card"><h2>Your guest workspace still works</h2><p>Browse champion changes, review recorded match facts, and save notes on this browser. Import them after signing in when you are ready.</p><div className="account-actions"><a href="/guide">How RiftScry works ↗</a><button disabled={busy || !account.ready} onClick={exportWorkspace}>Export workspace</button></div>{message && <p role="status">{message}</p>}</section>}
  </section>;
}
