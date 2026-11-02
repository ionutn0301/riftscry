# RiftScry design

## Current direction: the Rift atlas platform and Rift Cinema entrance

This contract retains the platform design from the 31 October 2026 refactor
and the motion and return-path refinement of 1 November 2026. The homepage
revision of 2 November 2026 introduces a single full-screen League world,
documented in the [Rift Cinema record](docs/rift-cinema/README.md). It supersedes
the same day's four-scene relief-instrument homepage after the user rejected
that direction as too static and insufficiently recognizable as League.
The [atlas audit](docs/rift-atlas/AUDIT.md) records the earlier platform change,
which superseded scrolling-homepage, observatory, and disconnected player
presentation amendments. See the [platform audit](docs/signal-journey/AUDIT.md)
and [research](docs/signal-journey/RESEARCH.md) for that rationale, and
[PRODUCT.md](PRODUCT.md) for evidence, queue, privacy, and storage contracts.

The platform's organizing idea is a connected world in the space between games. The Beacon
(briefing), Echoes (games), Archive (champions), Fracture (patches), and Sanctuary
(saved material) are places on one atlas. A persistent route path and shared
spatial map supply a stable geography across routes. The map menu uses one
perspective-projected Rift with five authored camera positions.
Drag, wheel, keyboard and a native range move the same object continuously;
all five destinations also remain ordinary links. Camera work is optional and
reduced motion selects the destination immediately. Destination type unfolds in
masked words; the same camera position drives a closed, morphing aperture.
Spline interpolation keeps tangents continuous between stations, while pointer
lean and travel streaks provide depth. Rendering stops at rest. Shared chapter
headings use a finite depth reveal without modifying React-owned text nodes.
Kinetic text retains one complete accessible heading and preserves authored
emphasis; reduced motion removes these animations.

The homepage brings the remembered briefing and exact public reading place
forward without making another lookup or storing new work. Within each place: where the visitor left off,
what changed, and what they take forward. A champion, player, recorded match, or
patch pair gives the scene a subject. **Choose → reveal → inspect → keep** is the
shared interaction grammar. The important moment is an understandable change or
useful recorded fact; scenery and movement frame that moment.

## Reader shell and homepage entrance

On application reader routes, the desktop header offers Discover, My game, and Saved. Mobile uses a compact
header, the five-place path and a full-screen Rift instrument. The map provides direct links to
the five established destinations, with comparison, exploration, and notebook
shortcuts. A lower continuation link follows the selected archive subject or
player; named scene tabs and previous/next controls belong to the active route.
No destination requires completing the homepage first.

After enhancement, the reader shell fits the viewport and exposes one active scene.
Long evidence grows in the document; the page has one vertical scroll and no nested reading panels. Hidden scenes are
inert and removed from the focus order. Headers and route controls stay reachable;
short screens must not hide the action or create a second document-sized page
inside the shell. Ordinary document flow and source records remain the archive
fallback without JavaScript.

The homepage has a dedicated immersive composition in the shared layout. It
replaces the reader header, route path and scene tabs with a compact brand row,
champion selection, direct briefing/archive actions, and a navigation dialog.
The world stays in one non-scrolling viewport. Its evidence dialog provides a
scrollable reading area when the exact record needs more space.

URL queries and fragments carry actual subject, scope, and scene state. Direct
links, reload, modified clicks, and Back/Forward remain native browser behaviors.
A transition expresses navigation after the selection is committed; it must not
delay a request, block a record, or require an animation to finish.

## The opening and its continuations

The homepage is `RiftCinema.astro`. Akali is visible on arrival against official
painted Summoner's Rift scenery. Yasuo and Thresh offer alternate perspectives
within the same world. Pointer movement or touch dragging adjusts the camera;
ordinary champion links provide selection without requiring either gesture.
There is no sequence of homepage sections or scroll-driven chapters.

Choosing a champion changes the actual record as well as artwork, identity,
palette and atmosphere. “Scry this champion” and the ability hotspot open an
evidence dialog while the camera reframes the subject. Exact before/after values,
patch and source remain readable HTML; keeping a finding is explicit. The full
record, saved findings, briefing, latest archived patch and other application
destinations remain ordinary links. Selection and inspection have URL state and
browser-history behavior.

Champion artwork consists of transparent two-dimensional planes, not rigged 3D
models. The decorative world is not live telemetry or an assertion about match
geography. A static artwork composition remains available if WebGL cannot start;
without JavaScript, champion and inspection links open their exact records.

