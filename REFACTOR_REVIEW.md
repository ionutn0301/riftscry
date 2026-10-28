# RiftScry — cinematic journey refactor

## Current revision — 28 October 2026

Started from fetched main `8320ee96dc2925dd39a8b82f42abdc23aef51d54`, preserving
subsequent mobile/search fixes. Reproduced the four advancing-archive test failures;
historical tests now use explicit endpoints. Corrected multi-entity parsing,
refreshed through official patch 26.21, and added per-patch coverage inventories.
See `docs/RELEASE_EVIDENCE.md` for current checks and remaining release blockers.
All earlier sections below are historical evidence, not a claim that this revision
has passed browser, motion, visual-baseline, or deployed-performance acceptance.

## Receiving-environment validation — 27 October 2026

The supplied ZIP patch applied cleanly to its exact base, `5f473dd`. Installed with `pnpm install --frozen-lockfile`. Fixed the readonly pool-subscriber type contract and marked the embedded Astro JSON script explicitly inline. The production build and Vitest suite passed. Desktop Chromium acceptance passed all 24 active original tests; additional layout/storage cases passed at 835×833, 1440×900, 1280×720, 390×844, and 844×390. Added a separate mobile Chromium project (without replacing WebKit): its active touch acceptance and all layout/storage cases passed. The existing Windows-only visual baselines remain skipped.

Reviewed real production screenshots of the opening and reading chapters; strengthened the mobile opening overlay after observing insufficient text contrast over the landscape. Keyboard, modal handoff, direct links, canonical champion selection, Back, retained findings, reduced motion, image/request failures, storage failure, and reader-route regressions were exercised by the browser suites. Screenshots are review evidence, not pixel-golden baselines.

A local, unthrottled production Chromium sample at 390×844 measured LCP 116 ms, CLS 0.00039, and 418,421 bytes of same-origin resource transfer. This is a single local lab sample, excludes cross-origin transfer, and does not establish field INP or physical-device scroll performance.

Remaining limits: WebKit cannot launch because required system libraries are unavailable in this sandbox; the external browser bridge returned `410 SANDBOX_STOPPED` despite the local preview returning HTTP 200. Local production browser review succeeded, but external preview routing and a Safari review remain outstanding. No publishing or release approval occurred. The original implementation report below is retained as historical handoff context, not the current verification status.

## Original review status

Implemented in the local `codex/cinematic-refactor` branch, based on upstream
`5f473dd352930cf7037ee64d1ed9aabf4f99883b`. This is a source implementation and a
concrete design for review. No remote branch, pull request, deployment, or live
site change has been made in this task.

Dependency installation was previously rejected by automatic approval review.
The subsequent standard project install was also rejected as a retry of that
blocked action. No further installation or alternative dependency workaround
has been attempted. Explicit permission to run `pnpm install --frozen-lockfile`
is the remaining prerequisite for the build and rendered validation pass.

**Astro compilation, full TypeScript checking, Vitest, browser regressions,
visual quality, and runtime performance remain unverified.** Source parsing,
data checks, and encoded asset sizes below do not substitute for those checks.

## The experience implemented in source

The homepage is now five real sections in a continuous document. The opening is
one viewport. Choosing a champion changes the records, dated trail, source links,
findings, and saved perspective that follow.

| Chapter | What the visitor does | Why it belongs in the journey |
| --- | --- | --- |
| Arrival | Enter the Rift or go directly to a personal briefing. | Establishes the environment and gives returning users a direct path. |
| Perspective | Choose any of the 173 champions in the committed roster. | The identity changes the subsequent evidence, not just the picture. |
| Change | Read complete values/prose, choose a field, and keep a finding. | The data becomes the main composition and gives interaction a purpose. |
| History | Change dates and inspect connected records for the same field. | Exact source connections explain a field's history without inventing impact scores. |
| Return | Revisit kept findings, save a champion, resume reading, or review a personal archive briefing. | The ending has a practical continuation and does not require repeating the opening. |

The shared Rift map replaces the destination navbar with a spatial map on large
screens and a clearly labeled path on phones. Destinations remain ordinary links.
Alt+M / Option+M opens the map; Cmd/Ctrl+K opens search. Native dialogs manage focus,
and search waits for a map/roster dialog to close before taking focus.

The five environments cross through camera framing, scale, direction, and a
foreground fracture. Work is scheduled on scroll, pointer, resize, and visibility
events; there is no continuous render loop. Native cross-document view transitions
carry the same language into other routes. Reduced motion retains the same
sections, choices, data, and navigation.

