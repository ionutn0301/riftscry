import { Component, Suspense, lazy, useEffect, useRef, useState, type ReactNode } from 'react';
import { chapters, chapterAt, type ObservatoryData } from '../../lib/observatory';
const World = lazy(() => import('./ObservatoryWorld'));
class SceneBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}
export default function Observatory({ data }: { data: ObservatoryData }) {
  const [progress, setProgress] = useState(0);
  const [watch, setWatch] = useState(false);
  const [selected, setSelected] = useState(0);
  const [pool, setPool] = useState<string[]>([]);
  const [patch, setPatch] = useState(0);
  const [split, setSplit] = useState(.35);
  const [staticMode, setStaticMode] = useState(true);
  const [ready, setReady] = useState(false);
  const [sound, setSound] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const chapter = chapterAt(progress);
  const champion = data.champions[selected]!;
  const numeric = champion.changes.find(c => c.before !== undefined);
  const go = (n: number) => { setWatch(false); setProgress(n); };
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { setStaticMode(media.matches); setWatch(false); };
    update(); setReady(true); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!watch || staticMode) return;
    let frame = 0, previous = performance.now();
    const tick = (now: number) => { const dt = Math.min((now - previous) / 1000, .1); previous = now; setProgress(p => Math.min(4, p + dt / 15)); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [watch, staticMode]);
  useEffect(() => { if (progress >= 4) setWatch(false); }, [progress]);
  useEffect(() => {
    const el = root.current; if (!el) return;
    let touchY = 0;
    const wheel = (e: WheelEvent) => { if ((e.target as HTMLElement).closest('.exhibit-panel, input, button, a')) return; e.preventDefault(); setWatch(false); setProgress(p => Math.min(4, Math.max(0, p + e.deltaY * .0013))); };
    const start = (e: TouchEvent) => { touchY = e.touches[0]?.clientY ?? 0; };
    const move = (e: TouchEvent) => { if ((e.target as HTMLElement).closest('.exhibit-panel, input, button, a')) return; const y = e.touches[0]?.clientY ?? touchY; setWatch(false); setProgress(p => Math.min(4, Math.max(0, p + (touchY - y) * .007))); touchY = y; };
    el.addEventListener('wheel', wheel, { passive: false }); el.addEventListener('touchstart', start, { passive: true }); el.addEventListener('touchmove', move, { passive: true });
    return () => { el.removeEventListener('wheel', wheel); el.removeEventListener('touchstart', start); el.removeEventListener('touchmove', move); };
  }, []);
  useEffect(() => {
    const hide = () => { if (document.hidden) { setWatch(false); setSound(false); void audio.current?.suspend(); } };
    document.addEventListener('visibilitychange', hide);
    return () => { document.removeEventListener('visibilitychange', hide); void audio.current?.close(); };
  }, []);
  async function toggleSound() {
    if (sound) { await audio.current?.suspend(); setSound(false); return; }
    try {
      if (!audio.current) {
        const ctx = new AudioContext(); const gain = ctx.createGain(); gain.gain.value = .025; gain.connect(ctx.destination);
        [55, 82.41, 110.2].forEach(f => { const osc = ctx.createOscillator(); osc.frequency.value = f; osc.connect(gain); osc.start(); }); audio.current = ctx;
      }
      await audio.current.resume(); setSound(true);
    } catch { setSound(false); }
  }
  const select = (i: number) => { setSelected(i); go(1); };
  return <div className={`observatory ${staticMode ? 'is-static' : ''}`} ref={root}>
    <div className="observatory-canvas" aria-hidden="true">{ready && !staticMode && <SceneBoundary onFailure={() => setStaticMode(true)}><Suspense fallback={null}><World data={data} progress={progress} split={chapter === 2 ? split : 0} select={select} inspect={() => go(2)} archive={i => { setPatch(i); go(3); }} onFailure={() => setStaticMode(true)} /></Suspense></SceneBoundary>}</div>
    <div className="observatory-vignette" />
    <header className="film-header"><a className="film-brand" href="/" aria-label="RiftScry home"><span className="brand-sigil" aria-hidden="true">◇</span> RIFTSCRY<span className="brand-caption">THE PATCH OBSERVATORY</span></a><a className="film-tool" href={`/patch/${data.latest}`}>Patch {data.latest}<span aria-hidden="true">↗</span></a></header>
    <div className="film-coordinate">RS—{data.latest}<span>AN EVER-CHANGING WORLD</span><a href="/pool">Choose champions ↗</a></div>
    <section className={`film-story chapter-${chapter}`} aria-label={chapters[chapter]}>
      <div className="film-kicker"><span /> {String(chapter + 1).padStart(2, '0')} / {chapters[chapter]}</div>
      {chapter === 0 && <><h1>Nothing stays.<br /><em>Know what shifts.</em></h1><p>The Rift is never the same twice.<br />A journey through the changes that shape your game.</p><div className="film-actions"><button className="film-primary" onClick={() => go(1)}>Enter the observatory <span>↗</span></button><button onClick={() => { setProgress(0); setWatch(true); }} disabled={staticMode}>Watch the journey <span>▷</span></button></div></>}
      {chapter === 1 && <><h2>Your champions.<br /><em>Your constellation.</em></h2><p>Choose an artifact. Discover what changed.<br />Build a small pool for this visit.</p></>}
      {chapter === 2 && <><h2>A small shift.<br /><em>A different game.</em></h2><p>Move the lens. Inspect the difference.<br />Every value comes from the recorded patch.</p></>}
      {chapter === 3 && <><h2>Every change<br /><em>leaves a trace.</em></h2><p>Travel through the archive.<br />Understand the game beyond a single patch.</p></>}
      {chapter === 4 && <><h2>Return to the Rift.<br /><em>See it differently.</em></h2><p>{pool.length ? `Your constellation: ${pool.map(id => data.champions.find(c => c.id === id)?.name).join(', ')}.` : 'A clearer perspective. A more informed next game.'}</p><div className="film-actions"><a className="film-primary" href={`/patch/${data.latest}`}>Explore patch {data.latest} ↗</a><button onClick={() => { setProgress(0); setWatch(!staticMode); }}>Replay journey ↺</button></div></>}
    </section>
    {chapter > 0 && chapter < 4 && <aside className="exhibit-panel" onPointerDown={() => setWatch(false)}>
      {chapter !== 3 ? <><div className="exhibit-meta">CHAMPION RECORD <span>{champion.classification}</span></div><h3>{champion.name}</h3><p className="exhibit-title">{champion.title}</p><div className="champion-picker" aria-label="Select champion">{data.champions.map((c, i) => <button key={c.id} aria-pressed={selected === i} onClick={() => { setSelected(i); setWatch(false); }}>{c.name}</button>)}</div>
      {chapter === 1 ? <><p className="record-label">MOST RECENT RECORD · {champion.patch}</p><p>{champion.changes[0]?.label ?? 'No changes in the recorded history.'}</p><button className="pool-button" aria-pressed={pool.includes(champion.id)} onClick={() => setPool(p => p.includes(champion.id) ? p.filter(id => id !== champion.id) : [...p, champion.id])}>{pool.includes(champion.id) ? '− Remove from constellation' : '+ Add to constellation'}</button><button className="inspect-button" onClick={() => go(2)}>Inspect the change ↗</button></> : <><p className="record-label">PATCH {champion.patch} · {numeric?.label ?? 'Qualitative change'}</p>{numeric ? <><div className="delta-values"><div><small>BEFORE</small>{numeric.before}</div><span>→</span><div><small>AFTER</small>{numeric.after}</div></div><label className="lens-label">Separate the lens<input aria-label="Separate the lens" type="range" min="0" max="1" step=".01" value={split} onChange={e => { setSplit(Number(e.target.value)); setWatch(false); }} /></label></> : <p>{champion.changes[0]?.text ?? 'No numeric comparison is available.'}</p>}<a href={`/champion/${champion.id.toLowerCase()}`}>Full champion history ↗</a></> }</> : <><div className="exhibit-meta">THE RECORDED ARCHIVE</div><h3>Patch {data.patches[patch]?.id}</h3><p>{data.patches[patch]?.date} · {data.patches[patch]?.count} champions changed</p><div className="archive-picker">{data.patches.map((p, i) => <button key={p.id} aria-pressed={patch === i} onClick={() => setPatch(i)}>{p.id}</button>)}</div><a className="inspect-button" href={`/patch/${data.patches[patch]?.id}`}>Open this record ↗</a></>}
    </aside>}
    <footer className="film-footer"><div className="playback"><button aria-label={watch ? 'Pause journey' : 'Play journey'} disabled={staticMode} onClick={() => { if (progress >= 4) setProgress(0); setWatch(v => !v); }}>{watch ? 'Ⅱ' : '▷'}</button><button aria-pressed={sound} onClick={toggleSound}>SOUND {sound ? 'ON' : 'OFF'}</button></div><nav aria-label="Journey chapters">{chapters.map((name, i) => <button key={name} aria-label={`Chapter ${i + 1}: ${name}`} aria-current={chapter === i ? 'step' : undefined} onClick={() => go(i)}><span>{String(i + 1).padStart(2, '0')}</span><i /></button>)}</nav><div className="film-scroll">{staticMode ? 'CHOOSE A CHAPTER' : 'SCROLL TO TRAVEL'} <span>↓</span></div></footer>
    <div className="film-progress" style={{ transform: `scaleX(${progress / 4})` }} />
    <details className="film-credits"><summary>Credits & information</summary><p>Original procedural environment. Patch data from Riot Games. No Riot artwork, models or audio are used in this scene. RiftScry isn’t endorsed by Riot Games and doesn’t reflect the views or opinions of Riot Games or anyone officially involved in producing or managing League of Legends. League of Legends and Riot Games are trademarks or registered trademarks of Riot Games, Inc.</p><a href={data.source}>Official patch source ↗</a><button onClick={() => { setStaticMode(v => !v); setWatch(false); }}>{staticMode ? 'Enable 3D' : 'Disable 3D'}</button></details>
  </div>;
}
