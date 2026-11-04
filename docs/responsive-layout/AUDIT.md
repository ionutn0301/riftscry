# Responsive task layout audit

The reported 1913×917 homepage collision came from independent absolute positions: opening actions grew downward while the roster was anchored to the viewport bottom. A continuation link could paint over the roster heading. Smaller offset patches could not account for text wrapping, account recovery messages, or zoom.

## Changes

- The homepage now has intrinsic header, main, champion/task, and footer rows. Briefing and one continuation share a column; champion selection has a separate ruled section; game review has its own action. Short and zoomed windows scroll the document instead of compressing labels or hiding useful content.
- Champion identity and inspection form one secondary group. The scene remains decorative and personal artwork/loading behavior is preserved. Vertical world gestures defer to document scrolling whenever content overflows.
- Removed the homepage height-measurement observer and the conflicting viewport-position media queries.
- Champion directory previews have intrinsic height, wrapping captions, and stop sticking on short windows.
- Atlas footer destinations wrap in narrow landscape. Chapter labels use useful minimum widths and additional rows. Practice choices use an intrinsic card grid.

## Verification contract

`responsive-layout.spec.ts` exercises guest, retained-champion and saved-reading home states at 18 widths (320–2560), including 700/701, 760/761, 1000/1001, 1050/1051, 1100/1101 and the reported 1913×917. It measures actual text ranges and region gaps, not just horizontal overflow. Effective CSS viewports of 480×320 and 320×256 model 200%/400% zoom reflow. These complement, rather than claim to replace, browser-level zoom and accessibility review.

The same suite captures 16 route families at four phone, landscape, intermediate and desktop sizes. Existing account, populated player, briefing, saved reading, keyboard, dialogs, WebKit, Chromium and reduced-motion suites remain in CI. Personal homepage controls are tested for reachability after native scrolling; requiring every control simultaneously onscreen is no longer the product contract.

A dedicated CI artifact retains full-page responsive screenshots. The managed local preview service was unavailable in this workspace, so visual browser verification uses CI captures and the production deployment.
