# Contributing to RiftScry

Thanks for helping keep the ledger accurate. The most valuable contributions are small
data corrections — they ship as JSON, no app code required.

## Setup

```bash
pnpm install
pnpm dev        # http://localhost:4321
pnpm test       # unit tests + validation of all committed patch data
```

Node ≥ 22, pnpm 11.

## Fix a wrong classification (the 5-line PR)

Say patch 26.17 marks Ahri as a `nerf` but it's really a `rework`. Create (or extend)
`src/data/overrides/26.17.json`:

```json
{
  "classificationOverrides": { "Ahri": "rework" }
}
```

Then regenerate that patch and validate:

```bash
pnpm ingest 26.17
pnpm test
```

Commit both the override and the regenerated `src/data/patches/26.17.json`. Overrides
support `removeChampions`, `replaceChampions`, `addChampions`, `classificationOverrides`,
and `addHotfixes` — see `scripts/patch-ingestion/normalize.ts` for exact shapes.

## Add a hotfix marker

```json
{
  "addHotfixes": [
    { "date": "2026-08-13", "description": "Azir Q damage hotfixed to 70/90/110/130/150.", "championIds": ["Azir"] }
  ]
}
```

## Ingest a new patch

```bash
pnpm ingest 26.17     # or several ids, or --all for the whole season
```

Read the coverage report the CLI prints. **Unknown labels** are classified neutral —
if a label is clearly directional (e.g. a new stat), add a pattern to `STAT_SEMANTICS`
in `scripts/patch-ingestion/classify.ts` *with a unit test* in
`tests/unit/classify.test.ts`. **Unparsed blocks** mean real change lines were dropped:
fix the parser with a fixture-backed test, or author the data via an override.

## Correct the role mapping

`src/data/roles.json` is a curated champion → positions map (labeled as such in the UI).
Edit it directly; `pnpm test` checks coverage and validity.

## Before you open a PR

```bash
pnpm check      # typecheck
pnpm test       # unit + data validation
pnpm build      # static build must succeed
pnpm e2e        # Playwright (run pnpm build first)
```

App-code PRs: follow the existing component patterns, keep semantic buff/nerf colors
paired with glyphs and labels (never color alone), and don't add runtime dependencies
for problems the platform already solves. For anything visual, include before/after
screenshots (desktop + 390px mobile).

## What we won't merge

Accounts/backends/analytics, republished Riot prose, opaque "impact scores", or
imitations of Riot's client UI. See `docs/DATA.md` for the methodology those rules
protect.
