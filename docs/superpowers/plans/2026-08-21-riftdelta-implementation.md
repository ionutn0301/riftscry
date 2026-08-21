# RiftDelta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build RiftDelta — a static, zero-account League of Legends patch-intelligence site: Riot patch notes parsed into structured before→after deltas, personalized per champion pool, with history, compare, role lens, command palette, and a cinematic homepage.

**Architecture:** Ingestion scripts parse official patch-notes HTML into Zod-validated JSON committed to git (patches 26.1–26.16). Astro 5 builds fully static pages from that JSON; React islands add interactivity (pool, palette, filters); vanilla GSAP + ScrollTrigger drives the homepage narrative. Cloudflare Pages hosts plain files; GitHub Actions watches for new patches and opens PRs.

**Tech Stack:** TypeScript (strict), Astro 5 + @astrojs/react (React 19), GSAP + ScrollTrigger, Zod, nanostores (+persistent, +react), cmdk, node-html-parser, tsx, Vitest + happy-dom, Playwright, pnpm, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-21-riftdelta-design.md` — read it before executing any task. The spec's §5 data model, §6 classification, §10 visual concept, and §29-equivalent anti-slop rules govern every task below.

## Global Constraints

- Patch identity is player-facing `26.x` everywhere (display, URLs, filenames). Data Dragon `16.x.y` appears only as `assetVersion` inside patch files.
- Zero runtime backend: no server code, no database, no accounts, no analytics infra, no runtime LLM. Output of `astro build` must be deployable as plain files.
- Riot prose is never committed: raw HTML goes to gitignored `.cache/`; normalized JSON only. Every patch file carries `sourceUrl`, `releaseDate`, `ingestedAt`, `schemaVersion`.
- Malformed patch data fails the build (Zod `validatePatch` throws).
- Semantic buff/nerf color is never the only signal — always paired with ▲/▼ glyph + text label. Gold is brand accent only, never a semantic change color.
- Banned: Inter/Geist/Arial/system-ui as chosen faces; Riot chrome/Hextech imitation; shadcn-look components; gradient blobs, glassmorphism, generic three-card sections, fake numbers/testimonials (spec anti-slop list applies verbatim).
- Copy voice: short, confident, game-aware. Never "seamless", "powerful", "AI-powered", "revolutionary".
- Logos: use files in `src/assets/brand/` as provided (never restyled). Desktop header uses `logo-desktop-light.png`; see `src/assets/brand/README.md`.
- Animations: transform/opacity only where possible; native scroll stays trustworthy; `prefers-reduced-motion` gets a designed reduced variant, never a dead page.
- All commits end with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- Package manager: pnpm. Node ≥ 22. Windows dev environment (PowerShell) — scripts must be cross-platform (no bash-isms in package.json).
- Verification commands (used throughout): `pnpm test` (Vitest), `pnpm check` (astro check + tsc for scripts), `pnpm build`, `pnpm exec playwright test`.

---

# Phase 1 — Foundation & data engine

### Task 1: Scaffold the Astro workspace

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `.gitattributes`, `.nvmrc`
- Create: `src/pages/index.astro` (placeholder), `src/styles/tokens.css` (empty shell), `src/styles/global.css` (reset + shell)
- Create: `src/env.d.ts`

**Interfaces:**
- Produces: working `pnpm dev` / `pnpm build` / `pnpm test` / `pnpm check` scripts every later task relies on. Directory skeleton per spec §15.

- [ ] **Step 1:** `pnpm create astro@latest . --template minimal --no-git --no-install --yes`, then `pnpm add react react-dom @astrojs/react gsap zod nanostores @nanostores/persistent @nanostores/react cmdk` and `pnpm add -D typescript tsx vitest happy-dom @types/react @types/react-dom node-html-parser @playwright/test @astrojs/sitemap`
- [ ] **Step 2:** Configure `astro.config.mjs`: `integrations: [react(), sitemap()]`, `site: "https://riftdelta.pages.dev"`, `output: "static"`. Configure `tsconfig.json` strict (`"strict": true, "noUncheckedIndexedAccess": true`). Add `.gitignore` entries: `node_modules/`, `dist/`, `.cache/`, `.astro/`, `test-results/`, `playwright-report/`. Add `.gitattributes`: `* text=auto eol=lf` plus `*.png binary`.
- [ ] **Step 3:** `package.json` scripts:

```json
{
  "dev": "astro dev",
  "build": "astro build",
  "preview": "astro preview",
  "check": "astro check",
  "test": "vitest run",
  "test:watch": "vitest",
  "e2e": "playwright test",
  "ingest": "tsx scripts/patch-ingestion/index.ts"
}
```

- [ ] **Step 4:** `vitest.config.ts` with `environment: "node"` default and `environmentMatchGlobs: [["tests/unit/browser/**", "happy-dom"]]`. Create empty dirs per spec §15 (`scripts/patch-ingestion/`, `src/data/patches/`, `src/data/overrides/`, `src/lib/`, `src/components/`, `tests/unit/`, `tests/e2e/`, `tests/fixtures/`).
- [ ] **Step 5:** Verify: `pnpm dev` serves the placeholder page; `pnpm build` succeeds; `pnpm test` reports "no test files" cleanly (add a trivial `tests/unit/smoke.test.ts` asserting `1 + 1 === 2` so the command passes).
- [ ] **Step 6:** Commit: `chore: scaffold Astro workspace with tooling`

### Task 2: Patch schema (Zod) and validatePatch

**Files:**
- Create: `src/lib/schema.ts`
- Test: `tests/unit/schema.test.ts`

**Interfaces:**
- Produces (exact, used by every later task):

```ts
export type Direction = "buff" | "nerf" | "neutral"
export type Classification = "buff" | "nerf" | "adjustment" | "rework" | "system"
export type NumericDelta = { kind: "numeric"; label: string; before: string; after: string; unit?: string; direction: Direction }
export type ProseChange = { kind: "prose"; label: string; text: string }
export type Change = NumericDelta | ProseChange
export type AbilityChange = { ability: "base" | "passive" | "Q" | "W" | "E" | "R" | "other"; name: string; changes: Change[] }
export type ChampionChange = { championId: string; classification: Classification; summary?: string; abilities: AbilityChange[] }
export type ItemChange = { itemId?: number; name: string; classification: Classification; changes: Change[] }
export type SystemChange = { name: string; classification: "system"; changes: Change[] }
export type Hotfix = { date: string; description: string; championIds?: string[] }
export type Patch = { schemaVersion: 1; id: string; assetVersion: string; releaseDate: string; sourceUrl: string; ingestedAt: string; champions: ChampionChange[]; items: ItemChange[]; systems: SystemChange[]; hotfixes?: Hotfix[] }
export const PatchSchema: z.ZodType<Patch>
export function validatePatch(data: unknown): Patch   // returns parsed Patch or throws ZodError
```

- [ ] **Step 1:** Write failing tests:

```ts
import { describe, it, expect } from "vitest"
import { validatePatch } from "../../src/lib/schema"

