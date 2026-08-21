# RiftScry — Design Specification

**Date:** 2026-08-21
**Status:** Approved (brainstorm phase complete)
**Brand:** RiftScry (renamed from RiftDelta 2026-08-21; the user-provided logo marks render "RIFTΔ" and remain the visual identity)
**Tagline:** The patch notes, diffed.

---

## 1. Product summary

RiftScry is an open-source, zero-account, statically hosted League of Legends patch
intelligence site. It converts Riot's prose patch notes into structured before → after
changes, personalized to the champions a player actually plays.

Core question answered: **"What changed for me?"** — in under 20 seconds.

## 2. Decisions made during brainstorming

| Decision | Choice | Rationale |
|---|---|---|
| Patch identity | Player-facing **26.x** (e.g. `26.16`) everywhere: display, URLs, file names | Matches the client, official notes, and search behavior. Data Dragon `16.16.1` is stored per patch as `assetVersion` for images/identity only. |
| Launch coverage | Full 2026 season: patches **26.1 → 26.16** (~16 patches) | Champion History and Compare are the product's identity; they need real depth. Parser automation makes the marginal cost validation, not authoring. |
| Ingestion source | Parse official patch-notes HTML (`before ⇒ after` arrows) | Provenance = the exact notes players read. Covers items, systems, non-numeric changes. Data Dragon diffing rejected as primary (incomplete spell data, blind to items/systems/context). |
| App framework | **Astro 5** static output + React islands + vanilla GSAP | Zero-JS HTML for content routes, islands only where interactive, first-class per-route metadata/OG, deploys as plain files. Next.js static export and Vite SPA rejected (runtime tax / per-route SEO workarounds). |

Verified facts this design rests on (checked 2026-08-21):

- Latest Data Dragon version: `16.16.1`; latest patch notes: **26.16**, released 2026-08-11.
- Official notes URL shape: `https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-16-notes/`.
- Change format is consistent and parseable: changes grouped under ability headers
  (`Q - Conquering Sands`), lines like
  `Damage: 60 / 80 / 100 / 120 / 140 (+35/40/45/50/55% AP) ⇒ 75 / 95 / 115 / 135 / 155 (…)`.
  Items and systems use identical arrow notation. Base stats appear in a dedicated block.
  Release date is available in page metadata.

## 3. V1 scope

**In scope**

1. `/patch/:id` — any supported patch: champion/item/system changes, classification badges, numeric deltas with relative change, filters (champion, role, change type, "my pool"), search, hotfix markers, source link.
2. **My Pool** — champion multi-select persisted to `localStorage` (`riftscry:pool`), no account. Homepage and patch pages personalize from it.
3. `/champion/:slug` — chronological patch timeline per champion; expanding a patch shows exact changes. "Git history for your main."
4. `/compare/:a/:b` — structured diff between any two supported patches: added / removed / buffed / nerfed / modified.
5. **Role lens** — Top / Jungle / Mid / ADC / Support filter from a curated static mapping, methodology labeled.
6. **Command palette** — `⌘K / Ctrl+K`, searches champions, items, patches, systems. Custom-styled.
7. **Shareable URLs** — filters and pool selections serialize to query params.
8. **Cinematic homepage** — scroll narrative per the storyboard (§10).
9. **Ingestion pipeline** — fetch/parse/normalize/classify/validate scripts; normalized JSON committed to git; override files.
10. **Automation** — scheduled GitHub Action detects new patches, runs ingestion, opens a PR (never auto-merges). CI validates schema + tests on every PR.
11. **OSS quality** — README, architecture docs, data/contribution docs, MIT license, Riot compliance notes.
12. Build-time Open Graph metadata for patch and champion pages; static OG images if time allows (droppable without redesign).

**Out of scope (explicitly not V1)**

Accounts, any backend/database, win-rate or external stat integrations, opaque impact
scores, RSS, Discord embeds, share-card image personalization, pool import, public API,
widgets, email, i18n, esports context, historical charts, LLM-anything at runtime,
analytics infrastructure.

## 4. Architecture

```text
Official Riot sources (patch notes HTML, ddragon JSON)
        │  scripts/patch-ingestion (local or CI)
        ▼
.cache/ raw HTML (gitignored — Riot prose is never committed)
        │  parse → normalize → classify → merge overrides → validate (Zod)
        ▼
src/data/patches/26.16.json   (committed; git = audit trail)
        │  astro build (static output)
        ▼
dist/  → Cloudflare Pages → browser (localStorage for pool)
```

