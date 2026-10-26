import type { StoryChampion } from './story-data';
export default function ChampionEncounter({ champions, selected, onSelect }: { champions: StoryChampion[]; selected: StoryChampion; onSelect: (id: string) => void }) {
  return <section className="encounter story-section" id="champions" aria-labelledby="encounter-heading">
    <div className="chapter-label"><span>02 / THE CHAMPIONS</span><span>PATCH 26.16 · ARCHIVED</span></div>
    <div className="encounter-stage">
      <div className="encounter-copy"><p className="eyebrow">Someone you know. Something new.</p><h2 id="encounter-heading">{selected.name}<span>.</span></h2><p className="champion-title">{selected.title}</p><p className="encounter-description">{selected.intro}</p><a className="text-link" href="#changes">Discover the change <span aria-hidden="true">↘</span></a></div>
      <div className={`encounter-art art-${selected.id}`}><img key={selected.id} src={`/images/story/${selected.id}.jpg`} width="1215" height="717" loading="lazy" alt={`${selected.name}, official base champion splash artwork`} /></div>
    </div>
    <div className="champion-choices"><div><p className="eyebrow">Choose a champion</p><div className="choice-buttons">{champions.map(c => <button key={c.id} type="button" aria-label={`Choose ${c.name}`} aria-pressed={c.id===selected.id} onClick={()=>onSelect(c.id)}><span className="choice-dot" aria-hidden="true" />{c.name}<span className="choice-tag">{c.tag}</span></button>)}</div></div><a className="text-link" href="/champions">Find any champion ↗</a></div>
  </section>;
}
