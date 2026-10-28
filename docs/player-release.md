# Player expansion delivery

## Routes and reproduction

- `/players`: Riot ID + platform lookup. Credentials are mandatory; no production fixtures.
- `/players?platform=euw1&puuid=<canonical-puuid>&queue=420`: official current rank and at most 20 queue-specific recent matches, imported four at a time. Champion/result filters and view are URL state. History, observed personal loadouts and Build Memory share this route.
- `/matches/<match-id>?platform=euw1&puuid=<canonical-puuid>`: facts, final inventory, rune IDs, patch-matched item metadata, explicit timeline and review requests, private adjustment form.
- Save an adjustment, reload, return to profile Build Memory, then refresh after later games. Same champion, known same role, same queue and same patch establish structural eligibility. Custom conditions and patch changes remain unknown. Explicitly select a later eligible match to inspect raw purchase/undo/sale events. This is not a success score or causal comparison.

Existing champion/pool data and storage keys are untouched. Notes use new versioned browser-local keys scoped by platform and PUUID, as authorized in the requirements. They are never sent to AI or shared Redis. Favorite, revision, reflection, status and discard are supported. Browser clearing loses them; no sync or verified ownership is claimed.

## Environment and public-access gate

Current integration check: Upstash for Redis and Vercel AI Gateway are connected. Redis passed a temporary expiring-key SET/GET/DEL roundtrip, and Riot status authenticated with HTTP 200. Private testing is enabled; public access remains disabled. Vercel project SSO protection is `all` and project-level protection bypass count is zero. Anonymous requests to the existing preview, branch alias and production aliases redirected to authentication. Individual tester access and alias-level sharing exceptions still require verification.

Server variables:
- `KV_REST_API_URL` and `KV_REST_API_TOKEN`, or `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, supplied by the Upstash connection.
- `RIOT_API_KEY`: server-only key used within its permitted scope for private testing; never a browser variable.
- `RIOT_PRIVATE_TESTING_ENABLED=true`: enables the private path in development or protected preview environments only. Keep Vercel Authentication enabled for all deployments.
- `RIOT_PUBLIC_ACCESS_APPROVED=false`: must remain disabled. Neither a working key nor private preview attests to public production approval.
- Optional `RIOT_IMPORT_LIMIT` (default 20, maximum 20).

AI Gateway authentication is runtime-managed. No provider key setup is required. Model: `google/gemini-3.8-flash`, verified in the current Gateway list. AI now produces short match-specific interpretations with schema-validated, existing evidence references. References do not independently validate generated prose: the UI labels interpretation explicitly. The prompt prohibits invented specialist alternatives, hidden information and causal claims. Deterministic review remains when generation fails. The current model was confirmed in the live Gateway catalogue; a successful runtime generation is not yet verified.

Riot policies checked 2026-10-28: https://developer.riotgames.com/docs/portal, https://developer.riotgames.com/docs/lol, https://developer.riotgames.com/apis, https://developer.riotgames.com/policies/general. Product registration and auditing of new features are required. Public alpha/beta also requires production access, not a personal/development key. Custom match data is excluded. Existing Riot legal attribution remains in the footer.

## Backend boundaries

Redis is a cache/limiter, not the primary store for private notes. Shared request locks deduplicate misses. Client rate controls and conservative regional Riot request limits fail closed without Redis. An upstream 429 places a shared host cooldown honoring Retry-After. Cached review key includes evidence content and prompt/rules/model versions. Timeline fetches occur only on explicit request. No automated retries against Riot 403 or 429.

No inventory reconstruction, hypothetical affordability, champion/mode eligibility recommendation, hidden rating, global win-rate claim, or causal inference. Raw purchase events may be undone. Item names use the latest Data Dragon build in the recorded major/minor patch, explicitly not exact hotfix metadata. No specialist rule catalogue is published yet. Item and rune IDs remain visible when metadata is missing. Unknown conditions cannot silently qualify as success or failure.

## Prospective tracking and readable builds

New adjustments have immutable `createdAt` and explicit `trackingStartedAt`; material revisions update target item, applicability and text together, setting `revisedAt` and a new tracking start. Reflection-only edits preserve the baseline. Matches at or before tracking start cannot qualify, even if they finish later. Source date remains evidence chronology.

Legacy notes retain their original content and storage keys. Missing timestamps deserialize as null, never fabricated dates. Use **Start tracking from now** to opt into prospective follow-up. Creation time stays unknown. Follow-up is derived from imported matches, not appended observations; resetting the tracking decision clears selected timeline state.

The item picker searches patch-compatible names and preserves existing IDs on metadata failure. Profiles and matches show versioned names/icons for items and runes, with ID fallbacks. Personal builds group exact champion/role/queue/patch/item-multiset/rune signatures with occurrence counts and source-match links. No specialist alternative is inferred from personal wins.

## Current verification checkpoint

The clean initial branch and remote main both matched `8fdc549889bf8fc85976cac4c3fbd03f0e778a86`. The existing protected preview inspected during the access audit was `riftscry-7v9w65j8e-ionutn0301s-projects.vercel.app`, commit `9b4076e9ba538d358d421eecbed2f9d62715ae16`, NOT the new changes. Production matched the reviewed baseline. Do not conflate these deployments with the local implementation.

Unit suite: 267 passing tests, including chronology, legacy migration and coherent revisions. Subsequent full unit, Astro check, production build and diff checks exited successfully. The player Playwright invocation exited 1 without diagnostics; its behavioral assertions are not reported as passed. The available agent browser rendered the local player form at 835x833 in dark mode; this is not yet end-to-end validation of save/reopen/revision.

Pending: a tester Riot ID/platform and live protected lookup/profile/timeline flow, successful AI generation and forced-failure verification, authenticated tester access/alias sharing audit, full mobile/keyboard/navigation tests, reviewed versioned itemization rules, one-click review-to-adjustment drafts, and a deployment tied to the new commit. Browser-local note storage is retained intentionally to preserve existing notes; no migration to shared storage was attempted.

## Prior baseline verification (historical, not current credentials)

Production build and Astro check passed after enabling the Vercel adapter. Unit suite passed, including new lane/jungle/support fixtures, unknown eligibility, missing player and raw undo evidence. Test fixtures live only under tests and are not exposed in production routes.

The `/players` mobile surface rendered at 359x603 in dark mode. Subsequent browser verification hit a preview routing/server-reload failure. Direct HTTP API verification passed (503 JSON, no credentials leaked). Fixture-isolated Playwright tests were added for save/refresh/player isolation, timeline undo, AI failure and initial timeline laziness, but could not execute: Chromium requires libnspr4.so and the one dependency recovery attempt failed. These browser assertions are NOT reported as passed. Web Vitals could not be completed; no fabricated performance numbers.

Live player lookup, real current rank, real match timelines and end-to-end AI remain unverified until Upstash variables and approved Riot access are available. Specialist itemization catalogue, reviewed champion-specific advice, richer item/rune imagery and cached-review history UI remain limitations. No deployment was initiated or production approval asserted. Git commit identity is supplied in the handoff after synchronization; this file intentionally does not claim a deployment corresponds to an unverified commit.
