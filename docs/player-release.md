# Player beta delivery

## Implementation checkpoint — 2026-10-28

This iteration starts from GitHub `main` commit `8778a5141294ffd3ffb094e7ae7e9acd449b5a4a` and continues on `codex/player-beta-completion`. It builds on the existing player profile, timestamp migration and personal-loadout work. The pull request identifies the delivered commit; an older deployment must not be treated as validation of these changes.

The implemented loop is **player gateway → separate profile → match review → editable adjustment → later-match evidence**. The player area now uses the homepage's original environmental art, display typography, open compositions and shared Rift map. The first useful result is a factual match summary. AI interpretation and timeline requests are explicit actions; following a saved link to a timeline event also requests that timeline.

## Routes and reproduction

- `/players`: enter a Riot ID and choose its League server. EUNE uses `eun1`, routed to Riot's Europe match/account APIs. The game is League of Legends; the server selector is separate from the Riot ID tag. This route is a search gateway, not an embedded profile.
- `/players/:platform/:puuid`: the resolved, bookmarkable profile. Displayed identity comes from Riot's account-by-PUUID response, not a trusted `name` query. Old `/players?platform=…&puuid=…` links redirect compatibly. Queue, champion, result and selected view remain in the URL; match links return to that context.
- History defaults to **All recent games** and omits both queue and type from the upstream match-ID request. The previous default of Ranked Solo/Duo (`420`) excluded newer ARAM/normal games and could leave old ranked games as the apparent latest result. There was no date cutoff. Exact queue selections request that queue upstream.
- The profile imports at most 20 recent match IDs in batches of four and sorts loaded games newest-first. Partial or excluded imports are counted explicitly and can be retried. The denominator is the imported, filtered sample, never all games on the account.
- Statistics are grouped by actual queue ID, with separate outcome and metric denominators. There is no all-mode win rate. ARAM (`450`), ARAM: Mayhem (`2400`), ARAM Clash (`720`), Ranked Solo/Duo, Ranked Flex, Normal Draft, Swiftplay and Quickplay retain distinct samples. Current official ranked status is separate from the match sample.
- **Personal builds** groups exact champion/role/queue/patch/item-multiset/rune signatures. Counts describe the imported personal sample, not build strength or global win rates.
- A match review shows match-wide metrics, final inventory, runes, a factual review, and linked supporting facts. The **Request evidence-assisted review** action asks the server for a bounded interpretation. Timeline or AI failure leaves the loaded summary usable.
- **Try this next time** prepares an editable draft. It does not save automatically. The player confirms the condition, tracked item, reason and tradeoff before choosing **Keep adjustment**.
- Return to **Build Memory** after later games. Follow-up uses imported matches strictly after the tracking start, with the same player, champion, known comparison context, actual queue and patch. New non-lane notes can explicitly record their ARAM/Arena/rotating-mode context without inventing a lane; existing notes with absent roles stay unknown. A custom condition requires explicit **This condition applied** confirmation for each structurally eligible match; it can be undone. Unknown context, incompatible patch or historical matches cannot be made eligible by that confirmation.
- Select a later eligible match to inspect purchase, sale, destruction and undo records. A purchase is an observation, not a success score or causal outcome.

The tester has supplied a Riot ID for EUNE. That account is not hardcoded, committed as a fixture, or represented by synthetic test data.

## Private deployment boundary

`RIOT_PRIVATE_TESTING_ENABLED=true` enables private Riot calls only in development or a protected Vercel preview. `RIOT_PUBLIC_ACCESS_APPROVED` remains a separate gate and must remain false for this private beta. The API checks the access gate before Redis rate limiting or provider work. Unknown endpoints are rejected without upstream requests.

Keep Vercel Authentication enabled for all deployments. Earlier in this session, the now-authorized Vercel management connection verified SSO protection enabled with `deploymentType: all`, a READY branch preview, private testing enabled and public approval disabled. Anonymous page/API requests reached Vercel sign-in. These observations do not prove that the agent's browser has an authenticated deployment session or that the live Riot/model integrations work. No protection setting has been weakened by this iteration.

Earlier implementation notes reported a successful temporary Redis SET/GET/DEL check and Riot status HTTP 200; those integration observations have not been independently repeated in this iteration. Team authorization is now resolved. The agent's protected-browser session remained at sign-in, and no shareable protection-bypass link was created. A successful agent-observed lookup of the supplied account and live AI generation are still pending. Controlled fixtures must not be presented as that account's data.

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

The versioned `item-observations-2-mode-aware` catalogue is intentionally limited:

1. Revisit an actual recorded purchase of an item also present in the final inventory.
2. Compare supported recorded tier-two boots with the two defensive alternatives, using patch-compatible item stats and prices.

Rules require available, purchasable items on the supported map and respect the metadata's champion restrictions. They do not infer the enemy threat, decide an optimal build, reconstruct available gold, model passives/upgrades/abilities, or claim that a different item would have changed the result. Conditional comparisons remain the player's decision. Source shape and item identities were checked against Riot Data Dragon 16.21.1 on 2026-10-28; values are read from each match's compatible payload rather than hardcoded.

