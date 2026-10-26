import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { useStore } from "@nanostores/react";
import { $pool, togglePool, inPool } from "../../lib/pool";
import {
  archivePatch,
  experienceUrl,
  featuredIds,
  getBranch,
  parseExperience,
  type ChampionId,
  type ExperienceState,
} from "./incision-data";
import IncisionStage from "./IncisionStage";
import IncisionRecord from "./IncisionRecord";
import PoolIdentity from "./PoolIdentity";
import "./incision.css";

const emptyPool: string[] = [];
const subscribe = (callback: () => void) => {
  window.addEventListener("popstate", callback);
  window.addEventListener("riftscry:navigate", callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener("riftscry:navigate", callback);
  };
};
const snapshot = () => location.search;
const serverSnapshot = () => "";
export default function RiftStory() {
  const search = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const state = parseExperience(search);
  const pool = useStore($pool, { ssr: () => emptyPool });
  const branch = getBranch(state.champion);
  const record = branch.records.find((item) => item.id === state.change);
  const anchor = useRef<HTMLSpanElement>(null);
  const anchorOrigin = useRef<DOMRect | null>(null);
  const anchorMotion = useRef<Animation | null>(null);
  useLayoutEffect(() => {
    anchorMotion.current?.cancel();
    if (
      !anchor.current ||
      !anchorOrigin.current ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const destination = anchor.current.getBoundingClientRect();
    const source = anchorOrigin.current;
    anchorMotion.current = anchor.current.animate(
      [
        {
          transform: `translate(${source.x - destination.x}px, ${source.y - destination.y}px) rotate(0deg)`,
        },
        {
          transform: `translate(${(source.x - destination.x) * 0.3}px, ${(source.y - destination.y) * 0.7}px) rotate(8deg)`,
          offset: 0.4,
        },
        { transform: "translate(0, 0) rotate(-5deg)" },
      ],
      { duration: 620, easing: "cubic-bezier(.22,.65,.15,1)" },
    );
    anchorOrigin.current = null;
    return () => {
      anchorMotion.current?.cancel();
    };
  }, [search]);
  const navigate = (next: ExperienceState) => {
    const url = experienceUrl(next);
    if (`${location.pathname}${location.search}` === url) return;
    history.pushState({ riftscry: true }, "", url);
    window.dispatchEvent(new Event("riftscry:navigate"));
  };
  const choose = (champion: ChampionId) =>
    navigate({ ...state, champion, change: null, view: "champion" });
  const reveal = (change: string) => {
    const restoreFocus =
      document.activeElement?.classList.contains("reveal-button");
    if (restoreFocus)
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLButtonElement>(".back-link")
          ?.focus({ preventScroll: true }),
      );
    anchorOrigin.current =
      document
        .querySelector(`[data-change="${change}"] .ability-key`)
        ?.getBoundingClientRect() ?? null;
    navigate({ ...state, change, view: "record" });
  };
  const saved = inPool(pool, state.champion);
  return (
    <div
      className="incision-experience"
      data-view={state.view}
      data-champion={state.champion}
    >
      <header className="incision-header">
        <a href="/" className="incision-wordmark" aria-label="RiftScry home">
          RIFT<span>SCRY</span>
          <i aria-hidden="true" />
        </a>
        <nav aria-label="Main navigation">
          <a href="/champions">Champions</a>
          <a href="/patches">Patches</a>
          <a href="/compare">Compare</a>
          <button
            onClick={() => navigate({ ...state, view: "pool", change: null })}
          >
            My Pool <span className="pool-count">{pool.length}</span>
          </button>
        </nav>
        <button className="incision-search" data-palette-trigger>
          Search <kbd>⌘ K</kbd>
        </button>
      </header>
      <div className="incision-location">
        <nav aria-label="Location">
          <button
            onClick={() => navigate({ ...state, view: "patch", change: null })}
          >
            Patch {state.patch}
          </button>
          {state.view !== "patch" && (
            <>
              <span>/</span>
              <button
                onClick={() => state.view !== "pool" && choose(state.champion)}
              >
                {state.view === "pool" ? "My Pool" : state.champion}
              </button>
            </>
          )}
          {record && (
            <>
              <span>/</span>
              <span>
                {record.name} · {record.label}
              </span>
            </>
          )}
        </nav>
        <span className="archive-label">ARCHIVED · 11 AUG 2026</span>
      </div>
      <div className="incision-composition">
        <IncisionStage state={state} choose={choose} />
        {state.view === "patch" && (
          <div className="patch-introduction">
            <p className="incision-kicker">
              League of Legends / Patch intelligence
            </p>
            <h1>
              Look closer.
              <br />
              <span>Know what changed.</span>
            </h1>
            <p>Choose a champion. Uncover the change.</p>
          </div>
        )}
        {state.view !== "patch" && state.view !== "pool" && (
          <div className="encounter-reading">
            <button
              className="back-link"
              onClick={() =>
                navigate({
                  ...state,
                  view: record ? "champion" : "patch",
                  change: null,
                })
              }
            >
              ← {record ? "Other changes" : "Back to patch"}
            </button>
            <p className="incision-kicker">{branch.title}</p>
            <h1>
              {branch.id}
              <span>
                {branch.records.length} recorded{" "}
                {branch.records.length === 1 ? "change" : "changes"}
              </span>
            </h1>
            <div className="ability-branches" aria-label="Available changes">
              {branch.records.map((item) => (
                <button
                  key={item.id}
                  data-change={item.id}
                  aria-pressed={record?.id === item.id}
                  onClick={() => reveal(item.id)}
                  className="ability-branch"
                >
                  <span className="ability-key">
                    {item.ability === "base"
                      ? "B"
                      : item.ability === "passive"
                        ? "P"
                        : item.ability}
                  </span>
                  <span>
                    {item.name}
                    <small>{item.label}</small>
                  </span>
                  <span aria-hidden="true">↗</span>
                </button>
              ))}
            </div>
            <div className="ability-anchor" data-open={!!record}>
              <span ref={anchor} className="ability-seal" aria-hidden="true">
                {record?.ability === "base"
                  ? "B"
                  : record?.ability === "passive"
                    ? "P"
                    : (record?.ability ?? branch.records[0]!.ability)}
              </span>
              <div>
                <p className="incision-kicker">
                  {record ? "Record opened" : "Start with a change"}
                </p>
                <h2>{record?.name ?? branch.records[0]!.name}</h2>
              </div>
              {!record && (
                <button
                  className="reveal-button"
                  onClick={() => reveal(branch.records[0]!.id)}
                >
                  Reveal this change <span aria-hidden="true">↗</span>
                </button>
              )}
            </div>
            {record ? (
              <IncisionRecord record={record} />
            ) : (
              <p className="encounter-summary">
                {branch.summary} Read the exact values, then decide what matters
                to your pool.
              </p>
            )}
            <div className="record-actions">
              <button
                className="save-button"
                aria-pressed={saved}
                onClick={() => togglePool(state.champion)}
              >
                {saved ? "✓ In My Pool · Remove" : "+ Add to My Pool"}
              </button>
              <a href={`/champion/${state.champion.toLowerCase()}`}>
                Full history ↗
              </a>
              <a href={archivePatch.sourceUrl} target="_blank" rel="noreferrer">
                Official source ↗
              </a>
            </div>
          </div>
        )}
        {state.view === "pool" && (
          <div className="pool-reading">
            <button
              className="back-link"
              onClick={() =>
                navigate({ ...state, view: "patch", change: null })
              }
            >
              ← Back to patch
            </button>
            <p className="incision-kicker">
              Your collection / saved on this device
            </p>
            <h1>
              My Pool<span>{pool.length} saved</span>
            </h1>
            {pool.length === 0 ? (
              <div className="pool-empty">
                <p>A place for the champions you follow.</p>
                <button
                  className="reveal-button"
                  onClick={() => choose(state.champion)}
                >
                  Explore {state.champion}&apos;s changes ↗
                </button>
              </div>
            ) : (
              <>
                <ul className="pool-identities">
                  {pool.slice(0, 8).map((id) => (
                    <li key={id}>
                      <PoolIdentity id={id} />
                      <button
                        aria-label={`Remove ${id} from My Pool`}
                        onClick={() => togglePool(id)}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
                <a className="reveal-button" href="/pool">
                  Open complete collection ({pool.length}) ↗
                </a>
              </>
            )}
          </div>
        )}
        <nav className="champion-branches" aria-label="Featured champions">
          {featuredIds.map((id) => (
            <button
              key={id}
              onClick={() => choose(id)}
              aria-current={
                state.champion === id && state.view !== "patch"
                  ? "true"
                  : undefined
              }
            >
              <span className="incision-kicker">
                {id === "Azir"
                  ? "01 / Sands & sovereignty"
                  : "02 / Steel & precision"}
              </span>
              <strong>{id}</strong>
              <span>
                Explore {id}&apos;s changes <span aria-hidden="true">↗</span>
              </span>
              {state.champion === id && search && <small>Last explored</small>}
            </button>
          ))}
        </nav>
      </div>
      <aside className="collection-rail" aria-label="Saved champion collection">
        <button
          onClick={() => navigate({ ...state, view: "pool", change: null })}
        >
          My Pool <span>{pool.length}</span> ↗
        </button>
        {pool.length ? (
          <ul>
            {pool.slice(0, 6).map((id) => (
              <li key={id}>
                <PoolIdentity id={id} compact />
              </li>
            ))}
          </ul>
        ) : (
          <p>No champions saved yet. Add one as you explore.</p>
        )}
        <a href="/champions">Browse the full roster ↗</a>
      </aside>
      <footer className="incision-footer">
        <span>Source-backed. No predictions.</span>
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
