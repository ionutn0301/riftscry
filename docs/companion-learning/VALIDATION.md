# Companion learning verification

Story: a guest enters through Briefing or Games, understands a recorded item,
requests one match timeline, chooses a replay moment, inspects its evidence and
opens Notebook with the same champion and mode.

The second pass also covers returning-player catch-up, historical item tradeoffs,
support/ARAM progress explanations and three sourced champion practice cards.
Results below record local validation on 4 November 2026. The release is published
in [PR #78](https://github.com/ionutn0301/riftscry/pull/78); its checks and merge state
are the current release record.

| Check | Result |
| --- | --- |
| `pnpm check` | Passed; zero errors/warnings, one existing unused-import hint in `players.astro`. |
| `pnpm test --maxWorkers=2` | 786 tests passed across 76 files, including historical item eligibility, missing stats, catch-up ranges, source parsing and React interaction cases. |
| `pnpm build` | Passed with the existing Vercel adapter. |
| `node scripts/verify-atlas.mjs` | Passed on all 673 generated pages. |
| `node scripts/verify-learning-paths.mjs` | Passed: six requests through the built SSR handler, plus three generated practice cards. No HTTP server or browser was used. |
| `node --import tsx scripts/patch-ingestion/index.ts --validate` | All 22 archived patch files passed schema validation. |
| `git diff --check` | Passed. |
| Browser test collection | 13 scenarios collect across guest learning, returning/practice paths and Momentum. Includes 320/390/1440px, retry, history and no-JavaScript cases. Collection alone is not execution. |
| CI browser execution and screenshots | Running on PR #78; inspect the latest commit's checks and `reading-layout` artifacts. |

## Boundaries

- Build explanations derive from the existing patch-keyed metadata cache.
- Quick review uses the existing explicit timeline request and rate-limit state.
- No new storage key, schema, AI request, credential, runtime dependency or
  account permission is introduced.
- Existing recorded inventories and unsupported modes remain accessible.

## Environment

Production homepage and briefing entry were inspected in the cloud browser.
The published preview's catch-up and Lux practice flow were also inspected.
The local managed preview daemon is unavailable (`sites-previewd mailbox is
unavailable`), so no local visual sign-off is claimed. Browser regression tests
and desktop/phone capture generation are included for execution in GitHub CI.
Fixture-backed tests do not verify live Riot availability, OAuth, or real player
improvement. This release is a reviewable branch; it does not itself change the
production deployment.

## Publication and release checks

The user authorized publication and merging to main on 4 November. The connected
GitHub account published the locally tested tree as commit `a163383`, with tree
`b1c546aa991ae3c809d0ad9dd79272954422b353` matching the local build exactly.

The first CI run exposed an outdated six-section guide assertion and search
rendering 53 entries after adding task shortcuts. The guide assertion now checks
all eight sections; the search implementation retains its existing 48-entry
budget. Live preview testing also led to explicit label/control associations in
the catch-up form. No assertion timeout or performance limit was relaxed.

Further CI feedback fixed relevance ordering in typed search, wrapping of Explore
controls at 320px, a champion preview shifting when its caption wrapped, and
catch-up controls restoring an old draft rather than the URL's results on Back.
Moving archive assertions now derive the current patch from checked-in data;
historical evidence assertions retain their fixed source patch. The exhaustive
interval test is split into one case per champion without removing assertions or
changing timeouts: all 959 unit/integration cases pass locally. The guest review
browser case also verifies its existing timeline survives chapter navigation
without another request.

Merge is gated on the final PR checks. GitHub CI artifacts provide the actual
desktop/mobile captures; the PR records final inspection and deployment results.

## Content review boundaries

Patch 26.22 was fetched from Riot through the existing ingestion pipeline, then
checked against the official article. The parser's paragraph handling and the
reviewed overrides are regression-tested. Historical item comparisons use exact
catalog versions; unknown or restricted alternatives are excluded. The three
practice cards were checked against official champion overviews but have not
been evaluated by coaches or players. Neither perfect UX nor better retention
than competitors has been established.
