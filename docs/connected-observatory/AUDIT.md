# Connected observatory: platform audit

Audit date: 30 October 2026. Source baseline: `36d3f7c4fc63513124a8ac7e8a3ea6038b612efb`.

This audit covers the active public and player-facing route families. It is a source audit, not a claim that live Riot APIs or protected production browsing were exercised. The redesign work and its verification are documented separately.

## Why the prior experience still felt like a website to read

The custom Rift environment was shared, but the primary interaction remained scrolling a document. The homepage stacked arrival, signal, impact, next-move cards, and an epilogue. `/explore` repeated a five-chapter introduction. Archive pages usually rendered a hero, a chapter rail, vertical reading sections, and another destination teaser.

The graphics supplied atmosphere without changing how visitors reached useful evidence. Several routes repeated instructions to choose, read, save, and return. The same user could encounter three different concepts called a briefing: an automatic match report, a saved-champion archive baseline, and a manual game-card workflow.

The implementation direction is one connected observatory with five global stations: **Briefing, Games, Champions, Patches, Saved**. A station starts with its actual task. Local scene choices replace the long sequence of sections; long records and lists have their own natural scrolling area. Direct URLs, source links, keyboard controls, and no-JavaScript archive access remain part of the design.

## Complete route inventory

| Route family | Actual task | Prior friction | Refactor direction |
| --- | --- | --- | --- |
| `/` | Entry, archive example, returning-player continuation | Five vertical sections and repeated destination choices | One entry scene leading into the shared station navigator |
| `/explore` | Champion selection, exact record inspection, period history | Five scroll chapters, repeated save instructions | One champion/evidence stage with local scene changes |
| `/players` | Riot ID and region lookup; remembered player | Additional destination choice before lookup | Compact entry with remembered continuation |
| `/players/[platform]/[puuid]` | Match history, builds, optional Build Memory | Header, ranks, navigation, filters, sample summary and long list | Focused player station using existing real view/filter state |
| `/matches/[id]` | Match facts, review, optional timeline and AI review | Several competing vertical sections | Local overview/review/evidence scenes |
| `/next-game` | Automatic session/focus/patch impact/loadout | Feature explanation and stacked report sections | Automatic briefing with one useful focus first |
| `/notebook` | Optional notes, saved loadouts, game cards and reflections | Champion/mode/situation setup, note/build choice, card creation and later reflection | Saved records first; preparation tools remain optional |
| `/champions` | Search, role filter, preview, champion history | Separate opening and roster, duplicated preview | One casting wall and responsive focal artwork |
| `/champion/[slug]` | Exact historical champion changes | Hero followed by entire timeline | Date selection replaces the exact record in one stage |
| `/patches` | Choose dated patch and inspect counts | Opening instrument and separate full chronology | Instrument and dated choices in one station |
| `/patch/[id]` | Filter and inspect champions/items/systems/hotfixes | Several consecutive long chapters | Champion record selection; item/system scenes |
| `/compare/[a]/[b]` | Endpoint selection and source-classification trails | Read-comparison jump, long grouped rows | Persistent endpoints and category scenes |
| `/pool` | Saved champions, findings, reviewed baseline, edits | Hero, saved report, complete picker and teaser | Saved records and champion-selection scenes |
| Missing routes / `/404` | Navigation recovery | Separate recovery hero | Shared environment with immediate recovery controls |

`/patch`, `/compare`, and `/compare/[a]` remain shortcut redirects.

## Reader-route implementation scope

The reader implementation changes the champion directory, champion detail, patch directory, patch detail, comparison, saved-pool, and 404 routes, plus `src/styles/journey-readers.css`. Each uses the shared `data-journey-deck` / `data-journey-panel` contract. It removes redundant arrival-only sections and preserves the original task/data components where practical.

Champion histories select one exact patch record after enhancement. Patch champion selection follows native record hashes and the existing filter island. Directory art remains official Riot artwork displayed without cropping. The patch instrument still positions real dates and counts actual listed records; it is not an impact score.

The saved station separates champion records, kept findings, and champion selection into three scenes. Saved champion histories are visible immediately; the reviewed-patch baseline is an optional Archive progress disclosure. Its explicit write action and storage behavior are preserved. Patch filters keep search and active-filter status visible, while role/type/pool options open on demand. Riot’s narrative context remains available beside the exact numeric and prose records through native disclosures.

## Simplification rules

- Call the imported report **Briefing**, the archive selection **Saved champions**, and the manual record collection **Notebook**.
- Promote the existing automatic briefing; it already derives champions, loadouts, session groups, and supported observations from match records.
- Keep note writing, pool editing, reviewed-baseline updates, saved findings, and game-card reflections optional.
- Remove repeated instructional prose when an understandable control and its visible result explain the action.
- Keep source coverage, conditions, unknown states, and method limitations accessible beside the evidence or in an explicit disclosure.
- Do not infer a patch was reviewed merely because its page was opened.
- Do not auto-save a champion, finding, notebook card, or reflection on behalf of the visitor.

## Required behavior preservation

### Data and requests

Exact source values, units, conditions and links remain intact. Archive coverage is not presented as the live patch. Comparisons exclude the starting patch and include the ending patch. Classifications do not claim current champion strength.

Player identity, region, exact queue and mode context remain authoritative. Available match samples stay bounded and partial. Unknown patch baselines and unsupported item calculations remain unknown. Mayhem history unavailability does not silently substitute ordinary ARAM.

AI review and timeline requests remain explicit user actions. Existing request budgets, caches, cooldowns, API error states, private/no-store player responses and noindex headers are outside this visual refactor.

### Navigation and persistence

Preserve direct links, record hashes, query filters, comparison endpoints, and browser Back/Forward. Player-to-match return links retain selected filters. Existing pool, findings, reviewed baseline, reading resume, notebook data, storage-failure behavior, cross-tab reconciliation and backup/conflict controls remain valid.

### Interaction

Navigation and selection must work with keyboard and touch. Scene changes respect reduced-motion preferences. Inactive panels cannot retain tab stops. Directly linked evidence reveals its containing scene. Escape returns from overlays to their opener. No-JavaScript archive content remains available. Natural scrolling inside a roster or detailed record must not unexpectedly move to a different destination.

## Source evidence reviewed

- `src/layouts/Layout.astro`, `src/components/experience/Wayfinder.astro`
- `src/components/companion/CompanionHome.astro`, `src/components/experience/HomeVoyage.astro`
- All route files listed in the inventory
- `AutomaticBriefing.tsx`, `PatchImpact.tsx` integration, `NextGame.tsx`, `PersonalBriefing.tsx`
- Player gateway/profile/history/build/review components and their existing data hooks
- `PatchFilterBar.tsx`, `PoolStrip.tsx`, `ComparePicker.tsx`, `TimelineEntry.astro`, `ChangeCard.astro`
- Reader preview, comparison context and persistent state modules
- Repository README, architecture references, and contribution requirements
