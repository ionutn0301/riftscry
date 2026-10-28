# RiftScry design

## Player clarity follow-up — current presentation

The player experience now leads with recognizable League imagery and short,
plain labels. Preserve the cinematic environments and connected routes while
reducing repeated explanation between the player and their next action.

- Champion portraits identify the recent-game path, match rows, builds and saved
  adjustments. The existing official catalogue resolves artwork aliases and
  readable names; raw match, filter and saved-comparison identifiers stay intact.
  Failed images retain names, initials and a stable footprint.
- Every primary icon has a short visible label. Navigation says Matches, Builds
  and Build Memory. Controls retain keyboard access and accessible names that
  include their visible text. Icons are decorative, not unexplained navigation.
- The profile arrival is shorter. Repeated slogans and the promotional closing
  section are removed. A real selected-match link makes the portrait path useful.
- Per-mode tiles lead with match count, win rate, known-result denominator, KDA
  and champion portraits. Date ranges, mode context and secondary metrics remain
  available in native disclosures. A partial sample and actual failures remain
  visible; no combined all-mode performance score is introduced.
- Match review shows a useful takeaway immediately. The remaining full result,
  supporting evidence and methodology are optional disclosures. Requesting AI
  opens the result automatically and keeps its AI label visible. User-authored
  notes and generated findings are not arbitrarily shortened or discarded.
- Items use artwork alongside readable names where decisions are made. Concise
  match rows can use icons with accessible names; the match detail keeps readable
  inventory labels. Missing artwork falls back to text.
- Storage, condition confirmation, timing, mode eligibility, request caching and
  cooldown behavior are unchanged. The lighter presentation must not erase facts
  that explain a failed request or prevent a misleading comparison.

The player browser suite retains its thirty workflow scenarios and captures the
gateway, profile, builds, Memory and match-review layouts. Current rendered and
deployment evidence belongs in the pull request; discovery is not a browser pass.

## October 28 player experience amendment — current implementation

The player area extends the homepage's environment, typography and Rift map into
a useful loop: **find a player → enter their profile → inspect a recorded game →
keep an adjustment → return with later evidence**. It does not embed a full profile
under the lookup form or turn the records into a horizontal slide deck.

- `/players` is the search gateway. Its first-screen arrival uses the original
  RiftScry environment, a readable Riot ID/server instrument, and an optional
  browser-local remembered-player destination.
- `/players/:platform/:puuid` is a separate, bookmarkable profile. The account API
  resolves its displayed Riot identity; a query-string name is not proof of that
  identity. Old query-based profile links redirect to the canonical route.
- The profile arrival connects to a real chronology of imported games. Match
  history, personal builds and Build Memory have named controls and URL state.
  Game rows are normal links; match review returns to the same profile context.
  The gateway uses the return-basin environment; the profile uses history-strata
  so entering the recorded-match destination has its own setting. Detailed queue
  statistics belong to Match history. Builds and Memory lead to their own content
  while retaining import/error status, and Memory does not show unrelated history
  champion/result filters.
- The shared Rift map includes Players. The player gateway, profile and match
  review use a compact map control instead of the desktop archive navigation
  lane. Archive search is labeled separately from the Riot ID lookup.
- Named route transitions and restrained arrival motion connect these surfaces.
  Required controls and records remain available immediately. Reduced motion,
  keyboard operation, short screens and ordinary browser Back remain supported.

Recent history defaults to **all recent games**, with no upstream queue or type
filter. Exact mode selections request the exact Riot queue, rather than filtering
an already ranked-only sample. Imports remain bounded at 20 IDs in batches of four.
Failed or excluded records are reported explicitly; they never become losses.

Statistics, personal loadout groups and prospective Build Memory comparisons keep
actual queues separate. There is no all-mode performance average. ARAM, ARAM:
Mayhem, ranked Solo/Duo, ranked Flex, normal Draft, Swiftplay and Quickplay are
distinct contexts. ARAM and other non-lane modes do not inherit Summoner's Rift
lane, farming, vision or standard item advice. Current official rank is a separate
record. The queue catalogue source and capability rules live in
`src/lib/player/modes.ts`; sample calculations live in `stats.ts`.

New non-lane Build Memory notes store an explicit comparison context without
inventing a lane. Existing notes with unknown roles remain unknown. Same queue,
champion, patch, player and prospective time constraints still apply.

The current player refactor's validation is recorded in `docs/player-release.md`
and the pull request's checks. CI captures desktop, portrait and short-phone
screens into the `player-experience` artifact. Controlled fixture screenshots are
visual evidence; they are not proof of a successful live Riot lookup.

## Earlier October 28 connected-story amendment

`docs/CONNECTED_STORYBOARD.md` specifies the connected observation sequence.
`src/styles/connected.css` now shortens task-route arrivals, reserves a desktop
navigation lane, raises metadata readability, and replaces history/return
landscapes with quiet lit planes. Full-page route wipes are removed. The opening
example derives from a real record in the latest archived patch.

