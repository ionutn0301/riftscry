import { useEffect, useRef, useState, type RefObject } from "react";
type Engine = {
  render: (progress: number, time: number, arrival: number) => unknown;
  dispose: () => void;
};
export default function CinematicStage({
  champion,
  progress,
  direct,
}: {
  champion: string;
  progress: RefObject<number>;
  direct: boolean;
}) {
  const host = useRef<HTMLDivElement>(null),
    engineRef = useRef<Engine | null>(null);
  const [mode, setMode] = useState("loading");
  useEffect(() => {
    let stop = false,
      frame = 0;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let cancelled = direct || media.matches;
    const interrupt = () => {
      cancelled = true;
    };
    for (const event of ["wheel", "touchstart", "keydown", "pointerdown"])
      window.addEventListener(event, interrupt, { passive: true });
    const element = host.current!;
    const next = document.createElement("div");
    next.className = "cinema-render-surface";
    next.style.cssText = "position:absolute;inset:0;visibility:hidden";
    element.appendChild(next);
    const failed = () => {
      if (stop) return;
      setMode("fallback");
      cancelAnimationFrame(frame);
      engineRef.current?.dispose();
      engineRef.current = null;
    };
    const mediaChange = () => {
      cancelled = true;
      setMode(media.matches ? "webgl-reduced" : "webgl");
    };
    media.addEventListener("change", mediaChange);
    import("./cinematic-scene")
      .then(async ({ buildScene }) => {
        if (new URLSearchParams(location.search).get("renderer") === "fallback")
          throw Error("Requested fallback");
        const engine = await buildScene(next, champion, media.matches);
        if (stop) {
          engine.dispose();
          next.remove();
          return;
        }
        engine.render(progress.current, 0, cancelled ? 0 : 1.5);
        engineRef.current?.dispose();
        for (const child of [...element.children])
          if (child !== next) child.remove();
        engineRef.current = engine;
        next.style.visibility = "visible";
        next
          .querySelector("canvas")
          ?.addEventListener("webglcontextlost", failed);
        setMode(media.matches ? "webgl-reduced" : "webgl");
        const started = performance.now();
        const tick = (now: number) => {
          if (stop) return;
          const t = Math.min(1, (now - started) / 1300);
          engine.render(
            progress.current,
            media.matches ? 0 : now / 1000,
            cancelled ? 0 : 1.5 * Math.pow(1 - t, 3),
          );
          for (const key of ["progress", "camera", "framing", "life"])
            element.dataset[key] = next.dataset[key];
          frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      })
      .catch(() => {
        next.remove();
        failed();
      });
    return () => {
      stop = true;
      cancelAnimationFrame(frame);
      for (const event of ["wheel", "touchstart", "keydown", "pointerdown"])
        window.removeEventListener(event, interrupt);
      media.removeEventListener("change", mediaChange);
    };
  }, [champion, direct, progress]);
  useEffect(
    () => () => {
      engineRef.current?.dispose();
    },
    [],
  );
  return (
    <div className="cinema-stage" data-renderer={mode}>
      <div ref={host} className="cinema-canvas" aria-hidden="true" />
      {(mode === "loading" || mode === "fallback") && (
        <img
          className="cinema-fallback"
          src={`/images/story/${champion}.jpg`}
          alt={`${champion} — complete original champion illustration`}
          width="1215"
          height="717"
        />
      )}
      <span className="cinema-mode">
        {mode === "fallback"
          ? "Still artwork · renderer unavailable"
          : mode === "loading"
            ? "Preparing scene"
            : mode === "webgl-reduced"
              ? "WebGL · reduced motion"
              : "WebGL · original illustration"}
      </span>
    </div>
  );
}
