# First-paint stability release

3 November 2026 · [PR #76](https://github.com/ionutn0301/riftscry/pull/76)

This document records the implementation, reproduced baseline and completed local
gates. The **Release validation** section of [PR #76](https://github.com/ionutn0301/riftscry/pull/76)
records the exact tested commit, final browser runs, visual proof, merge and
production deployment as those gates complete.

## Outcome and scope

Keep the first visible champion, artwork, copy and reader controls in their
authored positions while JavaScript, images and fonts arrive. Enhancement should
preserve the entrance the visitor has already seen. Deliberate navigation,
champion changes, pointer movement and expanding content remain interactive.

This is a presentation and loading-state repair. It does not change Riot API
routes, request contracts, match analysis, account permissions or monetization.
It does not establish that every page or loading sequence is free of visual
defects.

## Reproduced baseline

The test-only commit
[`d1ab3abe`](https://github.com/ionutn0301/riftscry/commit/d1ab3abe) added the cold-load
regression on top of the application at
[`ad6c678`](https://github.com/ionutn0301/riftscry/commit/ad6c678).
In [CI run 41640925775](https://github.com/ionutn0301/riftscry/actions/runs/41640925775),
**all six new cold-load cases failed an opacity-preservation assertion; all 27
pre-existing `home-flight` cases passed**. This is the measured baseline result,
not a successful verification of the repair. The
[home-flight artifact 13233855129](https://github.com/ionutn0301/riftscry/actions/runs/41640925775/artifacts/13233855129)
contains the browser evidence and attached startup telemetry.

### Geometry extracted from the baseline artifact

The retry attachments (`retry1`, the second attempt) contain these first styled
DOM rectangles and first GPU foreground draws. GPU rectangles below are
**projected from the recorded uniforms using the baseline shader equations**,
including its time-based vertical bob; they are not screenshot pixel matching.
The first draw precedes the canvas fade-in. Coordinates describe the complete
transparent image plane, so clipping outside the viewport is expected.

All numbers are CSS pixels, rounded to three decimals. Rectangles are
`x, y; width × height`; center deltas are GPU minus HTML.

| Viewport / motion | Initial HTML poster rectangle | First GPU rectangle | Center delta; height delta |
| --- | --- | --- | --- |
| 1440 × 900 / full | `442.797, −81.000; 1044 × 1044` | `513.900, −94.632; 1017 × 1017` | `+57.603, −27.132`; `−27.000` |
| 390 × 844 / full, Chromium | `−141.266, 25.313; 742.719 × 742.719` | `−177.394, −7.653; 791.588 × 791.588` | `−11.694, −8.531`; `+48.869` |
| 700 × 844 / reduced, Chromium | `41.641, 25.313; 742.719 × 742.719` | `20.140, −88.620; 953.720 × 953.720` | `+84.000, −8.432`; `+211.001` |

The 700px case exposes the original breakpoint mismatch: CSS selected the mobile
pose at 700px while the GPU selected its desktop pose. Desktop reduced motion
also retained the mismatch: its first GPU rectangle was
`513.900, −94.500; 1017 × 1017`, with no shader bob.

The source-only estimate predicted center changes of +57.6/−27px on desktop and
−11.7/−8.44px at 390px. The recorded values add actual DOM rounding and the
baseline shader's already-advanced clock; they confirm the separate geometry
definitions rather than treating the source estimate as a browser measurement.

After the pointer had left and the canvas was fully opaque, the sampled full
motion draws still changed position:

| Trace interval | Recorded draws | Projected center displacement |
| --- | --- | --- |
| Desktop, 2.109–2.935s after renderer readiness | 4 | `+1.084px, −0.392px` over 826.5ms |
| 390px Chromium, 1.854–3.746s after renderer readiness | 16 | `+0.116px, −0.613px` over 1891.7ms |

These intervals contain both the remaining pointer interpolation and the old
shader bob; they are not a measurement of purely autonomous drift. At 700px in
reduced motion, all three recorded draws had the same projected rectangle;
only one occurred after pointer leave, so the trace does not establish a longer
resting interval. No recorder samples were dropped in these traces.

The baseline test's planned 120ms incidental pointer pulse lasted approximately
1223ms on desktop, 1018ms at 390px and 670ms at 700px because rendering delayed
its rAF callback. That entire baseline window cannot be described as idle.
All twelve attached attempts reached WebGL. The actual WebKit viewport was
**390 × 664**, while the Chromium mobile cases used the dimensions above.

The desktop and 390px before/after PNGs were inspected. Their before captures
deliberately hold fonts and application scripts, so they include fallback
typography and not-yet-loaded secondary portraits. Their after captures are
from the **same unfixed baseline**, after font release and enhancement; they
are not repair proof. Mobile CDP captured 390 × 844 pixels while the later
device-scale PNG is 1024 × 2216, so raw PNG dimensions must not be interpreted
as layout growth. Use the CSS-pixel telemetry for quantitative comparisons.

The original poster/environment fade and JavaScript-triggered copy entrance
could alter an already visible frame. Automatic shader camera drift and champion
bobbing added position changes without visitor input. Font swaps and several
reader/island layouts introduced separate opportunities for movement.

## Repair

### Homepage composition and handoff

- `src/lib/rift-cinema-pose.ts` supplies the authored foreground position and
  scale to both `RiftCinema.astro` and `rift-cinema-world.ts`. CSS and GPU now use
  the same inclusive **700px** mobile breakpoint. The initial environment crop
  and zoom are aligned as well.
- Remove autonomous champion bobbing, camera zoom breathing and camera wander.
  Atmospheric effects and motes remain animated; deliberate pointer and scene
  transitions retain their motion. Reduced motion remains supported.
- Keep the native poster and environment intact beneath the opaque canvas.
  After its first complete draw, the canvas fades in over **400ms**. Start the
  interpolation/animation-clock hold after that first draw, so slow software
  rendering does not consume the visible handoff interval. Do not render a
  placeholder world before its required textures are ready. A failed required
  foreground texture keeps the native fallback available.
- Keep server-rendered copy visible when the deferred module arrives; do not
  replay an entrance animation solely because JavaScript became ready.
- Derive the native inspection pose and environment zoom from the same scene
  coordinates. A first or restored graphics draw starts at the native view's
  current mode with a neutral pointer; retained pointer input resumes after
  the handoff. A browser regression checks direct inspection and real graphics
  context loss/restoration after deliberate pointer movement.

### Fonts

The immersive layout preloads its actual Cinzel display face, alongside General
Sans; other reader surfaces preload Clash Display. These faces use
`font-display: optional`. The tradeoff is deliberate: a very late font can leave
the browser's fallback face in use for that navigation, instead of replacing
already visible text and changing its layout. This improves loading stability
without guaranteeing identical typography across every network condition.

### Adjacent readers and React islands

| Area | Stabilized behavior |
| --- | --- |
| Reader entrance | Apply the final `#main` reading inset before modules load. |
| Champion reader | Anchor artwork to the start of its record column, independent of the combined height of all SSR history records. Preserve the save button's label/mark structure while updating its state. |
| Mobile patch reader | Use the final wrapped chooser layout from first paint; retain ordinary links, explicit fragments and readable content without JavaScript. |
| Item and rune artwork | Reserve icon frames before metadata and CDN images arrive. Successful images and ID fallbacks share those frames in inventories, loadouts and patch comparisons. |
| Patch filter | Render a status row before hydration and reserve its line height. |
| Player gateway | Show an accessible pending choice while reading the remembered player, avoiding a briefly expanded lookup form. |
| Automatic briefing | Keep consistent route padding, chapter space, heading and subtitle footprints across pending selection, entry and report states. Compact variants depend on the viewport. |

## Regression method

`tests/e2e/home-flight.spec.ts` and `cinema-startup-test-helpers.ts` delay scripts,
hero images and fonts independently. An initialization probe records the styled
DOM before deferred modules run, then follows image decoding, enhancement, the
first 1.3 seconds of the handoff and late font completion. The repaired regression
samples an idle world: the artificial pointer pulse used in the baseline was
removed after its delayed callback was identified in the telemetry. Existing
interaction tests retain coverage of deliberate pointer and scene changes.

The probe observes native WebGL uniform/draw calls without changing their
arguments or results. It projects the actual foreground coordinates into CSS
pixels and compares them with the initial HTML poster, using a 1px tolerance.
DOM rectangles and opacity are also sampled across frames. A fixed canvas
rectangle or a layout-shift score alone would miss movement inside the canvas.

The six cases cover full/reduced motion on desktop Chromium and mobile WebKit,
390px Chromium in full motion, and the exact 700px Chromium boundary in reduced
motion. Chromium must exercise the GPU path; a genuine WebKit graphics fallback
is identified separately. Before-frame Chromium screenshots use CDP so pending
fonts do not postpone capture. WebKit retains early video and telemetry; final
PNGs and JSON attachments accompany the cases.

Additional coverage lives in `tests/e2e/reader-startup-stability.spec.ts` for
reader initialization, fragments and no-JavaScript behavior, and
`tests/player-e2e/load-stability.spec.ts` for hydration, pending selection,
metadata and failed-image transitions. Passing older interaction tests is not
substituted for these checks.

## Validation and release record

Local implementation gates completed:

- `pnpm check`: 311 files, zero errors and zero warnings; one pre-existing
  unused-import hint.
- `pnpm test --maxWorkers=1`: **657/657 tests passed across 63 files**.
- `pnpm build`: completed successfully.
- `git diff --check`: clean.

These local results do not stand in for browser execution or deployment
verification. See **Release validation** in
[PR #76](https://github.com/ionutn0301/riftscry/pull/76) for the exact tested
application commit, repaired cold-load run, reader/React browser checks,
repaired measurements, comparison artifacts, main merge and production
deployment. That live record keeps results tied to their actual commit without
requiring a documentation-only commit after each gate.

## Rollback

The pre-release main reference is
[`ad6c678`](https://github.com/ionutn0301/riftscry/commit/ad6c678).
If this release introduces a regression, revert the eventual release commit and
deploy that revert through the existing workflow. This repair requires no data
migration or API rollback. Record the exact release/revert and deployment
identifiers in PR #76's release validation; do not reset shared main history.
