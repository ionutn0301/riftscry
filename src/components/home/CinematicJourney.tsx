import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useStore } from "@nanostores/react";
import { $pool, togglePool } from "../../lib/pool";
import {
  archive,
  roster,
  assetFor,
  defaultVisit,
  parseVisit,
  visitUrl,
  derivePlan,
  type Visit,
} from "../../lib/investigation";
import InvestigationStage from "./InvestigationStage";
import InvestigationEvidence from "./InvestigationEvidence";
import "./investigation.css";
const subscribe = (fn: () => void) => {
  window.addEventListener("popstate", fn);
  window.addEventListener("investigation", fn);
  return () => {
    window.removeEventListener("popstate", fn);
    window.removeEventListener("investigation", fn);
  };
};
export default function CinematicJourney() {
  const query = useSyncExternalStore(
      subscribe,
      () => location.search,
      () => "",
    ),
    v = parseVisit(query),
    p = derivePlan(v),
    pool = useStore($pool);
  const [search, setSearch] = useState(""),
    [poolOpen, setPoolOpen] = useState(false),
    [artFailed, setArtFailed] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const go = (next: Visit) => {
    const changed =
      next.champion !== v.champion ||
      next.older !== v.older ||
      next.newer !== v.newer ||
      next.focus !== v.focus;
    if (changed) next.seen = "";
    if (next.beat === "evidence") {
      const chosen = derivePlan(next).selected;
      if (chosen)
        next.seen = [
          ...new Set([...next.seen.split("|").filter(Boolean), chosen.id]),
        ].join("|");
    }
    history.pushState(null, "", visitUrl(next));
    window.dispatchEvent(new Event("investigation"));
    window.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() => title.current?.focus({ preventScroll: true }));
  };
  const select = (id: string) => {
    setSearch("");
    go({ ...v, champion: id, focus: "", event: "", beat: "subject" });
  };
  useEffect(() => setArtFailed(false), [v.champion]);
  const identity = p.known ? assetFor(v.champion) : null;
  const matches = Object.entries(roster).filter(([id, m]) =>
    `${id} ${m.name}`.toLowerCase().includes(search.toLowerCase()),
  );
  const eventIndex = p.sequence.findIndex((r) => r.id === p.selected?.id),
    next = p.sequence[eventIndex + 1];
  const scope = `After ${v.older} through ${v.newer}`;
  const begin = () =>
    go({
      ...v,
      beat: p.records.length ? "evidence" : "ending",
      event: p.sequence[0]?.id ?? "",
    });
  return (
    <div
      className="investigation"
      data-beat={v.beat}
      data-treatment={p.treatment}
    >
      <header className="story-header">
        <a href="/" className="rift-wordmark">
          RIFTSCRY<span>THE CHANGING GAME</span>
        </a>
        <nav aria-label="Product">
          <button type="button" data-palette-trigger aria-label="Open search">Search</button>
          <a href={`/patch/${archive[0]!.id}`}>Patch records</a>
          <a href="/compare">Compare</a>
          <button
            aria-expanded={poolOpen}
            onClick={() => setPoolOpen(!poolOpen)}
          >
            My Pool ({pool.length})
          </button>
        </nav>
      </header>
      <InvestigationStage visit={v} />
      <div className="story-content">
        {poolOpen && (
          <section className="pool-panel" aria-label="My Pool">
            <h2>Your champions</h2>
            {!pool.length && (
              <p>
                No saved champions yet. Complete any investigation and save
                explicitly.
              </p>
            )}
            {pool.map((id) => (
              <div key={id}>
                <button
                  onClick={() => {
                    setPoolOpen(false);
                    select(id);
                  }}
                >
                  {roster[id]?.name ?? id} · investigate
                </button>
                <button
                  aria-label={`Remove ${roster[id]?.name ?? id} from pool`}
                  onClick={() => togglePool(id)}
                >
                  Remove
                </button>
              </div>
            ))}
            <a href="/champions">Champion directory ↗</a>
          </section>
        )}
        <div className="story-kicker">
          <span>AN INDEPENDENT LEAGUE COMPANION</span>
          <span>
            ARCHIVE {archive.at(-1)!.id} — {archive[0]!.id}
          </span>
        </div>
        {v.beat === "opening" ? (
          <section className="opening-copy">
            <p className="eyebrow">You know your champion.</p>
            <h1 ref={title} tabIndex={-1}>
              The Rift keeps
              <br />
              <em>changing.</em>
            </h1>
            <p className="story-lead">What changed since you last looked?</p>
            <p>
              Choose who matters to you. Follow the records. Leave with an
              answer.
            </p>
          </section>
        ) : (
          <div className="subject-heading">
            <button
              onClick={() =>
                go({ ...defaultVisit, older: v.older, newer: v.newer })
              }
            >
              ← Another champion
            </button>
            <p className="eyebrow">{scope} · recorded direct changes</p>
            <h1 ref={title} tabIndex={-1}>
              {identity?.name ?? "Champion not found"}
              <em>
                {v.beat === "ending"
                  ? " / your findings"
                  : v.beat === "evidence"
                    ? " / follow the evidence"
                    : ""}
              </em>
            </h1>
          </div>
        )}
        {(v.beat === "opening" || !p.known) && (
          <section className="roster-search" aria-label="Choose your champion">
            <h2>Who are you here for?</h2>
            {v.champion && !p.known && (
              <p role="alert">
                “{v.champion}” is not a canonical ID in this archive. Choose a
                champion below; no substitute has been selected.
              </p>
            )}
            <label htmlFor="roster-query">
              Search all {Object.keys(roster).length} archived champions
            </label>
            <input
              id="roster-query"
              type="search"
              placeholder="Name your champion…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="roster-results">
              {matches.map(([id, m]) => (
                <button key={id} onClick={() => select(id)}>
                  {m.name}
                  <span>{m.title}</span>
                </button>
              ))}
              {!matches.length && <p>No champions match. Try another name.</p>}
            </div>
            <a href={`/patch/${archive[0]!.id}`}>
              Just show me the patch records ↗
            </a>
          </section>
        )}
        {p.known && (
          <>
            <div className="period-controls">
              <label>
                After patch
                <select
                  aria-label="After patch"
                  value={v.older}
                  onChange={(e) =>
                    go({
                      ...v,
                      older: e.target.value,
                      focus: "",
                      event: "",
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
                Through patch
                <select
                  aria-label="Through patch"
                  value={v.newer}
                  onChange={(e) =>
                    go({
                      ...v,
                      newer: e.target.value,
                      focus: "",
                      event: "",
                      beat: "subject",
                    })
                  }
                >
                  {archive.map((a) => (
                    <option key={a.id}>{a.id}</option>
                  ))}
                </select>
              </label>
              <a href={`/champion/${v.champion.toLowerCase()}`}>
                Full history ↗
              </a>
            </div>
            {p.coverage === "invalid-scope" ? (
              <p role="alert">
                Choose an older starting patch and a newer ending patch. The
                starting patch is excluded.
              </p>
            ) : (
              <>
                {v.beat === "subject" && (
                  <section className="commitment">
                    <div className="artwork-insert">
                      {artFailed || !identity!.splash ? (
                        <p>
                          Artwork unavailable for {identity!.name}. Your
                          investigation is still complete below.
                        </p>
                      ) : (
                        <picture>
                          <source
                            media="(max-width: 520px)"
                            srcSet={identity!.portrait}
                          />
                          <img
                            width={1215}
                            height={717}
                            decoding="async"
                            src={identity!.splash}
                            alt={`${identity!.name} — intact Riot illustration`}
                            onError={() => setArtFailed(true)}
                          />
                        </picture>
                      )}
                      <p>
                        {identity!.name} · {identity!.title} / Riot Games
                      </p>
                    </div>
                    <div className="commitment-copy">
                      <p className="eyebrow">Your question, made personal</p>
                      <h2>
                        What happened
                        <br />
                        to {identity!.name}?
                      </h2>
                      <p>
                        {p.records.length
                          ? `${p.records.length} direct records across ${p.scope.length} archived patches. We’ll begin ${p.returned ? "with a field that appears again" : p.sequence.length > 1 ? "with a traceable thread" : "with the exact recorded change"}.`
                          : p.coverage === "missing-history"
                            ? "This champion has no direct history in the loaded archive. We can explain that boundary, not invent a past."
                            : "There are no recorded direct changes in this interval. That is an answer—with limits."}
                      </p>
                      <button className="primary-action" onClick={begin}>
                        {p.records.length
                          ? "Follow what changed"
                          : "Understand this interval"}{" "}
                        <span>→</span>
                      </button>
                      <button onClick={() => go({ ...v, beat: "ending" })}>
                        Skip the journey, read the findings
                      </button>
                    </div>
                  </section>
                )}
                {v.beat === "evidence" && p.selected && (
                  <section className="evidence-layout">
                    <div className="evidence-main">
                      <p className="eyebrow">
                        {eventIndex > 0
                          ? "Following the thread"
                          : "The first finding"}{" "}
                        · {identity!.name}
                      </p>
                      {eventIndex > 0 &&
                        p.sequence[eventIndex - 1]?.field ===
                          p.selected.field && (
                          <p className="continuity">
                            Previously, in {p.sequence[eventIndex - 1]!.patch}:{" "}
                            {p.sequence[eventIndex - 1]!.change.kind ===
                            "numeric"
                              ? (
                                  p.sequence[eventIndex - 1]!.change as {
                                    after: string;
                                  }
                                ).after
                              : "a rule was recorded"}
                            .
                          </p>
                        )}
                      <InvestigationEvidence record={p.selected} />
                      {p.returned && p.selected.id === p.returned.last.id && (
                        <aside className="finding">
                          <h3>Back to the earlier value.</h3>
                          <p>{p.findings[0]}</p>
                          <p>That explains this stat. What else changed?</p>
                        </aside>
                      )}
                      <div className="story-actions">
                        {next && (
                          <button
                            className="primary-action"
                            onClick={() => go({ ...v, event: next.id })}
                          >
                            {next.field === p.selected.field
                              ? "Follow this stat"
                              : "Inspect the next change"}{" "}
                            →
                          </button>
                        )}
                        <button onClick={() => go({ ...v, beat: "ending" })}>
                          Bring the findings together →
                        </button>
                      </div>
                    </div>
                    <aside className="focus-choices">
                      <h3>Where do you want to look?</h3>
                      <p>Your choice changes the evidence and the ending.</p>
                      <button
                        onClick={() =>
                          go({
                            ...v,
                            focus: p.selected!.field,
                            event: p.selected!.id,
                          })
                        }
                      >
                        Follow {p.selected.change.label}
                      </button>
                      {p.choices.map((a) => (
                        <button
                          key={a}
                          aria-pressed={v.focus === a}
                          onClick={() => go({ ...v, focus: a, event: "" })}
                        >
                          Inspect {a === "base" ? "base stats" : a}
                        </button>
                      ))}
                      <button
                        onClick={() => go({ ...v, focus: "", event: "" })}
                      >
                        Return to the main thread
                      </button>
                      <p className="selection-note">
                        Main thread: earliest repeated field, otherwise
                        chronological records. No importance score.
                      </p>
                    </aside>
                  </section>
                )}
                {(v.beat === "ending" ||
                  (v.beat === "evidence" && !p.selected)) && (
                  <section className="story-ending">
                    <p className="eyebrow">
                      The aperture is open / {identity!.name}
                    </p>
                    <h2>
                      {p.coverage === "records"
                        ? "You came with a question."
                        : "A quieter chapter."}
                    </h2>
                    {p.coverage === "records" ? (
                      <>
                        <p className="story-lead">
                          Here is what this investigation establishes.
                        </p>
                        <ul className="findings">
                          {p.findings.map((f, i) => (
                            <li key={i}>{f}</li>
                          ))}
                        </ul>
                        <p>
                          {p.unexplored} additional records outside this focus.
                          The finding is not a complete historical stat sheet or
                          a judgment of competitive strength.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="story-lead">
                          {p.coverage === "missing-history"
                            ? "No direct history is available for this champion in the loaded archive."
                            : "No recorded direct changes in this interval."}
                        </p>
                        <p>
                          This does not mean the champion&apos;s competitive
                          position stayed unchanged. Items, systems and
                          incomplete coverage may matter.
                        </p>
                        {p.all.length > 0 && (
                          <button
                            onClick={() => {
                              const last = p.all.at(-1)!;
                              const i = archive.findIndex(
                                (a) => a.id === last.patch,
                              );
                              go({
                                ...v,
                                older: archive[i + 1]?.id ?? archive.at(-1)!.id,
                                newer: last.patch,
                                focus: last.field,
                                event: last.id,
                                beat: "evidence",
                              });
                            }}
                          >
                            Inspect the last available change (changes period)
                          </button>
                        )}
                      </>
                    )}
                    <p className="coverage-note">
                      Scope: ({v.older}, {v.newer}]. Loaded archive:{" "}
                      {archive.at(-1)!.id}–{archive[0]!.id},{" "}
                      {archive.at(-1)!.releaseDate}–{archive[0]!.releaseDate}.
                      This is the latest available here, not a claim about the
                      live game. Direct champion records only; hotfix prose and
                      system effects are not reconstructed.
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
                    <div className="story-actions">
                      <button
                        className="primary-action"
                        aria-pressed={pool.includes(v.champion)}
                        onClick={() => togglePool(v.champion)}
                      >
                        {pool.includes(v.champion)
                          ? "Remove from My Pool"
                          : "Add to My Pool"}
                      </button>
                      <a href={visitUrl(v)}>Stable link to these findings</a>
                      <button onClick={begin}>Reopen the investigation</button>
                    </div>
                  </section>
                )}
                {p.records.length > 0 && (
                  <details className="all-evidence">
                    <summary>
                      Inspect all {p.records.length} records in this interval
                    </summary>
                    {p.records.map((r) => (
                      <div key={r.id}>
                        <InvestigationEvidence record={r} />
                        <button
                          onClick={() =>
                            go({
                              ...v,
                              beat: "evidence",
                              focus: r.field,
                              event: r.id,
                            })
                          }
                        >
                          Investigate this record
                        </button>
                      </div>
                    ))}
                  </details>
                )}
              </>
            )}
          </>
        )}
        <footer className="story-footer">
          RiftScry is not endorsed by Riot Games and does not reflect the views
          or opinions of Riot Games or anyone officially involved in producing
          or managing Riot Games properties. Riot Games and all associated
          properties are trademarks or registered trademarks of Riot Games, Inc.
        </footer>
      </div>
    </div>
  );
}
