import { useEffect, useState } from 'react';
import { getAvailableSocialProviders, signIn, socialProviders } from '../../lib/account/client';

const names = { google: 'Google', github: 'GitHub', discord: 'Discord' };
export default function SocialSignIn({ reauthenticate = false }: { reauthenticate?: boolean }) {
  const [providers, setProviders] = useState<typeof socialProviders>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    getAvailableSocialProviders().then(available => { if (active) setProviders(available); })
      .catch(() => { if (active) { setProviders([]); setError('Sign-in availability could not be checked. Please retry.'); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);
  async function start(provider: typeof socialProviders[number]) {
    setBusy(true); setError('');
    try { await signIn(provider); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not start sign-in. Please retry.'); }
    finally { setBusy(false); }
  }
  return <div className="social-sign-in">
    {loading ? <p role="status">Checking sign-in options…</p> : <>
      <div className="account-actions">{providers.map(provider => <button className="social-provider" key={provider} disabled={busy} onClick={() => void start(provider)}>
        <span className="social-provider-mark" aria-hidden="true">{names[provider][0]}</span>{reauthenticate ? 'Sign in again' : 'Continue'} with {names[provider]}
      </button>)}</div>
      {!providers.length && !error && <p>{socialProviders.includes('google') ? 'Google sign-in is being configured.' : 'Social sign-in is being set up.'} You can continue using your guest workspace.</p>}
    </>}
    {error && <><p role="alert" className="account-message">{error}</p><button type="button" disabled={busy || loading} onClick={() => setAttempt(value => value + 1)}>Retry sign-in options</button></>}
  </div>;
}
