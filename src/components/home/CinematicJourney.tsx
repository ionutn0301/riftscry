import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useStore } from "@nanostores/react";
import { $pool } from "../../lib/pool";
import {
  patches,
  cinemaBranch,
  parseCinema,
  cinemaUrl,
  type CinemaState,
} from "./cinematic-data";
import CinemaReading from "./CinemaReading";
import CinematicStage from "./CinematicStage";
import "./cinematic.css";
const empty: string[] = [];
const subscribe = (fn: () => void) => {
  window.addEventListener("popstate", fn);
  window.addEventListener("riftscry:navigate", fn);
  return () => {
    window.removeEventListener("popstate", fn);
    window.removeEventListener("riftscry:navigate", fn);
  };
};
export default function CinematicJourney() {
  const query = useSyncExternalStore(
    subscribe,
    () => location.search,
    () => "",
  );
  const state = parseCinema(query);
  const branch = cinemaBranch(state.champion, state.patch);
  const record =
    branch.records.find((r) => r.id === state.change) ?? branch.records[0];
  const pool = useStore($pool, { ssr: () => empty });
  const track = useRef<HTMLDivElement>(null),
    shell = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const [phase, setPhase] = useState("establishing");
  const direct = useRef(typeof location !== "undefined" && !!location.search);
  const go = (p: number) => {
    const element = track.current!;
    window.scrollTo({
      top: element.offsetTop + p * (element.offsetHeight - innerHeight),
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  };
  const navigate = (next: CinemaState, p: number) => {
    history.replaceState({ progress: progress.current }, "", location.href);
    history.pushState({ progress: p }, "", cinemaUrl(next));
    window.dispatchEvent(new Event("riftscry:navigate"));
    go(p);
  };
  useEffect(() => {
    const update = () => {
      const t = track.current!;
      const p = Math.max(
        0,
        Math.min(1, (scrollY - t.offsetTop) / (t.offsetHeight - innerHeight)),
      );
      progress.current = p;
      shell.current?.style.setProperty(
        "--inspection",
        String(Math.max(0, Math.min(1, (p - 0.72) / 0.28))),
      );
      setPhase(
        p > 0.88 ? "inspection" : p > 0.54 ? "encounter" : "establishing",
      );
    };
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  useEffect(() => {
    const restore = () => {
      const s = parseCinema(location.search);
      const t = track.current!;
      const p =
        history.state?.progress ??
        (s.view === "record" || s.view === "pool"
          ? 1
          : s.view === "champion"
            ? 0.7
            : 0);
      window.scrollTo({
        top: t.offsetTop + p * (t.offsetHeight - innerHeight),
        behavior: "instant",
      });
    };
    window.addEventListener("popstate", restore);
    if (direct.current) restore();
    return () => window.removeEventListener("popstate", restore);
  }, []);
  return (
    <div className="cinema-page">
      <header className="cinema-header">
        <a className="cinema-brand" href="/">
          RIFT<span>SCRY</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="/champions">Champions</a>
          <a href="/patches">Patches</a>
          <a href="/compare">Compare</a>
          <button
            onClick={() =>
              navigate({ ...state, view: "pool", change: null }, 1)
            }
          >
            My Pool ({pool.length})
          </button>
          <button data-palette-trigger>Search</button>
        </nav>
      </header>
      <div ref={track} className="cinema-track">
        <div ref={shell} className="cinema-shell" data-phase={phase}>
          <div className="cinema-context">
            <span>LEAGUE OF LEGENDS / PATCH INTELLIGENCE</span>
            <label>
              ARCHIVED{" "}
              <select
                aria-label="Patch"
                value={state.patch}
                onChange={(e) =>
                  navigate(
                    {
                      ...state,
                      patch: e.target.value,
                      change: null,
                      view: "record",
                    },
                    1,
                  )
                }
              >
                {patches.map((p) => (
                  <option key={p.id} value={p.id}>
                    Patch {p.id} · {p.releaseDate}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="cinema-picture">
            <CinematicStage
              champion={state.champion}
              progress={progress}
              direct={direct.current}
            />
          </div>
          <div className="cinema-caption">
            <div>
              <p>
                {phase === "establishing"
                  ? "A closer look at what changed"
                  : branch.title}
              </p>
              <h1>
                {phase === "establishing"
                  ? "Every change. In context."
                  : state.champion}
              </h1>
            </div>
            <div className="cinema-destinations">
              <button
                onClick={() =>
                  navigate({ ...state, view: "patch", change: null }, 0)
                }
              >
                Overview
              </button>
              {(["Azir", "Camille"] as const).map((id) => (
                <button
                  key={id}
                  aria-pressed={state.champion === id}
                  onClick={() =>
                    navigate(
                      {
                        ...state,
                        champion: id,
                        view: "champion",
                        change: null,
                      },
                      0.7,
                    )
                  }
                >
                  {id}
                </button>
              ))}
              <button
                onClick={() =>
                  navigate(
                    { ...state, view: "record", change: record?.id ?? null },
                    1,
                  )
                }
              >
                Inspect changes ↗
              </button>
            </div>
          </div>
          <CinemaReading
            state={state}
            pool={pool}
            active={phase === "inspection"}
            navigate={navigate}
          />
          <div className="cinema-bottom">
            <span>Scroll to explore · reverse to return</span>
            <span>
              {state.champion === "Azir" ? "01 / AZIR" : "02 / CAMILLE"} · 2
              FEATURED ENVIRONMENTS
            </span>
          </div>
        </div>
      </div>
      <footer className="cinema-footer">
        <a href="/champions">Explore the full roster ↗</a>
        <p>
          RiftScry isn&apos;t endorsed by Riot Games and doesn&apos;t reflect
          the views or opinions of Riot Games or anyone officially involved in
          producing or managing Riot Games properties. Riot Games, and all
          associated properties are trademarks or registered trademarks of Riot
          Games, Inc.
        </p>
        <p>
          RiftScry was created under Riot Games&apos; “Legal Jibber Jabber”
          policy using assets owned by Riot Games. Riot Games does not endorse
          or sponsor this project.
        </p>
      </footer>
    </div>
  );
}