const minimal = {
  schemaVersion: 1, id: "26.16", assetVersion: "16.16.1",
  releaseDate: "2026-08-11", sourceUrl: "https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-16-notes/",
  ingestedAt: "2026-08-21T00:00:00.000Z", champions: [], items: [], systems: []
}

describe("PatchSchema", () => {
  it("accepts a minimal valid patch", () => {
    expect(validatePatch(minimal).id).toBe("26.16")
  })
  it("accepts a full champion change", () => {
    const p = { ...minimal, champions: [{ championId: "Ahri", classification: "nerf", abilities: [{ ability: "Q", name: "Orb of Deception", changes: [{ kind: "numeric", label: "AP Ratio", before: "45%", after: "40%", unit: "%", direction: "nerf" }] }] }] }
    expect(validatePatch(p).champions[0]!.abilities[0]!.changes[0]).toMatchObject({ kind: "numeric", direction: "nerf" })
  })
  it("rejects a bad patch id", () => {
    expect(() => validatePatch({ ...minimal, id: "sixteen" })).toThrow()
  })
  it("rejects an unknown classification", () => {
    const p = { ...minimal, champions: [{ championId: "Ahri", classification: "mega-buff", abilities: [] }] }
    expect(() => validatePatch(p)).toThrow()
  })
  it("rejects missing provenance fields", () => {
    const { sourceUrl, ...rest } = minimal
    expect(() => validatePatch(rest)).toThrow()
  })
})
```

- [ ] **Step 2:** Run `pnpm test tests/unit/schema.test.ts` — expect FAIL (module not found).
- [ ] **Step 3:** Implement `src/lib/schema.ts` with Zod: `id: z.string().regex(/^\d+\.\d+$/)`, `releaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/)`, `sourceUrl: z.string().url()`, discriminated union on `kind` for Change, enums for classification/direction/ability. `validatePatch = (d) => PatchSchema.parse(d)`.
- [ ] **Step 4:** Run tests — PASS. Run `pnpm check` — clean.
- [ ] **Step 5:** Commit: `feat: normalized patch schema with Zod validation`

### Task 3: Value parsing and delta math

**Files:**
- Create: `src/lib/deltas.ts`
- Test: `tests/unit/deltas.test.ts`

**Interfaces:**
- Produces:

```ts
export function parseValueSeries(text: string): number[]
// "60 / 80 / 100" -> [60, 80, 100]; "45%" -> [45]; "12s" -> [12]
// "60 / 80 / 100 (+35/40/45% AP)" -> [60, 80, 100]  (parenthesized ratio ignored)
// "Removed" / non-numeric -> []
export function relativeDelta(before: string, after: string): number | null
// compares first rank values: ("45%", "40%") -> -0.1111…; null when either side unparseable or before is 0
export function formatDelta(x: number | null): string | null
// -0.1111 -> "−11.1%"; +0.125 -> "+12.5%"; null -> null; uses U+2212 minus
```

- [ ] **Step 1:** Write failing tests:

```ts
import { parseValueSeries, relativeDelta, formatDelta } from "../../src/lib/deltas"

it("parses rank series", () => expect(parseValueSeries("60 / 80 / 100 / 120 / 140")).toEqual([60, 80, 100, 120, 140]))
it("parses single percent", () => expect(parseValueSeries("45%")).toEqual([45]))
it("parses seconds", () => expect(parseValueSeries("12s")).toEqual([12]))
it("ignores parenthesized ratios", () => expect(parseValueSeries("75 / 95 / 115 (+35/40/45% AP)")).toEqual([75, 95, 115]))
it("parses decimals", () => expect(parseValueSeries("0.5 / 0.75")).toEqual([0.5, 0.75]))
it("returns [] for prose", () => expect(parseValueSeries("Removed")).toEqual([]))
it("computes relative delta on first rank", () => expect(relativeDelta("45%", "40%")).toBeCloseTo(-0.1111, 3))
it("null on unparseable", () => expect(relativeDelta("Removed", "40%")).toBeNull())
it("null on zero base", () => expect(relativeDelta("0", "10")).toBeNull())
it("formats with typographic minus", () => expect(formatDelta(-0.1111)).toBe("−11.1%"))
it("formats positive with sign", () => expect(formatDelta(0.125)).toBe("+12.5%"))
```

- [ ] **Step 2:** Run — FAIL. Implement: strip parenthesized groups first (`text.replace(/\([^)]*\)/g, "")`), then match `/-?\d+(?:\.\d+)?/g`, filter split on `/`. `relativeDelta` uses first elements; guard zero/empty. `formatDelta` rounds to 1 decimal, trims trailing `.0`.
- [ ] **Step 3:** Run — PASS. Commit: `feat: value series parsing and relative delta math`

### Task 4: Deterministic change classifier

**Files:**
- Create: `scripts/patch-ingestion/classify.ts`
- Test: `tests/unit/classify.test.ts`

**Interfaces:**
- Consumes: `parseValueSeries` from `src/lib/deltas.ts`; `Direction`, `Classification` types from `src/lib/schema.ts`.
- Produces:

```ts
export type DirectionResult = { direction: Direction; known: boolean }
export function classifyChange(label: string, before: string, after: string): DirectionResult
// Uses the stat-semantics table. Unknown label -> { direction: "neutral", known: false }
// No numeric movement (equal firsts or unparseable) -> { direction: "neutral", known: true }
export function rollupChampion(directions: Direction[]): Extract<Classification, "buff" | "nerf" | "adjustment">
// all buffs -> "buff"; all nerfs -> "nerf"; mixed or all-neutral -> "adjustment"
export const STAT_SEMANTICS: { pattern: RegExp; increaseIsGood: boolean }[]  // exported for docs generation
```

- [ ] **Step 1:** Write failing tests (the table is the spec §6 — encode it):

```ts
import { classifyChange, rollupChampion } from "../../scripts/patch-ingestion/classify"

