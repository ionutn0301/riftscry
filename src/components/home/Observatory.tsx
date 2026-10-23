import { useEffect, useRef, useState } from 'react';
import type { JourneyPhase } from '../../lib/journey-director';
import { chapters, chapterAt, type ObservatoryData } from '../../lib/observatory';

import brandLogo from '../../assets/brand/logo-desktop-light.png';
import CinematicStage from './CinematicStage';
import { JourneyArrival } from './JourneyArrival';
export default function Observatory({ data }: { data: ObservatoryData }) {
  const [progress, setProgress] = useState(0);
  const [watch, setWatch] = useState(false);
  const [paused, setPaused] = useState(false);
  const [skipVersion, setSkipVersion] = useState(0);
  const [exhibitOpen, setExhibitOpen] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [selected, setSelected] = useState(0);
  const [pool, setPool] = useState<string[]>([]);
  const [patch, setPatch] = useState(0);
  const [split, setSplit] = useState(.35);
  const [staticMode, setStaticMode] = useState(true);
  const [sound, setSound] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const destination = chapterAt(progress);
  const [chapter, setChapter] = useState(0);
  const [phase, setPhase] = useState<JourneyPhase>('ready');
  const champion = data.champions[selected]!;
  const numeric = champion.changes.find(c => c.before !== undefined);
  const go = (n: number) => { setWatch(false); setPaused(false); setProgress(n); };
  useEffect(() => { setExhibitOpen(false); }, [chapter]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.target instanceof Element && event.target.closest('input, textarea, button, a, summary, [contenteditable]')) return;
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault(); setWatch(false);
      setProgress(p => Math.max(0, Math.min(4, Math.round(p) + (event.key === 'ArrowRight' ? 1 : -1))));
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, []);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { setStaticMode(media.matches); setWatch(false); };
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!watch || staticMode) return;
    let frame = 0, previous = performance.now();
    const tick = (now: number) => {
      if (now - previous >= 1000 / 30) {
        const dt = Math.min((now - previous) / 1000, .1);
        previous = now;
        setProgress(p => Math.min(4, p + dt / 15));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [watch, staticMode]);
  useEffect(() => { if (progress >= 4) setWatch(false); }, [progress]);
  useEffect(() => {
    const el = root.current; if (!el) return;
    let touchY = 0, touchX = 0, active = false, pending = 0, frame = 0;
    const excluded = (target: EventTarget | null) => target instanceof Element && !!target.closest('.exhibit-panel, .film-credits, input, button, a');
    const enqueue = (delta: number) => {
      pending += delta;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        setWatch(false);
        const delta = pending;
        pending = 0; frame = 0;
        setProgress(p => Math.min(4, Math.max(0, p + delta)));
      });
    };
    const wheel = (e: WheelEvent) => { if (excluded(e.target) || e.ctrlKey) return; e.preventDefault(); enqueue(Math.max(-100, Math.min(100, e.deltaY)) * .0013); };
    const start = (e: TouchEvent) => {
      active = e.touches.length === 1 && !excluded(e.target);
      touchY = e.touches[0]?.clientY ?? 0; touchX = e.touches[0]?.clientX ?? 0;
    };
    const move = (e: TouchEvent) => {
      if (!active || e.touches.length !== 1) return;
      const touch = e.touches[0]!;
      const dy = touchY - touch.clientY;
      if (Math.abs(dy) < Math.abs(touchX - touch.clientX)) return;
      if (e.cancelable) e.preventDefault();
      enqueue(dy / Math.max(420, el.clientHeight * 1.1));
      touchY = touch.clientY; touchX = touch.clientX;
    };
    const end = () => { active = false; };
    el.addEventListener('wheel', wheel, { passive: false });
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end); el.addEventListener('touchcancel', end);
    return () => { cancelAnimationFrame(frame); el.removeEventListener('wheel', wheel); el.removeEventListener('touchstart', start); el.removeEventListener('touchmove', move); el.removeEventListener('touchend', end); el.removeEventListener('touchcancel', end); };
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
  return <div className={`observatory ${staticMode ? 'is-static' : ''}`} data-phase={phase} data-inspecting={inspecting} data-chapter={chapter} ref={root}>
    <div className="observatory-canvas"><CinematicStage onInspectionChange={setInspecting} record={{ patch: champion.patch, name: champion.name, before: String(numeric?.before ?? 'Before'), after: String(numeric?.after ?? 'After'), label: numeric?.label ?? champion.changes[0]?.label ?? 'Champion record' }} champions={data.champions} patches={data.patches} assetVersion={data.assetVersion} chapter={destination} skipVersion={skipVersion} paused={paused} reduced={staticMode} split={split} onSplit={value => { setSplit(value); setWatch(false); }} selected={selected} count={data.champions.length} patch={patch} patchCount={data.patches.length} onTravel={go} onSelect={i => { setSelected(i); setWatch(false); }} onPatch={i => { setPatch(i); setWatch(false); }} onArrival={setChapter} onPhase={setPhase} /></div>
    {phase !== 'ready' && <button className="skip-travel" onClick={() => { setSkipVersion(v => v + 1); setPaused(false); }}>Skip travel</button>}
    <div className="observatory-vignette" />
    <div className="scene-cue" role="status">{chapter === 0 ? 'ACTIVATE THE CORE · CLICK THE SCULPTURE' : chapter === 1 ? `${champion.name.toUpperCase()} SELECTED · CHOOSE A FLOATING SHARD` : chapter === 2 ? 'SELECT AN INSCRIBED RECORD · BRING IT CLOSER' : chapter === 3 ? 'SELECT A TABLET · INSPECT THE PATCH' : 'THE NEXT MOVE IS YOURS'}</div>
    <header className="film-header"><a className="film-brand" href="/" aria-label="RiftScry home"><img src={brandLogo.src} width="240" height="80" alt="RiftScry" /><span className="brand-caption">A NEW PERSPECTIVE ON THE RIFT</span></a><a className="film-tool" href={`/patch/${data.latest}`}>Patch {data.latest}<span aria-hidden="true">↗</span></a></header>
    <div className="film-coordinate">RS—{data.latest}<span>AN EVER-CHANGING WORLD</span><a href="/pool">Choose champions ↗</a></div>
    <section key={chapter} className={`film-story chapter-${chapter}`} aria-label={chapters[chapter]} inert={phase === 'travelling'}>
      <div className="film-kicker"><span /> {String(chapter + 1).padStart(2, '0')} / {chapters[chapter]}</div>
      {chapter === 0 && <><h1>Nothing stays.<br /><em>Know what shifts.</em></h1><p>The Rift is never the same twice.<br />A journey through the changes that shape your game.</p><div className="film-actions"><button className="film-primary" onClick={() => go(1)}>Enter the observatory <span>↗</span></button><button onClick={() => { setProgress(0); setWatch(true); }} disabled={staticMode}>Watch the journey <span>▷</span></button></div></>}
      {chapter === 1 && <><h2>Your champions.<br /><em>Your constellation.</em></h2><p>The signal leads to the sanctuary.<br />Choose the champion whose future you will follow.</p></>}
      {chapter === 2 && <><h2>A small shift.<br /><em>A different game.</em></h2><p>{champion.name}&apos;s record reveals the fracture.<br />Compare what was with what comes next.</p></>}
      {chapter === 3 && <><h2>Every change<br /><em>leaves a trace.</em></h2><p>One change is only part of the story.<br />Trace the records that brought us here.</p></>}
      {chapter === 4 && <><h2>Return to the Rift.<br /><em>See it differently.</em></h2><JourneyArrival champion={champion.name} patch={data.latest} records={data.patches.length} />{pool.length > 0 && <p>{`Your constellation: ${pool.map(id => data.champions.find(c => c.id === id)?.name).join(', ')}.`}</p>}<div className="film-actions"><a className="film-primary" href={`/patch/${data.latest}`}>Explore patch {data.latest} ↗</a><button onClick={() => { setProgress(0); setWatch(!staticMode); }}>Replay journey ↺</button></div></>}
      {chapter > 0 && chapter < 4 && <button className="story-next" onClick={() => go(chapter + 1)}>{chapter === 1 ? `Follow ${champion.name}’s signal` : chapter === 2 ? 'Trace the origin' : 'Carry this knowledge back'} <span aria-hidden="true">→</span></button>}
    </section>
    {chapter > 0 && chapter < 4 && <aside inert={phase === 'travelling'} className={`exhibit-panel ${exhibitOpen ? 'is-expanded' : ''}`} onPointerDown={() => setWatch(false)}>
      <button className="mobile-exhibit-toggle" aria-expanded={exhibitOpen} aria-controls="exhibit-content" onClick={() => { setWatch(false); setExhibitOpen(v => !v); }}><span>{chapter === 3 ? `Patch ${data.patches[patch]?.id}` : champion.name}<small>{exhibitOpen ? 'Return to the scene' : 'Tap to explore the record'}</small></span><span aria-hidden="true">{exhibitOpen ? '−' : '+'}</span></button>
      <div id="exhibit-content" className="exhibit-content">
      {chapter !== 3 ? <><div className="exhibit-meta">CHAMPION RECORD <span>{champion.classification}</span></div><h3>{champion.name}</h3><p className="exhibit-title">{champion.title}</p><div className="champion-picker" aria-label="Select champion">{data.champions.map((c, i) => <button key={c.id} aria-pressed={selected === i} onClick={() => { setSelected(i); setWatch(false); }}>{c.name}</button>)}</div>
      {chapter === 1 ? <><p className="record-label">MOST RECENT RECORD · {champion.patch}</p><p>{champion.changes[0]?.label ?? 'No changes in the recorded history.'}</p><button className="pool-button" aria-pressed={pool.includes(champion.id)} onClick={() => setPool(p => p.includes(champion.id) ? p.filter(id => id !== champion.id) : [...p, champion.id])}>{pool.includes(champion.id) ? '− Remove from constellation' : '+ Add to constellation'}</button><button className="inspect-button" onClick={() => go(2)}>Inspect the change ↗</button></> : <><p className="record-label">PATCH {champion.patch} · {numeric?.label ?? 'Qualitative change'}</p>{numeric ? <><div className="delta-values"><div><small>BEFORE</small>{numeric.before}</div><span>→</span><div><small>AFTER</small>{numeric.after}</div></div><label className="lens-label">Separate the lens<input aria-label="Separate the lens" type="range" min="0" max="1" step=".01" value={split} onChange={e => { setSplit(Number(e.target.value)); setWatch(false); }} /></label></> : <p>{champion.changes[0]?.text ?? 'No numeric comparison is available.'}</p>}<a href={`/champion/${champion.id.toLowerCase()}`}>Full champion history ↗</a></> }</> : <><div className="exhibit-meta">THE RECORDED ARCHIVE</div><h3>Patch {data.patches[patch]?.id}</h3><p>{data.patches[patch]?.date} · {data.patches[patch]?.count} champions changed</p><div className="archive-picker">{data.patches.map((p, i) => <button key={p.id} aria-pressed={patch === i} onClick={() => setPatch(i)}>{p.id}</button>)}</div><a className="inspect-button" href={`/patch/${data.patches[patch]?.id}`}>Open this record ↗</a></>}
      </div>
    </aside>}
    <footer className="film-footer"><div className="playback"><button aria-label={(watch || phase !== 'ready') && !paused ? 'Pause journey' : 'Play journey'} disabled={staticMode} onClick={() => { if (phase !== 'ready') { setPaused(v => !v); setWatch(false); } else { setPaused(false); if (progress >= 4) setProgress(0); setWatch(v => !v); } }}>{(watch || phase !== 'ready') && !paused ? 'Ⅱ' : '▷'}</button><button aria-pressed={sound} onClick={toggleSound}>SOUND {sound ? 'ON' : 'OFF'}</button></div><nav aria-label="Journey chapters">{chapters.map((name, i) => <button key={name} aria-label={`Chapter ${i + 1}: ${name}`} aria-current={chapter === i ? 'step' : undefined} onClick={() => go(i)}><span>{String(i + 1).padStart(2, '0')}</span><i /></button>)}</nav><div className="film-scroll">{staticMode ? 'CHOOSE A CHAPTER' : <><span className="desktop-travel">SCROLL TO TRAVEL</span><span className="mobile-travel">SWIPE TO TRAVEL</span></>} <span>↓</span></div></footer>
    <div className="film-progress" style={{ transform: `scaleX(${progress / 4})` }} />
    <details className="film-credits"><summary>Credits & information</summary><p>Original real-time 3D architecture, procedural stone and brass materials, and a continuous camera journey. Patch data from Riot Games. Champion portraits are provided by Riot Games Data Dragon. Architecture and audio are original. RiftScry isn’t endorsed by Riot Games and doesn’t reflect the views or opinions of Riot Games or anyone officially involved in producing or managing League of Legends. League of Legends and Riot Games are trademarks or registered trademarks of Riot Games, Inc.</p><a href={data.source}>Official patch source ↗</a><button onClick={() => { setStaticMode(v => !v); setWatch(false); }}>{staticMode ? 'Enable motion' : 'Reduce motion'}</button></details>
  </div>;
}
