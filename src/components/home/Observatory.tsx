import { useEffect, useState } from 'react';
import type { JourneyPhase } from '../../lib/journey-director';
import { chapters, type ObservatoryData } from '../../lib/observatory';
import brandLogo from '../../assets/brand/logo-desktop-light.png';
import CinematicStage from './CinematicStage';
import JourneyNavigation from './JourneyNavigation';

const introductions = [
  ['The Rift, in perspective.', 'Follow the signal. Discover what changed.'],
  ['Find your constellation.', 'Select a champion medallion to follow its story.'],
  ['Small changes. New possibilities.', 'Touch an inscribed record to bring it closer.'],
  ['Every patch leaves a trace.', 'Explore the tablets. Discover the history.'],
  ['Your next move starts here.', 'Take a clearer perspective back to the Rift.'],
];

export default function Observatory({ data }: { data: ObservatoryData }) {
  const [destination, setDestination] = useState(0);
  const [chapter, setChapter] = useState(0);
  const [phase, setPhase] = useState<JourneyPhase>('ready');
  const [reduced, setReduced] = useState(true);
  const [paused, setPaused] = useState(false);
  const [skipVersion, setSkipVersion] = useState(0);
  const [inspecting, setInspecting] = useState(false);
  const [selected, setSelected] = useState(0);
  const [patch, setPatch] = useState(0);
  const [split, setSplit] = useState(.35);
  const champion = data.champions[selected]!;
  const numeric = champion.changes.find(change => change.before !== undefined);
  const travel = (index: number) => { setDestination(Math.max(0, Math.min(4, index))); setPaused(false); };
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(preference.matches);
    update(); preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (inspecting || event.target instanceof Element && event.target.closest('input,button,a,summary,textarea,[contenteditable]')) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault(); setPaused(false);
        setDestination(current => Math.max(0, Math.min(4, current + (event.key === 'ArrowRight' ? 1 : -1))));
      }
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, [inspecting]);
  return <div className="observatory journey" data-chapter={chapter} data-phase={phase} data-inspecting={inspecting}>
    <div className="journey-world"><CinematicStage onInspectionChange={setInspecting} record={{ patch: champion.patch, name: champion.name, before: String(numeric?.before ?? 'Before'), after: String(numeric?.after ?? 'After'), label: numeric?.label ?? champion.changes[0]?.label ?? 'Champion record' }} champions={data.champions} patches={data.patches} assetVersion={data.assetVersion} chapter={destination} skipVersion={skipVersion} paused={paused} reduced={reduced} split={split} onSplit={setSplit} selected={selected} count={data.champions.length} patch={patch} patchCount={data.patches.length} onTravel={travel} onSelect={setSelected} onPatch={setPatch} onArrival={setChapter} onPhase={setPhase} /></div>
    <header className="journey-header"><a href="/" aria-label="RiftScry home"><img src={brandLogo.src} width="240" height="80" alt="RiftScry" /></a><a href={`/patch/${data.latest}`}>Patch {data.latest} <span aria-hidden="true">↗</span></a></header>
    <section className="journey-intro" aria-live="polite" aria-label={chapters[chapter]} inert={inspecting || phase !== 'ready'}>
      <p className="journey-eyebrow">{String(chapter + 1).padStart(2, '0')} / {chapters[chapter]}</p>
      <h1>{introductions[chapter]![0]}</h1>
      <p>{introductions[chapter]![1]}</p>
      {chapter === 0 && <button className="journey-link" onClick={() => travel(1)}>Begin the journey <span aria-hidden="true">→</span></button>}
      {chapter === 1 && <a className="journey-link" href={`/champion/${champion.id.toLowerCase()}`}>{champion.name} · Full history <span aria-hidden="true">↗</span></a>}
      {chapter === 2 && <a className="journey-link" href={`/champion/${champion.id.toLowerCase()}`}>Explore {champion.name}&apos;s changes <span aria-hidden="true">↗</span></a>}
      {chapter === 3 && <a className="journey-link" href={`/patch/${data.patches[patch]?.id}`}>Read patch {data.patches[patch]?.id} <span aria-hidden="true">↗</span></a>}
      {chapter === 4 && <a className="journey-link" href="/pool">Build your champion pool <span aria-hidden="true">↗</span></a>}
    </section>
    {phase !== 'ready' && <div className="journey-transit" role="status"><span>Travelling to {chapters[destination]}</span><button onClick={() => setPaused(value => !value)}>{paused ? 'Resume' : 'Pause'}</button><button onClick={() => { setSkipVersion(value => value + 1); setPaused(false); }}>Skip travel</button></div>}
    <JourneyNavigation chapter={chapter} destination={destination} onTravel={travel} reduced={reduced} onToggleMotion={() => setReduced(value => !value)} />
    <details className="journey-credits"><summary>About RiftScry</summary><p>An independent League of Legends patch observatory. Champion artwork and game data belong to Riot Games. RiftScry is not endorsed by Riot Games.</p><a href={data.source}>Official patch source ↗</a><a href="/champions">Browse all champions ↗</a></details>
  </div>;
}
