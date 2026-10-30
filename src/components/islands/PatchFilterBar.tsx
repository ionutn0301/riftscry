import { useEffect, useMemo, useRef, useState } from "react";
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

// Persisted selections are browser-only. React must hydrate the same empty
// snapshot the server rendered before subscribing to this device's saved pool.
const emptyServerPool: string[] = [];

export default function PatchFilterBar({ entries }: { entries: FilterEntry[] }) {
  const pool = useStore($pool, { ssr: () => emptyServerPool });
  const [filters, setFilters] = useState<PatchFilters>(EMPTY_FILTERS);
  const [ready, setReady] = useState(false);
  const anchorRestored = useRef(false);

  // Hydrate from the URL, and follow browser history navigation.
  useEffect(() => {
    setFilters(parseFilters(window.location.search));
    setReady(true);
    const onPop = () => setFilters(parseFilters(window.location.search));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
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
    if (!anchorRestored.current) {
      anchorRestored.current = true;
      let id = '';
      try { id = decodeURIComponent(window.location.hash.slice(1)); } catch { /* Malformed fragments have no target. */ }
      const target = document.getElementById(id);
      if (target && !target.hasAttribute('data-filtered')) {
        requestAnimationFrame(() => target.scrollIntoView({ block: 'start', behavior: 'instant' }));
      }
    }
    const empty = document.querySelector<HTMLElement>("[data-filter-empty]");
    if (empty) empty.hidden = shown !== 0;
    const count = document.querySelector<HTMLElement>("[data-filter-count]");
    if (count) count.textContent = String(shown);

    const params = new URLSearchParams(window.location.search);
    for (const key of ['q', 'role', 'type', 'pool', 'champions']) params.delete(key);
    new URLSearchParams(serializeFilters(filters)).forEach((value, key) => params.set(key, value));
    const qs = params.toString();
    if (window.location.search !== (qs ? `?${qs}` : "")) {
      const next = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
      window.history.replaceState(null, "", next);
    }
  }, [ready, filters, pool, changes, roles, meta]);

  const set = (patch: Partial<PatchFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const toggle = <K extends "role" | "type">(key: K, value: NonNullable<PatchFilters[K]>) =>
    set({ [key]: filters[key] === value ? null : value } as Partial<PatchFilters>);

  const activeFilters = [
    filters.role ? ROLE_OPTIONS.find(option => option.value === filters.role)?.label : null,
    filters.type ? TYPE_OPTIONS.find(option => option.value === filters.type)?.label ?? filters.type : null,
    filters.pool ? 'My pool' : null,
    filters.champions.length ? `${filters.champions.length} shared champions` : null,
  ].filter(Boolean);

  return (
    <div className="filter-bar patch-filter-console" data-ready={ready} role="group" aria-label="Filter changes">
      <input
        type="search"
        placeholder="Filter champions…"
        aria-label="Filter champions by name"
        value={filters.q}
        onChange={(e) => set({ q: e.target.value })}
      />
      <details className="patch-filter-options">
        <summary>Filters{activeFilters.length > 0 && <span className="patch-filter-count">{activeFilters.length}</span>}<span aria-hidden="true">+</span></summary>
        <div className="patch-filter-options-body">
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
        disabled={pool.length === 0 && !filters.pool}
        title={pool.length === 0 ? "Pick champions on the My Pool page first" : undefined}
        onClick={() => set({ pool: !filters.pool })}
      >
        My pool{pool.length > 0 ? ` (${pool.length})` : ""}
      </button>
        </div>
      </details>
      {serializeFilters(filters) && <button type="button" className="pool-toggle patch-filter-clear" onClick={() => setFilters({ ...EMPTY_FILTERS })}>Clear filters</button>}
      {ready && <span className="patch-filter-status" role="status" aria-live="polite">{filterChampions(changes, filters, roles, pool, meta).length} of {entries.length} champions{activeFilters.length > 0 ? ` · ${activeFilters.join(" · ")}` : ""}</span>}
      {ready && filters.pool && pool.length === 0 && <span>No champions saved on this device. Turn off My pool or <a href="/pool">choose champions</a>.</span>}
    </div>
  );
}
