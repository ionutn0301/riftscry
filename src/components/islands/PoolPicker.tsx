import { useMemo, useState } from "react";
import { useStore } from "@nanostores/react";
import { $pool, togglePool } from "../../lib/pool";
import type { Role } from "../../lib/data";
import "./pool-picker.css";

export type PoolChampion = { id: string; name: string; title: string; roles: Role[] };

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "top", label: "Top" },
  { value: "jungle", label: "Jungle" },
  { value: "mid", label: "Mid" },
  { value: "adc", label: "ADC" },
  { value: "support", label: "Support" },
];

export default function PoolPicker({
  champions,
  assetVersion,
  latestPatchId,
}: {
  champions: PoolChampion[];
  assetVersion: string;
  latestPatchId: string;
}) {
  const pool = useStore($pool);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<Role | null>(null);

  const visible = useMemo(() => {
    const query = q.trim().toLowerCase();
    return champions.filter((c) => {
      if (role && !c.roles.includes(role)) return false;
      if (query && !c.name.toLowerCase().includes(query) && !c.id.toLowerCase().includes(query))
        return false;
      return true;
    });
  }, [champions, q, role]);

  return (
    <div className="pool-picker">
      <div className="controls">
        <input
          type="search"
          placeholder="Find a champion…"
          aria-label="Find a champion"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="seg" role="group" aria-label="Role">
          {ROLE_OPTIONS.map((r) => (
            <button
              key={r.value}
              type="button"
              aria-pressed={role === r.value}
              onClick={() => setRole(role === r.value ? null : r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <ul className="grid" role="listbox" aria-label="Champions" aria-multiselectable="true">
        {visible.map((c) => {
          const selected = pool.includes(c.id);
          return (
            <li key={c.id}>
              <button
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => togglePool(c.id)}
              >
                <span className="portrait">
                  <img
                    src={`https://ddragon.leagueoflegends.com/cdn/${assetVersion}/img/champion/${c.id}.png`}
                    alt=""
                    width="64"
                    height="64"
                    loading="lazy"
                    decoding="async"
                  />
                  {selected && (
                    <span className="tick" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </span>
                <span className="name">{c.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {visible.length === 0 && <p className="empty">No champion matches that.</p>}

      <div className="pool-bar" aria-live="polite">
        <span className="count">
          <span className="num">{pool.length}</span>
          {pool.length === 1 ? " champion" : " champions"} in your pool
        </span>
        {pool.length > 0 && (
          <a className="cta" href={`/patch/${latestPatchId}?pool=1`}>
            See your patch →
          </a>
        )}
      </div>
    </div>
  );
}
