import { useEffect, useRef, useState } from "react";
import type { Visit } from "../../lib/investigation";
import { derivePlan } from "../../lib/investigation";
export default function InvestigationStage({ visit }: { visit: Visit }) {
  const host = useRef<HTMLDivElement>(null),
    state = useRef({ visit, plan: derivePlan(visit) });
  state.current = { visit, plan: derivePlan(visit) };
  const [mode, setMode] = useState("loading");
  useEffect(() => {
    let cancelled = false,
      frame = 0,
      dispose = () => {};
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const el = host.current!;
    if (new URLSearchParams(location.search).get("renderer") === "fallback") {
      setMode("fallback");
      return;
    }
    import("./cinematic-scene")
      .then(async ({ buildScene }) => {
        const engine = await buildScene(el, "archive", false);
        if (cancelled) {
          engine.dispose();
          return;
        }
        dispose = engine.dispose;
        setMode(media.matches ? "webgl-reduced" : "webgl");
        const start = performance.now();
        let last = 0,
          lastSignature = "";
        const fail = (e: Event) => {
          e.preventDefault();
          setMode("fallback");
          cancelAnimationFrame(frame);
        };
        el.querySelector("canvas")?.addEventListener("webglcontextlost", fail);
        const tick = (now: number) => {
          if (cancelled) return;
          frame = requestAnimationFrame(tick);
          if (document.hidden || now - last < 33) return;
          last = now;
          const { visit: v, plan: p } = state.current;
          const signature =
            JSON.stringify(v) + el.clientWidth + ":" + el.clientHeight;
          if (media.matches && signature === lastSignature) return;
          if (el.getBoundingClientRect().bottom < 0) return;
          lastSignature = signature;
          const beat = ["opening", "subject", "evidence", "ending"].indexOf(
            v.beat,
          );
          engine.render(beat / 3, media.matches ? 2 : (now - start) / 1000, 0, {
            beat,
            event: Math.max(
              0,
              p.sequence.findIndex((r) => r.id === p.selected?.id),
            ),
            treatment: p.treatment,
            focus: Math.max(0, p.choices.indexOf(p.selected?.ability ?? "")),
            reduced: media.matches,
          });
          el.dataset.renderer = media.matches ? "webgl-reduced" : "webgl";
        };
        frame = requestAnimationFrame(tick);
      })
      .catch(() => {
        if (!cancelled) setMode("fallback");
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      dispose();
    };
  }, []);
  return (
    <div className="investigation-world" data-mode={mode}>
      <div ref={host} className="investigation-canvas" aria-hidden="true" />
      {mode === "fallback" && (
        <div className={`aperture-still ${visit.beat}`} aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      )}
      <span className="renderer-label">
        {mode === "fallback"
          ? "Still composition · same investigation"
          : mode === "loading"
            ? "Preparing the archive"
            : mode === "webgl-reduced"
              ? "Reduced motion"
              : "RiftScry / the archive"}
      </span>
    </div>
  );
}
