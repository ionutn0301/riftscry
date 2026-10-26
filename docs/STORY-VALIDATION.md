# Replacement scroll story — 26 October 2026

Review `/story-review/` for the actual completed four-frame contact sheet, unedited browser video, portrait captures, reduced-motion capture, asset register and raw lab measurements. `/images/story/storyboard.png` was composed before implementing the story using the intended actual assets.

## Implemented
- Native document scrolling; no range inputs, timeline rail, wheel interception, compulsory interaction or WebGL dependency.
- Original battlefield with bounded landscape and separately masked foreground movement; dark foreground threshold into champion encounter.
- Three explicitly labeled, verified archived-patch champion choices. Selection does not navigate or reset scroll.
- Dedicated semantic numeric composition with complete records, all ranks, units, exact Before/After controls, official source, history and comparison links.
- Distinct staggered pool ensemble, explicit add/remove, all saved champions accessible, original local persistence and no maximum.
- Shared Atlas takeover removed. Existing utility routes and query behavior are directly accessible. Old rendering modules remain unmounted to preserve unrelated tested logic.
- Reduced motion disables travel while retaining all four compositions. Unsupported CSS scroll timelines retain the normal readable document.

## Checks run
- `pnpm check`: zero diagnostics.
- `pnpm test`: 187 passing tests in 23 files.
- `pnpm build`: 452 generated pages.
- `pnpm e2e`: all 10 desktop behavioral tests passed; 7 WebKit mobile tests could not launch; 9 pre-existing platform/keyboard skips. WebKit dependency recovery attempted once, blocked by missing apt-get.
- `pnpm exec playwright test --project=desktop`: 10 pass, 3 Windows visual-baseline skips.
- `node scripts/story-proof.mjs`: actual full-motion wheel sequence, Camille selection, exact Before/After values, add and reload persistence, touch Kennen selection/add/reload, 359x603 portrait layouts, no horizontal overflow, reduced motion and no runtime errors.
- Warm/local development-server Chromium lab: desktop LCP 232 ms, CLS 0, p95 frame interval 16.8 ms; emulated-phone LCP 120 ms, CLS 0. No throttling, physical device or field data. INP unmeasured.

## Precise limitations
- Safari/WebKit verification requires the missing host libraries. Physical-phone performance remains unmeasured.
- Riot Developer Portal registration/audit is an owner-side requirement; status could not be verified. See STORY-ASSETS.json for permission basis and exact sources.
- igloo.inc loaded only its preloader during reference inspection; no claim that its entire live sequence was observed.
- The platform agent-browser router reported preview not ready. The existing local Playwright browser successfully accessed the running Astro preview and supplied the actual UI evidence instead. No extra dev server was launched.

## Runtime fix
The new pool scene supplies an explicit empty server snapshot to the persistent atom hook, then hydrates saved device preferences without a React mismatch. Separate production/development Vite cache directories avoid production JSX-runtime prebundles being served to the live development browser after checks/builds.