Findings persist across champions and intervals in a bounded device-local collection,
with removal/restoration in the briefing. Quiet intervals link to the champion’s
latest archived change without changing the selected dates. Champion pages expose
a direct pool-save control. Comparisons retain champion/pool context and endpoint
changes preserve query state. Numerical interpretation is conservative and exact.

At that checkpoint, production build, typecheck, and 241 unit/integration tests passed.
Rendered review is blocked by preview routing and missing Chromium system libraries;
see `docs/RELEASE_EVIDENCE.md`. The verification narrative below records the previous
refactor handoff and is historical, not the current check result. No new visual
baseline or motion sign-off is claimed.

## Current direction: a journey through a changing game

This is the active design contract for the complete October 2026 refactor. It
replaces the previous Delta Loom, viewport investigation, and spatial-history
homepage directions. Historical components and specs may remain in the repository;
they do not define the current experience.

RiftScry takes the visitor from an unfamiliar landscape to a useful understanding
of their own champions. The environment changes because the task changes: arrive,
choose a perspective, inspect a record, trace its history, and carry that knowledge
into a future visit. The evidence and the visitor's choices give the journey its
structure. Decorative movement alone does not satisfy this direction.

## Five connected chapters

The active homepage is `src/components/experience/HomeVoyage.astro`, with
`src/scripts/voyage.ts` and `src/styles/voyage.css`. It renders five real sections
in document order, with named chapter links and ordinary browser scrolling.

| Chapter | Visitor's purpose | Composition and interaction |
| --- | --- | --- |
| Arrival — `#arrival` | Understand the place and begin | A complete first-screen overlook, a large editorial title, an explicit entry action, and the newest **archived** patch and date. |
| Perspective — `#perspective` | Choose who matters | A full, uncropped champion artwork and a native roster dialog. Featured choices are shortcuts; every champion can supply the journey. |
| Change — `#change` | Read one change accurately | Exact before/after values or prose become the principal composition. A field selector, explicit “Keep this finding” action, date, ability, unit, and Riot source keep the scene useful. |
| History — `#history` | Put that record in context | A trail of records for the same field, an evidence-based reading of their connection, real interval controls, and routes to complete champion history and comparison. |
| Return — `#return` | Save a perspective and know what to do next | The findings explicitly kept in this journey, My Pool, an explicit reviewed baseline, reading resume, and a dated selection from the archive. |

The arrival fits a normal desktop or portrait-phone viewport. The **homepage as a
whole must scroll**. Later chapters may grow to fit exact rank arrays, prose,
history, or a personalized briefing. Short viewports and enlarged text must retain
reachable content. Do not restore a full-page `overflow: hidden` shell, a slide
deck, forced snap points, or a very tall pinned timeline that simulates sections.

## Visual world and asset roles

`src/styles/experience.css` supplies the current shared palette and display font
over the compatibility tokens used by older components:

- Ink `#081319`, pale paper `#e6ece5`, cyan `#8ed8d0`, and restrained brass `#c7a56d`.
- Clash Display for spatial headlines; General Sans for reading and controls.
- Quiet rules, open compositions, and generous changes of scale. Semantic buff,
  nerf, and adjustment labels retain text/glyphs as well as color.

Three original environmental illustrations establish distinct places:
`rift-overlook.webp`, `history-strata.webp`, and `return-basin.webp`. The opening
also has a separately composed portrait asset, `rift-overlook-mobile.webp`. Their
purpose, provenance, dimensions, and encoded sizes are recorded in
`public/images/voyage/README.md`. They are abstract RiftScry environments, not
official or canonical League locations.

Official champion icons, loading portraits, and splash art remain separate from
these environments. Full champion artwork uses `object-fit: contain`; mobile
uses the official portrait when available. Do not cut out a champion, mask away
their composition, reuse one identity for the whole roster, or put an opaque UI
panel across the artwork. Source records are real text, not baked into an image.
Asset provenance does not amount to a blanket legal clearance; Riot assets remain
subject to applicable Riot policies and an appropriate release review.

## Navigation and motion

`Wayfinder.astro` replaces the conventional destination navbar with a persistent
Rift map control. Its native dialog has six clearly named, ordinary links: the
journey, champions, patch archive, compare, My Pool, and Players. The current destination
is marked. On mobile the same destinations become a readable ordered path. Search,
the motion preference, the brand link, and the briefing shortcut remain direct
utilities. The map is an orientation device, not a puzzle users must solve.
Its labeled keyboard shortcut is Alt+M (Option+M on Mac), using the `KeyM` code
so Option's character mapping does not break it. Single letters remain available
to assistive input. Editable fields, composition, repeated keys, already-handled
events, and an open dialog keep the shortcut inactive.

`src/scripts/experience.ts` owns shared map behavior, focus return, named chapter
navigation, motion preference, and small reader-route enhancements. Native routes
remain bookmarkable and work with browser Back. Same-page links retain meaningful
fragments. Search is available from the controls, from the map, and with Cmd/Ctrl+K.