Every review includes a mode-context fact. ARAM, Mayhem, Arena and rotating modes do not receive Summoner's Rift lane/farming/vision or standard item advice. Swiftplay retains descriptive rates for its own queue but withholds standard item alternatives because its progression and item rules differ. Mayhem and Arena do not display standard rune setups. Recorded combat, inventory and timeline events remain available. The review prompt and evidence/cache versions changed so prior assumptions are not reused.

Queue identities were checked against Riot's current official catalogue on 2026-10-28: <https://static.developer.riotgames.com/docs/lol/queues.json>. Mode capabilities are explicit in `src/lib/player/modes.ts`; unknown/custom/tutorial/bot queues are excluded rather than relabeled as normal or ranked.

Riot references: <https://developer.riotgames.com/docs/portal>, <https://developer.riotgames.com/docs/lol>, <https://developer.riotgames.com/apis>, <https://developer.riotgames.com/policies/general>. Registration, permitted key scope and approval for public access remain separate from successful technical testing. Custom matches are excluded. Existing Riot attribution remains in the footer.

## Notes, revisions and follow-up

Private notes keep the existing browser-local, versioned storage key scoped by canonical player and server. They are not sent to AI or shared Redis. Lookup does not establish account ownership; clearing browser storage loses notes, and no cross-device sync is claimed.

New notes have immutable `createdAt` and explicit `trackingStartedAt`. A material revision updates the decision, item and rationale together, starts a new tracking period and clears previous condition confirmations. Reflection-only edits preserve the baseline. Legacy timestamps remain unknown until the player explicitly starts prospective tracking. Historical dates are never invented.

Custom-condition confirmations are stored as bounded, unique match IDs. Structural eligibility is checked again when reading follow-up, so a stale or manually altered ID cannot qualify a wrong champion, unknown role, different patch or earlier match. Follow-up is derived from imported matches rather than appended counters; refreshing does not duplicate observations. Empty, not-yet-loaded and loading samples have distinct messages.

## Validation checkpoints

### Cinematic profile and mode-aware history refactor

The new source adds unit coverage for unfiltered history, exact queue requests, bounded imports, verified account identity, per-queue statistics, missing-value denominators, mode-aware evidence and non-lane prospective memory. The local full suite passes **330 tests in 39 files**; Astro typecheck and the production build pass. The dedicated player browser suite preserves the ten existing workflows and adds canonical-route, mode, refresh and visual coverage. Its controlled history includes recent ARAM, older ranked, Swiftplay and Mayhem games, never the tester's real identity.

CI writes thirteen successful visual captures to the `player-experience` artifact: desktop, portrait and short-phone gateway/profile views, plus a full-motion gateway. Fixtures also cover partial imports/retry, a changed history tail during refresh, forged query identity, legacy redirects, keyboard/map navigation and reduced motion. The infinite history cache includes the complete ordered ID sample; old batches cannot count toward a new sample. Progressive loading does not refetch its first four details on each new batch. Current browser execution results must be read from the latest pull-request checks; test discovery alone is not a browser pass.

### Earlier player beta baseline (`7b30ff6`)

- Locked installation passed the active minimum-release-age policy. `ai` is pinned to 7.0.154 with compatible older Gateway/provider-utils packages; the newer lockfile releases were rejected by that policy. The policy was not disabled.
- Full unit suite at the prior beta checkpoint: **38 files, 306 tests passed**, including persisted-pool hydration coverage.
- `pnpm check`: exited successfully; the existing cinematic scene still reports a Three.js deprecation hint.
- `pnpm build`: exited successfully and produced the Vercel server/static output.
- `git diff --check`: passed before delivery.
- The dedicated player Playwright suite covers lookup, metadata, grouped builds, navigation, review drafts, evidence links, persistence/isolation, revisions, chronology, condition confirmation/reversal, legacy notes, and provider/storage failures. Fixture interception exists only under `tests/player-e2e`; application routes do not expose a test mode. This suite is now included in CI.

Browser assertions are not reported as passed locally. The ordinary sandbox disallowed network sockets; the dev server started successfully with execution permission. The local browser download was truncated and unusable, and the cloud browser could not reach the local server. The first CI browser run executed all ten scenarios: six passed and four exposed inconsistent accessible form labels around nested selects and prefilled textareas. Those controls now use explicit label/control associations. The hosted player suite subsequently passed all ten scenarios on commit `490c677` after also fixing submission before hydration. The broader static-site test server had still targeted `dist/`; it now serves the Vercel adapter's `dist/client/` output, whose readiness URL was verified as HTTP 200. That broader run executed 159 cases: 121 passed, 21 were skipped by existing configuration, and 17 failed across six repeated scenarios. It exposed a saved-pool hydration mismatch, now covered by a stable server snapshot and a hydration regression test. The other failures came from outdated test assumptions about archived buff counts, the homepage's active patch, an already-cached champion, and intentionally compact mobile navigation. Tests now check the current canonical data and usable navigation while preserving failure/retry, history and storage assertions. The pull request's latest CI run records the final regression result. These browser checks are distinct from the successful production build.

Before treating the beta as validated, run the supplied account through the authenticated protected preview: resolve PUUID, import current rank/history, open a real match, inspect its timeline, request a real review, save/reopen an adjustment, and confirm that public production access remains disabled. The controlled browser tests do not substitute for those live checks.
