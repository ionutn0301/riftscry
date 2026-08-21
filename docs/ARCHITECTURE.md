# Architecture

RiftScry is a static site with a build-time data pipeline. There is no runtime backend:
no database, no API, no accounts, no server sessions. Hosting cost is $0.

```text
Official Riot sources (patch-notes HTML, Data Dragon JSON)
        │  scripts/patch-ingestion  (run locally or by CI)
        ▼
.cache/                     raw HTML — gitignored; Riot prose is never committed
        │  parse → normalize → classify → merge overrides → validate (Zod)
        ▼
src/data/patches/26.16.json normalized, committed — git is the audit trail
        │  astro build (static output)
        ▼
dist/  →  Cloudflare Pages / any static host  →  browser (localStorage for My Pool)
```

## Ingestion pipeline (`scripts/patch-ingestion/`)

| Module | Responsibility |
|---|---|
| `fetch.ts` | Notes/ddragon HTTP with `.cache/` caching; patch-id → notes-URL candidates (Riot used two slug forms in 2026); patch-id → ddragon `assetVersion` resolution |
| `parse.ts` | Riot HTML → raw change tree. Tolerant by construction: unknown sections default to *systems* (with an out-of-scope skip list), headerless blocks inherit their section title, and blocks with unattachable change lines are reported — never dropped silently |
| `classify.ts` | Deterministic stat-semantics table (see [DATA.md](DATA.md)) |
| `normalize.ts` | Raw tree → schema shape; champion-name canonicalization (curly apostrophes, `&`/`and`); override merging; ends in `validatePatch` |
| `validate.ts` | Zod validation of every committed patch file — also wired into `pnpm test`, so malformed data fails CI |
| `index.ts` | CLI: `pnpm ingest <id…> | --all | --validate`; prints a per-patch coverage report (arrow/prose lines, unknown labels, skipped sections) |

Two real-world hazards the pipeline defends against, found during the 2026-season
ingestion: Data Dragon occasionally ships variant entries whose display name collides
with a real champion (`Jade_Alistar` → skipped by underscore-id rule + a referential-
integrity test), and early-season notes use a different URL slug (candidate fallback).

## Site (`src/`)

- **Astro 7, static output.** Every route is prerendered from the committed JSON:
  16 patch pages, 173 champion histories, ~240 compare pairs, indexes — ~450 pages in
  under 10 seconds.
- **React islands** only where state lives client-side: patch filter bar, My Pool picker
  and strip, compare picker, command palette (cmdk under fully custom styling, loaded on
  first open from a build-time `search-index.json`).
- **My Pool** is a nanostores `persistentAtom` on `localStorage` (`riftscry:pool`).
  Server-rendered pages never depend on it; islands personalize after hydration, and
  `?champions=` URLs let pool-less visitors see pinned champions.
- **Homepage motion** is vanilla GSAP + ScrollTrigger in a plain `<script>` (no React):
  scrubbed, transform/opacity/clip-path only. The static composition is the end state,
  so `prefers-reduced-motion` and no-JS get the complete page with zero pins.

## Automation (`.github/workflows/`)

- `ci.yml` — typecheck, unit tests (including data validation), build, Playwright e2e.
- `check-new-patch.yml` — scheduled; detects new ddragon versions, attempts ingestion,
  and opens a PR with the JSON diff for human review. Never auto-merges; if Riot's site
  blocks CI fetches the PR still opens with local-ingestion instructions.

## Testing

Unit (Vitest): parser fixtures, classifier table, normalizer + overrides, delta math,
URL state, filters, pool store (happy-dom), search index, data/compare layers, and the
always-on patch-data validation guard. E2E (Playwright, desktop + mobile projects):
core personalization flow, filters/URL sync, keyboard-only navigation, reduced-motion
behavior, and visual snapshots (ddragon imagery masked for determinism).
