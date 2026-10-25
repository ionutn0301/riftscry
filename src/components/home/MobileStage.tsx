import { useEffect } from 'react';
import type { WorldProps } from './ObservatoryWorld';
const scenes = ['gateway', 'sanctuary', 'fracture', 'archive', 'return'];
export default function MobileStage(props: Omit<WorldProps, 'onReady' | 'onFailure'>) {
  const { chapter, onArrival, onPhase, onInspectionChange } = props;
  useEffect(() => { onArrival(chapter); onPhase('ready'); onInspectionChange(false); }, [chapter, onArrival, onPhase, onInspectionChange]);
  return <div className="mobile-scene" data-ready="true">
    <img src={`/images/journey/${scenes[chapter]}-mobile.webp`} alt="" width="720" height="402" fetchPriority={chapter === 0 ? 'high' : 'auto'} />
    {chapter === 1 && <label className="mobile-scene-control">Your champion<select value={props.selected} onChange={event => props.onSelect(Number(event.target.value))}>{props.champions.map((champion, index) => <option key={champion.id} value={index}>{champion.name}</option>)}</select></label>}
    {chapter === 2 && <div className="mobile-scene-control"><span>{props.record.name} · {props.record.label}</span><strong>{props.record.before} → {props.record.after}</strong></div>}
    {chapter === 3 && <label className="mobile-scene-control">Explore the archive<select value={props.patch} onChange={event => props.onPatch(Number(event.target.value))}>{props.patches.map((patch, index) => <option key={patch.id} value={index}>Patch {patch.id} · {patch.date}</option>)}</select></label>}
  </div>;
}
