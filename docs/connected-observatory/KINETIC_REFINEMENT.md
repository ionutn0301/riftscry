# Movement with a purpose

Follow-up audit and implementation: 30 October 2026. Baseline: the connected
observatory release at `88d0c430d551dc0a91bf2a21fff14394447224ed`.

The first release established one world and focused scenes across all 14 route
families. This pass addresses the remaining gap between that structure and its
physical behavior: the world map was interactive, but the patch instrument was
still a picture, scene changes all moved in the same direction, and large nested
panels obscured the environment.

## One world during navigation

Native document transitions now treat the environment, header, task stage, and
destination controls as separate visual layers. The controls stay anchored while
the stage changes. Moving into a detail uses a shallow approach; returning uses
its reverse. Travel between destinations has a direction derived from the
browser's same-origin navigation metadata. The ordinary links still own the
navigation, including modified clicks and browser Back.

Within every multi-scene destination, previous and next scenes enter from opposite
sides. A scene selection commits immediately. There is no animation queue, input
lock, loading interlude, or artificial delay before the task becomes available.
The existing reduced-motion choice disables these effects, and the native-link
fallback remains available without transition support.

## The archive becomes an instrument

The dated patch chart accepts a tap or drag directly. Its cursor follows actual
release-date positions, including irregular gaps. Keyboard and assistive input
use a native range: arrows move one recorded patch; Home and End reach the archive
endpoints. The large patch number, exact date, entry counts, highlighted column,
and entry link change together.

Selection does not open a page. **Enter patch** remains an explicit native link,
and all chronological list links remain available. Column height still counts
champion, item, and system entries; it is not an impact or strength score. No
synthetic intermediate patch or date is created.

## An exact place to continue

The existing device-local reading resume now follows public champion, patch, and
comparison records after real scene and record selections. It preserves the exact
query and fragment, including final filters when leaving a reader. Directory,
player, briefing, and notebook visits do not replace that record.

Explore continues to own its richer champion/interval/event resume. It records
only after its requested model resolves successfully, including direct entry and
Back. A generic scene notification does not overwrite it.

The map's existing Explore shortcut becomes **Continue** when a different valid
reading place is available. It occupies the same space; the five main destination
links keep their meaning. Invalid or private legacy resumes are ignored, storage
failure does not block navigation, and no finding, note, or reviewed baseline is
created automatically.

## Quieter task surfaces across the platform

Reader, Explore, Briefing, Games, match review, and Saved surfaces now use a common
directional reading gradient. Artwork and margins show more of the environment;
exact evidence retains a dark backdrop. Redundant enclosing outlines are removed
without changing the established dimensions or scrolling behavior. Selected dates
and records use a lighted edge instead of another box.

Phone patch controls use less spacing before the evidence. The duplicated
champion-record counter is removed; the filter's existing status still reports
the filtered count, total, and applied scope. The remaining buff/nerf summary is
explicitly labeled **Patch totals** so it cannot be mistaken for filtered totals.
Name search, zero-result recovery, original sources, and no-JavaScript records
remain available.

Champion detail also handles unavailable external artwork: the broken image is
replaced by the champion's identity and an explicit unavailable state. Successful
images retain their complete original framing. Exact records and navigation do
not depend on artwork delivery.

### Rendered views

- [Desktop patch instrument](screenshots/kinetic-timeline-desktop.webp)
- [Phone patch instrument](screenshots/kinetic-timeline-mobile.webp)

These are actual browser captures. The cursor is at the latest archived entry;
dragging or keyboard input selects another real recorded date before entry.

## Research behind this pass

This is a qualitative reference review, not a measurement of market adoption or
a prediction of engagement. Primary sources were reviewed on 30 October 2026.

- [Dardo: Janus Observatory](https://dardo.studio/en/work/janus-observatory/)
  describes connected narrative, atlas, and instrument views, with usable
  structured records without WebGL. It informed the decision that RiftScry's
  chart should perform the selection task itself. Its project metrics are the
  studio's own reports and are not adopted as RiftScry benchmarks.
- [Chrome: cross-document view transitions](https://developer.chrome.com/docs/web-platform/view-transitions/cross-document)
  documents named visual layers, activation metadata, early event registration,
  and the different lifecycle of incoming and outgoing transition promises.
- [Chrome: consistent cross-document transitions](https://developer.chrome.com/docs/modern-web-guidance/guides/ui-behaviors/consistent-cross-document-transitions)
  explains why critical layout must exist before the incoming snapshot. The
  existing early opt-in and scoped cancellation handling remain in place.
- [W3C: animation from interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)
  supports a global way to disable nonessential movement. RiftScry's device and
  saved motion preferences continue to govern the complete experience.

## Verification boundaries

Release-specific commands and results are recorded in the pull request. The
verification includes the full unit/data suite, exact date/count/entry checks,
keyboard and touch timeline use, exact-record continuation, native transition
cancellation, shared navigation, and fixture-backed player routes. Synthetic
player fixtures verify UI/API contracts; they do not demonstrate live Riot-service
availability.

Protected hosted browser access remains outside the checks: deployment source,
readiness, and the production alias are verified through Vercel metadata, while
the interface is exercised locally and in CI. Existing deployment protection is
retained.
