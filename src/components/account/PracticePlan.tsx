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
    <label htmlFor={`${id}-focus`}>My focus for the next game</label>
    <textarea id={`${id}-focus`} rows={3} maxLength={240} placeholder="For example: review my first recall before queuing again." value={draft.focus} onChange={event => { setDirty(true); setDraft({ ...draft, focus: event.target.value }); }} />
    {dirty && original.current !== current && <p role="status">Saved preferences changed while you were editing. Reload them before saving.</p>}
    <div className="practice-actions"><button disabled={!dirty} type="submit">Save preferences</button><button type="button" disabled={!dirty} onClick={() => { setDraft(profile); original.current = current; setDirty(false); }}>Reload saved preferences</button></div>
  </form>;
}

export default function PracticePlan({ compact = false }: { compact?: boolean }) {
  const account = useStore($account, { ssr: 'initial' });
  const id = useId();
  const [plan, setPlan] = useState(emptyPracticePlan);
  const [loadedOwner, setLoadedOwner] = useState<string | null>(null);
  const [problem, setProblem] = useState('');
  const [message, setMessage] = useState('');
  const [goal, setGoal] = useState('');
  useEffect(() => {
    function reload() {
      try { setPlan(readPracticePlan()); setProblem(''); }
      catch (error) { setPlan(emptyPracticePlan()); setProblem(error instanceof Error ? error.message : 'Your practice plan could not be opened.'); }
      setLoadedOwner(account.userId);
    }
    function changed(event: StorageEvent) { if (!event.key || event.key === PRACTICE_PLAN_KEY) reload(); }
    reload(); window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, [account.userId, account.ready]);
  function update(change: (current: Plan) => Plan, success: string) {
    try {
      if (!account.userId || $account.get().userId !== account.userId || !$account.get().ready) throw new Error('Open your account before saving your plan.');
      setPlan(updatePracticePlan(change)); setProblem(''); setMessage(success); return true;
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Your plan could not be saved. Please retry.'); return false; }
  }
  if (!account.ready || !account.userId || loadedOwner !== account.userId) return null;
  const done = plan.goals.filter(item => item.done).length;
  return <section className={`practice-plan${compact ? ' practice-plan-compact' : ' account-card'}`} aria-labelledby={`${id}-heading`} data-practice-plan>
    <p className="practice-eyebrow">YOUR OWN PLAN</p>
    <h2 id={`${id}-heading`}>{plan.profile.displayName ? `${plan.profile.displayName}’s practice plan` : 'Your practice plan'}</h2>
    <p className="practice-help">Your own focus and checklist. Completion is self-tracked and does not measure match performance.</p>
    {problem ? <p role="alert">{problem}</p> : <>
      {compact ? <><p>{plan.profile.focus || 'Choose one thing you want to pay attention to in your next game.'}</p>{plan.profile.role !== 'Any role' && <p className="practice-help">Preferred role: {plan.profile.role}</p>}<a href="/account#practice-plan">Edit your preferences and goals →</a></> : <ProfileEditor profile={plan.profile} save={(profile, expected) => update(current => {
        if (JSON.stringify(current.profile) !== expected) throw new Error('Preferences changed. Reload saved preferences before saving.');
        return { ...current, profile };
      }, 'Preferences saved on this device. Account sync status is shown above.')} />}
      <p className="practice-progress">{plan.goals.length ? `${done} of ${plan.goals.length} goals checked` : 'No goals yet. Add your first small, specific practice goal.'}</p>
      <ul className="practice-goals">{plan.goals.map(item => <li key={item.id}>
        <label><input type="checkbox" checked={item.done} onChange={event => { const checked = event.target.checked; update(current => ({ ...current, goals: current.goals.map(value => value.id === item.id ? { ...value, done: checked } : value) }), checked ? 'Goal checked.' : 'Goal reopened.'); }} /><span>{item.text}</span></label>
        {!compact && <button type="button" aria-label={`Remove goal: ${item.text}`} onClick={() => update(current => ({ ...current, goals: current.goals.filter(value => value.id !== item.id) }), 'Goal removed.')}>Remove</button>}
      </li>)}</ul>
      {!compact && <form className="practice-add" onSubmit={event => { event.preventDefault(); if (!goal.trim()) return; if (update(current => ({ ...current, goals: [...current.goals, { id: crypto.randomUUID(), text: goal.trim(), done: false }] }), 'Goal added.')) setGoal(''); }}>
        <label htmlFor={`${id}-goal`}>New practice goal</label><input id={`${id}-goal`} value={goal} maxLength={180} required onChange={event => setGoal(event.target.value)} placeholder="For example: inspect one recorded death." />
        <button type="submit" disabled={plan.goals.length >= 8 || !goal.trim()}>Add goal</button><p className="practice-help">Up to 8 goals. Remove a goal to make room for a new one.</p>
      </form>}
      {done > 0 && <button type="button" onClick={() => update(current => ({ ...current, goals: current.goals.map(item => ({ ...item, done: false })) }), 'Checklist reset for your next session.')}>Reset checklist for next session</button>}
    </>}
    <p role="status" aria-live="polite">{message}</p>
  </section>;
}
