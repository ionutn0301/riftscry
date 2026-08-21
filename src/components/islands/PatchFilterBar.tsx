import { useEffect, useMemo, useState } from "react";
import { useStore } from "@nanostores/react";
import { $pool } from "../../lib/pool";
import { EMPTY_FILTERS, parseFilters, serializeFilters, type PatchFilters } from "../../lib/url-state";
import { filterChampions } from "../../lib/filters";
import type { ChampionChange } from "../../lib/schema";
import type { ChampionMeta, Role } from "../../lib/data";
import "./patch-filter-bar.css";

/**
 * Client island for the patch page. The server renders EVERY champion card;
 * this island only hides cards, so the page works fully without JS and
 * filtered URLs restore state on load.
 */

export type FilterEntry = {
  id: string; // ddragon id, original casing
  name: string;
  classification: ChampionChange["classification"];
  roles: Role[];
};

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "top", label: "Top" },
  { value: "jungle", label: "Jungle" },
  { value: "mid", label: "Mid" },
  { value: "adc", label: "ADC" },
  { value: "support", label: "Support" },
];

const TYPE_OPTIONS = [
  { value: "buff", label: "Buffs" },
  { value: "nerf", label: "Nerfs" },
  { value: "adjustment", label: "Adjusted" },
  { value: "rework", label: "Reworks" },
] as const;

export default function PatchFilterBar({ entries }: { entries: FilterEntry[] }) {
  const pool = useStore($pool);
  const [filters, setFilters] = useState<PatchFilters>(EMPTY_FILTERS);
  const [ready, setReady] = useState(false);

  // Hydrate from the URL once.
  useEffect(() => {
    setFilters(parseFilters(window.location.search));
    setReady(true);
  }, []);

  const { changes, roles, meta } = useMemo(() => {
    const changes: ChampionChange[] = entries.map((e) => ({
      championId: e.id,
      classification: e.classification,
      abilities: [],
    }));
    const roles: Record<string, Role[]> = {};
    const meta: Record<string, ChampionMeta> = {};
    for (const e of entries) {
      roles[e.id] = e.roles;
      meta[e.id] = { name: e.name, title: "" };
    }
    return { changes, roles, meta };
  }, [entries]);

  // Apply filters to the server-rendered cards + sync the URL.
  useEffect(() => {
    if (!ready) return;
    const visible = new Set(
      filterChampions(changes, filters, roles, pool, meta).map((c) => c.championId.toLowerCase()),
    );
    let shown = 0;
    for (const card of document.querySelectorAll<HTMLElement>("[data-champion-id]")) {
      const on = visible.has(card.dataset.championId!);
      card.toggleAttribute("data-filtered", !on);
      if (!on) card.setAttribute("data-filtered", "out");
      if (on) shown += 1;
    }
    const empty = document.querySelector<HTMLElement>("[data-filter-empty]");
    if (empty) empty.hidden = shown !== 0;
    const count = document.querySelector<HTMLElement>("[data-filter-count]");
    if (count) count.textContent = String(shown);

    const qs = serializeFilters(filters);
    const next = qs ? `?${qs}` : window.location.pathname;
    if (window.location.search !== (qs ? `?${qs}` : "")) {
      window.history.replaceState(null, "", next);
    }
  }, [ready, filters, pool, changes, roles, meta]);

  const set = (patch: Partial<PatchFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const toggle = <K extends "role" | "type">(key: K, value: NonNullable<PatchFilters[K]>) =>
    set({ [key]: filters[key] === value ? null : value } as Partial<PatchFilters>);

  return (
    <div className="filter-bar" role="group" aria-label="Filter changes">
      <input
        type="search"
        placeholder="Filter champions…"
        aria-label="Filter champions by name"
        value={filters.q}
        onChange={(e) => set({ q: e.target.value })}
      />
      <div className="seg" role="group" aria-label="Role">
        {ROLE_OPTIONS.map((r) => (
          <button
            key={r.value}
            type="button"
            aria-pressed={filters.role === r.value}
            onClick={() => toggle("role", r.value)}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div className="seg" role="group" aria-label="Change type">
        {TYPE_OPTIONS.map((t) => (
          <button
            key={t.value}
            type="button"
            aria-pressed={filters.type === t.value}
            onClick={() => toggle("type", t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="pool-toggle"
        aria-pressed={filters.pool}
        disabled={pool.length === 0}
        title={pool.length === 0 ? "Pick champions on the My Pool page first" : undefined}
        onClick={() => set({ pool: !filters.pool })}
      >
        My pool{pool.length > 0 ? ` (${pool.length})` : ""}
      </button>
    </div>
  );
}
