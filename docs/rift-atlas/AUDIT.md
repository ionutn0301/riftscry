# RiftScry: the Rift atlas

Reviewed 31 October 2026. Baseline: `49d18c3` on main.

## Audit finding

RiftScry already has exact patch evidence, champion histories, comparisons,
automatic match imports, personal patch impact, loadouts and optional saved
material. It also already has chapter controls, transitions, remembered context
and a decorative environment. The main issue is composition and navigation:
chapters swap content inside a familiar document layout. A backdrop alone does
not make that layout feel like a journey.

The document-layout correction layer had accumulated 523 lines, many reversing
earlier viewport locking and nested scrolling. The refactor replaces it with a
compact document-flow contract and makes the site's structure visible as places.
The existing working data pipeline and optional personal workflows are retained.

The second pass identified concrete defects: profile styles placed identity and
result in intersecting grid cells; changing only `overflow-y` left accidental
scrollports when `overflow-x` was hidden; image changes blanked the displayed
asset before its replacement decoded; resizing a canvas cleared it between
paints; React could briefly commit all chapters before registration. AI review
also lacked a clear entry action in the overview. These paths are now corrected
in source and covered by targeted regression tests.

## Current research

This is a qualitative review of primary sources, not a popularity ranking.

| Source | Observed direction | RiftScry decision |
| --- | --- | --- |
| [Figma: 2026 web-design trends](https://www.figma.com/resource-library/web-design-trends/) | Immersive depth, experimental navigation and non-linear exploration. | Make the entrance a spatial interface with real, visible destination links. |
| [Webflow: 2026 trends](https://webflow.com/blog/web-design-trends-2026) | Proprietary visual systems, minimal copy, selective detail and clear wayfinding. | Give all routes one geography and use short scene captions, with complete evidence available when wanted. |
| [Bruno Simon](https://bruno-simon.com/) | A playable portfolio with map, recovery, quality and audio controls. | Make navigation an activity while keeping direct entry and Back. RiftScry uses a domain-specific atlas rather than a vehicle mechanic. |
| [Lusion](https://lusion.co/) and [Spatial Fusion](https://lusion.co/projects/spatial_fusion/) | Spatial storytelling, motion and interaction form a connected creative system. | Apply the same world and travel rules to archive, player tools and saved records. |

The proposed distinction is the ripple between games: echoes from the game you
played, a fracture when balance changes, an archive to inspect, a beacon for your
next focus, and a sanctuary for what you keep. These labels supplement clear task
names and correspond to real destinations. This synthesis does not claim that
spatial navigation has never appeared elsewhere.

## Igloo reference and new interaction

The [Igloo creator case study by abeto](https://www.awwwards.com/igloo-inc-case-study.html)
describes planning a camera journey, prototyping geometry before final art,
iterating in the browser, and making effects and transitions part of a connected
world. RiftScry adopts the continuous-camera principle with its own fractured
Rift object and task geography. This is an interaction synthesis, not a claim
that the implementation matches Igloo's production quality.

The homepage and shared menu now render a real perspective projection of the
same existing mesh. Five authored views connect by eased movement, material
color and a focal push between destinations. Mobile supports direct object
dragging and a native range; keyboard and wheel work too. Native links remain
visible and do not wait for an animation. The menu is the same spatial
instrument, including on deep routes. Chapter and document transitions open a
cut through depth instead of fading the entire scene. Canvas2D avoids a WebGL2
requirement; the SSR SVG remains until a successful first paint. No runtime
package or texture download was added for this interaction.

The live Igloo site returned its WebGL2 compatibility fallback in this browser.
Its rendered interaction could not be inspected here; the creator's published
case study is the source for these design principles.

## Entire platform inventory

| Route | Place and experience |
| --- | --- |
| / | Continuous Rift camera with five native destinations, direct briefing entry, and a champion-signal branch. |
| /explore | Archive: retain the champion, interval, selected field and exact evidence while travelling through task chapters. |
| /champions | Archive: search and preview a champion; reduce excess card framing so artwork occupies the scene. |
| /champion/:slug | Archive: dated records, true before/after values and sources, with the atlas path always reachable. |
| /patches | Fracture: choose a real dated archive moment using the timeline. |
| /patch/:id | Fracture: champion, item, system and hotfix evidence keeps its filters and sources. |
| /compare/:a/:b | Fracture: explicit interval and subject selection stay intact through native links and Back. |
| /next-game | Beacon: enter a Riot ID once; the existing automatic briefing, patch impact and recorded loadout do the work. |
| /players | Echoes: one identity lookup, remembered player and sensible task defaults. |
| /players/:platform/:puuid | Echoes: player identity, exact-mode history, observed builds and Build Memory inherit the shared environment and path. |
| /matches/:id | Echoes: overview, explicit AI review entry, source evidence and build tasks are chapters of the same destination. |
| /pool | Sanctuary: champions and exact kept findings retain their source links. |
| /notebook | Sanctuary: notes, retained builds, preparation and backups remain optional. |
| 404 | Shared atlas, search and route path support recovery. |
| Redirects | Existing patch/compare shortcuts and legacy journey URLs keep native routing. |
| JSON and player APIs | Preserve access checks, rate limits, exact queues, stored formats and evidence boundaries. |

Every generated content page uses the shared shell. Server-rendered player and
match routes import that same layout; complete live behavior still requires
browser and API verification.

## Implementation

- `journey-stations.ts` supplies task names, places, links, artwork and colors to
  the entrance, modal atlas and persistent route path.
- `RiftAtlas.astro` renders the persistent object, its SVG fallback and real
  links. `rift-passage.ts` paints the projected mesh; `passage-camera.ts` owns
  continuous pose/color interpolation. The RAF stops once the camera settles,
  pauses in hidden documents, and caps rendering density at 1.5 device pixels.
  Touch, range, Tab, directional arrows and native links provide alternatives.
- Mobile chapter controls show the active chapter name and use 44px targets.
  The menu has one outer scroll on short screens, never an inner destination
  list. Route content and evidence retain one document scroll.
- Profile identity, tags and mode/result labels wrap in natural flow. Match
  cards use one named-area grid, with separate identity and result rows at
  380px and below. Optional identity settings open in flow.
- `artwork.ts` holds the old image until the latest requested asset is decoded.
  Stale completions cannot replace it, returning to the displayed source cancels
  pending work, and failed current assets reveal the existing honest fallback.
  Canvas dimensions change only in a callback that also paints.
- Match overview has a direct AI action. It reveals the named chapter and makes
  exactly one explicit request, even on rapid repeated activation. AI failures
  keep deterministic facts and retry; deterministic responses retain their label.
- `rift-atlas.ts` previews settings with two environment planes. Stale image
  requests cannot commit an obsolete destination; failed art leaves links usable.
- The existing chapter controller owns panel selection, focus, fragments,
  inactive panels and Back/Forward. No navigation waits for animation.
- The persistent path connects every page, including deep champion, comparison
  and match routes. The same atlas opens from all of them.
- Place memory contains only allowlisted destination IDs in session storage,
  never player IDs, matches, queries or notebook content.
- Existing local art provides all environments. No runtime dependency was added.
- Short scene copy and automatic briefing entry reduce explanation and setup.
  Existing loadout saving still needs no item re-entry. Notes, reflections and
  preparation cards remain optional; no new bookkeeping was introduced.
- Reduced motion, native URLs, source records and the no-JavaScript archive
  remain part of the shared design.

## Motion and useful return paths — 1 November 2026

- Destination headings unfold in masked words while keeping one complete
  accessible name and the authored emphasis. Chapter headings share a depth
  reveal; React-owned text is not split or rewritten.
- A closed Bézier aperture morphs with the same continuous position as the
  projected 3D Rift. Camera rotations/offsets use a spline, with zero-slope focal
  pushes at station boundaries. Pointer lean eases to rest and travel streaks
  follow movement. All RAF work stops when the camera and lean settle.
- A selection dead band prevents heading chatter near drag boundaries. Motion
  preferences remove kinetic animation and make the camera selection immediate.
- The entrance exposes a remembered briefing and the exact previous public
  reading URL using existing validated storage. Cross-tab changes, clearing and
  blocked storage have explicit fallbacks. No new persistence or API request is
  introduced, and arriving does not keep findings or mark patches reviewed.
- A common native handoff connects patch records to item impact and recorded
  build evidence to its own source match. Choosing another impact champion
  changes that match link too; it never silently routes to another build.

## Composition correction — 1 November 2026

The production screenshot exposed a composition defect that unit and output
contracts did not measure. An absolutely positioned brand headline collided
with a separately positioned destination headline; the entrance also repeated
its destination navigation in the global footer. The secondary champion path
used another introductory slogan, which made the page feel like two entrances.

The correction puts one dynamic H1, caption and primary entry in a dedicated
grid area. The visual, range and native destinations each own a separate area;
mobile stacks those areas in ordinary document flow. The extra headline block
and duplicate briefing action are removed. The remembered player changes the
single entry action, while exact public reading resume remains a quiet link.
The global chapter/footer navigation is hidden on the entrance and returns
only after entering a task. The champion branch is a picker rather than a
second welcome screen. Chapter fragments now reset the initial document scroll
without changing deep-record or browser-history restoration.

The previous browser CI finished with 105 passes and six failures after the
merge. Some checks referenced retired navigation/artwork; the Saved chapter
also exposed an initial fragment scroll defect. Those expectations and the
fragment behavior are corrected. A separate CI job now measures intersections
between actual browser boxes at 320, 390, 683, 844, 1366, 1440 and 1920px,
checks all five destinations and the menu, and retains screenshots. Its results
must be reviewed before treating the correction as visually verified.

## Actual verification and limitations

Validation for this revision:

- Astro check: 266 files, zero errors and warnings, one pre-existing unused-import
  hint in `src/pages/players.astro`.
- Vitest: all 550 tests pass across 59 files. New cases cover camera convergence,
  boundary/reversal behavior, reduced motion, resize without canvas clearing,
  wheel scroll release, image races/failure/abort, fast React scene registration,
  explicit AI request/success/failure/deterministic fallback, camera tangent
  continuity, closed shape topology, kinetic text semantics and useful returns.
- Production build succeeds with the existing Astro/Vercel adapter.
- Production-output contract passes on all 622 generated content pages.
- Browser collections parse successfully: 753 archive/journey cases and 118
  fixture-backed player cases. Collection is not browser execution.

Browser suites cover the five destinations, menu focus return, long profile
labels at 320/390/844/1440px, accidental nested scrolling, camera travel, reduced
motion, native Back and explicit AI entry. They have been collected, not executed
in this environment. Mocked DOM tests establish state and lifecycle behavior;
they do not establish visual composition or browser performance.

The managed preview CLI reports an absent daemon mailbox. The Vercel preview
redirects this browser to sign-in, and the connected preview-access tools report
no access to that deployment/team. The PR remains a draft until browser review
can verify desktop, mobile, short landscape, enlarged text, touch gestures,
failed assets and real player journeys. Live Riot/AI services have not been
exercised by fixture-based tests. No claim of zero UI defects, measured frame
rate or accessibility certification is made.
