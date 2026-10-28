# October 28, 2026 — implementation and release evidence

## Starting point

Fetched origin and confirmed clean main at `8320ee96dc2925dd39a8b82f42abdc23aef51d54`. Inspected production, which still advertised archive 26.16. Read DESIGN, PRODUCT, REFACTOR_REVIEW, CONTRIBUTING and the failed workflow 40498167025. The igloo reference was opened, but its capture showed only its loading surface; no claim of a complete reference-motion review is made.

## Implemented

- Reproduced the four investigation failures after ingesting newer patches. Historical assertions now pin 26.14–26.16; archive-growth tests separately protect advancing defaults, stable historical IDs/links/findings, and earlier relevant briefing records.
- Replaced first-number delta interpretation with matching literal scalars/rank arrays. Percent values use percentage points; mixed arrays show per-rank differences. Recipes, ranges, formulas and conditional expressions have no invented aggregate. Regenerated stored numeric directions; a full audit found zero mismatches with the current classifier.
- Fixed multiple h3 entities in one wrapper (26.21's four items), duplicate heading IDs, records preceding the first h3 (26.11 support adjustments), and explicit removal headings. Captured a minimized real 26.21 item fixture retaining exact change lines, excluding artwork and commentary.
- Refreshes refetch all season sources, not just unseen URLs. Unchanged normalized content keeps its previous ingestion timestamp to avoid empty refresh churn. Missing structured source headings/lines block the update PR; workflow artifacts retain coverage reports and failed runs remain visible. Review PRs still never auto-merge.
- Added a bounded device-local collection of 50 findings, independent of selected champion/dates, with removal/restoration and write-failure feedback. Historical URL findings still work. Added direct champion-history saving and explicit briefing/editor destinations.
- Briefing action opens the reviewed interval, not blindly the latest patch. Comparison honors champion/pool query context and preserves it when endpoints change. Quiet champion journeys link to a dated archived change without changing the original interval.
- PoolStrip's initial client render now matches its server render; device-local pool state is applied only after mount. This fixes an identified mismatch mechanism, but the reported production #418 symptom has not been conclusively reproduced and rechecked on the changed deployment.
- Added compact storyboard, task-oriented route headers, a reserved desktop navigation lane, readable metadata sizes, static reduced-motion equivalents, and quiet evidence/history planes instead of repeated landscape scenes. Complete original champion art remains intact. No additional Riot artwork was introduced.

## Data coverage and freshness

Official Riot patch index checked October 28: newest listed release 26.21 (October 20). Archive refreshed from 26.1 through 26.21, 21 patches, 173 champions. `docs/coverage/<patch>.json` records source wrapper headings, source/parsed line counts, parsed entities, normalized entities/counts, excluded mode sections and overrides. 26.21 now contains Bastion Breaker, Dawncore, Gluttonous Greaves and Hubris separately, with 4/1/1/2 records respectively.

The gate exposed a prose-only Shyvana change in 26.7; a reviewed override retains the exact ultimate-haste rule sentence. It also exposed previously dropped 26.11 support records, now retained. Reports make parsed coverage inspectable, but are **not a complete semantic audit of every Riot paragraph**. Prose-only system commentary and separately dated hotfix annotations still need editorial review. Some items appear in system sections because the official source groups them there. Unknown labels and unsupported structures remain conservative, not silently interpreted.

## Checks

- `pnpm ingest --all`: passed with source coverage gates and reviewed override.
- `pnpm test`: 28 files, 241 tests passed.
- `pnpm check`: passed.
- `pnpm build`: passed.
- Stored numeric-direction audit: zero mismatches.
- `git diff --check`: passed at the preceding validation checkpoint.
- Browser tests: blocked, not passing. Initial attempt lacked a browser executable. One recovery installed Chromium. The subsequent run reported 76 launch failures and 10 skips because `libnspr4.so` is unavailable; no application assertions ran. WebKit was not run.
- The 10 skips in that attempted two-project run include the Windows-only visual baseline cases and desktop-only cases skipped on mobile. Historical presentation files remain excluded by the pre-existing Playwright configuration. New connected-journey tests were added after the blocked run and remain unexecuted.
- Hosted local browser bridge: `404 SANDBOX_NOT_FOUND`. The original production site could be opened, but that is not verification of these changes.

## Outstanding release requirements

This is a substantial implementation checkpoint, **not completion of every acceptance criterion**. Desktop/mobile screenshots of the changed app, complete first/return recordings, reviewed Ubuntu visual goldens, actual motion refinement, contrast/touch/enlarged-text measurements, post-fix hydration reproduction, full E2E passage, and deployed throttled mobile performance remain outstanding. No field p75 CWV claim or localhost performance substitute is made. No production alias promotion is authorized or claimed here. Review the synchronized branch/deployment and complete these checks before release.
