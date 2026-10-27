import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { useStore } from "@nanostores/react";
import { $pool, togglePool } from "../../lib/pool";
import {
  archive,
  roster,
  assetFor,
  parseVisit,
  visitUrl,
  derivePlan,
  type Visit,
  type Evidence,
} from "../../lib/investigation";
import InvestigationEvidence from "./InvestigationEvidence";
import EvidenceField, { recordTransition } from "./EvidenceField";
import ChampionPicker from "./ChampionPicker";
import "./investigation.css";
const subscribe = (fn: () => void) => {
  window.addEventListener("popstate", fn);
  window.addEventListener("investigation", fn);
  return () => {
    window.removeEventListener("popstate", fn);
    window.removeEventListener("investigation", fn);
  };
};
type Utility = "champions" | "explore" | "pool" | "records" | null;
export default function CinematicJourney() {
  const query = useSyncExternalStore(
      subscribe,
      () => location.search,
      () => "",
    ),
    raw = parseVisit(query),
    featured = !raw.champion;
  const v = { ...raw, champion: featured ? "Belveth" : raw.champion },
    p = derivePlan(v),
    identity = p.known ? assetFor(v.champion) : null,
    pool = useStore($pool);
  const [utility, setUtility] = useState<Utility>(null),
    [failed, setFailed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    opener = useRef<HTMLElement | null>(null),
    edge = useRef<HTMLButtonElement>(null),
    heading = useRef<HTMLHeadingElement>(null),
    artwork = useRef<HTMLImageElement>(null);
  const transition = useRef<{ skipTransition: () => void } | null>(null);
  const focusHeading = () =>
    requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>('.evidence-main h2, .record-reading h2, .empty-reading h2') ?? heading.current;
      if (target) { target.tabIndex = -1; target.focus({ preventScroll: true }); }
    });
  const go = (next: Visit) => {
    if (
      next.champion !== v.champion ||
      next.older !== v.older ||
      next.newer !== v.newer
    )
      next.seen = "";
    if (next.beat === "evidence") {
      const chosen = derivePlan(next).selected;
      if (chosen)
        next.seen = [
          ...new Set([...next.seen.split("|").filter(Boolean), chosen.id]),
        ].join("|");
    }
    const apply = () => {
      flushSync(() => {
        history.pushState(null, "", visitUrl(next));
        window.dispatchEvent(new Event("investigation"));
      });
      focusHeading();
    };
    transition.current?.skipTransition();
    if (
      document.startViewTransition &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      transition.current = document.startViewTransition(apply);
    } else apply();
  };
  useEffect(() => {
    setFailed(Boolean(artwork.current?.complete && !artwork.current.naturalWidth));
  }, [v.champion]);
  useEffect(() => {
    const back = () => focusHeading();
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, []);
  useEffect(() => {
    if (utility) {
      opener.current = document.activeElement as HTMLElement;
      dialog.current?.showModal();
      if (utility === "champions")
        dialog.current?.querySelector<HTMLInputElement>("input")?.focus();
    } else if (dialog.current?.open) dialog.current.close();
  }, [utility]);
  const close = () => {
    dialog.current?.close();
    setUtility(null);
  };
  const closed = () => {
    setUtility(null);
    const target = opener.current;
    requestAnimationFrame(() => {
      if (target?.isConnected && !target.closest("dialog")) target.focus();
      else edge.current?.focus();
    });
  };
  const search = () => {
    close();
    requestAnimationFrame(() =>
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "k",
          ctrlKey: true,
          bubbles: true,
        }),
      ),
    );
  };
  const openRecord = (r: Evidence) => {
    close();
    go({ ...v, focus: r.field, event: r.id, beat: "evidence" });
  };
  const select = (champion: string) => {
    close();
    go({ ...v, champion, focus: "", event: "", beat: "subject" });
  };
  const historyView = () => go({ ...v, beat: "subject" });
  const read = v.beat === "evidence" && p.selected;
  const empty =
    p.coverage === "unknown"
      ? "Champion not found"
      : p.coverage === "invalid-scope"
        ? "Choose a valid interval"
        : p.coverage === "missing-history"
          ? "No direct history in this archive"
          : "No direct records in this interval";
  return (
    <div className="investigation" data-beat={v.beat}>
      <header className="story-header">
        <a className="rift-wordmark" href="/">
          RIFTSCRY<span>THE CHANGING GAME</span>
        </a>
        <button onClick={() => setUtility("explore")}>
          Explore <span aria-hidden="true">↗</span>
        </button>
        <button
          className="champion-edge"
          ref={edge}
          onClick={() => setUtility("champions")}
        >
          {identity?.name ?? "Choose champion"}{" "}
          <span aria-hidden="true">⌄</span>
        </button>
      </header>
      <div className="spatial-body">
        <aside
          className="champion-identity"
          style={{ viewTransitionName: "champion-identity" }}
        >
          <div className="identity-copy">
            <p className="eyebrow">
              {featured
                ? "FEATURED HISTORY · BEL’VETH"
                : "YOUR CHAMPION · RECORDED HISTORY"}
            </p>
            <h1 tabIndex={-1} ref={heading}>
              {featured ? (
                <>
                  The Rift keeps
                  <br />
                  <em>changing.</em>
                </>
              ) : (
                (identity?.name ?? "Unknown champion")
              )}
            </h1>
            <p>
              {featured
                ? "What changed since you last looked?"
                : (identity?.title ??
                  `“${v.champion}” is not a canonical champion ID. No substitute was selected.`)}
            </p>
          </div>
          {identity && (
            <figure className="champion-art">
              {failed || !identity.splash ? (
                <p>
                  Artwork unavailable for {identity.name}. The records remain
                  available.
                </p>
              ) : (
                <picture>
                  <source
                    media="(max-width:700px)"
                    srcSet={identity.portrait}
                  />
                      <img ref={artwork}

                    src={identity.splash}
                    width="1215"
                    height="717"
                    alt={`${identity.name} — complete Riot illustration`}
                    onError={() => setFailed(true)}
                  />
                </picture>
              )}
              <figcaption>{identity.name} / Riot Games</figcaption>
            </figure>
          )}
          <div className="identity-actions">
            <button
              className="primary-action"
              onClick={() => setUtility("champions")}
            >
              Choose your champion ↗
            </button>
            <button onClick={() => go({ ...v, beat: "ending" })}>
              {v.seen ? "Your findings" : "Interval overview"}{" "}
              <span>{v.seen.split("|").filter(Boolean).length || ""}</span>
            </button>
          </div>
        </aside>
        <div className="spatial-reading">
          {p.coverage !== "records" ? (
            <section className="empty-reading">
              <p className="eyebrow">ARCHIVE BOUNDARY</p>
              <h2>{empty}</h2>
              <p>
                {p.coverage === "invalid-scope"
                  ? "The starting patch must be older than the ending patch. It is excluded from the interval."
                  : p.coverage === "unknown"
                    ? "Search the complete canonical roster to begin."
                    : "This does not imply the champion was unaffected by items, systems, or other champions."}
              </p>
              <button onClick={() => setUtility("explore")}>
                View archive coverage ↗
              </button>
            </section>
          ) : read ? (
            <section className="record-reading">
              <button className="return-history" onClick={historyView}>
                ← {identity!.name}’s history
              </button>
              <div
                className="evidence-scroll"
                tabIndex={0}
                aria-label="Complete record"
              >
                <article
                  className="evidence-main"
                  style={{ viewTransitionName: recordTransition(read.id) }}
                >
                  <InvestigationEvidence record={read} />
                </article>
                <nav
                  className="record-connections"
                  aria-label="Connected records"
                >
                  <p className="eyebrow">SAME FIELD · ANOTHER PATCH</p>
                  {p.records
                    .filter(
                      (r) => r.field === read.field && r.patch !== read.patch,
                    )
                    .map((r) => (
                      <button key={r.id} onClick={() => openRecord(r)}>
                        {r.patch} · {r.change.label} →
                      </button>
                    ))}
                  {!p.records.some(
                    (r) => r.field === read.field && r.patch !== read.patch,
                  ) && <p>No other record of this field in the interval.</p>}
                  <p className="eyebrow">TAKE ANOTHER BRANCH</p>
                  {p.records
                    .filter((r) => r.field !== read.field)
                    .sort(
                      (a, b) =>
                        Number(b.patch === read.patch) -
                        Number(a.patch === read.patch),
                    )
                    .slice(0, 3)
                    .map((r) => (
                      <button key={r.id} onClick={() => openRecord(r)}>
                        {r.patch} · {r.ability} · {r.change.label} →
                      </button>
                    ))}
                </nav>
              </div>
              <div className="reading-actions">
                <button onClick={() => setUtility("records")}>
                  All {p.records.length} records ↗
                </button>
                <button onClick={() => go({ ...v, beat: "ending" })}>
                  Gather your findings →
                </button>
              </div>
            </section>
          ) : v.beat === "ending" ? (
            <section className="record-reading">
              <button className="return-history" onClick={historyView}>
                ← {identity!.name}’s history
              </button>
              <div
                className="evidence-scroll"
                tabIndex={0}
                aria-label="Findings"
              >
                <p className="eyebrow">
                  {v.seen
                    ? "YOUR VISITED RECORDS"
                    : "INTERVAL OVERVIEW · NO VISIT TRAIL"}
                </p>
                <h2>
                  {v.seen ? "The story so far." : "What the archive records."}
                </h2>
                <ul className="findings">
                  {p.findings.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
                <p>
                  {p.unexplored} records not included. This is not a complete
                  stat sheet or a judgment of competitive strength.
                </p>
                <p className="coverage-note">
                  After {v.older}, through {v.newer}. Loaded archive{" "}
                  {archive.at(-1)!.id}–{archive[0]!.id}; not live game data.
                </p>
                <div className="source-links">
                  {p.scope.map((a) => (
                    <a
                      key={a.id}
                      href={a.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Riot {a.id} ↗
                    </a>
                  ))}
                </div>
              </div>
              <div className="reading-actions">
                <button
                  aria-pressed={pool.includes(v.champion)}
                  onClick={() => togglePool(v.champion)}
                >
                  {pool.includes(v.champion)
                    ? "Remove from My Pool"
                    : "Add to My Pool"}
                </button>
                <a href={visitUrl(v)}>Link to findings ↗</a>
              </div>
            </section>
          ) : (
            <EvidenceField
              records={p.records}
              selected={v.event}
              onOpen={openRecord}
              onAll={() => setUtility("records")}
            />
          )}
        </div>
      </div>
      <footer className="story-footer">
        <div className="period-controls">
          <label>
            After{" "}
            <select
              aria-label="After patch"
              value={v.older}
              onChange={(e) =>
                go({
                  ...v,
                  older: e.target.value,
                  event: "",
                  focus: "",
                  beat: "subject",
                })
              }
            >
              {archive.map((a) => (
                <option key={a.id}>{a.id}</option>
              ))}
            </select>
          </label>
          <span>→</span>
          <label>
            Through{" "}
            <select
              aria-label="Through patch"
              value={v.newer}
              onChange={(e) =>
                go({
                  ...v,
                  newer: e.target.value,
                  event: "",
                  focus: "",
                  beat: "subject",
                })
              }
            >
              {archive.map((a) => (
                <option key={a.id}>{a.id}</option>
              ))}
            </select>
          </label>
        </div>
        <span className="archive-caption">
          AN INDEPENDENT ARCHIVE / NOT LIVE DATA
        </span>
        <button onClick={() => setUtility("pool")}>
          My Pool ({pool.length}) ↗
        </button>
      </footer>
      <dialog
        ref={dialog}
        className="story-dialog"
        aria-labelledby="utility-title"
        onClose={closed}
        onCancel={() => setUtility(null)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
            e.preventDefault();
            e.stopPropagation();
            search();
          }
        }}
      >
        <button className="close-dialog" onClick={close}>
          Close <span aria-hidden="true">×</span>
        </button>
        <div className="dialog-content">
          {utility === "champions" && <ChampionPicker onSelect={select} />}
          {utility === "records" && (
            <>
              <h2 id="utility-title">Every record · {identity?.name}</h2>
              <p>
                After {v.older}, through {v.newer}. Choose any field.
              </p>
              <div className="record-directory">
                {p.records.map((r) => (
                  <button key={r.id} onClick={() => openRecord(r)}>
                    <small>
                      {r.patch} · {r.ability}
                    </small>
                    <strong>{r.change.label}</strong>
                  </button>
                ))}
              </div>
            </>
          )}
          {utility === "explore" && (
            <>
              <h2 id="utility-title">Explore RiftScry</h2>
              <nav className="utility-links">
                <button onClick={search}>Search the archive</button>
                <a href={`/patch/${archive[0]!.id}`}>Patch records ↗</a>
                <a href="/champions">Champion directory ↗</a>
                <a href="/compare">Compare patches ↗</a>
                <a href="/pool">My Pool ↗</a>
              </nav>
              <p>
                Loaded archive: {archive.at(-1)!.id}–{archive[0]!.id}. Original
                Riot sources remain attached to every record. This is not a
                claim about the live game.
              </p>
              <p>
                RiftScry is not endorsed by Riot Games. League of Legends and
                its assets belong to Riot Games.
              </p>
            </>
          )}
          {utility === "pool" && (
            <>
              <h2 id="utility-title">Your champions</h2>
              <p>Saved explicitly on this device.</p>
              {!pool.length && <p>No saved champions yet.</p>}
              <div className="utility-links">
                {pool.map((id) => (
                  <div key={id}>
                    <button onClick={() => select(id)}>
                      {roster[id]?.name ?? id} · investigate ↗
                    </button>
                    <button
                      aria-label={`Remove ${roster[id]?.name ?? id}`}
                      onClick={() => togglePool(id)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              {p.known && (
                <button
                  className="primary-action"
                  onClick={() => togglePool(v.champion)}
                >
                  {pool.includes(v.champion)
                    ? "Remove from My Pool"
                    : "Add to My Pool"}{" "}
                  · {identity!.name}
                </button>
              )}
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}