// increase is good
it("damage up = buff", () => expect(classifyChange("Magic Damage", "60 / 80", "75 / 95")).toEqual({ direction: "buff", known: true }))
it("damage down = nerf", () => expect(classifyChange("Base Damage", "80", "70")).toEqual({ direction: "nerf", known: true }))
it("AP ratio down = nerf", () => expect(classifyChange("AP Ratio", "45%", "40%")).toEqual({ direction: "nerf", known: true }))
it("movement speed up = buff", () => expect(classifyChange("Movement Speed", "330", "335").direction).toBe("buff"))
it("shield up = buff", () => expect(classifyChange("Shield Amount", "80", "90").direction).toBe("buff"))
// increase is bad
it("cooldown up = nerf", () => expect(classifyChange("Cooldown", "12s", "13s")).toEqual({ direction: "nerf", known: true }))
it("cooldown down = buff", () => expect(classifyChange("Cooldown", "10", "8").direction).toBe("buff"))
it("mana cost up = nerf", () => expect(classifyChange("Mana Cost", "60", "80").direction).toBe("nerf"))
it("cast time up = nerf", () => expect(classifyChange("Cast Time", "0.25", "0.4").direction).toBe("nerf"))
// edge cases
it("unknown label = neutral, unknown", () => expect(classifyChange("Sweetness Factor", "1", "2")).toEqual({ direction: "neutral", known: false }))
it("no numeric movement = neutral, known", () => expect(classifyChange("Cooldown", "12", "12")).toEqual({ direction: "neutral", known: true }))
it("unparseable = neutral, known", () => expect(classifyChange("Cooldown", "Removed", "New")).toEqual({ direction: "neutral", known: true }))
// rollup
it("all buffs -> buff", () => expect(rollupChampion(["buff", "buff"])).toBe("buff"))
it("mixed -> adjustment", () => expect(rollupChampion(["buff", "nerf"])).toBe("adjustment"))
it("neutrals ignored beside one nerf -> nerf", () => expect(rollupChampion(["neutral", "nerf"])).toBe("nerf"))
it("all neutral -> adjustment", () => expect(rollupChampion(["neutral"])).toBe("adjustment"))
```

- [ ] **Step 2:** Run — FAIL. Implement `STAT_SEMANTICS` (order matters, first match wins; case-insensitive):

```ts
export const STAT_SEMANTICS = [
  { pattern: /cooldown|recharge|cost|cast time|delay|channel/i, increaseIsGood: false },
  { pattern: /damage|ratio|\bad\b|\bap\b|heal|shield|movement speed|move speed|attack speed|range|duration|slow|stun|charm|root|armor|magic resist|health|\bhp\b|mana(?! cost)|regen|gold|bonus/i, increaseIsGood: true },
] as const
```

`classifyChange`: find table row for label → if none, `{neutral, known:false}`; parse both sides with `parseValueSeries` → if either empty or firsts equal, `{neutral, known:true}`; else direction from sign × polarity.
- [ ] **Step 3:** Run — PASS. Commit: `feat: deterministic stat-semantics classifier with rollup`

### Task 5: Patch-notes HTML parser

**Files:**
- Create: `scripts/patch-ingestion/parse.ts`
- Create: `tests/fixtures/notes-fragment.html` (small hand-written fragment mimicking Riot structure — never a full page)
- Test: `tests/unit/parse.test.ts`

**Interfaces:**
- Produces:

```ts
export type RawLine = { label: string; before?: string; after?: string; text?: string }  // arrow line has before/after; prose line has text
export type RawBlock = { header: string; lines: RawLine[] }   // header: "Q - Orb of Deception" | "Base Stats" | item/system block title
export type RawSection = { name: string; summary?: string; blocks: RawBlock[] }
export type RawPatch = { champions: RawSection[]; items: RawSection[]; systems: RawSection[] }
export type ParseReport = { championCount: number; arrowLines: number; proseLines: number; unparsedBlocks: string[] }
export function parsePatchHtml(html: string): { raw: RawPatch; report: ParseReport }
```

- [ ] **Step 1:** Create the fixture. Model it on the real structure verified 2026-08-21 (change blocks under `h3`/champion headers; ability sub-headers; lines `Label: X ⇒ Y`; bold after-values; items/systems in same notation). Include in the fixture: two champions (one with Base Stats block + Q block with two arrow lines; one with a prose-only line), one item with an arrow line, one system block. **Before finalizing the parser, fetch one real page into `.cache/` and adjust fixture/selectors to match reality — the fixture must mirror the live DOM's actual class names/tags** (`patch-change-block` etc.), discovered at execution time.
- [ ] **Step 2:** Write failing tests:

```ts
import { readFileSync } from "node:fs"
import { parsePatchHtml } from "../../scripts/patch-ingestion/parse"
const html = readFileSync("tests/fixtures/notes-fragment.html", "utf8")

it("finds champion sections by name", () => {
  const { raw } = parsePatchHtml(html)
  expect(raw.champions.map(c => c.name)).toContain("Azir")
})
it("splits arrow lines into before/after", () => {
  const { raw } = parsePatchHtml(html)
  const azirQ = raw.champions.find(c => c.name === "Azir")!.blocks.find(b => /Q -/.test(b.header))!
  expect(azirQ.lines[0]).toMatchObject({ label: "Damage", before: expect.stringContaining("60"), after: expect.stringContaining("75") })
})
it("keeps prose lines as text", () => {
  const { raw } = parsePatchHtml(html)
  const prose = raw.champions.flatMap(c => c.blocks).flatMap(b => b.lines).filter(l => l.text)
  expect(prose.length).toBeGreaterThan(0)
})
it("reports coverage counts", () => {
  const { report } = parsePatchHtml(html)
  expect(report.championCount).toBe(2)
  expect(report.arrowLines).toBeGreaterThanOrEqual(3)
})
```

- [ ] **Step 3:** Run — FAIL. Implement with `node-html-parser`: locate champion/item/system groupings (Riot pages group under section headers "Champions", "Items", "Systems"-like headings — match on heading text, tolerant of case/pluralization), split lines on `⇒` (also accept `=>` fallback), label = text before first `:`. Anything non-matching inside a known block → prose line; whole blocks that resist parsing → pushed to `report.unparsedBlocks` (never silently dropped).
- [ ] **Step 4:** Run — PASS. Commit: `feat: patch-notes HTML parser with coverage report`

### Task 6: Normalizer with override merging

**Files:**
- Create: `scripts/patch-ingestion/normalize.ts`
- Test: `tests/unit/normalize.test.ts`

**Interfaces:**
- Consumes: `RawPatch` (Task 5), `classifyChange`/`rollupChampion` (Task 4), `validatePatch` (Task 2), champion name→id mapping.
- Produces:

```ts
export type PatchOverride = {
  classificationOverrides?: Record<string, Classification>   // championId -> classification (e.g. "rework")
  replaceChampions?: ChampionChange[]                        // full replacement matched by championId
  addChampions?: ChampionChange[]
  removeChampions?: string[]
  addHotfixes?: Hotfix[]
}
export type PatchMeta = { id: string; assetVersion: string; releaseDate: string; sourceUrl: string; ingestedAt: string }
export function normalizePatch(raw: RawPatch, meta: PatchMeta, championIds: Record<string, string>, override?: PatchOverride): Patch
// championIds maps display name -> ddragon id ("Kai'Sa" -> "Kaisa"); unmapped names throw
// ability detection: block header "Q - Name" -> ability "Q"; "Base Stats" -> "base"; "Passive - Name" -> "passive"; else "other"
```

- [ ] **Step 1:** Write failing tests:

```ts
import { normalizePatch } from "../../scripts/patch-ingestion/normalize"
const meta = { id: "26.16", assetVersion: "16.16.1", releaseDate: "2026-08-11", sourceUrl: "https://example.com/notes", ingestedAt: "2026-08-21T00:00:00.000Z" }
const ids = { "Azir": "Azir", "Kai'Sa": "Kaisa" }
const raw = { champions: [{ name: "Azir", blocks: [{ header: "Q - Conquering Sands", lines: [{ label: "Damage", before: "60 / 80", after: "75 / 95" }] }] }], items: [], systems: [] }

