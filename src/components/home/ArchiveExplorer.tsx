import { useEffect, useState } from "react";
import { useStore } from "@nanostores/react";
import { $pool, inPool, togglePool } from "../../lib/pool";
import {
  archiveDate,
  recordsBetween,
  type ArchiveData,
} from "../../lib/living-archive";
import ArchiveRecord from "./ArchiveRecord";

export default function ArchiveExplorer({ data }: { data: ArchiveData }) {
  const initial =
    data.champions.find((champion) => champion.id === "Azir") ??
    data.champions[0]!;
  const [selected, setSelected] = useState(initial.id);
  const [recordId, setRecordId] = useState(initial.records[0]?.patchId ?? "");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState(data.patches[1]?.id ?? data.patches[0]!.id);
  const [to, setTo] = useState(data.patches[0]!.id);
  const [revealed, setRevealed] = useState(false);
  const [ready, setReady] = useState(false);
  const storedPool = useStore($pool);
  const pool = ready ? storedPool : [];
  const champion =
    data.champions.find((item) => item.id === selected) ?? initial;
  const record =
    champion.records.find((item) => item.patchId === recordId) ??
    champion.records[0];
  const matches = data.champions.filter((item) =>
    `${item.name} ${item.title}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const curated = ["Azir", "Gwen", "Camille", "Nasus"]
    .map((id) => data.champions.find((item) => item.id === id))
    .filter((item) => !!item);
  const records = recordsBetween(champion, data.patches, from, to);
  const saved = inPool(pool, champion.id);

  useEffect(() => {
    const restore = () => {
      const params = new URLSearchParams(location.search);
      const next =
        data.champions.find(
          (item) =>
            item.id.toLowerCase() === params.get("champion")?.toLowerCase(),
        ) ?? initial;
      setSelected(next.id);
      setRecordId(
        next.records.find((item) => item.patchId === params.get("record"))
          ?.patchId ??
          next.records[0]?.patchId ??
          "",
      );
      setFrom(
        data.patches.find((item) => item.id === params.get("from"))?.id ??
          data.patches[1]?.id ??
          data.patches[0]!.id,
      );
      setTo(
        data.patches.find((item) => item.id === params.get("to"))?.id ??
          data.patches[0]!.id,
      );
      setRevealed(params.get("reveal") === "1");
      setQuery("");
    };
    restore();
    setReady(true);
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [data, initial]);

  function updateUrl(values: Record<string, string>) {
    const url = new URL(location.href);
    Object.entries(values).forEach(([key, value]) =>
      value ? url.searchParams.set(key, value) : url.searchParams.delete(key),
    );
    history.pushState(null, "", url);
  }

  function choose(id: string) {
    const next = data.champions.find((item) => item.id === id)!;
    setSelected(id);
    setRecordId(next.records[0]?.patchId ?? "");
    setRevealed(false);
    setQuery("");
    updateUrl({
      champion: id.toLowerCase(),
      record: next.records[0]?.patchId ?? "",
      reveal: "",
    });
  }

  function selectEndpoint(value: string, endpoint: "from" | "to") {
    if (endpoint === "from") setFrom(value);
    else setTo(value);
    setRevealed(false);
    updateUrl({ [endpoint]: value, reveal: "" });
  }

  return (
    <div className="archive-explorer" data-ready={ready}>
      <section
        className="archive-focus archive-section"
        id="focus"
        aria-labelledby="focus-title"
      >
        <div className="section-heading">
          <p className="archive-eyebrow">02 / FOCUS</p>
          <span>THE CHAMPION INDEX</span>
        </div>
        <div className="focus-layout">
          <div className="focus-controls">
            <h2 id="focus-title">
              Your champion.
              <br />
              <em>A clearer perspective.</em>
            </h2>
            <p className="section-intro">
              Choose who matters to you. We&apos;ll bring their recorded changes
              into view.
            </p>
            <div className="roster-search">
              <label htmlFor="archive-roster">Search the champion index</label>
              <div className="search-field">
                <span aria-hidden="true">⌕</span>
                <input
                  id="archive-roster"
                  type="search"
                  placeholder={`Search ${data.champions.length} champions…`}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  autoComplete="off"
                  aria-controls="roster-results"
                />
              </div>
            </div>
            <div
              id="roster-results"
              className={
                query ? "roster-results is-searching" : "roster-results"
              }
              aria-label="Champion choices"
            >
              {(query ? matches : curated).map((item) => (
                <button
                  type="button"
                  key={item.id}
                  aria-pressed={selected === item.id}
                  onClick={() => choose(item.id)}
                >
                  <span>{item.name}</span>
                  <span aria-hidden="true">
                    {selected === item.id ? "●" : "→"}
                  </span>
                </button>
              ))}
              {query && matches.length === 0 && (
                <p role="status">
                  No champions match “{query}”. Try another name.
                </p>
              )}
            </div>
            <a className="archive-text-link" href="/champions">
              Browse the full champion index <span aria-hidden="true">→</span>
            </a>
          </div>
          <div className="focus-identity" key={champion.id}>
            <p className="archive-eyebrow">
              IN FOCUS / {champion.records.length} RECORDED PATCHES
            </p>
            <h3>{champion.name}</h3>
            <p className="champion-title">{champion.title}</p>
            <div className="focus-instrument" aria-hidden="true">
              <img
                src="/images/living-archive/observatory-mobile.webp"
                width="800"
                height="964"
                alt=""
                loading="lazy"
              />
            </div>
            <div className="focus-actions">
              <a href={`/champion/${champion.id.toLowerCase()}`}>
                Champion history <span aria-hidden="true">→</span>
              </a>
              <button
                type="button"
                aria-pressed={saved}
                onClick={() => togglePool(champion.id)}
              >
                {saved ? "✓ In your pool" : "+ Add to pool"}
              </button>
            </div>
          </div>
        </div>
      </section>
      <section
        className="archive-trace archive-section"
        id="trace"
        aria-labelledby="trace-title"
      >
        <div className="section-heading">
          <p className="archive-eyebrow">03 / TRACE</p>
          <span>THE RECORD OF CHANGE</span>
        </div>
        <div className="trace-heading">
          <h2 id="trace-title">
            Every change
            <br />
            leaves a <em>trace.</em>
          </h2>
          <p className="section-intro">
            {champion.name}&apos;s history, one patch at a time.
            <br />
            Original values. Full context. A source for every record.
          </p>
        </div>
        {champion.records.length > 0 ? (
          <>
            <div
              className="archive-timeline"
              aria-label={`${champion.name} patch history`}
            >
              {champion.records.map((item) => (
                <button
                  type="button"
                  key={item.patchId}
                  aria-pressed={record?.patchId === item.patchId}
                  onClick={() => {
                    setRecordId(item.patchId);
                    updateUrl({
                      record: item.patchId,
                      champion: selected.toLowerCase(),
                    });
                  }}
                >
                  <span className="timeline-point" aria-hidden="true" />
                  <strong>{item.patchId}</strong>
                  <time dateTime={item.date}>{archiveDate(item.date)}</time>
                </button>
              ))}
            </div>
            <div aria-live="polite" aria-atomic="false">
              {record && <ArchiveRecord record={record} name={champion.name} />}
            </div>
          </>
        ) : (
          <p className="archive-empty">
            No changes for {champion.name} are recorded in this archive. That is
            not a complete statement of their historical stats.{" "}
            <a href={`/champion/${champion.id.toLowerCase()}`}>
              Open champion history →
            </a>
          </p>
        )}
        <p className="archive-data-note">
          Archive coverage ends at patch {data.patches[0]!.id}. These are
          recorded patch changes, not reconstructed champion stats.
        </p>
      </section>
      <section
        className="archive-compare archive-section"
        id="compare"
        aria-labelledby="compare-title"
      >
        <div className="section-heading">
          <p className="archive-eyebrow">04 / COMPARE</p>
          <span>TWO RECORDS. ONE PERSPECTIVE.</span>
        </div>
        <h2 id="compare-title">
          Bring the records
          <br />
          into <em>alignment.</em>
        </h2>
        <p className="section-intro">
          What happened to {champion.name} between two patches?
          <br />
          Choose your endpoints. See the changes in between.
        </p>
        <div className="compare-alignment">
          <label htmlFor="archive-from">
            <span>FIRST PATCH</span>
            <select
              id="archive-from"
              value={from}
              onChange={(event) => selectEndpoint(event.target.value, "from")}
            >
              {data.patches.map((patch) => (
                <option key={patch.id} value={patch.id}>
                  {patch.id}
                </option>
              ))}
            </select>
          </label>
          <div className="alignment-line" aria-hidden="true">
            <span />→<span />
          </div>
          <label htmlFor="archive-to">
            <span>SECOND PATCH</span>
            <select
              id="archive-to"
              value={to}
              onChange={(event) => selectEndpoint(event.target.value, "to")}
            >
              {data.patches.map((patch) => (
                <option key={patch.id} value={patch.id}>
                  {patch.id}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="compare-actions">
          <button
            className="archive-primary"
            type="button"
            disabled={from === to}
            aria-expanded={revealed}
            aria-controls="aligned-records"
            onClick={() => {
              setRevealed(true);
              updateUrl({
                reveal: "1",
                champion: selected.toLowerCase(),
                from,
                to,
              });
              requestAnimationFrame(() => {
                const result = document.getElementById("aligned-records");
                result?.scrollIntoView({ block: "start", behavior: "instant" });
                result?.focus({ preventScroll: true });
              });
            }}
          >
            Bring changes into focus <span aria-hidden="true">→</span>
          </button>
          <a className="archive-text-link" href={`/compare/${to}/${from}`}>
            Full patch comparison <span aria-hidden="true">→</span>
          </a>
        </div>
        <p className="archive-data-note">
          {from === to
            ? "Choose two different patches to compare."
            : "The older patch is excluded; the newer patch is included, regardless of selection order. No missing values are inferred."}
        </p>
        <div
          id="aligned-records"
          className="aligned-records"
          hidden={!revealed}
          aria-live="polite"
          tabIndex={-1}
        >
          {revealed && (
            <>
              <h3>
                {records.length
                  ? `${records.length} recorded ${records.length === 1 ? "patch" : "patches"} for ${champion.name}`
                  : `No recorded changes for ${champion.name} in this interval`}
              </h3>
              {records.length === 0 && (
                <p>
                  This does not establish that all historical values were
                  unchanged. Check the official source notes for complete
                  context.
                </p>
              )}
              {records.map((item) => (
                <ArchiveRecord
                  key={item.patchId}
                  record={item}
                  name={champion.name}
                />
              ))}
            </>
          )}
        </div>
      </section>
      <section
        className="archive-continue archive-section"
        id="continue"
        aria-labelledby="continue-title"
      >
        <div className="section-heading">
          <p className="archive-eyebrow">05 / CONTINUE</p>
          <span>YOUR PERSONAL INDEX</span>
        </div>
        <div className="continue-layout">
          <div>
            <h2 id="continue-title">
              Keep your champions
              <br />
              <em>in view.</em>
            </h2>
            <p className="section-intro">
              The archive is vast. Your pool makes it personal.
              <br />
              Saved on this device. No account required.
            </p>
          </div>
          <div className="continue-actions">
            <p className="pool-count">
              <strong>{pool.length.toString().padStart(2, "0")}</strong>{" "}
              champions in your pool
            </p>
            <a className="archive-primary" href="/pool">
              Choose champions <span aria-hidden="true">→</span>
            </a>
            <a
              className="archive-text-link"
              href={`/patch/${data.patches[0]!.id}?pool=1`}
            >
              View your pool&apos;s archived patch{" "}
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
