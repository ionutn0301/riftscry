import { useEffect, useId, useRef, useState, type SubmitEvent } from 'react';
import { getAccountScope } from '../../lib/account/storage';
import { readRiotAssociation, RIOT_ACCOUNT_KEY, saveRiotAssociation } from '../../lib/account/riot-account';
import { briefingLink, parseRecentPlayer, type RecentPlayer } from '../../lib/player/identity';
import { platforms } from '../../lib/player/contracts';
import { api, fetcher, playerLink } from '../player/client';
import { usePlayerCooldown } from '../player/usePlayerCooldown';

const regions: Record<string, string> = { euw1: 'EUW · Europe West', eun1: 'EUNE · Nordic & East', na1: 'NA · North America', br1: 'BR · Brazil', la1: 'LAN · Latin America North', la2: 'LAS · Latin America South', oc1: 'OCE · Oceania', kr: 'KR · Korea', jp1: 'JP · Japan', tr1: 'TR · Türkiye', ru: 'RU · Russia', sg2: 'SG · Singapore', tw2: 'TW · Taiwan', vn2: 'VN · Vietnam', me1: 'ME · Middle East', ph2: 'PH · Legacy server', th2: 'TH · Legacy server' };
export default function RiotAssociation({ owner }: { owner: string }) {
  const id = useId();
  const [saved, setSaved] = useState<RecentPlayer | null>(null);
  const [candidate, setCandidate] = useState<{ player: RecentPlayer; expected: RecentPlayer | null } | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [message, setMessage] = useState('');
  const retrySeconds = usePlayerCooldown();
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const reload = () => {
      try { setSaved(readRiotAssociation()); }
      catch (error) { setProblem((error as Error).message); }
    };
    const change = (event: StorageEvent) => { if (!event.key || event.key === RIOT_ACCOUNT_KEY) reload(); };
    reload(); window.addEventListener('storage', change);
    return () => { alive.current = false; window.removeEventListener('storage', change); };
  }, [owner]);
  async function lookup(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || retrySeconds || getAccountScope() !== owner) return;
    const form = new FormData(event.currentTarget);
    const riotId = String(form.get('riotId') ?? '').trim(), separator = riotId.lastIndexOf('#');
    const name = riotId.slice(0, separator).trim(), tag = riotId.slice(separator + 1).trim();
    if (separator < 1 || name.length < 3 || name.length > 32 || tag.length < 2 || tag.length > 16) {
      setProblem('Enter your full Riot ID, including #tagline.');
      (event.currentTarget.elements.namedItem('riotId') as HTMLInputElement)?.focus(); return;
    }
    const expected = saved;
    setBusy(true); setCandidate(null); setProblem(''); setMessage('Finding your Riot ID…');
    try {
      const platform = String(form.get('platform'));
      const result = await fetcher<{ puuid: string; gameName: string; tagLine: string }>(api('lookup', { platform, name, tag }));
      if (!alive.current || getAccountScope() !== owner) return;
      const player = parseRecentPlayer({ platform, puuid: result.puuid, name: `${result.gameName}#${result.tagLine}` });
      if (!player || !result.gameName || !result.tagLine) throw new Error('This player could not be found. Check the Riot ID and server.');
      setCandidate({ player, expected }); setMessage('Check the player, then confirm.');
    } catch (error) { if (alive.current) { setProblem(error instanceof Error ? error.message : 'Lookup is unavailable. Please retry.'); setMessage(''); } }
    finally { if (alive.current) setBusy(false); }
  }
  function associate() {
    if (!candidate) return;
    try { saveRiotAssociation(owner, candidate.player, candidate.expected); setCandidate(null); setEditing(false); setProblem(''); setMessage('Riot ID associated.'); }
    catch (error) { setProblem((error as Error).message); }
  }
  function remove() {
    try { saveRiotAssociation(owner, null, saved); setCandidate(null); setProblem(''); setMessage('Riot ID removed. Your notes are kept.'); }
    catch (error) { setProblem((error as Error).message); }
  }
  return <div className="riot-association">
    <p className="account-section-help">Your shortcut to matches and coaching.</p>
    {saved ? <div className="associated-player"><span className="account-eyebrow">ASSOCIATED RIOT ID</span><strong>{saved.name}</strong><span>{regions[saved.platform] || saved.platform.toUpperCase()}</span><div className="account-actions"><a href={briefingLink(saved)}>Open my briefing ↗</a><a href={playerLink(saved.platform, saved.puuid, { name: saved.name })}>View my matches ↗</a><button type="button" disabled={busy} onClick={() => { setEditing(true); setMessage(''); }}>Change Riot ID</button><button type="button" disabled={busy} onClick={remove}>Remove association</button></div></div> : <p className="account-empty">No Riot ID associated yet.</p>}
    {(!saved || editing) && !candidate && <form className="account-riot-form" aria-label="Associate a Riot ID" aria-busy={busy} onSubmit={lookup} onChange={() => { setCandidate(null); setProblem(''); setMessage(''); }}>
      <div><label htmlFor={`${id}-riot`}>{saved ? 'Different Riot ID' : 'Riot ID'}</label><input id={`${id}-riot`} name="riotId" autoComplete="off" spellCheck={false} placeholder="Game name#TAG" maxLength={50} required disabled={busy} aria-describedby={`${id}-status`} /></div>
      <div><label htmlFor={`${id}-server`}>Server</label><select id={`${id}-server`} name="platform" defaultValue={saved?.platform || 'euw1'} disabled={busy}>{Object.keys(platforms).map(platform => <option key={platform} value={platform}>{regions[platform] || platform.toUpperCase()}</option>)}</select></div>
      <button type="submit" disabled={busy || retrySeconds > 0}>{retrySeconds ? `Retry in ${retrySeconds}s` : busy ? 'Finding player…' : 'Find Riot ID'}</button>
      {saved && <button type="button" disabled={busy} onClick={() => { setEditing(false); setProblem(''); }}>Cancel</button>}
    </form>}
    {candidate && <div className="riot-candidate"><span>Ready to associate</span><strong>{candidate.player.name}</strong><p>{regions[candidate.player.platform]}</p><button className="account-save" type="button" onClick={associate}>Associate this Riot ID</button><button type="button" onClick={() => { setCandidate(null); setMessage(''); }}>Back</button></div>}
    <p id={`${id}-status`} role={problem ? 'alert' : 'status'} className={problem ? 'account-inline-error' : 'account-inline-status'}>{problem || message}</p>
    <p className="account-fineprint">Links a player; it does not verify Riot account ownership. No Riot password needed.</p>
  </div>;
}
