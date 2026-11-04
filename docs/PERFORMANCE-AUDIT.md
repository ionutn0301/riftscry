# Performance and experience audit — 2026-11-04

Baseline: `afea9a2487e51d8710cbdffe5c9ad9796a3cbf81`. Measurements compare production builds with the same installed dependencies. The table counts the static JavaScript import graph and immediate Astro islands, gzipped per asset. It excludes inline scripts, on-demand features and response headers; it is not a field Core Web Vitals report.

| Route | Before | After | Reduction |
|---|---:|---:|---:|
| `/` | 156.1 KB | 36.3 KB | 77% |
| `/champions` | 157.7 KB | 38.0 KB | 76% |
| `/patches` | 156.8 KB | 37.2 KB | 76% |
| `/champion/ahri` | 156.2 KB | 36.6 KB | 77% |
| `/patch/26.21` | 159.2 KB | 101.3 KB | 36% |
| `/compare/26.20/26.21` | 156.4 KB | 97.9 KB | 37% |
| `/explore` | 161.7 KB | 42.0 KB | 74% |
| `/next-game` | 215.8 KB | 157.9 KB | 27% |
| `/pool` | 156.3 KB | 98.4 KB | 37% |
| `/notebook` | 191.1 KB | 132.6 KB | 31% |
| `/account` | 178.0 KB | 177.9 KB | 0% |
| `/profile` | 176.9 KB | 176.8 KB | 0% |

## Changes and decisions

- Clean guests establish a guest workspace without downloading the account SDK. Existing sessions, PKCE callbacks, unreadable storage and Account/Profile pages still initialize Auth immediately. A sign-in in another tab or a credential found when restoring a frozen guest document locks the workspace and replaces the document. Absence of a credential never authenticates anyone; AI requests still require server-side verification.
- Global search initializes on first use. The keyboard and pointer controller is present immediately, supplies cancellable loading feedback, and retains native-dialog handoff, focus restoration, search retry and native navigation. React and cmdk load together instead of in serial hydration waterfalls.
- Search ranks the full 632-entry archive but renders at most 48 options. The empty query shows a sample from each category. Fuzzy matching and keyboard selection remain supported; a result count explains how to narrow the search.
- Account status is integrated into the header. Only actionable sync errors/conflicts produce a toast, positioned away from the bottom navigation, with a 44px target. Quiet success stays in Account. The shared page menu now uses the same three-line symbol and Menu label as Home.
- Decorative scene visibility uses IntersectionObserver. Animation frames no longer call synchronous layout/style measurement, and unchanged pointer styles/status attributes are not repeatedly written. Existing GPU pixel budgets, 30fps ambient cadence, reduced motion, visibility suspension and static fallbacks remain intact. Resume starts with a zero delta to avoid a time jump; failed artwork requests can be retried.
- Full-size transparent champion textures use Astro's build-time WebP optimization at quality 90; the same optimized URL serves poster, thumbnails and GPU texture to reuse browser caching. Original art/provenance stays in the repository.
- Cinzel is delivered as WOFF2: 47,920 bytes versus 125,468 bytes, with all 548 glyphs and the variable weight axis retained. Home preloads Cinzel instead of the unused Clash Display font; other routes keep their own display font. Original font and license remain available.
- Historical review videos/screenshots moved from public URLs to `docs/reviews/`, preserving their Git history and evidence. They were deployment overhead, not initial-page downloads. Static output fell from approximately 268.3 MB to 216.6 MB.

## Audit coverage and regression protection

| Area | Verification |
|---|---|
| Home, menu, tour, still mode, artwork fallback | Existing homepage, cinema, keyboard and navigation browser suites; new startup budget and cancellation checks |
| Champion list/history, patch list/detail, comparison, Explore | Generated route contracts, three browser/device projects, static import budgets |
| Briefing, players, matches and AI review | Existing fixture-based player workflow suites, API/cache/rate-limit unit tests; AI guest denial remains enforced |
| Saved pool, findings, notebook, profile | Existing workspace, returning-user, restore and responsive suites |
| Account and cross-tab boundaries | Existing managed-account browser suite plus guest-to-signed-in tab reset; startup classification unit tests |
| Motion and rendering | Reduced-motion suites, context fallback tests, per-frame geometry-read budget, desktop/mobile layout checks |
| Search | Slow module startup, cancellation/reopening, bounded rendered results, results beyond the first window, keyboard selection, retry, overlay handoff and focus restoration |
| Release protection | `performance-experience` CI job retains browser metrics and screenshots and fails on asset-budget regressions |

Local verification: 738 unit/integration assertions passed; production build and typecheck are required. The generated-site checker validates optimized artwork paths against real output files. Browser coverage runs in GitHub Actions because the managed local preview daemon is unavailable in this environment. Live production is also reviewed after deployment.

Run `node scripts/performance-budget.mjs` after a build. The home startup budget is 45 KB gzip, and each optimized hero figure is capped at 300 KB. Run `pnpm exec playwright test --config=playwright.performance.config.ts` for the isolated lab checks. Timing reports are unthrottled CI observations, not a claim about all visitors' hardware or networks.

## Finish criteria

The Chromium run at commit `7d195e9` passed all four performance tests. Actual initial script transfer was 36,240 bytes at both 1440×900 and 390×844, with CLS 0 in both. Trace capture produced GPU readback stalls, so the final performance configuration disables tracing and saves metric JSON before assertions. Lab timings remain environment-dependent and are not evidence of universal frame-rate or field INP guarantees. The cloud browser's WebGL-unavailable fallback was reviewed separately; CI exercises the WebGL world.

No failing release checks, inaccessible primary controls, reproducible regression in the covered flows, or unexplained budget violation. This is a bounded, repeatable quality bar; it does not claim that an evolving application has no possible defects. Real OAuth success was confirmed by the owner before this audit; credentials and provider settings were not changed during it.