The homepage does not fetch player records. A validated remembered player
personalizes its briefing link; public archive context can offer a continuation.
Neither behavior invents a personal result from the archive example.

`/explore` continues through the selected change, its history, and the return
scene. It retains the existing canonical champion model, field and interval
controls, exact records, and URL compatibility. Full champion, patch, and
comparison routes are alternate entry points into the same evidence.

## A record as an interaction

`SignalRecord.astro` is the shared record presentation. The selected field is
prominent, before/after strings are real text, and a source link stays nearby.
A native range input and Before/After buttons change visual emphasis; they do
not interpolate a stat, alter source values, or imply a game simulation. Long
rank arrays, scaling expressions, units, and prose stay complete.
The homepage's evidence dialog presents both exact values together and omits
the emphasis scrubber; the shared reader controls remain available elsewhere.

Champion histories focus one dated record while retaining the rest as ordinary
links or disclosures. Patch pages focus one champion record with filters and
native hash navigation. The patch directory's timeline selects a real dated
patch. Comparison selects a champion within the explicit `(older, newer]`
interval and opens its underlying records. Classification labels keep text and
glyph semantics; color alone never carries the conclusion.

## Player tasks with less repeated work

- **Briefing:** lead with one supported focus. Exact patch deltas or measured
  comparisons are prominent; the reason and calculation details are disclosures.
  Player, mode, and refresh settings are grouped under the player summary.
  Import status, partial samples, failures, and the retry action stay visible.
- **Gateway and profile:** use a compact identity and a useful first action.
  Explicit valid player selection supplies continuity. Account data, not a
  query-string name, identifies the player. Recognizable mode categories expose
  exact queues; matches are whole-row links with champion, mode, result, KDA,
  final items, date, and duration. Filters and statistics are optional.
- **Match:** move between overview, review, evidence, and Build Memory scenes.
  The recorded summary works before optional timeline or AI requests. A labelled
  AI result keeps its evidence and full text available. Keep loadout retains the
  source game and opens the notebook without re-entering items.
- **Adjustment:** a generated suggestion arrives as a prepared summary with one
  Save adjustment action. Edit details exposes the complete native form; manual
  adjustments begin with fields open. Invalid hidden fields reopen for correction.
  Opening a draft never saves it or starts prospective tracking.
- **Notebook and Saved:** notes and retained material are useful immediately.
  A kept loadout can prefill its champion and exact mode for an optional game
  card. Starting a card, saving a reflection, reviewing a patch, and keeping a
  finding remain separate deliberate actions.

These presentation changes retain exact queues, real missing-data states,
source links, player-scoped comparison eligibility, existing storage keys, and
all API access and rate-limit boundaries described in PRODUCT.md.

## Visual world, motion, and access

The shared palette is ink, pale paper, and a restrained green signal, defined in
`experience-shell.css`. Clash Display carries the large subject headings;
General Sans carries controls and reading; Spline Sans Mono identifies compact
coordinates and metadata. Use open compositions, quiet borders, and intentional
changes of scale. Reduce repeated explanation through native disclosures, not
by truncating a visitor's notes or removing evidence.

The homepage uses Cinzel for engraved display type and General Sans for controls
and evidence. Warm ivory and gold complement the characters' own colours.
Official Akali, Yasuo and Thresh foregrounds and the painted blue Nexus environment
establish its visual identity; code supplies layered camera movement, mist,
light and motes. The [asset manifest](public/images/rift-cinema/asset-manifest.json)
and [homepage record](docs/rift-cinema/README.md) identify the original sources
and the open font license. Earlier generated environment illustrations retain
their own provenance and are not the homepage's visual source.
Keep source text separate from imagery. Failed art retains readable identity and
the task's controls. The optional environment renderer has a static fallback;
no sound or 3D interaction is required to navigate or inspect a record.

Scene and supported cross-document transitions preserve a recognizable subject
and direction of travel. Operating-system reduced motion and the persistent
motion control retain all choices with nonessential movement removed. Before/After
and timeline interactions have click/tap and keyboard alternatives to dragging.
Preserve the skip link, visible focus, labelled controls, dialog Escape and focus
return, search with Cmd/Ctrl+K, and the guarded Alt+M map shortcut. Keyboard
shortcuts must not capture text entry or composition.

## Active implementation map

