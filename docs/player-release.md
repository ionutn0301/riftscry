# Player beta delivery

## Implementation checkpoint — 2026-10-28

This iteration starts from GitHub `main` commit `8778a5141294ffd3ffb094e7ae7e9acd449b5a4a` and continues on `codex/player-beta-completion`. It builds on the existing player profile, timestamp migration and personal-loadout work. The pull request identifies the delivered commit; an older deployment must not be treated as validation of these changes.

The implemented loop is **profile → match review → editable adjustment → later-match evidence**. The first useful result is a factual match summary. AI interpretation and timeline requests are explicit actions; following a saved link to a timeline event also requests that timeline.

## Routes and reproduction

- `/players`: enter a Riot ID and choose its League server. EUNE uses `eun1`, routed to Riot's Europe match/account APIs. The game is League of Legends; the server selector is separate from the Riot ID tag.
- A resolved profile URL retains the canonical PUUID, server and queue. The profile imports up to 20 recent queue-specific matches in batches of four. History filters and the selected view remain in the URL.
- **Personal builds** groups exact champion/role/queue/patch/item-multiset/rune signatures. Counts describe the imported personal sample, not build strength or global win rates.
- A match review shows match-wide metrics, final inventory, runes, a factual review, and linked supporting facts. The **Request evidence-assisted review** action asks the server for a bounded interpretation. Timeline or AI failure leaves the loaded summary usable.
- **Try this next time** prepares an editable draft. It does not save automatically. The player confirms the condition, tracked item, reason and tradeoff before choosing **Keep adjustment**.
- Return to **Build Memory** after later games. Follow-up uses imported matches strictly after the tracking start, with the same player, champion, known role, queue and patch. A custom condition requires explicit **This condition applied** confirmation for each structurally eligible match; it can be undone. Unknown role, incompatible patch or historical matches cannot be made eligible by that confirmation.
- Select a later eligible match to inspect purchase, sale, destruction and undo records. A purchase is an observation, not a success score or causal outcome.

The tester has supplied a Riot ID for EUNE. That account is not hardcoded, committed as a fixture, or represented by synthetic test data.

## Private deployment boundary

`RIOT_PRIVATE_TESTING_ENABLED=true` enables private Riot calls only in development or a protected Vercel preview. `RIOT_PUBLIC_ACCESS_APPROVED` remains a separate gate and must remain false for this private beta. The API checks the access gate before Redis rate limiting or provider work. Unknown endpoints are rejected without upstream requests.

Keep Vercel Authentication enabled for all deployments. The current session observed `/players` on the production alias redirecting an anonymous browser to Vercel sign-in. That observation verifies the page's sign-in wall, not the complete project configuration, tester membership, sharing exceptions or private API integration. No protection setting has been weakened by this iteration.

Earlier implementation notes reported a successful temporary Redis SET/GET/DEL check, Riot status HTTP 200, Vercel SSO protection set to `all`, and zero project-level bypasses. Those are historical integration observations and have not been independently repeated in this iteration. Vercel is not connected to this session, and the available browser has no authenticated preview session. A successful lookup of the supplied account and live AI generation are still pending.

Server configuration:

- `KV_REST_API_URL` / `KV_REST_API_TOKEN`, or `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`.
- `RIOT_API_KEY`, server-only and used within its permitted scope.
- `RIOT_PRIVATE_TESTING_ENABLED=true` for protected private testing.
- `RIOT_PUBLIC_ACCESS_APPROVED=false` until separately approved for public use.
- Optional `RIOT_IMPORT_LIMIT`, default and maximum 20.

The model remains `google/gemini-3.8-flash`, using the existing runtime-managed Vercel AI Gateway authentication. Its successful runtime execution has not been verified in this iteration. No API key or authentication token is committed, exposed to the client, or requested in chat.

## Evidence and item advice

The review includes typed summary and event facts. Long timelines are sampled across the whole match for the model while the full returned evidence remains available in the interface. Output must contain the four expected sections, valid evidence references and numbers present in the cited facts. These checks bound the response; they do not prove every qualitative interpretation. The UI labels AI interpretation explicitly and falls back to recorded facts if generation, validation or caching fails.

Item metadata is resolved from an official Data Dragon version in the recorded major/minor game patch. It never falls forward to a different patch. Item and rune retrieval are independent, so a rune outage preserves valid item names. Missing metadata retains identifiers and displays an explanation. Profile rows share metadata requests by player/server/patch.

The versioned `item-observations-1` catalogue is intentionally limited:

1. Revisit an actual recorded purchase of an item also present in the final inventory.
2. Compare supported recorded tier-two boots with the two defensive alternatives, using patch-compatible item stats and prices.

Rules require available, purchasable items on the supported map and respect the metadata's champion restrictions. They do not infer the enemy threat, decide an optimal build, reconstruct available gold, model passives/upgrades/abilities, or claim that a different item would have changed the result. Conditional comparisons remain the player's decision. Source shape and item identities were checked against Riot Data Dragon 16.21.1 on 2026-10-28; values are read from each match's compatible payload rather than hardcoded.

Riot references: <https://developer.riotgames.com/docs/portal>, <https://developer.riotgames.com/docs/lol>, <https://developer.riotgames.com/apis>, <https://developer.riotgames.com/policies/general>. Registration, permitted key scope and approval for public access remain separate from successful technical testing. Custom matches are excluded. Existing Riot attribution remains in the footer.

## Notes, revisions and follow-up

Private notes keep the existing browser-local, versioned storage key scoped by canonical player and server. They are not sent to AI or shared Redis. Lookup does not establish account ownership; clearing browser storage loses notes, and no cross-device sync is claimed.

New notes have immutable `createdAt` and explicit `trackingStartedAt`. A material revision updates the decision, item and rationale together, starts a new tracking period and clears previous condition confirmations. Reflection-only edits preserve the baseline. Legacy timestamps remain unknown until the player explicitly starts prospective tracking. Historical dates are never invented.

Custom-condition confirmations are stored as bounded, unique match IDs. Structural eligibility is checked again when reading follow-up, so a stale or manually altered ID cannot qualify a wrong champion, unknown role, different patch or earlier match. Follow-up is derived from imported matches rather than appended counters; refreshing does not duplicate observations. Empty, not-yet-loaded and loading samples have distinct messages.

## Validation of this iteration

- Locked installation passed the active minimum-release-age policy. `ai` is pinned to 7.0.154 with compatible older Gateway/provider-utils packages; the newer lockfile releases were rejected by that policy. The policy was not disabled.
- Full unit suite: **37 files, 304 tests passed**.
- `pnpm check`: exited successfully; the existing cinematic scene still reports a Three.js deprecation hint.
- `pnpm build`: exited successfully and produced the Vercel server/static output.
- `git diff --check`: passed before delivery.
- The dedicated player Playwright suite covers lookup, metadata, grouped builds, navigation, review drafts, evidence links, persistence/isolation, revisions, chronology, condition confirmation/reversal, legacy notes, and provider/storage failures. Fixture interception exists only under `tests/player-e2e`; application routes do not expose a test mode. This suite is now included in CI.

Browser assertions are not reported as passed locally. The ordinary sandbox disallowed network sockets; the dev server started successfully with execution permission. The local browser download was truncated and unusable, and the cloud browser could not reach the local server. CI must provide the behavioral browser result. These environment failures are distinct from the successful production build.

Before treating the beta as validated, run the supplied account through the authenticated protected preview: resolve PUUID, import current rank/history, open a real match, inspect its timeline, request a real review, save/reopen an adjustment, and confirm that public production access remains disabled. The controlled browser tests do not substitute for those live checks.
