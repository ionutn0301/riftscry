# The connected observatory

RiftScry now uses a shared world and focused task scenes across its 14 route families.
The change addresses a structural problem in the earlier design: atmospheric visuals
surrounded an ordinary sequence of large introductions, stacked reading sections,
and repeated instructions. The world is now an interface for choosing a destination;
within a destination, selecting a scene changes what the visitor can work with.

## Experience

The homepage is a single-view orbital instrument. Five named destinations surround
the Rift. Hovering or focusing a point changes the central invitation and camera
perspective. The preview arrows provide the same choice without precise pointing.
Each point is a native link; entering a destination takes one activation. There is
no mandatory introduction, free-movement tutorial, account creation, or unlock step.

The same five destinations remain in a compact navigation strip throughout the site.
The destination map opens the same instrument. Within a task, a scene strip exposes
its meaningful views. Only the selected scene participates in focus or the accessibility
tree. Click, keyboard arrows, next/previous buttons, and an optional swipe on the
scene strip all lead to the same state. Forms and record areas keep their normal
scrolling and touch behavior.

The scene responds to destination and task changes. The existing authored WebGL
aperture remains the common object, with route camera and light presets. Native
cross-document transitions connect real URLs; in-place scene changes reveal the
new content while retaining the underlying task state. This is not an SPA router,
and data access does not depend on a 3D hit target or a finished animation.

### Across the platform

| Destination | Routes | Interaction |
| --- | --- | --- |
| Observatory | `/` | Select a destination, resume a remembered player, or inspect a real archive signal |
| Briefing | `/next-game` | Connect once; switch between Focus, Changes, Impact, and Loadout |
| Games | `/players`, `/players/[platform]/[puuid]`, `/matches/[id]` | Resume or find a player; switch existing history/build views; inspect match, review, evidence, or build memory |
| Champions | `/champions`, `/champion/[slug]`, `/explore` | Search a casting wall; select a dated champion record; inspect an exact change, its timeline, or a kept finding |
| Patches | `/patches`, `/patch/[id]`, `/compare/[a]/[b]` | Select a date; inspect one champion record; switch to item/system evidence or an interval comparison |
| Saved | `/pool`, `/notebook` | Revisit saved champions/findings; choose champions; open notes, loadouts, game cards, or history |
| Recovery | `/404` and missing routes | Return to the same world, open search, or follow the latest archived patch |

Shortcut routes under `/patch` and `/compare` keep their redirect behavior.

## Simplification decisions

- The homepage's five stacked explanatory sections are replaced by one useful choice.
- Repeated route heroes, reading rails, and next-page teasers are removed from readers.
- The champion directory uses one preview, not two versions of the same artwork.
- Champion and patch histories select one record at a time. Their exact values,
  conditions, original wording, and source links remain available.
- Patch filters keep name search in view. Additional role/type/pool filters open
  from a disclosure, with applied scope and clearing available outside it.
- A returning player's verified recent identity is reused in the global Briefing
  and Games links. Explicit saved-player state remains separate and optional.
- Automatic briefing leads with its observation. Session detail and methodology
  are available through disclosures; they no longer occupy parallel reading blocks.
- The notebook starts with saved notes. Adding a note requires its text; champion,
  mode, situation, and pinning are optional context. Existing preparation cards,
  reflection, backup, conflict protection, and export/import remain available.
- Free exploration selects a useful latest recorded interval. Explicit `older`,
  `newer`, or legacy `patch` query parameters always retain their requested meaning.
- Choosing a destination never saves a champion, marks a patch reviewed, creates a
  note, or requests an AI review on the visitor's behalf.

## Implementation boundaries

`journey-stations.ts` supplies the five destinations and surface mapping. The
`RiftNavigator`, `JourneyWayfinder`, and `JourneyChrome` components provide the
shared instrument, controls, and scene navigation. `connected-observatory.ts`
coordinates declarative route panels, URL hashes, browser history, focus, and
camera events. It observes asynchronously hydrated panel changes without moving
React-owned nodes or resetting task state. React decks expose readiness after their
first committed render, so the coordinator never mutates markup during hydration.
Route components keep responsibility
for evidence, filters, API calls, and saved data.

A route declares one `data-journey-deck` with named `data-journey-panel` descendants.
Each scene has a real ID. A direct link to an element inside an inactive scene
reveals that scene. Scene controls use the standard tab/tabpanel relationship and
remove inactive content from the tab order. Programmatic task actions can reveal
a scene through `riftscry:journey-reveal`; record selectors receive
`riftscry:journey-change` after the global scene is activated.

The enhanced document fits the viewport; evidence lists and active reading panels
can scroll internally. This is deliberate: meaningful data is never truncated to
fit a cinematic screenshot. At small or landscape sizes, the same scene model
remains available with tap controls and natural internal scrolling.

Reduced-motion users receive the same choices and state changes without camera
travel or content animations. The SVG scene works without WebGL. Without JavaScript,
archive panels remain readable in document order and destination links remain native.
The legal/source information is available from About; a no-JavaScript footer remains.

No dependency upgrade, player API change, additional external service, credential
change, or Vercel protection change is required by this redesign.

## Audit and research

- [Movement with a purpose](KINETIC_REFINEMENT.md): the follow-up pass on directional
  travel, direct timeline control, exact reading continuation, and shared task surfaces.
- [Full route audit](AUDIT.md): actual tasks, manual friction, duplicated structures,
  retained data invariants, and implementation priorities.
- [Current reference research](RESEARCH.md): primary studio/product sources, observed
  interaction models, design interpretation, and device tradeoffs.

The references informed spatial choice, continuity, and context reuse. RiftScry's
specific interaction system and visual composition are original to this implementation.
No engagement or performance outcome is inferred from other studios' case studies.

## Verification

Release-specific results and limitations are recorded in the pull request. The
verification combines typechecking, the full existing unit/data suite, browser
stories for exact evidence and saved continuity, all 14 route families on desktop
and mobile, WebGL/static fallbacks, keyboard/history/deep-link checks, and fixture-backed
player flows. Player browser fixtures exercise UI/API contracts with synthetic
records; they do not prove live Riot-service availability.

Screenshots in this directory document actual rendered routes, not design mockups.

| Capture | Context |
| --- | --- |
| [Desktop observatory](screenshots/home-desktop.webp) / [Phone observatory](screenshots/home-mobile.webp) | Interactive destination instrument with full motion enabled |
| [Explore](screenshots/explore-desktop.webp) | Exact Azir record from patch 26.16 |
| [Champion history](screenshots/champion-desktop.webp) | Ahri's selected archived patch record |
| [Phone patch record](screenshots/patch-mobile.webp) | Selected champion record in the patch station |
| [Prepared briefing](screenshots/briefing-desktop-fixture.webp) | Synthetic `Fixture Player#TEST` browser fixture, not a live account |
| [Phone notebook](screenshots/notebook-mobile.webp) | Empty saved-note state |
| [Phone saved champions](screenshots/saved-mobile.webp) | Locally seeded Ahri, Azir, and Jinx selection for visual verification |
