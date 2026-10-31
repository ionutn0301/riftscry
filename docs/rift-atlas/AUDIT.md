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

## Entire platform inventory

| Route | Place and experience |
| --- | --- |
| / | Spatial atlas with five native portals, setting previews, direct briefing entry, and a champion-signal branch. |
| /explore | Archive: retain the champion, interval, selected field and exact evidence while travelling through task chapters. |
| /champions | Archive: search and preview a champion; reduce excess card framing so artwork occupies the scene. |
| /champion/:slug | Archive: dated records, true before/after values and sources, with the atlas path always reachable. |
| /patches | Fracture: choose a real dated archive moment using the timeline. |
| /patch/:id | Fracture: champion, item, system and hotfix evidence keeps its filters and sources. |
| /compare/:a/:b | Fracture: explicit interval and subject selection stay intact through native links and Back. |
| /next-game | Beacon: enter a Riot ID once; the existing automatic briefing, patch impact and recorded loadout do the work. |
| /players | Echoes: one identity lookup, remembered player and sensible task defaults. |
| /players/:platform/:puuid | Echoes: player identity, exact-mode history, observed builds and Build Memory inherit the shared environment and path. |
| /matches/:id | Echoes: overview, review, source evidence and build tasks are chapters of the same destination. |
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
- `RiftAtlas.astro` renders real links. Pointer, touch, Tab, directional arrows
  and Enter provide access without a compulsory drag gesture or tutorial.
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

## Actual verification and limitations

Before workspace access was lost:

- The first implementation passed Astro typecheck, the production build and
  519 unit/integration tests.
- Five additional atlas DOM tests passed separately: stale image requests,
  keyboard movement, blocked storage, place-only memory and lifecycle cleanup.
- The production-output atlas contract passed on 622 generated content pages,
  including every generated champion history, patch and comparison pair.
- Vercel deployed commit `061c1da` successfully.

Browser suites were added/migrated for the new entrance and dialog name. They
were not executed in this session. Browser geometry, cinematic composition and
live Riot/AI behavior remain unverified.

The managed preview CLI reports an absent daemon mailbox. The deployed preview
redirects this browser to Vercel sign-in, and the connected preview-access tool
could not access the deployment. The workspace then became unavailable during
final cleanup. The main implementation was already committed, and remaining
test/documentation updates were preserved through GitHub. Final incremental
changes therefore require a fresh full check in a restored environment.

The PR remains a draft. Before merging, review desktop and mobile composition,
short landscape, enlarged text, hit targets, failed art, reduced motion, complete
player journeys and native Back. Neither DOM tests nor historical screenshots
establish cinematic quality, measured performance or accessibility certification.