- **Runtime cost target: $0.** No server, no functions, no database.
- **Stack:** TypeScript (strict), Astro 5 (static output), React islands for stateful UI
  (palette, pool picker, filters, compare interactions), vanilla GSAP + ScrollTrigger in
  Astro `<script>` for the homepage narrative, nanostores + `localStorage` for pool state
  shared across islands, `cmdk` as palette behavior primitive under fully custom styling,
  Zod for schemas (shared by scripts and app), Vitest, Playwright, pnpm, GitHub Actions,
  Cloudflare Pages.
- No component libraries as design language. Radix/cmdk primitives allowed strictly
  beneath custom styling.

## 5. Normalized data model

One file per patch: `src/data/patches/26.16.json`. Overrides: `src/data/overrides/26.16.json`.

```ts
type Patch = {
  schemaVersion: 1
  id: string                 // "26.16" — canonical everywhere
  assetVersion: string       // "16.16.1" — ddragon version for assets
  releaseDate: string        // ISO date
  sourceUrl: string          // official notes URL
  ingestedAt: string         // ISO timestamp
  champions: ChampionChange[]
  items: ItemChange[]
  systems: SystemChange[]
  hotfixes?: Hotfix[]        // manually curated via overrides
}

type Classification = "buff" | "nerf" | "adjustment" | "rework" | "system"

type ChampionChange = {
  championId: string         // ddragon id, e.g. "Ahri"
  classification: Classification   // rolled up from changes; overridable
  summary?: string           // concise original wording for context, never full prose
  abilities: AbilityChange[]
}

type AbilityChange = {
  ability: "base" | "passive" | "Q" | "W" | "E" | "R" | "other"
  name: string               // "Orb of Deception"
  changes: Change[]
}

type Change = NumericDelta | ProseChange

type NumericDelta = {
  kind: "numeric"
  label: string              // "Magic Damage", "Cooldown"
  before: string             // verbatim value text: "60 / 80 / 100"
  after: string
  unit?: string              // "s", "%", …
  direction: "buff" | "nerf" | "neutral"   // deterministic, per-change
}

type ProseChange = {
  kind: "prose"
  label: string
  text: string               // concise; links to sourceUrl for full context
}

type ItemChange = { itemId?: number; name: string; classification: Classification; changes: Change[] }
type SystemChange = { name: string; classification: "system"; changes: Change[] }
type Hotfix = { date: string; description: string; championIds?: string[] }
```

