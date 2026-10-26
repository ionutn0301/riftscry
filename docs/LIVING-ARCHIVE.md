# The Living Archive — review build

Research and implementation date: 26 October 2026. Not approved for production release.

## Product audit

The active site is Astro 7 + React 19 islands, static JSON ingestion, nanostores local-device pool, CSS, GSAP and installed Three/R3F. The live homepage uses CinematicHome.astro and ArcaneInstrument.astro, not the numerous earlier React scene variants. Its chapter controls overlap the central object; document-wide arrow interception also interferes with native selects. The old homepage has three separate H1s and only six champion choices. No new database, account, framework migration or animation library is warranted.

Preserve /champions, /champion/:slug, /patches, /patch/:id, /compare/:a/:b, /pool, global search, filter query strings, the `riftscry:pool` storage key, and official source links. Comparison means records in (older, newer], not reconstructed champion statistics. Existing first-rank classification can label mixed rank arrays directionally: display the complete original values and champion-level adjustment rather than claiming every rank improved.

Dataset coverage is 26.1–26.16. Official patch index https://www.leagueoflegends.com/en-us/news/tags/patch-notes/ lists 26.21 (20 October) as newest when checked. Do not call 26.16 live/current. Data ingestion remains a separate reviewed task: do not fabricate later records. Azir Q values in 26.16 are traceable to the committed source URL. Whole dataset correctness is covered by schema tests, not claimed to have been manually re-audited.

## Reference evidence

Igloo and KPR were opened, snapshotted and captured in the graphics-enabled browser. Captures showed loader/partial rendering, not a verified complete interaction. The following lessons come from creator documentation, not claimed hands-on observation:

- Abeto / Awwwards Igloo: specific objects, material iteration in browser, previsualization before scene expansion. Do not copy ice, text shaders or effects.
- Resn / Awwwards KPR: authored tableaux reveal a useful second layer. Do not copy panels, brand or hold-only controls.
- Thinkingbox Arcane: contextual objects and sparse attention cues; the licensed client production is not an asset pack.
- Immersive Garden Hatom: one narrative protagonist connects progression. No commercial/product concepts borrowed.
- Unseen Blue Marine: complete environments support understanding, not decoration.
- Lusion Of The Oak: export pipeline and instancing are deliberate production work, not evidence that arbitrary geometry will fit a budget.
- Active Theory Hogwarts / Prometheus: authored start/end viewpoints and continuity rather than free-camera wandering.
- Media.Monks Witcher interview: a memorable environmental hub must lead into substantial content.

Sources are the URLs in the supplied brief; official policies reviewed: riotgames.com/en/legal, developer.riotgames.com/policies/general, developer.riotgames.com/docs/lol, developer.riotgames.com/terms, riotgames.com/en/terms-of-service, riotgames.com/en/riot-music-creator-safe-guidelines. Accessibility/performance guidance: web.dev/articles/vitals and W3C Understanding Animation from Interactions.

## Direction

One invention: an archive of recorded change, with twin optical elements mounted on a machined rail and grounded stone pedestal. Basalt, aged brass, optical glass, ivory typography, restrained spectral teal. Brass indicates focus, never buff/nerf. An original generated architectural still establishes the proposed look; it is not a working 3D model. The prototype uses the same still on mobile with an authored crop. No floating primitives, client-ripped models, audio, particles or simulated loaders.

Typography: system Georgia for editorial display, existing self-hosted General Sans for UI and tabular values. Data-heavy pages share the dark material palette but have no artwork behind tables.

## Five-beat shot list / storyboard

| Beat | User question / exact content | Subject, camera and composition | Input / resulting state | Transition and accessible counterpart |
| --- | --- | --- | --- | --- |
| 01 Arrival | What is this? “Bring change into focus.” / “A living archive of League of Legends. Follow your champions, trace their history, and see exactly what changed.” | Establishing 35mm view; apparatus in right two-thirds, architectural shadow left. Future camera: wide hall to rail midpoint. | Explore the archive anchors to Focus; Champions, Patch history, Compare, My Pool and search immediately available. | Native scroll, no gate. Mobile text above portrait still; reduced motion identical stationary composition. |
| 02 Focus | Which champion? “Your champion. A clearer perspective.” | Dedicated identity composition beside, never behind, selection controls; no fake animated character. Future camera: rail midpoint to chosen lens, original character art only after release clearance. | Search entire committed roster, quick-select a curated set, choose champion; identity, history, pool control and comparison update together. | State lives in URL; Back/Forward restores. Mobile stacked controls. Selection readable without any image. |
| 03 Trace | How did they change? “Every change leaves a trace.” | Timeline and semantic source-backed records in calm editorial space. Future camera: lens surface to engraved time rail, then stationary. | Jump directly to any recorded patch. Complete rank arrays, units, dates and classification retained. | No compulsory scrubbing. Keyboard native buttons/selects. No-record state does not claim unchanged historical state. |
| 04 Compare | What changed between versions? “Bring the records into alignment.” | Two aligned chronological endpoints above a dedicated reading area. Future camera: twin lens planes align then cut to text composition; no artwork under data. | Choose baseline and endpoint; reveal selected champion's recorded changes in (older,newer]. Open full comparison for all champions/items/systems. | Reveal is ordinary click; reduced motion instant. Missing records explicitly not complete historical values. |
| 05 Continue | What matters to my pool? “Keep your champions in view.” | Quiet final composition, continuity through fine rules and brass type. Future camera: return to archive desk. | Existing nanostores pool toggle, direct personalized patch link, full pool editor. | Same stored key and device-only behavior, no new account. Direct navigation skips entire story. |

## Art-production dependency (not hidden by the still)

Required deliverables: original source .blend plus GLB environment and comparator, KTX2 textures, Meshopt-compressed geometry, named pivots for Lens_A, Lens_B, Rail, FocusWheel. A specialist must model physically consistent optical assemblies, rear supports, bevels, UVs and stone modules; generate neutral / selected / aligned states; bake lighting where useful. Target one 1K stone, one 1K metal atlas, optional 512 glass normal, 2K lightmap, three LODs. Final triangle/texture budgets must follow measured visual review, not presumed acceptance.

Shots required: 16:10 wide arrival, 4:5 portrait arrival, 50mm champion focus, 65mm aligned comparison closeup. Rails/lenses must remain recognizable across shots. No character models needed. Supply matched still fallback exports at 1600px desktop / 800px mobile. Production camera continuity and physical lens movement cannot be validated with a flat still. This is an explicit remaining specialist dependency, not an implemented feature.

## Release gates

Confirm operator identity (individual versus entity), commercial model, Developer Portal registration/audit status and any necessary written permission. No keys or personal credentials requested. Existing Riot Data Dragon use is not proof of these facts. Review generated-still provenance and brand ownership. Obtain approval for the changed product through Riot's portal if applicable. Do not publish this review branch automatically.

Representative frames, validation results and known failures are recorded in the companion validation document after browser review. A generated concept still does not establish animation or model rights, and this work must not be described as production-ready.
