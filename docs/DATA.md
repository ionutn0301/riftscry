# Data & methodology

## Normalized patch schema

One file per patch: `src/data/patches/<id>.json`, validated by the Zod schema in
[`src/lib/schema.ts`](../src/lib/schema.ts) — the single source of truth (this document
describes it; the code defines it). Malformed data fails the build.

```jsonc
{
  "schemaVersion": 1,
  "id": "26.16",              // player-facing patch id — canonical everywhere
  "assetVersion": "16.16.1",  // Data Dragon version for champion imagery
  "releaseDate": "2026-08-11",
  "sourceUrl": "https://www.leagueoflegends.com/…/league-of-legends-patch-26-16-notes/",
  "ingestedAt": "…",          // provenance timestamp
  "champions": [
    {
      "championId": "Azir",          // ddragon id
      "classification": "buff",      // buff | nerf | adjustment | rework
      "summary": "…Riot's own context line…",
      "abilities": [
        {
          "ability": "Q",            // base | passive | Q | W | E | R | other
          "name": "Conquering Sands",
          "changes": [
            { "kind": "numeric", "label": "Damage",
              "before": "60 / 80 / 100 / 120 / 140 (+35 / 40 / 45 / 50 / 55% AP)",
              "after":  "75 / 95 / 115 / 135 / 155 (+35 / 40 / 45 / 50 / 55% AP)",
              "direction": "buff" }
          ]
        }
      ]
    }
  ],
  "items": [ /* same shape, flat changes */ ],
  "systems": [ /* runes, summoner spells, SR system changes */ ],
  "hotfixes": [ /* optional, curated via overrides */ ]
}
```

`before`/`after` keep Riot's verbatim value strings — rank arrays are the domain's
native shape. The relative-delta chip shown in the UI is derived from the first rank
value (`src/lib/deltas.ts`).

## Classification: deterministic, no scores

Every numeric change gets a direction from a stat-semantics table
(`scripts/patch-ingestion/classify.ts`): each label pattern maps to a polarity — whether
an increase helps the champion.

| Label family (examples) | Increase means |
|---|---|
| cooldown, recharge, cost, cast time, delay, channel, price | worse → up = **nerf**, down = **buff** |
| damage, ratios, AD/AP, healing, shields, movement/attack speed, range, durations, crowd-control numbers, resists, health, regen, crit, lifesteal/vamp, haste, tenacity, penetration… | better → up = **buff**, down = **nerf** |
| anything unrecognized | **neutral** + a build warning listing the label |

Rules that keep it honest:

- **First-rank comparison.** `20/25/30% ⇒ 20/23/26%` where rank 1 is unchanged reads as
  *neutral* — the full values are always displayed, so nothing is hidden.
- **Champion rollup:** all buffs → `buff`; all nerfs → `nerf`; anything mixed (or all
  neutral) → `adjustment`. `rework` is never inferred — only set by an override.
- **No opaque impact scores.** If RiftScry shows a judgment, you can recompute it from
  this table and the visible numbers.

## Overrides

`src/data/overrides/<id>.json` merges over parser output during normalization
(`removeChampions → replaceChampions → addChampions → classificationOverrides →
addHotfixes`). A wrong classification or a missed change is a small data PR — never a
parser patch. See [CONTRIBUTING.md](../CONTRIBUTING.md) for a worked example.

## Hotfix markers

The schema, override path (`addHotfixes`), and patch-page UI all support mid-patch
hotfix entries, but **no hotfixes are curated yet**: RiftScry only records data it can
trace to a source, and Riot does not publish hotfixes in the patch-notes pages this
pipeline ingests. Adding one is a five-line override PR with the source in the
description — see [CONTRIBUTING.md](../CONTRIBUTING.md).

## Provenance guarantees

- Every patch file records its official `sourceUrl`, `releaseDate`, and `ingestedAt`.
- Raw Riot HTML is cached locally (`.cache/`, gitignored) and never committed — only
  concise summaries and numeric structures are republished, with a link to the source.
- The dataset's entire history is the git history of `src/data/`.

## Supporting data

- `src/data/champions.json` — ddragon identity snapshot (id, name, title, assetVersion).
- `src/data/roles.json` — **curated** champion→position mapping, labeled as such in the
  UI. Deterministic and hand-maintained; no fake statistical precision. Corrections
  welcome via PR.
