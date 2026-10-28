# Player expansion delivery

## Routes and reproduction

- `/players`: Riot ID + platform lookup. Credentials are mandatory; no production fixtures.
- `/players?platform=euw1&puuid=<canonical-puuid>&queue=420`: official current rank and at most 20 queue-specific recent matches, imported four at a time. Champion/result filters and view are URL state. History, observed personal loadouts and Build Memory share this route.
- `/matches/<match-id>?platform=euw1&puuid=<canonical-puuid>`: facts, final inventory, rune IDs, patch-matched item metadata, explicit timeline and review requests, private adjustment form.
- Save an adjustment, reload, return to profile Build Memory, then refresh after later games. Same champion, known same role, same queue and same patch establish structural eligibility. Custom conditions and patch changes remain unknown. Explicitly select a later eligible match to inspect raw purchase/undo/sale events. This is not a success score or causal comparison.

Existing champion/pool data and storage keys are untouched. Notes use new versioned browser-local keys scoped by platform and PUUID, as authorized in the requirements. They are never sent to AI or shared Redis. Favorite, revision, reflection, status and discard are supported. Browser clearing loses them; no sync or verified ownership is claimed.

## Environment and public-access gate

Integration check: Upstash for Redis and Vercel AI Gateway connected. Two environment inventory checks returned only `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL`; Upstash REST credentials were not listed. Direct API check returned the expected 503 JSON when absent.

Server variables:
- `KV_REST_API_URL` and `KV_REST_API_TOKEN`, or `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, supplied by the Upstash connection.
- `RIOT_API_KEY`: approved production key for this product. Never a browser variable.
- `RIOT_PUBLIC_ACCESS_APPROVED=true`: operator attestation that Riot has reviewed these new features. A flag does not obtain approval.
- Optional `RIOT_IMPORT_LIMIT` (default 20, maximum 20).

AI Gateway authentication is runtime-managed. No provider key setup is required. Model: `google/gemini-3.8-flash`, verified in the current Gateway list. AI only selects evidence references for reviewed fixed prose; novel tactical claims are intentionally not generated. Deterministic review remains when generation fails. This is narrower than a freeform AI match analyst.

Riot policies checked 2026-10-28: https://developer.riotgames.com/docs/portal, https://developer.riotgames.com/docs/lol, https://developer.riotgames.com/apis, https://developer.riotgames.com/policies/general. Product registration and auditing of new features are required. Public alpha/beta also requires production access, not a personal/development key. Custom match data is excluded. Existing Riot legal attribution remains in the footer.

## Backend boundaries

Redis is a cache/limiter, not the primary store for private notes. Shared request locks deduplicate misses. Client rate controls and conservative regional Riot request limits fail closed without Redis. An upstream 429 places a shared host cooldown honoring Retry-After. Cached review key includes evidence content and prompt/rules/model versions. Timeline fetches occur only on explicit request. No automated retries against Riot 403 or 429.

No inventory reconstruction, hypothetical affordability, champion/mode eligibility recommendation, hidden rating, global win-rate claim, or causal inference. Raw purchase events may be undone. Item names use the latest Data Dragon build in the recorded major/minor patch, explicitly not exact hotfix metadata. No specialist rule catalogue is published yet. Item and rune IDs remain visible when metadata is missing. Unknown conditions cannot silently qualify as success or failure.

## Verification and remaining work

Production build and Astro check passed after enabling the Vercel adapter. Unit suite passed, including new lane/jungle/support fixtures, unknown eligibility, missing player and raw undo evidence. Test fixtures live only under tests and are not exposed in production routes.

The `/players` mobile surface rendered at 359x603 in dark mode. Subsequent browser verification hit a preview routing/server-reload failure. Direct HTTP API verification passed (503 JSON, no credentials leaked). Fixture-isolated Playwright tests were added for save/refresh/player isolation, timeline undo, AI failure and initial timeline laziness, but could not execute: Chromium requires libnspr4.so and the one dependency recovery attempt failed. These browser assertions are NOT reported as passed. Web Vitals could not be completed; no fabricated performance numbers.

Live player lookup, real current rank, real match timelines and end-to-end AI remain unverified until Upstash variables and approved Riot access are available. Specialist itemization catalogue, reviewed champion-specific advice, richer item/rune imagery and cached-review history UI remain limitations. No deployment was initiated or production approval asserted. Git commit identity is supplied in the handoff after synchronization; this file intentionally does not claim a deployment corresponds to an unverified commit.
