import { useEffect, useRef, useState } from 'react';
import type { ArchiveData } from '../../lib/living-archive';
export default function AtlasSearch({ data, navigate, close }: { data: ArchiveData; navigate: (url: string) => void; close: () => void }) {
  const [query, setQuery] = useState(''); const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  const q = query.trim().toLowerCase();
  const champions = data.champions.filter(c => c.name.toLowerCase().includes(q)).slice(0, 12);
  const patches = data.patches.filter(p => (`patch ${p.id}`).includes(q)).slice(0, 5);
  const other = q.length > 1 ? data.patchDetails?.flatMap(p => [...p.items.map(c => ({ name: c.name, patch: p.id, category: 'items' })), ...p.systems.map(c => ({ name: c.name, patch: p.id, category: 'systems' }))]).filter(c => c.name.toLowerCase().includes(q)).slice(0, 12) ?? [] : [];
  return <div className="atlas-global-search"><p className="atlas-kicker">SEARCH THE ARCHIVE</p><h1>Find your path.</h1><label className="atlas-label" htmlFor="atlas-global-search">Champion, patch, item, or system</label><input ref={input} id="atlas-global-search" type="search" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') close(); }} /><button className="atlas-search-close" onClick={close}>Close search</button><div className="atlas-roster" aria-live="polite"><h2>Champions</h2>{champions.map(c => <div className="atlas-roster-row" key={c.id}><button onClick={() => navigate(`/champion/${c.id.toLowerCase()}`)}>{c.name}</button></div>)}{patches.length > 0 && <h2>Patches</h2>}{patches.map(p => <div className="atlas-roster-row" key={p.id}><button onClick={() => navigate(`/patch/${p.id}?scope=all`)}>Patch {p.id}</button></div>)}{other.length > 0 && <h2>Items &amp; systems</h2>}{other.map((c, i) => <div className="atlas-roster-row" key={`${c.patch}-${i}`}><button onClick={() => navigate(`/patch/${c.patch}?scope=all&category=${c.category}&q=${encodeURIComponent(c.name)}`)}>{c.name}<small>{c.patch}</small></button></div>)}{!champions.length && !patches.length && !other.length && <p>No matching records.</p>}</div></div>;
}
