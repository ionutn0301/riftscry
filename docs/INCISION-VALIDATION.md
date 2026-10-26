# RiftScry V4: branching inspection

## Implementation

The active `/` now renders a branching patch composition, not the previous four-section page. `RiftStory` coordinates a URL-derived state with the existing authoritative `$pool` persistent store. Existing pool key and utility routes are unchanged. `IncisionStage` retains both source-art actors and independently transforms original material planes. Selection/reveal interrupts the current GSAP timeline rather than queueing it. The ability seal uses a source-to-anchor path. Deep links settle directly; Back/Forward restores URL state. No wheel interception, audio gate, fake combat footage, or reconstructed historical champion state.

Azir's one Q damage record and Camille's five real records are taken directly from `26.16.json`. Both complete Before and After strings remain visible. Differences are computed only when numeric-array lengths and suffix context match; changed level breakpoints receive an explanation instead of invalid subtraction. The full roster/search/history/patch/filter/comparison utilities remain accessible. Collection art is derived only from actual saved IDs, with a visible subset of 8 and a complete-collection link; the original storage contract is retained.

## Slice-first review

`incision-slice.spec.ts` records overview → Azir encounter → reveal → return. Initial browser inspection exposed over-large framing and too much foreground occlusion. Those were revised before the second branch was completed. Source silhouettes were refined using OpenCV GrabCut without generating missing character parts. Subsequent captures checked the middle of the actual transformation, not just its endpoints.

## Evidence

`/incision-review/index.html` contains the unedited two-branch recording, start/middle/end frames, alternative Camille record, portrait/reduced-motion images, raw performance JSON and asset register. It supersedes the earlier `/story-review/` material, which remains an archived artifact of the rejected V3 concept.

Mode: production build, Chromium, GSAP/CSS 2.5D and accessible HTML. No WebGL renderer. Video contains actual clicks, layers and record changes, not an edited simulation. Reduced-motion captures are clearly distinguished.

## Verification

- `pnpm check`: no errors, warnings or hints.
- `pnpm test`: 193 tests passed.
- `pnpm build`: passed.
- Full Playwright run: 15 passed, 9 skipped, 12 failed to launch due to missing WebKit system libraries. `playwright install-deps webkit` recovery failed because apt-get is unavailable. Do not claim the complete suite passed.
- Desktop-project checks include explicit Chromium touch contexts, URL/browser history, persistence/removal, keyboard, visible search, interruptible selection, qualitative level context, source values, utility routes, and artwork fallback before hydration.
- Performance observers ran separately without screenshot/video overhead at 1440×1000 and 390×844. Measured layout shift is zero after replacing layout-property animation with transforms. Desktop frame pacing remains uneven in the VM (~67ms p95); no claim of 60fps or real-device performance. See raw JSON for LCP, event-duration and frame timing. Max Event Timing duration is not field INP.

## Remaining limits

The host-managed preview was not listening (502), and its preview URL lookup returned null. The build was exercised on the existing repository's short-lived production browser-test server at localhost:4321, not a manually launched dev server. A running host preview could not be confirmed.

Riot's three requested policy pages were reviewed on 2026-10-26. Data Dragon is a supported asset source, but that does not establish project-specific approval or unrestricted commercial rights. Registration and feature audit require owner confirmation. No reference-site assets or music were copied. Igloo's live canvas did not render a readable scene in the automated browser; its creator case study was successfully read.

This is source-art 2.5D, not a rigged 3D character system. Painterly matte edges and original baked lighting remain. Portrait tests are Chromium emulation, not physical iOS validation. See the asset register for preparation scripts, source URLs, intended usage and permissions scope.
