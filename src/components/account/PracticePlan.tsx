import { useEffect, useId, useRef, useState, type SubmitEvent } from 'react';
import { useStore } from '@nanostores/react';
import { $account } from '../../lib/account/storage';
import { emptyPracticePlan, PRACTICE_PLAN_KEY, readPracticePlan, roles, updatePracticePlan, type PracticePlan as Plan, type PracticeProfile } from '../../lib/account/practice-plan';
import '../../styles/practice-plan.css';

function ProfileEditor({ profile, save }: { profile: PracticeProfile; save: (profile: PracticeProfile, expected: string) => boolean }) {
  const id = useId();
  const [draft, setDraft] = useState(profile);
  const [dirty, setDirty] = useState(false);
  const original = useRef(JSON.stringify(profile));
  const current = JSON.stringify(profile);
  useEffect(() => {
    if (!dirty) { setDraft(profile); original.current = current; }
  }, [profile, current, dirty]);
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (save(draft, original.current)) setDirty(false);
  }
  return <form onSubmit={submit} className="practice-profile" aria-label="Personal preferences">
    <label htmlFor={`${id}-name`}>Display name <span>(optional)</span></label>
    <input id={`${id}-name`} maxLength={40} autoComplete="nickname" value={draft.displayName} onChange={event => { setDirty(true); setDraft({ ...draft, displayName: event.target.value }); }} />
    <label htmlFor={`${id}-role`}>Preferred role</label>
    <select id={`${id}-role`} value={draft.role} onChange={event => { setDirty(true); setDraft({ ...draft, role: event.target.value as PracticeProfile['role'] }); }}>{roles.map(role => <option key={role}>{role}</option>)}</select>
    {dirty && original.current !== current && <p role="status">Saved preferences changed while you were editing. Reload them before saving.</p>}
    <div className="practice-actions"><button disabled={!dirty} type="submit">Save preferences</button><button type="button" disabled={!dirty} onClick={() => { setDraft(profile); original.current = current; setDirty(false); }}>Reload saved preferences</button></div>
  </form>;
}

export default function ProfilePreferences() {
  const account = useStore($account, { ssr: 'initial' });
  const id = useId();
  const [plan, setPlan] = useState(emptyPracticePlan);
  const [loadedOwner, setLoadedOwner] = useState<string | null>(null);
  const [problem, setProblem] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    function reload() {
      try { setPlan(readPracticePlan()); setProblem(''); }
      catch { setPlan(emptyPracticePlan()); setProblem('Your profile could not be opened. Export your workspace before making changes.'); }
      setLoadedOwner(account.userId);
    }
    function changed(event: StorageEvent) { if (!event.key || event.key === PRACTICE_PLAN_KEY) reload(); }
    reload(); window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, [account.userId, account.ready]);
  function update(change: (current: Plan) => Plan) {
    try {
      if (!account.userId || $account.get().userId !== account.userId || !$account.get().ready) throw new Error('Open your account before saving preferences.');
      setPlan(updatePracticePlan(change)); setProblem(''); setMessage('Preferences saved on this device. Account sync status is shown above.'); return true;
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Preferences could not be saved.'); return false; }
  }
  if (!account.ready || !account.userId || loadedOwner !== account.userId) return null;
  return <section className="practice-plan account-card" data-profile-preferences aria-labelledby={`${id}-heading`}>
    <h2 id={`${id}-heading`}>Profile details</h2>
    <p className="practice-help">Your display name and preferred role. Your coach prepares the next-game focus automatically.</p>
    {problem ? <p role="alert">{problem}</p> : <ProfileEditor profile={plan.profile} save={(profile, expected) => update(current => {
      if (JSON.stringify(current.profile) !== expected) throw new Error('Preferences changed. Reload saved preferences before saving.');
      // Keep old records in backups; removing the editor must not erase user data.
      return { ...current, profile };
    })} />}
    <p role="status" aria-live="polite">{message}</p>
  </section>;
}
