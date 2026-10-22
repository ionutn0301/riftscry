import { useState } from 'react';
import '../../styles/cinematic-stage.css';
const scenes = ['gateway', 'sanctuary', 'fracture', 'archive', 'return'];
export default function CinematicStage({ chapter, reduced }: { chapter: number; reduced: boolean }) {
  const [loaded, setLoaded] = useState<Record<number, boolean>>({});
  const visible = loaded[chapter] ? chapter : 0;
  return <div className={`cinematic-stage ${reduced ? 'motion-off' : ''}`} aria-hidden="true">
    {scenes.map((scene, index) => <div key={scene} className={`cinematic-shot shot-${index} ${visible === index ? 'is-visible' : ''}`}><img src={`/images/journey/${scene}.png`} alt="" fetchPriority={index === 0 ? 'high' : 'auto'} decoding="async" onLoad={() => setLoaded(previous => ({ ...previous, [index]: true }))} /></div>)}
    <div className="cinematic-readability" />
  </div>;
}
