# Companion learning verification

Story: a guest enters through Briefing or Games, understands a recorded item,
requests one match timeline, chooses a replay moment, inspects its evidence and
opens Notebook with the same champion and mode.

The second pass also covers returning-player catch-up, historical item tradeoffs,
support/ARAM progress explanations and three sourced champion practice cards.
Results below describe the complete local branch as of 4 November 2026.

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
| CI browser execution and screenshots | Blocked pending explicit authorization to push the public branch. |

## Boundaries

- Build explanations derive from the existing patch-keyed metadata cache.
- Quick review uses the existing explicit timeline request and rate-limit state.
- No new storage key, schema, AI request, credential, runtime dependency or
  account permission is introduced.
- Existing recorded inventories and unsupported modes remain accessible.

## Environment

Production homepage and briefing entry were inspected in the cloud browser.
The local managed preview daemon is unavailable (`sites-previewd mailbox is
unavailable`), so no local visual sign-off is claimed. Browser regression tests
and desktop/phone capture generation are included for execution in GitHub CI.
Fixture-backed tests do not verify live Riot availability, OAuth, or real player
improvement. This release is a reviewable branch; it does not itself change the
production deployment.

## Publication handoff

First implementation commit: `a8416ee`; subsequent work stays on
`feat/clearer-companion-build-learning`. See git history for the complete branch.
The remote URL matches the repository selected by the user, and the GitHub
connector confirms admin/maintain/push permission. Automatic approval review
nevertheless rejected the branch push because the user had not explicitly
authorized publishing this implementation to a public repository. No remote
branch, PR or deployment was created by this task.

Next action after authorization: push this branch, open a draft PR into `main`,
inspect the full CI result and the new `reading-layout` captures, fix observed
failures and update this record. No merge is part of that publication action.

The user subsequently authorized continued implementation. A further push was
again rejected by automatic approval review because it did not interpret that
instruction as explicit publication approval. No alternate publication method
was attempted. Local implementation and validation continued independently.

## Content review boundaries

Patch 26.22 was fetched from Riot through the existing ingestion pipeline, then
checked against the official article. The parser's paragraph handling and the
reviewed overrides are regression-tested. Historical item comparisons use exact
catalog versions; unknown or restricted alternatives are excluded. The three
practice cards were checked against official champion overviews but have not
been evaluated by coaches or players. Neither perfect UX nor better retention
than competitors has been established.
