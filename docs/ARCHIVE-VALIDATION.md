# Living Archive — validation and handoff

26 October 2026. **Interactive visual review build, not a completed 3D production or release-cleared site.** No production deployment performed.

## Review path

Open `/`, choose **Explore the archive**, search/select a champion, select a dated timeline record, jump to **Compare**, choose endpoints, then **Bring changes into focus**. The result receives keyboard focus and shows source-linked records. Add the champion to the existing pool, reload, and open `/pool` or the personalized patch. State can be shared with `/?champion=azir&from=26.15&to=26.16&reveal=1#compare`.

## Implemented

- Original basalt/brass optical archive concept still, optimized wide and portrait variants; no floating primitive scene or reused unverified journey backgrounds.
- Five linked semantic sections, immediate practical navigation, native scrolling, source-backed selection/history/interval reveal, 173-name committed roster search, source links, ordinary comparison controls, browser history restoration.
- Full numeric rank arrays, units when supplied, dates, prose records, champion-level mixed classification and explicit absence/coverage caveats. Original interval semantics tested across every pair of committed patches.
- Existing local-device pool key and workflow preserved. Saved-pool rendering waits for hydration to keep server/client first renders consistent.
- Shared dark material palette across existing data routes. No art underneath data tables. Original logo colors restored. Official general-policy notice and correct repository URL in footer.
- Archive 26.16 is explicitly labeled archived, not current. Official index lists 26.21 as newest at review time; later records were not fabricated or ingested without validation.

## Automated checks

`pnpm check`: passed, 0 errors/warnings/hints. `pnpm test`: 21 files / 177 tests passed, including 3 new interval/provenance tests and all existing palette contrast checks. `pnpm build`: passed, 452 static pages. `git diff --check`: passed.

Repository Playwright **did not complete**. Initial launch lacked browser binaries. One installation recovery downloaded Chromium/WebKit; subsequent Chromium launch failed because the VM lacks `libnspr4.so` (WebKit also reports missing system libraries). No assertions ran in that attempt. Do not interpret this as an e2e pass. Added a dedicated Living Archive spec; adjusted only the obsolete homepage heading in the core-flow spec. Historical cinematic/WebGL tests target retired designs and remain to be reviewed/replaced against the final agreed production scope, not silently skipped.

Formatter: TSX/TS/CSS files formatted successfully; Astro file was left as authored because the standalone formatter has no Astro parser. This is not a compiler failure.

## Preview-browser evidence

Actual Chromium preview used at 1008×833 desktop and 390×844 portrait mobile, dark scheme:

- Arrival, focus, comparison, mobile reveal and patch data route inspected in screenshots; no horizontal overflow in checked portrait state.
- Search Camille → select → browser Back restores Azir. Selected champion and reveal state reflected in query parameters.
- Azir 26.15→26.16 reveal displays full 60/80/100/120/140 → 75/95/115/135/155 arrays and AP scaling; source points to Riot. Camille reveal visibly retains Adjustment, not universal Buff.
- Add Azir to pool → reload → In your pool preserved. Saved-pool first-render mismatch found and corrected.
- Patch Buffs control updates `?type=buff`, leaves 3 visible champion records (matches committed dataset).
- Global search opens, displays actual indexed options, accepts a query and closes with Escape. A stale Vite `cmdk` optimized-module 504 was diagnosed; dev optimizer restarted. Existing lazy-search architecture retained, not rewritten to mask the cache failure.
- Reduced-motion media produces `data-archive-motion=off`. Native chapter links remain usable and a return-to-Arrival check lands at scrollY 0. Comparison reveal puts focus on `aligned-records`.
- No canvas is used: unsupported WebGL and context loss cannot prevent the still-led build from functioning. This is renderer independence, **not** validation of a future 3D fallback implementation.

### Frames

- `docs/screenshots/living-archive-arrival-desktop.png`
- `docs/screenshots/living-archive-arrival-mobile.png`
- `docs/screenshots/living-archive-focus-desktop.png`
- `docs/screenshots/living-archive-compare-desktop.png`
- `docs/screenshots/living-archive-reveal-mobile.png`

These are browser review frames from the implemented still-led slice, not a claim of finished real-time 3D final-look frames. Capture was used to correct portrait text/art overlap and bright-header navigation contrast.

A short interaction recording was attempted. Recording start succeeded, but encoding failed at stop because `ffmpeg` is absent in the browser runtime. No playable recording is delivered; screenshots are the available evidence. No separate camera-previsualization animation has been delivered.

## Performance evidence and limits

Initial mobile Chromium **development-mode lab** sample on `/` at 390×844: TTFB 188ms, FCP 504ms, LCP 572ms (portrait environment image), CLS 0.000. INP was unavailable (no measured interaction in the vitals sampling window). This first measurement exposed the saved-pool hydration issue subsequently fixed; it is not a production benchmark.

Post-fix mobile development lab sample: TTFB 183.1ms, FCP 520ms, LCP 552ms, CLS 0.000, INP unavailable. The ArchiveExplorer hydration completed at approximately 1145ms in this run; no errored hydration phase was recorded. This remains local lab evidence, not field or real-device performance.

Asset sizes: wide WebP 83,148 bytes; portrait WebP 48,030 bytes. Generated full PNG is retained as a source artifact but never requested by the UI. Initial generated HTML was 362,403 bytes / 39,469 gzip bytes. These are component/file sizes, **not** measured total compressed network transfer. No claim that full mobile/desktop transfer budgets or field Core Web Vitals have been certified.

Not measured: real midrange phone FPS, physical desktop GPU frame times, memory trends, p75 field CWV, 3D time-to-usable, throttled-network/missing-file matrix, complete assistive-technology audit. A flat-still prototype cannot establish real-time renderer performance. Typography token contrast tests pass; this is not comprehensive WCAG conformance certification.

## Remaining production dependencies

1. Specialist model/material/lighting pipeline and connected camera/lens animation. Exact GLB/Blender/material/pivot/shot requirements in `LIVING-ARCHIVE.md`. Apparatus does not physically move in response to selected records in this build.
2. Rights clearance: operator identity, monetization, Developer Portal registration/audit and applicable permission. New champion splash art intentionally absent. Existing Data Dragon thumbnails on data routes are retained, not independently release-cleared.
3. Generated environment and user-supplied brand signoff; review bundled font redistribution restrictions before public source release. `ARCHIVE-ASSETS.json` records sources, policy evidence and restrictions.
4. Bring patch ingestion up to date through reviewed source ingestion, not copied labels. Product currently has 16 archived patches.
5. Real-device/performance/accessibility test matrix and migration of legacy cinematic tests after final art implementation.

Do not call this production-ready or publish it until those dependencies are resolved. The implemented scope is a coherent, functional still-led review experience with honest data and documented next production steps.
