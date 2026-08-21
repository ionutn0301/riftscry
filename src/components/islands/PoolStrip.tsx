import { useEffect, useState } from "react";
import { useStore } from "@nanostores/react";
import { $pool, togglePool } from "../../lib/pool";
import "./pool-strip.css";

/**
 * "YOUR POOL — PATCH X" strip at the top of a patch page. Client-only by
 * nature (the pool lives in localStorage). Also honors ?champions=a,b links:
 * pinned champions render even for visitors with no pool, with an
 * add-to-pool affordance.
 */

export type PoolStripProps = {
  patchId: string;
  assetVersion: string;
  /** ddragon id (original casing) -> display name, all champions. */
  names: Record<string, string>;
  /** Champions changed in this patch: id -> classification. */
  changed: Record<string, { classification: string; changes: number }>;
};

const GLYPH: Record<string, { glyph: string; label: string; cls: string }> = {
  buff: { glyph: "▲", label: "Buff", cls: "buff" },
  nerf: { glyph: "▼", label: "Nerf", cls: "nerf" },
  adjustment: { glyph: "◆", label: "Adjusted", cls: "neutral" },
  rework: { glyph: "Δ", label: "Rework", cls: "gold" },
};

export default function PoolStrip({ patchId, assetVersion, names, changed }: PoolStripProps) {
  const pool = useStore($pool);
  const [pinned, setPinned] = useState<string[]>([]);

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("champions");
    if (!param) return;
    const byLower = new Map(Object.keys(names).map((id) => [id.toLowerCase(), id]));
    setPinned(
      param
        .split(",")
        .map((c) => byLower.get(c.trim().toLowerCase()))
        .filter((id): id is string => Boolean(id)),
    );
  }, [names]);

  const members = [...pool, ...pinned.filter((p) => !pool.includes(p))];
  if (members.length === 0) return null;

  return (
    <section className="pool-strip" aria-label={`Your pool in patch ${patchId}`}>
      <header>
        <h2>
          Your pool <span className="dash">—</span> <span className="num">patch {patchId}</span>
        </h2>
        <a href="/pool" className="edit">
          Edit pool
        </a>
      </header>
      <ul>
        {members.map((id) => {
          const c = changed[id];
          const g = c ? GLYPH[c.classification] : null;
          const isPinned = !pool.includes(id);
          return (
            <li key={id} className={c ? `is-${c.classification}` : "is-unchanged"}>
              <a href={c ? `#${id.toLowerCase()}` : `/champion/${id.toLowerCase()}`}>
                <img
                  src={`https://ddragon.leagueoflegends.com/cdn/${assetVersion}/img/champion/${id}.png`}
                  alt=""
                  width="48"
                  height="48"
                  loading="lazy"
                />
                <span className="who">
                  <span className="name">{names[id] ?? id}</span>
                  {c && g ? (
                    <span className={`state ${g.cls}`}>
                      <span aria-hidden="true">{g.glyph}</span> {g.label} ·{" "}
                      <span className="num">{c.changes}</span>{" "}
                      {c.changes === 1 ? "change" : "changes"}
                    </span>
                  ) : (
                    <span className="state unchanged">Unchanged</span>
                  )}
                </span>
              </a>
              {isPinned && (
                <button
                  type="button"
                  className="add"
                  title={`Add ${names[id] ?? id} to my pool`}
                  onClick={() => togglePool(id)}
                >
                  + pool
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
