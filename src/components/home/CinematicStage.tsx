import { useRef, useState, type CSSProperties } from 'react';
import '../../styles/cinematic-stage.css';
import '../../styles/journey-interactions.css';
const scenes = ['gateway', 'sanctuary', 'fracture', 'archive', 'return'];
type Props = { chapter: number; reduced: boolean; split: number; selected: number; names: string[]; patch: number; patches: string[]; onTravel: (chapter: number) => void; onSelect: (index: number) => void; onPatch: (index: number) => void };
export default function CinematicStage({ chapter, reduced, split, selected, names, patch, patches, onTravel, onSelect, onPatch }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState<Record<number, boolean>>({});
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  return <div ref={root} className={`cinematic-stage location-${chapter} ${reduced ? 'motion-off' : ''}`} onPointerMove={event => {
    if (reduced || event.pointerType === 'touch') return;
    const box = event.currentTarget.getBoundingClientRect();
    root.current?.style.setProperty('--look-x', `${(event.clientX - box.left - box.width / 2) / box.width * 20}px`);
    root.current?.style.setProperty('--look-y', `${(event.clientY - box.top - box.height / 2) / box.height * 12}px`);
  }} onPointerLeave={() => { root.current?.style.setProperty('--look-x', '0px'); root.current?.style.setProperty('--look-y', '0px'); }}>
    {scenes.map((scene, index) => <div key={scene} aria-hidden="true" className={`cinematic-shot shot-${index} ${chapter === index && loaded[index] ? 'is-visible' : ''}`}><img src={`/images/journey/${scene}.png`} alt="" fetchPriority={index === 0 ? 'high' : 'auto'} decoding="async" onLoad={() => setLoaded(previous => ({ ...previous, [index]: true }))} onError={() => setFailed(previous => ({ ...previous, [index]: true }))} /></div>)}
    {!loaded[chapter] && <p className="scene-loading" role="status">{failed[chapter] ? 'Environment unavailable. Journey controls remain available.' : 'Entering the next location…'}</p>}
    <div className="cinematic-readability" />
    <div key={chapter} className="travel-veil" aria-hidden="true" />
    <div className="world-interaction" style={{ '--fracture': `${split * 100}%` } as CSSProperties}>
      <span className="world-caption">{['THE THRESHOLD', 'ATTUNE TO A CHAMPION', 'THE FRACTURE', 'ECHOES OF THE PAST', 'YOUR NEXT CHAPTER'][chapter]}</span>
      {chapter === 0 && <button className="portal-control" onClick={() => onTravel(1)}><span className="portal-rings" aria-hidden="true" /><span>Open the gate</span><small>Begin your discovery</small></button>}
      {chapter === 1 && <div className="signal-orbit">{names.map((name, index) => <button key={name} aria-pressed={selected === index} onClick={() => onSelect(index)}><span aria-hidden="true" className="signal-light" />{name}</button>)}<button className="world-continue" onClick={() => onTravel(2)}>Follow {names[selected]} →</button></div>}
      {chapter === 2 && <><div className="fracture-window" aria-hidden="true"><span /><i /></div><button className="world-continue" onClick={() => onTravel(3)}>Find the origin →</button><small className="world-hint">Move “Separate the lens” to reshape the fracture</small></>}
      {chapter === 3 && <div className="record-path">{patches.map((id, index) => <button key={id} aria-pressed={patch === index} onClick={() => onPatch(index)}><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>Patch {id}</button>)}<button className="world-continue" onClick={() => onTravel(4)}>Return with your discoveries →</button></div>}
      {chapter === 4 && <div className="return-beacon"><span aria-hidden="true" /><p>The signal is yours now.</p><button className="world-continue" onClick={() => onTravel(0)}>Reopen the gateway ↺</button></div>}
    </div>
  </div>;
}