The homepage director changes the environmental framing and crossings around
the real sections. CSS cross-document view transitions connect route changes on
supporting browsers; unsupported browsers retain ordinary navigation. Do not delay
a click for an animation, block a record until a reveal completes, or make a
loading screen part of the story. `prefers-reduced-motion` and the visible motion
control preserve the same information and choices with motion reduced. No sound
or WebGL is required by the active presentation.

## All route families belong to the same experience

`RouteArrival.astro` and `reader-experience.css` provide a shared arrival, named
chapter links, and legible reading compositions. Each route has its own purpose:

| Route | Arrival and reading sequence |
| --- | --- |
| `/champions` | Roster overview → searchable/filterable complete roster → champion history. |
| `/champion/:slug` | Intact champion identity → exact dated records → archive context and a focused homepage interval. |
| `/patches` | Archive scope → chronological patch destinations with real totals and dates. |
| `/patch/:id` | Patch identity → personal perspective → champion records → available item, system, and hotfix chapters. |
| `/compare/:newer/:older` | Two endpoints → interval controls → champion classifications and linked item/system records. |
| `/pool` | Personal return → useful briefing → saved-champion editor. |
| `/players` | Riot ID/server search → verified identity → a separate player profile. |
| `/players/:platform/:puuid` | Player arrival → mode-separated recent sample → match history, personal builds and Build Memory. |
| `/matches/:id` | Recorded match context → evidence and timeline → an editable prospective adjustment → return to the profile. |
| Missing route | A clear recovery arrival with real destinations. |

Presentation changes must preserve existing patch filter selectors and URL state,
comparison logic, timeline disclosures, source links, shared-pool URLs, and the
`riftscry:pool` storage contract. The champion directory is server-rendered and
enhanced by a small search/role script; it does not hydrate the full archive in a
React homepage. `[data-scene]` and `[data-reveal]` are enhancement hooks, never
permission to hide required content by default.

## Data and performance boundaries

`src/lib/voyage-data.ts` builds compact champion models. Static endpoints
`/journey/roster.json` and `/journey/:canonicalId.json` support every champion in
the committed roster (173 at this refactor). The browser starts with one embedded
model and requests another champion as needed. Importing the full archive into
the homepage client is outside this contract.

Kept findings travel in `seen=` as validated record IDs and survive direct links,
reload, and browser Back. Legacy `beat=` chapters, `patch=` ending dates, and
champion display names resolve into the current journey. A geometric focus
effect must never be the unexplained prerequisite for collecting a finding.

The exact recorded strings, including rank arrays, scaling, conditions, units,
and prose, are authoritative. An interval is `(older, newer]`: the starting patch
is excluded and the ending patch is included. Do not turn classifications into a
strength score, add unrelated changes into one percentage, or infer “unchanged in
the game” from an absence of direct records. A missing image or a failed champion
request must leave a readable state and a useful next action.

Prioritize the opening image, defer later environments, and use responsive assets
without loading both opening compositions. React remains for bounded product
islands such as the palette, pool controls, and return briefing. Treat performance
budgets as release criteria that need measurement, not as proof supplied by the
architecture or the word “static.”

## Historical refactor verification and ongoing acceptance criteria

At the initial refactor handoff, dependency installation was rejected by
automatic approval review, so the Astro build, type check,
Playwright suite, browser rendering, performance, and visual quality have **not
been verified** here. Static parsing and diff checks are narrower checks; they
must not be reported as a successful build or a premium-experience sign-off.

The active regression sources now cover these contracts:

| Test file | Scope |
| --- | --- |
| `tests/e2e/voyage.spec.ts` | Five real chapters, first-screen/document bounds, canonical model loading, URL/Back/reload, complete roster, exact numeric/prose evidence, interval boundaries, request retry, map/search, and every reading route. |
| `tests/e2e/keyboard.spec.ts` | Skip link, keyboard-only champion choice/evidence/save/history, dialog dismissal/focus return, the Alt+M / Option+M map shortcut without intercepting single letters or form input, and native-dialog-to-palette handoff. |
| `tests/e2e/spatial-history.spec.ts` | The retained filename now protects artwork failure, normalized direct URLs, unknown/invalid states, reduced motion, and short-view controls. It no longer asserts the removed viewport-only UI. |
| `tests/e2e/core-flow.spec.ts` | Existing pool persistence/sharing, patch filters, compare results, and champion timelines, now through ordinary routes without a presentation-mode query. |

These migrations preserve product and accessibility goals instead of ignoring
the old failures. `playwright.config.ts` keeps the earlier historical presentation
exclusions; its explanatory comment now names the active presentation.
`visual.spec.ts` still has old Windows-specific baselines and requires new,
visually reviewed captures after the design can actually render. No replacement
baseline has been fabricated. All new and migrated tests remain unexecuted in
this session; the combined suite must not be described as passing.

Release review must inspect the actual five-chapter transitions and reader-route
arrivals at 1440×900, 1280×720, and 390×844, plus short landscape and enlarged text.
Check keyboard focus, native dialog dismissal, complete artwork, exact long
records, invalid/quiet intervals, direct URLs, Back, local-storage failures,
missing imagery, and the reduced-motion path. A screenshot or a green build alone
does not establish that the journey is coherent, intuitive, or cinematic.