Champions, individual champion histories, the patch archive, individual patches,
comparisons, My Pool, and missing-page recovery now share an arrival and a sequence
of named reading chapters. Existing filters, comparisons, timeline disclosures,
pool persistence, shared-pool links, and source links remain part of those routes.

## Assets and loading

The environment art is original AI-generated, abstract, noncanonical landscape
work. The opening, history, and return use different compositions. Mobile has an
independently composed portrait opening. Official Riot champion art remains
complete and separate, using `object-fit: contain` and the existing Data Dragon
asset manifest. See `public/images/voyage/README.md` for asset provenance.

| Environment | Dimensions | Encoded size |
| --- | --- | ---: |
| Desktop overlook | 1672 × 941 | 220,964 bytes |
| Mobile overlook | 941 × 1672 | 241,462 bytes |
| History strata | 1672 × 941 | 258,396 bytes |
| Return basin | 1672 × 941 | 201,394 bytes |

The opening `<picture>` selects one composition. The other two environmental
images receive their `src` as the user approaches their chapters. The browser
starts with one champion model and requests another on selection; roster JSON is
requested when selection/alias resolution needs it. The largest champion model
measured from the current archive is 25,371 bytes; roster JSON is 57,638 bytes.
These sizes are encoded/source measurements, not measured network performance.

The inspected voyage runtime graph does not import the full patch archive,
`investigation.ts`, GSAP, or Three.js. React remains in bounded product islands
such as search and the personal briefing. Actual production chunks and total
hydration cost still need measurement.

## Data and return behavior

The committed archive contains 173 champions and 16 patches, from 26.1
(2026-01-07) through 26.16 (2026-08-11). The interface states its archive date;
it does not present this as live October game data.

Intervals remain `(older, newer]`. Exact rank arrays, conditions, percentages,
source wording, dates, and URLs are retained. A connection statement only joins
matching fields and continuous source values. For example, the two consecutive
Bel'Veth Health Growth records in 26.15 and 26.16 can state that this field's
recorded values returned to their starting values. It does not imply an overall
champion strength calculation.

Empty interval coverage and an entirely absent champion history receive distinct
explanations. Unknown names and failed fetches retain the last readable perspective
with an explicit status and retry. Display aliases such as Wukong resolve to the
canonical ID. Legacy `patch=`, `beat=`, and valid `seen=` links are handled.

Keeping a finding is an explicit action. Valid record IDs travel in the URL and
survive reload/Back; invalid IDs are discarded. Saving champions uses the existing
device-local pool. Reading resume is separate from the reviewed baseline: only
the explicit “Mark reviewed” button advances that baseline. The rotating archive
selection is dated and labeled as an older record, rather than a fabricated new
update.

## Verification completed without dependency installation

- Executed the actual build-time journey model and JSON endpoint modules using
  Node's built-in TypeScript stripping and VM support, backed by repository data.
  All 173 champion models/routes and 654 original source records matched.
- Checked all 44,288 champion/endpoint combinations for the current 16-patch
  archive: 20,760 valid ranges, including exact boundary and invalid-state cases.
  Equivalent Node assertion cases also cover selection, names, arrays, prose,
  and units. This was not a Vitest execution.
- Ran focused exact-connection cases, including the real Bel'Veth return and
  rejection of discontinuous, mixed, gap, or mismatched records.
- Checked the compact return-briefing payload and its modes, safe resume paths,
  separate reviewed/resume writes, and source-backed dated archive selection.
- Parsed the new native TypeScript, Astro frontmatter/script blocks, and authored
  regression sources using Node built-ins. This does not compile Astro templates
  or typecheck React TSX.
- Checked whitespace with `git diff --check` and reviewed the browser import graph.

## Remaining rendered review

After the permitted project installation, run the project checks and production
build, then inspect a managed preview. The current e2e sources cover the new
journey, keyboard navigation, recovery/deep links, and preserved product behavior.
Historical Windows-only screenshot baselines have not been replaced with invented
captures and will require actual visual review.

Review the actual motion between all five chapters at 1440×900, 1280×720,
390×844, and a short landscape size. Verify hero bounds, readable long records,
mobile framing, modal focus/search handoff, Back restoration, missing images,
storage failure, and reduced motion. Measure production transfer, input response,
layout stability, and rendering while scrolling. The release decision must follow
that pass, rather than treating source architecture as proof of a premium result.

`DESIGN.md` is the current design contract; `PRODUCT.md` records the behavior and
data constraints. Those documents replace the conflicting previous directions.
