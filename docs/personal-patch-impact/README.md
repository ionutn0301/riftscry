# Personal patch impact

Implemented 2026-10-29. Entry point: `/next-game#impact`.

## What a player does

Enter a Riot ID and server once, or open the remembered player's briefing. RiftScry
imports available games and selects a recent champion and exact queue. The impact
panel takes that context's latest imported final inventory and compares its recorded
patch with the latest committed archive patch. The player can inspect another
imported champion/queue with a single button; there is no build editor or notebook step.

The panel presents source game, compared patches, changed numerical components,
before/after values and formulas. Large figures and a short decorative scan support
the presentation. All content stays in normal document flow. Context controls wrap,
evidence expands inline, and both OS and application reduced-motion settings disable
decorative animation and transitions.

## Supported calculations

| Calculation | Inputs | Interpretation |
|---|---|---|
| Same-inventory total shop price | Exact item IDs and quantities, old/new `gold.total`, purchasability | Price of buying that same inventory at each reference version; not paid gold, sale cost or a purchase path |
| Listed flat item AP, AD, health, mana, armor and MR | Exact old/new item `stats` | Sum of listed flat item contributions; excludes passives, stacks, conversions and champion totals |
| Listed item ability haste | One complete, strictly parsed Data Dragon `<stats>` block per item | General listed item haste; excludes temporary, conditional and ultimate-only sources |
| Reviewed base-damage component | Supported literal base values from a reviewed champion ability | Documented component at explicitly shown reference ranks, before other scaling and mitigation |
| Reviewed AP damage contribution | Supported AP ratio and the recorded inventory's listed AP at each endpoint | The AP component only; not total spell, combo or dealt damage |
| Reviewed cooldown reference | Supported base cooldown and listed item haste when available | `base × 100 / (100 + listed haste)` at explicit reference ranks; otherwise documented base cooldown with that limitation visible |

Only changed values become metric cards. All ranks available to the reviewed mechanic
remain inspectable; the headline rank is explicitly identified. Match skill ranks are
not guessed. A base component may remain useful when a more specific item scenario
cannot be calculated, and the report marks that coverage partial.

The model's reviewed mechanic keys are in `src/lib/player/patch-impact.ts`. Adding a
key requires inspecting its mechanic and source shape, not merely matching a label
such as “Damage.” An unreviewed key stays outside calculation coverage.

## Boundaries

- Baselines are the latest **imported** match for a champion/queue, within the bounded
  recent sample. This is not a complete lifetime history.
- Calculations currently require the existing `standardItems` mode guard. ARAM,
  Mayhem, Arena, Swiftplay, other modified modes and contradictory mode/map records
  retain their patch catch-up but receive an explicit unsupported calculation state.
- Final inventory slots 0–5 supply exact IDs and quantities. The trinket is excluded.
  Missing or invalid items withhold the affected complete totals. Item names and
  alternate-mode numeric suffixes never establish equivalence.
- All endpoint item versions are pinned to the committed archive's `assetVersion`.
  The service does not silently choose newer Data Dragon revisions. The existing
  match-item display API still uses its separate compatible-version resolver.
- Runes, temporary effects, passives, stacks, item amplifiers, champion stat conversion,
  target defenses, movement and real fight outcomes are not reconstructed.
- Item shop availability is checked separately from stat availability. Transformed
  or non-purchasable items can prevent a total shop-price comparison.
- Champion changes must form a contiguous, consistent chronological chain. Gaps,
  reworks, relevant prose changes, conflicting numeric labels and formula ambiguity
  withhold that ability calculation. Reversals correctly produce zero net difference.
- “No supported numerical difference” is not “this patch has no effect.” Unsupported
  changes and partial references remain disclosed. Reference failures have an explicit
  retry action and never masquerade as zero impact.
- Patch-level references can differ from mid-patch updates. The report is an explained
  calculation, not a recommendation to repeat the build or a prediction of game outcome.

### An actual source disagreement

For Darius Q in patch 26.21, Riot's notes and Data Dragon disagree at intermediate
ranks. Only their matching rank-5 change (5 seconds to 4 seconds before haste) is
shown. The report marks this partial and links both sources:

