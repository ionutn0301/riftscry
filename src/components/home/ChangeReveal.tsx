import { useState } from 'react';
import { storyPatch, type StoryChampion } from './story-data';
export default function ChangeReveal({ champion }: { champion: StoryChampion }) {
  const [phase,setPhase] = useState<'before'|'after'>('after');
  const values = champion[phase];
  return <section className="change-scene story-section" id="changes" aria-labelledby="change-heading">
    <div className="chapter-label"><span>03 / THE CHANGE</span><a href={`/patch/${storyPatch.id}`}>ARCHIVED PATCH {storyPatch.id} ↗</a></div>
    <div className="change-heading"><div><div className="ability-identity"><img src={`/images/story/${champion.id}-ability.png`} width="48" height="48" loading="lazy" alt=""/><p><span>{champion.name} / {champion.ability}</span><strong>{champion.abilityName}</strong></p></div><h2 id="change-heading">{champion.headline}</h2></div><div className="phase-controls" role="group" aria-label="Inspect recorded values"><button type="button" aria-pressed={phase==='before'} onClick={()=>setPhase('before')}>Before</button><button type="button" aria-pressed={phase==='after'} onClick={()=>setPhase('after')}>After</button></div></div>
    <div className="rank-values" aria-live="polite" aria-atomic="true"><p className="eyebrow">{phase === 'before' ? 'BEFORE' : 'AFTER'} PATCH {storyPatch.id} · {champion.unit}</p><ol className="rank-list">{values.map((value,i)=><li key={i}><span className="rank-label">RANK 0{i+1}</span><strong key={`${champion.id}-${phase}`} className="rank-number">{value}</strong><span className="rank-delta">{phase==='after' ? `${Number((value-champion.before[i]!).toFixed(1))>0?'+':''}${Number((value-champion.before[i]!).toFixed(1))}` : 'BASELINE'}</span></li>)}</ol></div>
    <div className="record-context"><div><h3>The full recorded change</h3><dl><div><dt>Before</dt><dd>{champion.recordedBefore}</dd></div><div><dt>After</dt><dd>{champion.recordedAfter}</dd></div></dl></div><div><p>{champion.note}</p><a className="text-link" href={storyPatch.source} target="_blank" rel="noreferrer">Official Riot source ↗</a><p className="record-date">11 August 2026 · Archived example, not the live patch.</p></div></div>
    <nav className="change-links" aria-label="Explore this change"><a href={`/champion/${champion.id.toLowerCase()}`}>See full champion history ↗</a><a href="/compare/26.15/26.16">Compare patches ↗</a></nav>
  </section>;
}
