# RiftScry design

## October 28 amendment — current implementation

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

Current checks: production build, typecheck, and 241 unit/integration tests passed.
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
Rift map control. Its native dialog has five clearly named, ordinary links: the
journey, champions, patch archive, compare, and My Pool. The current destination
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

## Verification status and acceptance

The refactor is implemented in source. Dependency installation was rejected by
automatic approval review in this session, so the Astro build, type check,
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
