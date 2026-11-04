# Player-first homepage

Implemented 4 November 2026. This iteration preserves RiftScry's League artwork and optional cinematic interactions while making player tasks and personal relevance the first things to understand. The release PR records the tested revision, CI evidence, preview review and production deployment.

## Research translated into product decisions

These are design choices informed by primary guidance, not a claim that heuristics guarantee customer attention or that the whole application has a WCAG certification.

| Principle and primary source | Implementation | Verification |
| --- | --- | --- |
| [Nielsen Norman Group: ten usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/), especially familiar language, recognition, status, consistency and minimalist design | Task-led headline; one visually dominant briefing action; a named game-review action replaces the patch-number exit; champion-specific catch-up; recent-game counts explain personal cards | Guest and account browser journeys, responsive captures, native links |
| [NN/G: progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/) | Keep the detailed archive, source records and secondary destinations available through existing inspection/navigation; no new onboarding modal or additional dashboard of metrics | Inspection, menu, Back/Forward and no-JavaScript regressions |
| [W3C: target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | Primary actions and champion choices target at least 44 CSS pixels, above the AA minimum; clear spacing on narrow phones | Measured bounds and hit testing at 320, 390 and 1440 pixels |
| [W3C: focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) | Keep native links, focus outlines, modal focus return, and a small-viewport reflow escape | Keyboard/Escape/Back tests and responsive layout checks |
| [Riot: Data Dragon](https://developer.riotgames.com/docs/lol#data-dragon) | Canonical IDs resolve official base artwork for every catalog champion; missing art preserves identity and navigation | Catalog coverage tests and the actual-download artwork audit |

## Personalization contract

- Only a signed-in account's explicitly associated Riot ID selects personal champion cards. Guest history and another player viewed in the player browser do not become that account's top champions.
- Fetch the existing bounded, unfiltered recent history (at most 20 IDs) and match details, four at a time through the shared request cache and Riot cooldown controls. Do not request timelines, AI, rank or item data for this feature.
- Count supported public matchmade games once per match, for the selected participant and a known canonical champion. Combine case variants, sort by game count, then latest appearance, then ID. This is **most played in the recent loaded sample**, not lifetime play, mastery, win rate or a recommendation of strength.
- Show the real sample size, unavailable records and exclusions. Fewer than three observed champions stays fewer than three. No supported results or a service error retains explicitly featured examples. Loading, retry and association actions remain available.
- Late responses cannot overwrite a changed account/association. Guest accounts issue no player requests. No new personal record, database schema, authentication behavior or runtime dependency is introduced.
- The briefing carries the selected champion for a signed-in returning player. Review opens the latest supported loaded game; other visitors enter the existing game lookup/history. Catch-up carries the visible champion.

## Artwork coverage

All 173 catalog champions resolve their own full official splash illustration in the same cinematic presentation, including direct `/?signal=CanonicalId` links and champion-page previews. The full catalog is fetched only for personalization or an explicit non-featured champion URL; image loading remains limited to selected/visible art.

Akali, Yasuo and Thresh retain their approved transparent foreground figures. Other champions use full illustrations, not fabricated cutouts. Consistency here means equivalent champion-specific scenes, typography, actions, selection and fallback behavior. A verified complete official transparent-figure collection is still unavailable; see the earlier [asset research](../rift-cinema/ASSET-COVERAGE.md).

[artwork-audit.json](artwork-audit.json) records successful download and image decoding for all 173 official splash URLs, with dimensions, size and SHA-256. Run `node scripts/verify-home-artwork.mjs` to refresh it deliberately; normal CI does not depend on external artwork availability. Numeric, prose-only and absent archive evidence are separate states.

## Release checks

Run `pnpm check`, `pnpm test`, `pnpm build`, the existing route/learning verification scripts and asset budgets. CI exercises desktop Chromium, phone Chromium/WebKit, account isolation, guest paths, rate/error recovery, native links, reading continuity and screenshots. Account-specific new cases are also included in the fast account-profile job. Download and inspect homepage/account captures before merging; do not equate successful screenshot generation with visual approval.

Follow-up product validation: observe players finding their champion and entering a briefing/review, record task completion and confusion, and compare repeat usefulness. This release does not claim measured retention gains or perfect usability.