| Responsibility | Active sources |
| --- | --- |
| Spatial atlas and route path | `src/components/experience/RiftAtlas.astro`, `JourneySpine.astro`, `src/scripts/rift-atlas.ts`, `src/scripts/rift-passage.ts`, `src/lib/passage-camera.ts`, `src/styles/rift-atlas.css` |
| Shared shell and navigation | `src/layouts/Layout.astro`, `src/components/experience/JourneyWayfinder.astro`, `src/components/experience/JourneyChrome.astro`, `src/styles/experience-shell.css` |
| Kinetic type and camera-linked shape | `src/scripts/kinetic-type.ts`, `src/lib/passage-camera.ts`, `src/scripts/rift-passage.ts` |
| Evidence-to-action handoffs | `src/components/experience/JourneyHandoff.tsx`; native links from changes to impact, and from impact/loadout to the exact source match |
| Scene visibility, history, and focus | `src/scripts/connected-observatory.ts`; shared map/motion behavior in `src/scripts/experience.ts` |
| Public subject and player continuation | `src/scripts/signal-continuity.ts`, `src/lib/signal-context.ts`, `src/lib/player/identity.ts` |
| Homepage records, composition and continuation | `src/components/experience/RiftCinema.astro`, `src/scripts/rift-cinema.ts`, `src/styles/rift-cinema.css` |
| Homepage layered artwork, camera and atmosphere | `src/lib/rift-cinema-world.ts`, `public/images/rift-cinema/asset-manifest.json` |
| Shared exact records and readers | `src/components/experience/SignalRecord.astro`, `src/scripts/signal-record.ts`, `src/styles/signal-readers.css` |
| Champion exploration | `src/components/experience/HomeVoyage.astro`, `src/scripts/voyage.ts`, `src/styles/signal-explore.css` |
| Roster/archive preview and comparisons | `src/scripts/reader-lens.ts`, `src/scripts/signal-comparison.ts` |
| Player, briefing, and notebook presentation | `src/components/player/`, `src/components/companion/`, `src/styles/signal-player.css`, and their retained task styles |
| Decoded artwork swaps | `src/scripts/artwork.ts` (latest selection wins; retain the current image until the next is decoded) |
| Shared environment | `src/components/experience/RiftScene.astro`, `src/scripts/rift-scene.ts`, `src/styles/rift-scene.css` |

The filename `connected-observatory.ts` remains the scene controller; it does not
reintroduce the retired observatory homepage. Superseded global style layers and
unreachable presentation trees were removed. Add shared layout changes to the
single shell, and task-specific changes to the relevant route styles.

Build-time archive data supplies `/journey/roster.json` and compact
`/journey/:canonicalId.json` models. Champion exploration loads another model on
demand. React islands remain for bounded product tasks; do not hydrate the entire
archive merely to present the opening scene.

## Verification and historical evidence

**Historical checkpoint: the 31 October 2026 platform refactor.**

The first implementation passed typecheck, the production build and 519 tests.
Five atlas DOM tests passed separately. The output contract checked 622 generated
content pages. Browser QA was pending at that checkpoint: managed preview
infrastructure was unavailable, Vercel access was protected, and the workspace
became unavailable during cleanup. These results do not verify the subsequent
homepage revision.

**Historical checkpoint: the earlier 2 November 2026 relief-instrument homepage.**

Verification for that superseded homepage revision is recorded in
[pull request #70](https://github.com/ionutn0301/riftscry/pull/70) and its CI
artifacts; its [historical record](docs/cinematic-instrument/README.md) provides
the design decisions and comparison captures. Those results do not verify Rift Cinema.

**Current Rift Cinema verification is recorded in its release pull request and
CI artifacts.** The [current homepage record](docs/rift-cinema/README.md) defines
the review procedure and the evidence to attach to the release.
Test collection is not a browser pass, historical screenshots are not current
baselines, and controlled
fixtures do not establish successful live Riot or AI access.

Acceptance must follow a complete route: enter or resume, choose a subject,
reveal evidence, inspect its source, keep a finding/loadout/adjustment, reopen it,
and return through browser Back. Check desktop, portrait, 320px and short-landscape
viewports, enlarged text, keyboard-only access, reduced motion, long records,
empty/partial imports, cooldowns, API failures, and unavailable storage or artwork.
Measure performance on the actual build; neither the architecture nor a screenshot
establishes a cinematic, accessible, or fast experience.

Earlier checkpoints and assets remain in [docs](docs/), including the
[connected-observatory record](docs/connected-observatory/README.md),
[player release history](docs/player-release.md), and
[release evidence](docs/RELEASE_EVIDENCE.md). Their presentation descriptions and
check results apply to their own commits. Git history retains superseded designs.