- `before`/`after` keep verbatim value strings (rank arrays like `60/80/100` are the
  domain's native shape); a parsed numeric form is derived where possible for relative
  delta display (`−11.1%`), computed from the first rank value or the single value.
- Zod schemas are the single source of truth; **malformed patch data fails the build**.
- `schemaVersion` gates future migrations.

### Supporting data

- `src/data/roles.json` — curated champion → positions mapping. Labeled in the UI:
  *"curated mapping — corrections welcome via PR."* Deterministic; no fake statistical precision.
- `src/data/champions.json` — build-time snapshot from ddragon (id, name, title, image
  refs) for the latest `assetVersion`, refreshed by the ingestion script.

## 6. Classification methodology (deterministic, documented)

A single stat-semantics table (`scripts/patch-ingestion/classify.ts`) maps label patterns
to a polarity: whether an increase is good for the champion.

| Label pattern (examples) | Increase means | Direction rule |
|---|---|---|
| damage, ratio, AD, AP, healing, shield, movement speed, attack speed, range, duration (of own effects) | good | up = buff, down = nerf |
| cooldown, cost, mana cost, cast time, recharge | bad | up = nerf, down = buff |
| unrecognized label | unknown | `neutral` + build warning listing the label |

- Champion rollup: all buffs → `buff`; all nerfs → `nerf`; mixed → `adjustment`;
  override file may set `rework` or correct anything.
- Overrides merge over parser output during normalization — a wrong classification or a
  missed change is a small data PR, never a parser patch.
- The table and rollup rules are documented in `docs/DATA.md`. If severity labels are ever
  shown, they must derive from these visible facts — no opaque scores.

## 7. Ingestion pipeline

```text
scripts/patch-ingestion/
  index.ts        # CLI: pnpm ingest 26.16 [--all]
  fetch.ts        # notes HTML → .cache/ ; ddragon versions.json + champion index
  parse.ts        # HTML → raw change tree (champion/ability/label/before/after)
  normalize.ts    # raw tree → schema shape; merge overrides; derive numeric deltas
  classify.ts     # stat-semantics table; per-change direction; champion rollup
  validate.ts     # Zod parse; hard-fails on malformed output
```

- Raw HTML is cached in gitignored `.cache/`; only normalized JSON is committed.
- Test fixtures are **small excerpted HTML fragments**, not full Riot pages.
- The parser targets the `Label: before ⇒ after` convention and ability-header grouping;
  anything it cannot confidently parse becomes a `ProseChange` (concise) or a build
  warning — silent drops are not permitted (parser reports per-patch coverage stats).
- Patch-note URL discovery: derived from patch id (`…patch-26-16-notes/`), with the news
  index as fallback.

## 8. Automation (GitHub Actions)

1. **`check-new-patch.yml`** — scheduled. Compares ddragon `versions.json` + notes index
   against `src/data/patches/`. On a new patch: runs ingestion, opens/updates a PR with
   generated JSON + coverage report in the PR body. Never auto-merges; low-confidence
   output is inspectable as a diff.
2. **`ci.yml`** — on PR/push: typecheck, unit + integration tests, schema validation of
   all patch files, build.
3. Riot's site may bot-block CI runners. Documented fallback: run `pnpm ingest` locally
   and push; the scheduled Action still opens a reminder PR noting the new patch exists.

## 9. Routes & information architecture

| Route | Content | Notes |
|---|---|---|
| `/` | Cinematic homepage | Scenes per §10; personalized strip when a pool exists |
| `/patch/26.16` | Full patch view | Query params: `?champions=ahri,jinx&role=mid&type=nerf&pool=1` |
| `/patch` | Redirect → latest patch | Latest = max id in data, resolved at build |
| `/champion/ahri` | Patch history timeline | Built from all patch files at build time |
| `/compare/26.16/26.12` | Structured diff of two patches | All ordered pairs statically generated (~240 cheap pages) |
| `/patches` | Patch index | Simple chronological list |
| 404 | Custom, on-brand | |

- Command palette (`⌘K`/`Ctrl+K`) available on every route; searches a build-time JSON
  index (champions, items, patches, systems → route targets).
- URL state: filters serialize to query params; pool itself stays in `localStorage` but
  a shared link can pin champions via `?champions=`.
- SEO: per-route titles/descriptions per the brief (§34 patterns), sitemap, OG tags.

## 10. Visual concept — "The Balance Ledger"

**Positioning:** an editorial intelligence briefing about a game — annual-report-meets-
wire-service — not an esports template. `DESIGN_VARIANCE 8 / MOTION_INTENSITY 9 /
VISUAL_DENSITY 5`.

**Brand anchor (user-provided logos, 2026-08-21):** four RIFTΔ marks in an ink + gold +
cream luxury-editorial style, stored in `src/assets/brand/` (see its README for the
variant table: horizontal wordmarks for desktop, stacked R-monogram lockups for mobile,
each in a dark-background and light-background version). The site's palette derives from
these marks; the logos are used as provided, never restyled.

- **Environment:** deep warm ink/charcoal (paper-dark, not blue-black), matching the
  logo ink. Dark is primary and art-directed, not a default. Cream (from the wordmark)
  is the primary text tone on dark.
- **Accent:** **gold** (from the logo's rift slashes) — reserved for the Δ mark, patch
  numbers, rules/dividers, and moments of emphasis. The "gilt-edged ledger" read is the
  brand.
- **Semantics:** buff/nerf as desaturated teal/ember, tuned to sit beside gold without
  competing, always paired with ▲/▼ glyphs and text labels — never color alone
  (CVD-safe). Gold is never used as a semantic change color.
- **Typography:** high-contrast editorial display face for headlines; a grotesque for UI;
  hard requirement on tabular-figure numerics — `45% → 40%` is the brand's core visual
  asset. Faces chosen in the design phase from distinctive open-source candidates
  (Fontshare/Google class); Inter/Geist/system-ui banned per brief.
- **Anti-slop rules of the brief (§29) apply verbatim.** No Riot chrome, Hextech,
  gradient blobs, glassmorphism, bento defaults, fake numbers.

**Homepage storyboard (adapted from brief §§12–19, kept):**

1. **Hero** — giant `26.15` numerals split/mask-transition into `26.16` on scroll intent;
   stat deltas flash around the transformation. Copy: "Your main got nerfed. You
   shouldn't need 8,000 words to find out." CTAs: *Pick your champions* / *Explore 26.16*.
2. **Wall of notes** — dense typographic wall compresses; irrelevant lines mask away;
   surviving deltas snap into RiftScry's structured representation. "8,000 words → your
   champions → 7 changes → done."
3. **Your champions** — portrait field; unselected recede, selected advance;
   "4 champions. 6 relevant changes." Shared-element continuity into product UI.
4. **The Delta** — massive before/after typography scrubbed by scroll (`45% → 40%`,
   `12s → 13s`). "See the delta. Skip the prose."
5. **Champion history** — vertical timeline traveling through the viewport; "Git history
   for your main."
6. **Role impact** — proprietary editorial visualization of the five roles; selected role
   sweeps into focus with real counts from current patch data.
7. **Open source** — deliberate cinematic break; real schema fragment; "View source on
   GitHub."
8. **Close** — "Queue informed." + CTAs. Minimal footer with Riot disclaimer.

## 11. Motion principles

- GSAP + ScrollTrigger; transform/opacity only; pinned sections short; native scroll
  always trustworthy (no hijack, no heavy smooth-scroll inertia).
- `prefers-reduced-motion`: designed reduced variant — immediate/cut transitions, no
  pinned scrubbing, full content and hierarchy intact.
- Mobile: separately designed — mostly non-pinned, stacked/simplified sequences that keep
  the narrative.
- Product pages: restrained micro-interactions (selection tactility, coherent list
  reorganization on filter, patch-number continuity). Durations/easings tuned via Emil's
  skills (`animate`, then `review-animations`, `improve-animations` at the end).
- Every major animation must have an explainable purpose (hierarchy, continuity,
  causality, transformation, progress).

## 12. Testing strategy

| Layer | Tool | Covers |
|---|---|---|
| Unit | Vitest | parse.ts (fixture fragments), normalize.ts (override merging, delta derivation), classify.ts (semantics table, rollup), Zod schemas (malformed data fails), URL-state serialization, filter logic |
| Integration | Vitest + built output | patch page contains known deltas for a fixture patch; champion history aggregation; palette index generation |
| E2E | Playwright | desktop + mobile critical flows (land → pick pool → see relevant changes; patch filter; compare; palette), keyboard-only navigation, reduced-motion behavior, localStorage persistence across reloads |
| Visual | Playwright screenshots | homepage scenes desktop + mobile, animation end states, overflow checks |

No tests written to inflate count; each maps to a behavior above.

## 13. Performance & accessibility budgets

- Lighthouse ≥ 90 (all categories) on product pages; homepage performance ≥ 85 with
  animations active.
- 60fps scroll on a normal laptop; no long tasks during scroll; profiled, not guessed —
  effects that drop frames get simplified.
- Minimal CLS; responsive lazy-loaded ddragon images below the fold; `will-change`
  sparingly and removed after use.
- Keyboard: full product navigable without a mouse (palette, pool picker, filters,
  expanding timeline entries). Visible focus states. Landmarks/headings correct.
- Contrast: WCAG AA minimum everywhere; semantics never color-only.

## 14. Riot compliance

- Independent third-party product; Riot's required disclaimer ("RiftScry isn't endorsed
  by Riot Games…") visible in the footer of every page.
- Assets exclusively from Data Dragon. No Riot logos as identity, no client UI imitation.
- Patch prose: concise summaries + numeric structures + link to official source; full
  prose never republished; raw HTML never committed.

## 15. Repository layout

```text
riftscry/
  README.md                    # §37 hero: brand, tagline, install, dev
  LICENSE                      # MIT
  CONTRIBUTING.md              # how to fix a patch, add an override, run tests
  docs/
    ARCHITECTURE.md            # this pipeline + build, diagrammed
    DATA.md                    # schema, classification methodology, provenance
    superpowers/specs/         # this document
    superpowers/plans/         # implementation plan (next phase)
  scripts/patch-ingestion/     # §7
  src/
    assets/brand/              # user-provided RIFTΔ logo set (see its README)
    data/patches/*.json        # normalized patches (26.1 … 26.16)
    data/overrides/*.json      # manual corrections
    data/roles.json            # curated role mapping
    data/champions.json        # ddragon identity snapshot
    lib/                       # schema.ts (Zod), deltas.ts, filters.ts, url-state.ts, pool.ts (nanostores)
    components/                # Astro components + React islands
    pages/                     # Astro routes per §9
    styles/                    # tokens.css (custom properties), global.css
  tests/                       # unit / integration / e2e
  .github/workflows/           # ci.yml, check-new-patch.yml
```

## 16. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Notes HTML drift across 16 patches | Parser tolerant by construction (falls back to ProseChange + warnings); per-patch coverage report; overrides fix residue; spot-check each ingested patch |
| Riot site blocks CI fetching | Local ingestion path documented; Action degrades to reminder PR |
| A patch page resists automated parsing entirely | Manual normalized JSON authored for that patch (schema makes this tractable); noted in file provenance |
| Homepage motion vs performance budget | Profile early (Scene 1 + 2 first); simplify before adding scenes |
| Scope creep in cinematic design | Storyboard is fixed; product pages ship before homepage polish rounds |

## 17. Success criteria (from brief §40)

Product: relevant changes understood in < 20s. Design: authored system, screenshot-
recognizable without the logo. Motion: every major animation explainable. Engineering:
another developer can reproduce the build and trace any datum to its Riot source.
Performance: cinematic homepage stays smooth. Accessibility: mouse-free navigation.
OSS: repository respected on its own.
