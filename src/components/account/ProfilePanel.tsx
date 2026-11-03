import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { $account, accountsConfigured } from '../../lib/account/storage';
import { getProfileIdentity, type ProfileIdentity } from '../../lib/account/client';
import { emptyPracticePlan, readPracticePlan, type PracticePlan as Plan } from '../../lib/account/practice-plan';
import { briefingLink, readRecentPlayer, RECENT_PLAYER_EVENT, type RecentPlayer } from '../../lib/player/identity';
import AccountTabs from './AccountTabs';
import PracticePlan from './PracticePlan';

type Snapshot = { owner: string; plan: Plan; player: RecentPlayer | null; error: string };
export default function ProfilePanel() {
  const account = useStore($account, { ssr: 'initial' });
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [identity, setIdentity] = useState<ProfileIdentity | null>(null);
  const [identityError, setIdentityError] = useState('');
  useEffect(() => {
    const owner = account.userId;
    if (!account.ready || !owner) return;
    const reload = () => {
      try { setSnapshot({ owner, plan: readPracticePlan(), player: readRecentPlayer(), error: '' }); }
      catch { setSnapshot({ owner, plan: emptyPracticePlan(), player: readRecentPlayer(), error: 'Your saved profile could not be read. Open Account to export a copy before making changes.' }); }
    };
    reload(); window.addEventListener('storage', reload); window.addEventListener(RECENT_PLAYER_EVENT, reload);
    return () => { window.removeEventListener('storage', reload); window.removeEventListener(RECENT_PLAYER_EVENT, reload); };
  }, [account.ready, account.userId]);
  useEffect(() => {
    if (!account.ready || !account.userId) return;
    let active = true; setIdentityError('');
    getProfileIdentity(account.userId).then(value => { if (active) setIdentity(value); })
      .catch(() => { if (active) setIdentityError('Your sign-in details could not be refreshed. Reconnect from Account if needed.'); });
    return () => { active = false; };
  }, [account.ready, account.userId]);
  const current = account.ready && snapshot?.owner === account.userId ? snapshot : null;
  const currentIdentity = identity?.userId === account.userId ? identity : null;
  return <section className="account-panel profile-panel" data-journey-panel data-journey-label="My profile" aria-labelledby="profile-title">
    <p className="account-eyebrow">YOUR RIFTSCRY</p><h1 id="profile-title">My profile.</h1>
    <p>Your preferences, your practice, and the player you follow. This profile is private to your account.</p>
    <AccountTabs active="profile" />
    {!accountsConfigured || (account.ready && !account.userId) ? <div className="account-card"><h2>Make this space yours</h2><p>Sign in to keep your preferences and practice plan across devices. Your guest workspace stays on this browser until you choose to import it.</p><a className="account-primary-link" href="/account?returnTo=%2Fprofile">Sign in to create your profile →</a><a className="profile-guest-link" href="/next-game">Continue as a guest →</a></div>
      : !account.ready ? <div className="account-card" role="status">{account.error ? <><p>Your profile could not be opened.</p><a href="/account">Open Account to retry →</a></> : 'Opening your profile…'}</div>
      : <>
        <div className="account-card profile-overview"><div className="profile-avatar" aria-hidden="true">{Array.from(current?.plan.profile.displayName.trim() || '')[0]?.toLocaleUpperCase() || 'R'}</div><div><p className="account-eyebrow">PRIVATE PROFILE</p><h2>{current?.plan.profile.displayName || 'Your RiftScry profile'}</h2><p className="account-email">{account.email || 'Signed in'}</p><p className="practice-help">{currentIdentity?.providers.length ? `Sign-in: ${currentIdentity.providers.join(', ')}` : 'Your social sign-in is managed securely.'}</p></div></div>
        {(identityError || current?.error) && <p role="status" className="account-message">{current?.error || identityError}</p>}
        {(account.pending > 0 || account.error || account.conflicts.length > 0) && <p className="account-message">{account.conflicts.length ? 'Your workspace has a sync conflict.' : 'Some workspace changes still need to sync.'} <a href="/account">Manage account sync →</a></p>}
        <div id="practice-plan"><PracticePlan /></div>
        <section className="account-card" aria-labelledby="profile-riot-title"><p className="account-eyebrow">RIOT GAMES</p><h2 id="profile-riot-title">Your player shortcut</h2>
          {current?.player ? <><p className="account-email"><strong>{current.player.name || 'Saved player'}</strong> · {current.player.platform.toUpperCase()}</p><a className="account-primary-link" href={briefingLink(current.player)}>Open this player’s briefing →</a></> : <p>No player selected yet. Look up your Riot ID to save a shortcut here.</p>}
          <a className="profile-guest-link" href="/players">{current?.player ? 'Choose another Riot ID →' : 'Find your Riot ID →'}</a>
          <p className="practice-help">This is a saved lookup, not verified Riot account linking. Riot Sign On is not enabled for RiftScry yet.</p>
        </section>
        <nav className="profile-shortcuts" aria-label="Your workspace"><a href="/pool#edit-pool"><strong>Champion pool</strong><span>Keep your regular picks close.</span></a><a href="/notebook"><strong>Your notebook</strong><span>Notes, saved builds, and reflections.</span></a><a href="/account"><strong>Account & sync</strong><span>Sign-in, backups, and sync recovery.</span></a></nav>
      </>}
  </section>;
}
