import { useEffect, useId, useState } from 'react';
import { downloadAvatar, preparePhoto, removeAvatar, uploadAvatar } from '../../lib/account/avatar';

function usePhotoUrl(photo: Blob | null) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const next = photo ? URL.createObjectURL(photo) : '';
    setUrl(next);
    return () => { if (next) URL.revokeObjectURL(next); };
  }, [photo]);
  return url;
}
export default function ProfilePhoto({ owner, name }: { owner: string; name: string }) {
  const id = useId();
  const [saved, setSaved] = useState<Blob | null>(null);
  const [draft, setDraft] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [retry, setRetry] = useState(0);
  const url = usePhotoUrl(draft || saved);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    downloadAvatar(owner).then(photo => { if (active) setSaved(photo); })
      .catch(problem => { if (active) setError(problem.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [owner, retry]);
  async function choose(file: File | undefined) {
    if (!file || busy) return;
    setBusy(true); setError(''); setMessage('Preparing your photo…');
    try { setDraft(await preparePhoto(file)); setMessage('Preview ready. Save to keep it.'); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'This photo could not be opened.'); setMessage(''); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!draft || busy) return;
    setBusy(true); setError(''); setMessage('Saving your photo…');
    try { await uploadAvatar(owner, draft); setSaved(draft); setDraft(null); setMessage('Profile photo saved.'); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'Your photo was not saved.'); setMessage(''); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try { await removeAvatar(owner); setSaved(null); setDraft(null); setMessage('Profile photo removed.'); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'Your photo could not be removed.'); }
    finally { setBusy(false); }
  }
  return <div className="profile-photo-editor" aria-busy={busy || loading}>
    <div className="profile-photo-preview">{url ? <img src={url} alt={draft ? 'New profile photo preview' : 'Your profile photo'} width="112" height="112" /> : <span aria-hidden="true">{Array.from(name.trim())[0]?.toLocaleUpperCase() || 'R'}</span>}</div>
    <div className="profile-photo-controls"><h3>Profile photo</h3><p id={`${id}-help`}>Private · JPG, PNG or WebP · 5 MB</p>
      <div className="profile-photo-actions"><label className="profile-file-choice" htmlFor={`${id}-file`}>{saved ? 'Change photo' : 'Upload photo'}<input id={`${id}-file`} type="file" accept="image/jpeg,image/png,image/webp" aria-describedby={`${id}-help`} disabled={busy || loading} onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void choose(file); }} /></label>
      <div className="account-actions">{draft ? <><button type="button" className="account-save" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save photo'}</button><button type="button" disabled={busy} onClick={() => { setDraft(null); setMessage('Preview discarded.'); setError(''); }}>Cancel preview</button></> : saved && <button type="button" disabled={busy || loading} onClick={() => void remove()} className="profile-remove-photo" aria-label="Remove photo" title="Remove photo"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7" /></svg></button>}
        {error && !draft && <button type="button" disabled={busy || loading} onClick={() => setRetry(value => value + 1)}>Retry photo</button>}
      </div></div>
      {(loading || message) && <p className="account-inline-status" role="status">{loading ? 'Loading your photo…' : message}</p>}{error && <p className="account-inline-error" role="alert">{error}</p>}
    </div>
  </div>;
}
