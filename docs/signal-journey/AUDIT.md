# RiftScry platform audit

Date: 30 October 2026. Baseline: `ce1ce5f` on `main`.

## Scope and finding

The audit covers the shared experience, every route entry, interaction density,
repeated work, and presentation-code reachability. RiftScry already had scene
switching, a destination map, animated scenery, view transitions, saved context,
and automatic player briefings. The underlying archive, player APIs, and local
storage provide useful capabilities worth retaining.

The main problem was composition and continuity. A visitor repeatedly encountered
headings, explanations, controls, and evidence cards inside differently styled
scenes. Multiple global style layers and earlier abandoned homepage renderers
made the experience harder to maintain. An atmospheric backdrop alone did not
make the evidence feel like a connected journey.

## Complete route inventory

The baseline contains 21 route entry files: 14 content/not-found surfaces,
three redirect entry points, and four JSON/API entry points.

| Route | Existing purpose | Role in the shared journey |
| --- | --- | --- |
| `/` | Observatory entrance and destinations | Begin with a real signal or resume remembered context |
| `/explore` | A champion's change, history, and kept findings | Inspect one exact change and carry it forward |
| `/next-game` | Automatic player briefing, patch impact, and loadout | Reveal the next useful focus from available records |
| `/players` | Player lookup and entry | Identify the player once and resume recorded games |
| `/players/[platform]/[puuid]` | Player profile and match history | Choose the game that supplies the evidence |
| `/matches/[id]` | Match review, builds, and evidence | Examine the source of a briefing or save a useful record |
| `/champions` | Searchable champion roster | Choose the subject of the investigation |
| `/champion/[slug]` | Exact archived champion history | Keep the subject in focus while moving through records |
| `/patches` | Patch timeline | Choose a recorded point in time |
| `/patch/[id]` | Champion, item, and system patch records | Focus on one affected subject with sources nearby |
| `/compare/[a]/[b]` | Changes across an explicit interval | Inspect the distance between two archive endpoints |
| `/pool` | Saved champions, archive progress, and findings | Return to retained subjects and findings |
| `/notebook` | Local notes and saved builds | Review deliberately saved material |
| `404` / unknown path | Recovery from a missing route | Offer a clear way back into the journey |
| `/patch`, `/compare`, `/compare/[a]` | Archive-aware redirects | Preserve familiar entry URLs and useful defaults |
| `/search-index.json` | Search data | Keep global search connected to real records |
| `/journey/roster.json`, `/journey/[id].json` | Roster and champion investigation data | Supply the same evidence model to interactive scenes |
| `/api/player/[action]` | Player, match, metadata, review, and impact service | Retain validated data access and existing rate-limit handling |

## Changes required across the platform

1. **Lead with evidence.** The opening interaction should reveal something real.
   The archive date and subject remain identifiable; an example is distinguishable
   from the visitor's own player history.
2. **Use a shared interaction grammar.** Choose a subject, reveal a signal,
   inspect its evidence, and retain what is useful. Every destination is an entry
   into that same loop.
3. **Reduce repeated work.** Remember valid selected context, reuse it in related
   routes, and choose sensible defaults from available records. Saving a finding,
   note, or build remains an explicit action.
4. **Make detail available on demand.** Primary scenes need one clear focal point
   and action. Sources, calculation detail, filters, and coverage explanations
   remain accessible without competing with the main task.
5. **Consolidate presentation.** A single authoritative shared shell replaces
   seven accumulated global experience layers. Route-specific data components
   and useful specialized styles remain separate where appropriate.
6. **Preserve navigation and recovery.** Direct URLs, browser Back, modified
   clicks, keyboard access, reduced motion, loading states, and unavailable-data
   states are part of the experience.

## Source and dependency cleanup

Reachability was checked recursively from all page entries, tests, ingestion
scripts, and configuration files. The audit included literal dynamic imports,
CSS imports, and tests reading source files, followed by searches for remaining
references. This check was repeated before removing superseded shell styles.

The cleanup removes:

- The unreachable `src/components/home` presentation tree, including old WebGL,
  React Three Fiber, GSAP, illustrated-story, and atlas variants.
- The unused `SiteHeader`, `TimelineEntry`, `RouteArrival`, and old `Wayfinder`
  components, plus orphaned scene scripts and style sheets. Once their
  replacements were connected, the old `ObservatoryHome` and `RiftNavigator`,
  `journey-readers.css`, `reader-experience.css`, `archive-timeline.css`, and
  `journey-companion.css` were removed after a fresh reference check. The old
  Explore CSS pair and the retired companion-home presentation, its child
  components, script and styles were removed after their last imports disappeared.
  The unused QuickNoteCapture component was also retired; active notebook
  and match capture flows remain in place.
- The seven superseded global layers: `experience.css`, `connected.css`,
  `observatory-pages.css`, `observatory-companion.css`, `living-rift.css`,
  `living-readers.css`, and `connected-observatory.css`.
- The old `journey-path` camera geometry helper, whose only runtime consumer was
  the retired 3D presentation.
- `@react-three/drei`, `@react-three/fiber`, `gsap`, `three`, and `@types/three`.
  `pnpm remove` updated the manifest and lockfile and pruned 54 installed packages.

Four unit suites were removed with the presentations they exclusively tested:
`cinematic-path`, `incision-state`, and `story-data` cover the retired camera/demo
scenes and their hardcoded data; `journey-path` covers collision clearance in the
retired 3D environment. Current archive, comparison, investigation, voyage,
briefing, API, storage, and player tests remain.

Active data/API helpers, current player/companion components, and their supporting
imports are retained. Historical documentation and review assets are retained as
provenance. Code already unreachable from live pages did not contribute to those
page bundles; this cleanup reduces repository and dependency maintenance surface.
Build size and runtime performance require their own measurements.

## Verification criteria

A complete check follows a real user across surfaces: enter or resume, select a
champion/player, reveal a change, inspect its source, retain a finding or build,
open it again, and use Back to restore context. Repeat the navigation on a small
touch viewport, with a keyboard, and with reduced motion. Empty results, partial
match samples, API failure, and unavailable artwork must still offer a useful
next action. Claims about champion strength or game outcomes must never be
manufactured from archive labels or a small match sample.

The home browser suites now exercise the three-act signal journey rather than
retired observatory selectors. They verify exact archived values and sources,
explicit saving, duplicate-save prevention, collection capacity, failed storage,
prior-subject continuation, player privacy, cross-tab updates, native Back,
cancelled document transitions, reduced motion, static/no-WebGL operation, and
no unsolicited audio. Fourteen viewport sizes permit scrolling inside the
active scene while checking reachable primary controls, inactive-panel isolation,
and a stationary document without horizontal overflow.

The visual-review case writes arrival, reveal, and carry screenshots to
`signal-visuals/`: desktop at 1440×900 and short landscape at 568×320, plus mobile
Chromium at 390×844. These are review artifacts produced when the browser suite
runs, not a substitute for inspecting the rendered result or testing on devices.