it("produces a schema-valid patch with classified changes", () => {
  const p = normalizePatch(raw as any, meta, ids)
  expect(p.champions[0]).toMatchObject({ championId: "Azir", classification: "buff" })
  expect(p.champions[0]!.abilities[0]).toMatchObject({ ability: "Q", name: "Conquering Sands" })
})
it("maps punctuated names to ddragon ids", () => {
  const r = { ...raw, champions: [{ name: "Kai'Sa", blocks: raw.champions[0]!.blocks }] }
  expect(normalizePatch(r as any, meta, ids).champions[0]!.championId).toBe("Kaisa")
})
it("throws on unmapped champion name", () => {
  const r = { ...raw, champions: [{ name: "Notachamp", blocks: [] }] }
  expect(() => normalizePatch(r as any, meta, ids)).toThrow(/Notachamp/)
})
it("applies classification overrides", () => {
  const p = normalizePatch(raw as any, meta, ids, { classificationOverrides: { Azir: "rework" } })
  expect(p.champions[0]!.classification).toBe("rework")
})
it("removes and adds champions via override", () => {
  const add = { championId: "Ahri", classification: "nerf", abilities: [] }
  const p = normalizePatch(raw as any, meta, ids, { removeChampions: ["Azir"], addChampions: [add as any] })
  expect(p.champions.map(c => c.championId)).toEqual(["Ahri"])
})
```

- [ ] **Step 2:** Run — FAIL. Implement: map raw sections → ChampionChange (per-line `classifyChange`, rollup, prose lines → ProseChange), items/systems similarly (systems always `classification: "system"`), apply override in order remove → replace → add → classificationOverrides → addHotfixes, finish with `return validatePatch(patch)`.
- [ ] **Step 3:** Run — PASS. Commit: `feat: normalizer with override merge and schema gate`

### Task 7: Fetchers and version resolution

**Files:**
- Create: `scripts/patch-ingestion/fetch.ts`
- Test: `tests/unit/fetch.test.ts` (pure functions only — no network in tests)

**Interfaces:**
- Produces:

```ts
export function notesUrlFor(id: string): string
// "26.16" -> "https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-16-notes/"
export function resolveAssetVersion(id: string, ddragonVersions: string[]): string | null
// match on minor: "26.16" + ["16.16.1", "16.15.1"] -> "16.16.1"; no match -> null
export async function fetchWithCache(url: string, cacheKey: string): Promise<string>
// GET with browser-like User-Agent; caches body to .cache/<cacheKey>; returns cached copy when present
export async function fetchDdragonVersions(): Promise<string[]>
export async function fetchChampionIndex(assetVersion: string): Promise<Record<string, { id: string; name: string; title: string }>>
// from ddragon /cdn/<v>/data/en_US/champion.json -> keyed by display name
```

- [ ] **Step 1:** Failing tests for `notesUrlFor` (dot→dash mapping) and `resolveAssetVersion` (match, no-match → null, picks the listed version even when patch is `.1`-suffixed differently). Run — FAIL.
- [ ] **Step 2:** Implement. `fetchWithCache`: `mkdir -p .cache` via `node:fs/promises`, read-if-exists, else `fetch` with `User-Agent: Mozilla/5.0 (RiftDelta ingestion; +https://github.com/<repo>)`, non-200 throws with status + url.
- [ ] **Step 3:** Run — PASS. Commit: `feat: notes/ddragon fetchers with cache and version resolver`

### Task 8: Ingestion CLI

**Files:**
- Create: `scripts/patch-ingestion/index.ts`, `scripts/patch-ingestion/validate.ts`
- Test: `tests/unit/validate-all.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–7.
- Produces:
  - CLI: `pnpm ingest 26.16` (one patch), `pnpm ingest --all` (26.1→26.16), `pnpm ingest --validate` (re-validate all committed patch files, no network).
  - `validateAllPatches(dir: string): { file: string; ok: boolean; error?: string }[]` in `validate.ts` — also imported by tests so **any malformed committed patch file fails `pnpm test`**.
  - Writes `src/data/patches/<id>.json` (2-space indent, key order stable via schema shape) and refreshes `src/data/champions.json` (`{ assetVersion, champions: { [ddragonId]: { name, title } } }`).
  - Prints per-patch report: champions found, arrow/prose line counts, unknown labels (from `classifyChange(...).known === false`), unparsed blocks.

- [ ] **Step 1:** Failing test: `validateAllPatches("src/data/patches")` returns `ok: true` for every file (drop a known-bad fixture into a temp dir in the test to assert failure detection too). Run — FAIL (function missing).
- [ ] **Step 2:** Implement `validate.ts`, then the CLI: parse args → resolve versions → for each patch id: fetch (cache) → parse → normalize (+ load `src/data/overrides/<id>.json` if present) → write → print report. Exit non-zero if validation fails or a champion name is unmapped.
- [ ] **Step 3:** Wire the always-on guard: `tests/unit/validate-all.test.ts` iterates real `src/data/patches/*.json` through `validatePatch` (skips cleanly when dir empty).
- [ ] **Step 4:** Run `pnpm test` — PASS. Commit: `feat: ingestion CLI with validation guard`

### Task 9: Ingest the 2026 season (real data) + roles mapping

**Files:**
- Create: `src/data/patches/26.1.json` … `26.16.json` (via CLI), `src/data/overrides/*.json` (as needed), `src/data/champions.json`, `src/data/roles.json`

**Interfaces:**
- Produces: the complete committed dataset every page builds from. `roles.json` shape: `Record<ddragonId, ("top"|"jungle"|"mid"|"adc"|"support")[]>` — every champion in `champions.json` has ≥ 1 role.

- [ ] **Step 1:** Run `pnpm ingest --all`. Where a page 404s or a patch id doesn't exist (verify against the notes index `https://www.leagueoflegends.com/en-us/news/tags/patch-notes/`), adjust the id list (some numbers may be skipped mid-season — the CLI accepts an explicit list).
- [ ] **Step 2:** Triage reports: for every unknown label, either extend `STAT_SEMANTICS` (add a unit test per added pattern — repeat the Task 4 test shape) or accept neutral; for every unparsed block, add an override entry or improve the parser (with a fixture-backed test).
- [ ] **Step 3:** Spot-check 3 patches against the live pages (26.16 Azir Q damage `60/80/100/120/140 ⇒ 75/95/115/135/155`, Camille E cooldown `18/14/10/6s ⇒ 14/11/8s`, Poppy W slow `20/25/30/35/40% ⇒ 20/23/26/29/32%`, plus 2 champions each in 26.8 and 26.1). Fix via override or parser as appropriate.
- [ ] **Step 4:** Author `src/data/roles.json` for all champions (curated; use widely-known primary positions; multi-role champions get multiple entries). Add unit test: every champions.json id appears in roles.json with ≥1 valid role.
- [ ] **Step 5:** `pnpm test` PASS (validation guard now exercises real data). Commit data: `data: ingest 2026 season patches 26.1-26.16 with roles mapping`

# Phase 2 — Product surfaces

### Task 10: Data access and compare logic

**Files:**
- Create: `src/lib/data.ts`, `src/lib/compare.ts`
- Test: `tests/unit/data.test.ts`, `tests/unit/compare.test.ts`

**Interfaces:**
- Produces:

```ts
// data.ts — loads via import.meta.glob in Astro; accepts injected patches for tests
export function sortPatchIds(ids: string[]): string[]            // numeric desc: "26.16" before "26.9"
export function getAllPatches(): Patch[]                          // sorted desc
export function getLatestPatch(): Patch
export function getPatch(id: string): Patch | undefined
export function getChampionHistory(championId: string, patches?: Patch[]): { patchId: string; releaseDate: string; change: ChampionChange }[]
export function getChampionMeta(): Record<string, { name: string; title: string }>   // from champions.json
export function getRoles(): Record<string, Role[]>
export type Role = "top" | "jungle" | "mid" | "adc" | "support"

// compare.ts — aggregate everything that happened in (older, newer]
export type CompareEntry = { championId: string; patches: { patchId: string; classification: Classification }[]; net: Classification }
export type CompareResult = { newer: string; older: string; span: string[]; champions: CompareEntry[]; items: { name: string; patches: string[] }[]; systems: { name: string; patches: string[] }[] }
export function comparePatches(newerId: string, olderId: string, patches: Patch[]): CompareResult
// net: all buff -> buff, all nerf -> nerf, contains rework -> rework, else adjustment
```

- [ ] **Step 1:** Failing tests with 3 tiny in-memory patches (champion buffed in A, nerfed in B, absent in C): sort order (`26.16` > `26.9`), history returns chronological desc entries with patchId, compare over a 2-patch span aggregates and computes `net`, compare with reversed args throws or swaps deterministically (pick: swap so `/compare/26.12/26.16` still works). Run — FAIL.
- [ ] **Step 2:** Implement (`import.meta.glob("../data/patches/*.json", { eager: true })` behind a lazily-initialized module map; test path injects patches). Run — PASS.
- [ ] **Step 3:** Commit: `feat: data access layer and cross-patch compare aggregation`

### Task 11: URL state and filtering

**Files:**
- Create: `src/lib/url-state.ts`, `src/lib/filters.ts`
- Test: `tests/unit/url-state.test.ts`, `tests/unit/filters.test.ts`

**Interfaces:**
- Produces:

```ts
export type PatchFilters = { champions: string[]; role: Role | null; type: Classification | null; pool: boolean; q: string }
export const EMPTY_FILTERS: PatchFilters
export function parseFilters(search: string): PatchFilters       // tolerant: unknown params ignored, bad values dropped
export function serializeFilters(f: PatchFilters): string        // omits defaults; stable param order champions,role,type,pool,q; "" when empty
export function filterChampions(changes: ChampionChange[], f: PatchFilters, roles: Record<string, Role[]>, pool: string[]): ChampionChange[]
// champions: exact id match (case-insensitive); role: any-overlap; type: classification equal; pool: intersect with pool ids; q: substring on champion name/id
```

- [ ] **Step 1:** Failing tests: round-trip `parse(serialize(f)) == f` for a full filter set; `serializeFilters(EMPTY_FILTERS) === ""`; bad role value dropped; filtering by role/type/pool/q on a 4-champion fixture. Run — FAIL.
- [ ] **Step 2:** Implement with `URLSearchParams`. Run — PASS. Commit: `feat: url filter state and champion filtering`

### Task 12: My Pool store

**Files:**
- Create: `src/lib/pool.ts`
- Test: `tests/unit/browser/pool.test.ts` (happy-dom)

**Interfaces:**
- Produces:

```ts
export const $pool: WritableAtom<string[]>          // @nanostores/persistent, key "riftdelta:pool", JSON codec
export function togglePool(championId: string): void
export function inPool(pool: string[], championId: string): boolean
```

- [ ] **Step 1:** Failing tests: toggle adds then removes; persists to `localStorage["riftdelta:pool"]`; fresh import with pre-seeded localStorage hydrates the atom; corrupted JSON in storage resets to `[]` without throwing. Run — FAIL.
- [ ] **Step 2:** Implement with `persistentAtom<string[]>("riftdelta:pool", [], { encode: JSON.stringify, decode: safeParse })`. Run — PASS. Commit: `feat: localStorage-backed champion pool store`

### Task 13: Design tokens, fonts, base layout

**Files:**
- Create: `src/styles/tokens.css` (fill), `src/styles/global.css` (fill), `src/assets/fonts/*` (+ license files), `src/layouts/Layout.astro`, `src/components/SiteHeader.astro`, `src/components/SiteFooter.astro`, `src/components/DeltaGlyph.astro` (▲/▼/Δ glyph + label primitive)

**Interfaces:**
- Produces: `Layout.astro` props `{ title: string; description: string; ogImage?: string }`; CSS custom properties every component uses:
  `--ink` (deep warm charcoal bg), `--ink-2` (raised surface), `--cream` (primary text), `--cream-dim`, `--gold` (brand accent), `--buff` (desaturated teal), `--nerf` (desaturated ember), `--neutral`; type scale `--font-display`, `--font-ui`, `--font-num`; spacing scale `--s1..--s9`.
- Type system (spec §10; chosen at design time, executor may substitute same-class faces if a download fails — never Inter/Geist/system-ui): display **Clash Display** (Fontshare), UI/body **General Sans** (Fontshare), numerics **Spline Sans Mono** (Google Fonts, tabular figures). Self-host woff2 with `font-display: swap`, subset latin.

- [ ] **Step 1:** Download the three families (woff2, weights: display 500/600, UI 400/500/600, mono 400/500) into `src/assets/fonts/` with their license files. `@font-face` in `tokens.css`; `font-feature-settings: "tnum"` utility class `.num`.
- [ ] **Step 2:** Fill `tokens.css`: palette derived from the logo set (sample the logo ink and gold; target AA contrast: cream-on-ink ≥ 7:1, gold used at display sizes only), semantic colors distinct from gold under deuteranopia simulation (verify with a contrast checker).
- [ ] **Step 3:** Build `Layout.astro` (meta, OG tags, skip-link, `<slot/>`), `SiteHeader` (desktop: `logo-desktop-light.png` via `astro:assets` Image, height ≤ 28px, links: Patch, Champions, Compare, ⌘K hint; mobile: R-monogram crop or small wordmark), `SiteFooter` (Riot third-party disclaimer verbatim: "RiftDelta is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games and League of Legends are trademarks or registered trademarks of Riot Games, Inc." + GitHub link + data provenance line).
- [ ] **Step 4:** Verify: `pnpm dev`, screenshot header/footer desktop + 390px mobile; fonts load (Network tab, no layout shift); `pnpm build` clean. Commit: `feat: design tokens, self-hosted type system, base layout`

### Task 14: Patch page

**Files:**
- Create: `src/pages/patch/[id].astro`, `src/pages/patch/index.astro` (redirect to latest), `src/pages/patches/index.astro`
- Create: `src/components/ChangeCard.astro`, `src/components/DeltaRow.astro`, `src/components/ClassificationBadge.astro`, `src/components/islands/PatchFilterBar.tsx` (React island)
- Test: `tests/unit/filters.test.ts` already covers logic; page assertions land in Task 23 e2e.

**Interfaces:**
- Consumes: `getAllPatches`, `getPatch`, `filterChampions`, `parseFilters`, `serializeFilters`, `$pool`, `formatDelta`/`relativeDelta`, tokens.
- Produces:
  - `DeltaRow` props: `{ change: Change }` — renders `label`, `before → after` in `--font-num` with tabular figures, relative delta chip, ▲/▼ + text direction label (never color alone).
  - `ChangeCard` props: `{ change: ChampionChange; meta: { name: string; title: string }; assetVersion: string }` — champion square from ddragon CDN (`/cdn/<assetVersion>/img/champion/<id>.png`, lazy, width/height set), classification badge, ability groups.
  - `PatchFilterBar` props: `{ patchId: string; championIds: string[]; roles: Record<string, Role[]> }` — client island: reads URL on mount, writes via `history.replaceState`, filters by toggling `hidden` attr on `[data-champion-id]` cards (server renders ALL cards; island only hides — page works without JS).
  - Every card has `id="<championId>"` for deep links.

- [ ] **Step 1:** Build static rendering: `getStaticPaths` from `getAllPatches()`; page sections Champions / Items / Systems / Hotfixes (when present); patch header shows id (display size, `--font-display`), releaseDate, link to `sourceUrl`, counts line ("14 champions · 6 items · 2 systems").
- [ ] **Step 2:** Build `PatchFilterBar`: search input, role segmented control, type segmented control, "My pool" toggle (from `$pool` via `@nanostores/react`), active-filter → URL sync both directions. Layout reorganization must be coherent (CSS grid, no teleporting: hidden cards collapse with a 150ms opacity/transform exit).
- [ ] **Step 3:** `/patch/index.astro`: meta-refresh + JS redirect to `/patch/<latest>`; `/patches`: chronological list with dates and per-patch counts.
- [ ] **Step 4:** Verify: `pnpm build`; open `dist/patch/26.16/index.html` and grep a known delta (`45%` case from data; at minimum the Azir 26.16 values); dev-server manual check: filters update URL, URL restores filters, pool toggle hides others, works at 390px. Commit: `feat: patch pages with filterable structured changes`

### Task 15: Champion history page

**Files:**
- Create: `src/pages/champion/[slug].astro`, `src/components/TimelineEntry.astro`, `src/pages/champions/index.astro`

**Interfaces:**
- Consumes: `getChampionHistory`, `getChampionMeta`, `getRoles`, ChangeCard internals (DeltaRow, ClassificationBadge).
- Produces: `/champion/<lowercase-ddragon-id>` for every champion in `champions.json` (even the unchanged: they render an "Unchanged all season" state with their meta — the empty state is designed, not blank). Timeline: patch id + classification marker per entry, `<details>`-based expansion (keyboard-accessible for free), newest first, git-log visual metaphor (rail + node markers).

- [ ] **Step 1:** `getStaticPaths` over all champion ids; header: loading-screen artwork (`/cdn/img/champion/loading/<id>_0.jpg`, lazy), name/title, roles chips with "curated mapping — corrections welcome via PR" label linked to CONTRIBUTING.
- [ ] **Step 2:** Timeline entries: summary row (patch id in `--font-num`, date, badge, one-line change count); expanded: full ability groups reusing `DeltaRow`.
- [ ] **Step 3:** `/champions`: index grid of all champions (portrait, name, change-count-this-season) linking to their pages — this is also the SEO surface for champion queries.
- [ ] **Step 4:** Verify: build; check `dist/champion/ahri/index.html` exists with timeline; expanded details render deltas; mobile layout. Commit: `feat: champion history timeline pages`

### Task 16: Compare page

**Files:**
- Create: `src/pages/compare/[a]/[b].astro`, `src/pages/compare/index.astro`, `src/components/islands/ComparePicker.tsx`

**Interfaces:**
- Consumes: `comparePatches`, `getAllPatches`, badge/delta components.
- Produces: all ordered pairs statically generated (newer/older canonicalized — `getStaticPaths` emits every ordered pair; reversed pair renders identical content). Sections: **Changed champions** (grouped by `net`: buffed / nerfed / adjusted / reworked — with per-patch trail "26.13 nerf → 26.15 buff"), **Items**, **Systems**. `ComparePicker`: two patch selects, navigates on change.

- [ ] **Step 1:** Implement pages + picker; compare header treats the two patch numbers as the visual object (`26.16 Δ 26.12` in display type).
- [ ] **Step 2:** Verify: build (~240 pair pages build in reasonable time — record the build duration; if > 2 min, restrict to pairs within a 6-patch window and note it in the page copy); spot-check a champion with multiple changes in the span shows the full trail. Commit: `feat: cross-patch compare with net classification`

### Task 17: Command palette

**Files:**
- Create: `src/components/islands/CommandPalette.tsx`, `src/lib/search-index.ts`
- Test: `tests/unit/search-index.test.ts`

**Interfaces:**
- Produces:

```ts
// search-index.ts (build-time, imported by the island as props via Astro)
export type SearchEntry = { type: "champion" | "patch" | "item" | "system"; label: string; sub?: string; href: string; keywords: string[] }
export function buildSearchIndex(patches: Patch[], meta: Record<string, {name: string; title: string}>): SearchEntry[]
// champions -> /champion/<slug> (+ per-patch entries "Patch 26.16: Ahri" -> /patch/26.16#Ahri for patches where changed)
// patches -> /patch/<id>; items/systems -> /patch/<id>#<anchor>
```

  Palette island mounted in `Layout.astro`: `⌘K`/`Ctrl+K` opens, `Esc` closes, full keyboard nav (cmdk), custom styling on tokens (ink surface, gold caret, cream text — explicitly NOT default cmdk/shadcn look: no border-radius-heavy card, styled as an editorial "index card" with `--font-num` shortcuts column).

- [ ] **Step 1:** Failing tests for `buildSearchIndex`: contains champion entry with href `/champion/ahri`; per-patch champion entries only for patches where the champion changed; patch entries sorted desc. Run — FAIL. Implement. Run — PASS.
- [ ] **Step 2:** Build the island (lazy: `client:idle`, and the cmdk import is dynamic on first open so the palette costs ~0 on load). Focus trap + focus return verified manually.
- [ ] **Step 3:** Verify: dev server — `Ctrl+K` from any page; type "ahri" → entries navigate; keyboard-only round trip; screenshot. Commit: `feat: command palette with build-time search index`

### Task 18: Pool picker and personalization

**Files:**
- Create: `src/components/islands/PoolPicker.tsx`, `src/pages/pool.astro`
- Modify: `src/pages/patch/[id].astro` (personalized strip), `src/components/islands/PatchFilterBar.tsx` (pool count on toggle)

**Interfaces:**
- Consumes: `$pool`, `togglePool`, `getChampionMeta`, roles.
- Produces: `/pool` page — full champion grid (portraits from ddragon, search field, role filter) where clicking/Enter toggles selection: immediate tactile response (pressed scale 0.97 → selected state with gold rule under portrait + name weight change), selected count updates in a sticky bar ("5 champions — see your patch"). Patch pages: when pool non-empty, a "YOUR POOL" strip renders first (client-side island reordering server-rendered cards by id — cards exist regardless; JS only reorders/pins), including UNCHANGED entries for pool champions absent from the patch (per spec §2 product experience). `?champions=a,b` in any patch URL pins those champions visually with an "add to my pool" affordance.

- [ ] **Step 1:** Build `/pool` grid + island; keyboard operable (roving tabindex, Enter/Space toggles, visible focus ring in gold).
- [ ] **Step 2:** Wire patch-page strip + UNCHANGED entries + `?champions=` pinning.
- [ ] **Step 3:** Verify: select 3 champions → reload → persists; patch page shows pool strip with UNCHANGED for untouched pool champion; `?champions=ahri,jinx` link works in a private window (no localStorage); mobile. Commit: `feat: my pool selection and patch personalization`

# Phase 3 — Cinema & ship

### Task 19: Homepage — static composition first

**Files:**
- Create: `src/pages/index.astro` (replace placeholder), `src/components/home/*.astro` (one file per scene: `Hero.astro`, `WallOfNotes.astro`, `YourChampions.astro`, `TheDelta.astro`, `HistoryScene.astro`, `RoleImpact.astro`, `OpenSourceScene.astro`, `Closing.astro`)

**Interfaces:**
- Consumes: latest patch data (real numbers — every stat shown on the homepage is real, from `getLatestPatch()`), pool store (personalized strip when pool exists), brand assets, tokens.
- Produces: the complete homepage as a **static, semantically correct, mobile-first composition** — full content hierarchy per spec §10 storyboard, zero scroll-driven motion yet. This static version IS the reduced-motion and no-JS experience, so it must stand alone: correct headings h1→h2 flow, all copy in place (voice rules), CTAs (`Pick your champions` → `/pool`, `Explore 26.16` → `/patch/26.16`), real deltas in the Delta scene, real counts in Role Impact, real schema fragment in Open Source scene.

- [ ] **Step 1:** Invoke the design skills before building: use `impeccable` (craft) and `design-taste-frontend` guidance with the spec §10 concept (DESIGN_VARIANCE 8 / MOTION_INTENSITY 9 / VISUAL_DENSITY 5) to lay out each scene's composition — editorial scale contrasts, the patch number as a massive typographic object in the hero, the wall-of-notes as a dense typographic texture block, the Delta scene as giant paired numerals. No card grids, no three-card sections.
- [ ] **Step 2:** Build all eight scene components statically, desktop and mobile layouts.
- [ ] **Step 3:** Verify: build; screenshots of every scene at 1440px and 390px; heading outline correct (one h1); Lighthouse a11y ≥ 95 on `/`; copy voice check against banned-words list. Commit: `feat: homepage static composition (all scenes)`

### Task 20: Homepage motion — hero + wall of notes

**Files:**
- Create: `src/scripts/home-motion.ts` (single GSAP entry, imported by `index.astro` with `<script>`), `src/scripts/motion-utils.ts`
- Modify: `Hero.astro`, `WallOfNotes.astro` (data attributes/markup hooks)

**Interfaces:**
- Produces: `motion-utils.ts` exports `prefersReducedMotion(): boolean` and `initScene(name, fn)` registry so scenes register independently and all respect the same guard. Reduced motion or no-JS → static composition from Task 19 with simple opacity cuts only.
- Motion spec (from spec §10, brief §12–13): hero patch number `26.15` → `26.16` numeral mask-transition scrubbed over the first ~120vh with small real deltas flashing during the transform; wall-of-notes: pinned section (≤ 150vh pin) where dense lines compress/mask away leaving structured deltas that snap into RiftDelta card form. Use Emil's `animate` guidance for durations/easing before implementing.

- [ ] **Step 1:** Invoke `animate` (Emil) for the two sequences; write the motion notes (target durations, easings, what property animates) as comments at the top of `home-motion.ts`.
- [ ] **Step 2:** Implement hero + wall with GSAP ScrollTrigger; transform/opacity/clip-path only; `will-change` applied on scene enter and removed on leave.
- [ ] **Step 3:** Profile: Chrome DevTools performance recording while scrolling both scenes; no long tasks > 50ms, steady 60fps on the dev machine. Simplify anything that drops frames.
- [ ] **Step 4:** Verify reduced-motion: emulate `prefers-reduced-motion: reduce` → no pinning, content readable top-to-bottom. Rapid-scroll test: flick from top to bottom — reachable without feeling trapped. Commit: `feat: hero and wall-of-notes scroll narrative`

### Task 21: Homepage motion — remaining scenes

**Files:**
- Modify: `src/scripts/home-motion.ts`, scene components (hooks)

**Interfaces:**
- Consumes: Task 20's `initScene`/guard infra.
- Produces motion for: YourChampions (portrait field: unselected recede via scale/opacity, selected advance — driven by real pool when present, exemplar pool otherwise), TheDelta (scroll-linked number transitions: old value translates out, new in, per spec §15 — three sequential deltas), HistoryScene (timeline rail draws via scaleY transform; entries accumulate), RoleImpact (role list sweep with real counts), OpenSourceScene (deliberate cinematic break — motion stops, content is still), Closing (single mask reveal of "Queue informed.").

- [ ] **Step 1:** Implement per scene; each ≤ 100vh of scroll distance except TheDelta (≤ 200vh); mobile variants non-pinned (stacked, short fades) per spec §11.
- [ ] **Step 2:** Profile the full page scroll end-to-end (desktop + CPU 4x throttle); fix jank; verify total scroll length feels editorial, not a scroll prison (full flick-through < ~8s).
- [ ] **Step 3:** Reduced-motion + keyboard (tab through CTAs mid-narrative) verification. Commit: `feat: full homepage scroll narrative`

### Task 22: Design and animation review passes

**Files:**
- Modify: whatever the passes flag (styles, scenes, components)

**Interfaces:**
- Consumes: the complete site.
- Produces: written critique notes + applied fixes + screenshot set `docs/screenshots/` (hero, wall, delta, patch page, champion page, compare, palette open, pool — desktop 1440 & mobile 390, light on the two light-bg docs contexts if any).

- [ ] **Step 1:** Invoke `impeccable` critique + polish passes on: homepage, patch page, champion page, palette. Apply fixes.
- [ ] **Step 2:** Invoke Emil's `review-animations` on hero, wall, delta scenes and the micro-interactions (pool toggle, filter reorganization, palette open/close). Apply fixes.
- [ ] **Step 3:** Invoke `improve-animations` across the whole experience once; triage its report — implement accepted items, record rejected items with reasons in the PR/commit message.
- [ ] **Step 4:** Re-screenshot everything into `docs/screenshots/`; verify the §40 originality bar (screenshot-without-logo test) honestly — if it fails, iterate on the weakest viewport before proceeding. Commit: `polish: design and motion review passes`

### Task 23: Playwright end-to-end suite

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/core-flow.spec.ts`, `tests/e2e/keyboard.spec.ts`, `tests/e2e/reduced-motion.spec.ts`, `tests/e2e/visual.spec.ts`

**Interfaces:**
- Consumes: built site via `webServer: { command: "pnpm preview", url: "http://localhost:4321" }` (build first in CI).
- Produces: green `pnpm e2e` on chromium desktop + iPhone-class mobile viewport project.

- [ ] **Step 1:** `core-flow.spec.ts`: land on `/` → CTA to `/pool` → select Ahri + Jinx → navigate to latest patch → pool strip shows both (Ahri with changes or UNCHANGED) → toggle "My pool" filter → only pool champions visible → reload → persists → shared URL `?champions=ahri` renders pinned champion in a fresh context (no storage).
- [ ] **Step 2:** `keyboard.spec.ts`: tab from page top → skip-link → header → open palette with `Control+k` → arrow to a champion → Enter navigates; on `/pool` toggle a champion with keyboard only; on champion page expand a timeline entry with Enter.
- [ ] **Step 3:** `reduced-motion.spec.ts`: with `reducedMotion: "reduce"` context: `/` renders all eight scene headings visible by plain scrolling, no pinned sections (assert no ScrollTrigger pin spacers in DOM).
- [ ] **Step 4:** `visual.spec.ts`: screenshot assertions (`toHaveScreenshot` with maxDiffPixelRatio 0.02) for hero end-state, delta scene end-state, patch page top, palette open — desktop + mobile.
- [ ] **Step 5:** Run full suite against a production build — PASS. Commit: `test: e2e coverage for core flows, keyboard, reduced motion, visuals`

### Task 24: SEO, OG, sitemap, 404

**Files:**
- Create: `src/pages/404.astro`, `public/og-default.png`, `scripts/generate-og.ts`
- Modify: `src/layouts/Layout.astro` (canonical URLs, og/twitter meta), patch/champion pages (per-page titles/descriptions)

**Interfaces:**
- Produces: titles per spec §9/§34 patterns — champion: `Ahri Patch History — RiftDelta` / `Every Ahri buff, nerf and adjustment across League patches.`; patch: `League Patch 26.16 Changes — RiftDelta`; compare: `League 26.16 vs 26.12 — RiftDelta`. `generate-og.ts` (run once, output committed): composes `logo-mobile-gold.png` on `--ink` background at 1200×630 via `sharp` (`pnpm add -D sharp` in this task) → `public/og-default.png`. Sitemap from @astrojs/sitemap (already integrated Task 1). 404: on-brand ("This page got removed in a patch."), links home + palette hint.

- [ ] **Step 1:** Implement; run the OG script; verify meta with `pnpm build` + grep dist for `og:title` on 3 page types; sitemap exists in dist.
- [ ] **Step 2:** Commit: `feat: seo metadata, og card, sitemap, 404`

### Task 25: GitHub Actions

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/check-new-patch.yml`, `scripts/check-new-patch.ts`

**Interfaces:**
- Produces:
  - `ci.yml`: on push/PR → pnpm install (frozen lockfile) → `pnpm check` → `pnpm test` → `pnpm build` → `pnpm exec playwright install --with-deps chromium && pnpm e2e`. Node 22, pnpm cache.
  - `check-new-patch.ts`: fetch ddragon versions + notes index → derive expected next patch id → exit 0 with output `new_patch=<id>` when a patch exists that `src/data/patches/` lacks.
  - `check-new-patch.yml`: cron `0 6 * * 2,3` (Tue/Wed mornings; patches ship Tue/Wed) → run script → if new: attempt `pnpm ingest <id>` → open/update PR via `peter-evans/create-pull-request@v6` with the JSON diff + coverage report in body → if ingestion fails (bot-block, parse failure), still open the PR with a checklist body telling the maintainer to run `pnpm ingest <id>` locally. Never auto-merges (no auto-merge config present).

- [ ] **Step 1:** Implement all three; unit-test `deriveNextPatchIds(existing: string[], versions: string[]): string[]` in the check script (exported pure function).
- [ ] **Step 2:** Validate workflow YAML (`npx action-validator` or careful review); run `tsx scripts/check-new-patch.ts` locally to confirm it reports no-new-patch against current data. Commit: `ci: build/test pipeline and patch-watch automation`

### Task 26: Open-source documentation

**Files:**
- Create: `README.md`, `docs/ARCHITECTURE.md`, `docs/DATA.md`, `CONTRIBUTING.md`, `LICENSE` (MIT), `public/humans.txt` (optional, skip if noise)

**Interfaces:**
- Produces:
  - `README.md` per spec §37: RIFTΔ hero (embed `logo-desktop-dark.png` — README renders on light GitHub bg), tagline, 2-sentence description, screenshot (from `docs/screenshots/`), `pnpm install / pnpm dev`, links to the three docs, Riot disclaimer, license.
  - `docs/ARCHITECTURE.md`: the spec §4 diagram + build flow + island inventory + why-static rationale.
  - `docs/DATA.md`: schema reference (generated from the TS types, kept in sync manually with a pointer to `schema.ts` as source of truth), classification methodology table (render `STAT_SEMANTICS` rules in prose), provenance guarantees, how overrides work.
  - `CONTRIBUTING.md`: fix-a-patch walkthrough (override file example correcting a classification), add-a-patch (`pnpm ingest`), run tests, PR expectations, roles.json corrections.

- [ ] **Step 1:** Write all files; every command in them actually run once to confirm it works as written.
- [ ] **Step 2:** Commit: `docs: readme, architecture, data, contributing, license`

### Task 27: Final verification and release readiness

**Files:**
- Modify: anything the review flags.

- [ ] **Step 1:** Invoke `superpowers:requesting-code-review` over the full diff; triage with `superpowers:receiving-code-review` discipline; fix accepted findings.
- [ ] **Step 2:** Invoke `superpowers:verification-before-completion`: run `pnpm check`, `pnpm test`, `pnpm build`, `pnpm e2e` — all green, outputs quoted, not asserted.
- [ ] **Step 3:** Lighthouse (Chrome, incognito, `pnpm preview`): product pages ≥ 90 all categories; homepage perf ≥ 85 with motion. Record scores in `docs/screenshots/lighthouse.md`. If under budget: fix, don't rationalize.
- [ ] **Step 4:** Spec §40 quality-bar walkthrough — answer each question in writing in the final report; the originality screenshot test included.
- [ ] **Step 5:** Cloudflare Pages deploy instructions verified present in README (build command `pnpm build`, output `dist`); final commit: `chore: release readiness verification`
