import { Component, lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import type { WorldProps } from './ObservatoryWorld';
import MobileStage from './MobileStage';
const World = lazy(() => import('./ObservatoryWorld'));
class SceneBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}
export default function CinematicStage(props: Omit<WorldProps, 'onReady' | 'onFailure'>) {
  const [mobile, setMobile] = useState<boolean | null>(null);
  useEffect(() => {
    const query = matchMedia('(max-width: 760px), (pointer: coarse)');
    const update = () => setMobile(query.matches);
    update(); query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { if (failed) { props.onArrival(props.chapter); props.onPhase('ready'); } }, [failed, props.chapter, props.onArrival, props.onPhase]);
  const onReady = useCallback(() => setReady(true), []);
  const onFailure = useCallback(() => { setFailed(true); setReady(false); }, []);
  if (mobile === null) return <div className="world-stage" aria-busy="true" />;
  if (mobile) return <MobileStage {...props} />;
  return <div className="world-stage" data-ready={ready} data-failed={failed}>
    {!failed && <SceneBoundary key={attempt} onFailure={onFailure}><Suspense fallback={null}><World {...props} onReady={onReady} onFailure={onFailure} /></Suspense></SceneBoundary>}
    {!ready && <div className="world-status" role="status"><span>{failed ? 'The 3D scene is unavailable. Use the patch link or browse champions in About RiftScry.' : 'Preparing the observatory…'}</span>{failed && <button onClick={() => { setFailed(false); setAttempt(v => v + 1); }}>Retry scene</button>}</div>}
  </div>;
}
