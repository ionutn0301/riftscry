import { cinemaBranch, type CinemaState } from "./cinematic-data";
import { togglePool } from "../../lib/pool";
import PoolIdentity from "./PoolIdentity";
export default function CinemaReading({
  state,
  pool,
  active,
  navigate,
}: {
  state: CinemaState;
  pool: string[];
  active: boolean;
  navigate: (s: CinemaState, p: number) => void;
}) {
  const branch = cinemaBranch(state.champion, state.patch),
    record =
      branch.records.find((r) => r.id === state.change) ?? branch.records[0];
  return (
    <section
      className="cinema-reading"
      aria-label="Champion change inspection"
      inert={!active}
    >
      {state.view === "pool" ? (
        <>
          <p className="cinema-eyebrow">Saved on this device</p>
          <h2>My Pool</h2>
          {pool.length ? (
            <ul className="cinema-pool">
              {pool.map((id) => (
                <li key={id}>
                  <PoolIdentity id={id} />
                  <button
                    onClick={() => togglePool(id)}
                    aria-label={`Remove ${id} from My Pool`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              No champions saved yet. Explore a champion and add it to your
              pool.
            </p>
          )}
          <a href="/pool">Complete collection ↗</a>
        </>
      ) : (
        <>
          <p className="cinema-eyebrow">
            {state.champion} / PATCH {state.patch} / ARCHIVED
          </p>
          <label className="cinema-record-label">
            Choose a change
            <select
              aria-label="Choose a change"
              value={record?.id ?? ""}
              onChange={(e) =>
                navigate(
                  { ...state, change: e.target.value, view: "record" },
                  1,
                )
              }
              disabled={!record}
            >
              {branch.records.map((r) => (
                <option value={r.id} key={r.id}>
                  {r.name} — {r.label}
                </option>
              ))}
              {!record && <option>No recorded changes</option>}
            </select>
          </label>
          {record ? (
            <article aria-live="polite">
              <p className="cinema-eyebrow">
                {record.direction} / {record.kind}
              </p>
              <h2>{record.name}</h2>
              <p>{record.label}</p>
              {record.before !== undefined || record.after !== undefined ? (
                <dl>
                  <dt>Before</dt>
                  <dd>{record.before ?? "Not specified"}</dd>
                  <dt>After</dt>
                  <dd>{record.after ?? "Not specified"}</dd>
                </dl>
              ) : (
                <p>{record.text}</p>
              )}
              {record.difference && (
                <p className="cinema-difference">{record.difference}</p>
              )}
              {record.context && <p>{record.context}</p>}
            </article>
          ) : (
            <>
              <h2>{state.champion}</h2>
              <p>
                No changes for this champion are recorded in Patch {state.patch}
                . This does not imply that its complete balance state is known.
              </p>
            </>
          )}
          <button
            className="cinema-save"
            aria-pressed={pool.includes(state.champion)}
            onClick={() => togglePool(state.champion)}
          >
            {pool.includes(state.champion)
              ? "Remove from My Pool"
              : "Add to My Pool"}
          </button>
          <p role="status">
            {pool.includes(state.champion)
              ? `${state.champion} is saved on this device.`
              : ""}
          </p>
          <div className="cinema-source">
            <a href={branch.patch.sourceUrl} target="_blank" rel="noreferrer">
              Official source ↗
            </a>
            <a href={`/champion/${state.champion.toLowerCase()}`}>
              Full history ↗
            </a>
            <button
              onClick={() =>
                navigate({ ...state, change: null, view: "champion" }, 0.7)
              }
            >
              Return to champion
            </button>
          </div>
        </>
      )}
    </section>
  );
}