- [Riot patch 26.21](https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-21-notes/)
- [Riot Darius reference 16.21.1](https://ddragon.leagueoflegends.com/cdn/16.21.1/data/en_US/champion/Darius.json)
- [Riot's ability-haste introduction](https://www.leagueoflegends.com/en-us/news/game-updates/patch-10-23-notes/)

## Homepage reference example

`src/data/impact-example.json` contains the two public item records copied from
Riot's exact 16.20.1 and 16.21.1 references, checked on 2026-10-29. The homepage runs
the production engine using Orianna and these items, explicitly labeled a reference
scenario rather than a player's match:

- Hextech Rocketbelt (3152): 60 listed AP.
- Horizon Focus (4628): 75 listed AP.
- Listed AP total: 135 at both endpoints.
- Q AP component: `135 × 55% = 74.25` to `135 × 60% = 81`, a difference of 6.75.
- W AP component: `135 × 80% = 108` to `135 × 85% = 114.75`, a difference of 6.75.

These components are not summed into a hypothetical fight or full combo. The example
remains pinned to its stated patches even after the archive grows. It is rendered at
build time, adds no client island, and makes no player API requests.

Sources:

- [Riot item reference 16.20.1](https://ddragon.leagueoflegends.com/cdn/16.20.1/data/en_US/item.json)
- [Riot item reference 16.21.1](https://ddragon.leagueoflegends.com/cdn/16.21.1/data/en_US/item.json)
- [Riot patch 26.21](https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-21-notes/)

## Request and cache behavior

`GET /api/player/impact?platform=…&puuid=…&id=…` uses the existing Riot access gate,
identifier validation, player-in-match guard, shared Riot budget and cached match
retrieval. Only the currently selected context requests an impact report. Context
keys include platform, PUUID, match ID and game version; mismatched responses are
rejected, and old responses cannot replace a newly selected context.

Exact public item references are cached for 24 hours by version. The impact request
does not request a timeline, profile, ranks, account ownership or AI review. Both
reference fetches can complete independently; a failure produces a partial report
and retry control. Unknown, current and unsupported contexts skip item-reference work.
No new credentials, database schema or environment variables are required.

## Verification

The change adds independent numerical reference tests, multi-patch reversals and
conflicts, missing references, item quantities/identity, modes, patch resolution,
formula ambiguity and source provenance. API tests exercise access, identifiers,
player membership, private responses and budget propagation. Service tests verify
exact pinned endpoints, independent failures and skipped work.

Browser tests cover automatic loading, exact displayed values, sources, keyboard
selection, stale/error states, source mismatch, empty and partial coverage, retry,
mobile geometry and both motion preferences across Chromium and iPhone WebKit.
The existing homepage and automatic briefing suites remain part of the release gate.

```sh
pnpm check
pnpm test
pnpm build
pnpm exec playwright test tests/e2e/personal-patch-impact.spec.ts
pnpm exec playwright test tests/e2e/automatic-briefing.spec.ts tests/e2e/companion-home.spec.ts
```

GitHub CI additionally runs the complete player and shared browser matrices before
merge. The existing Vercel Git integration builds the merged main commit.

### Local release results

- Typecheck: 259 files, zero errors or warnings; two pre-existing hints.
- Unit and integration tests: 510 passing across 51 files.
- Production build: passed.
- Existing homepage + automatic briefing + new impact browser checks: 123 passing
  across desktop Chromium, mobile Chromium and iPhone WebKit, with no retries.
- After final grid/icon refinements: all 45 impact browser checks passed again.
- Visual inspection at 320, 390 and 1440 pixels: no horizontal overflow or page errors.

The local Chromium fallback was version 141 because the default CDN returned an
invalid download; the repository's Playwright version and CI configuration were
unchanged. WebKit used the configured runtime.

Screenshots use isolated browser fixtures and the verified Orianna reference setup,
not a real player account. Dynamic champion/item art may use its designed text
fallback when the external image host is unavailable. The fixed homepage example
serves its three original Riot icons locally.

- [Homepage example, desktop](screenshots/home-impact-1440.png)
- [Personal comparison, desktop](screenshots/personal-impact-1440.png)
- [Personal comparison, mobile](screenshots/personal-impact-390.png)
