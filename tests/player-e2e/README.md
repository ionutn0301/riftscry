# Player workflow browser tests

Run from the repository root after installing the locked dependencies and a supported Playwright browser:

```sh
pnpm exec playwright test --config=playwright.player.config.ts
```

The configuration reuses a local development server on port 3000 when available. Otherwise it starts the normal development command. A separately installed browser can be selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

These tests intercept `/api/player/*` **inside the test browser only**. The fixtures are under this test directory and are not served by application routes. They do not set Riot access flags, load API keys, disable Vercel protection, or represent the tester's account.

The suite exercises the separate lookup gateway and canonical `/players/{platform}/{puuid}` profile, legacy-link redirects, direct links, reload and Back navigation, readable metadata, grouped loadouts, a fixture AI success and failure, evidence disclosure, draft confirmation, local note persistence and isolation, coherent revisions, prospective follow-up, explicit custom-condition confirmation and reversal, legacy activation, and corrupt-storage recovery. The profile identity comes from the mocked account endpoint; editable name-query hints cannot impersonate another account.

Recent-history regressions deliberately combine 2026 ARAM games with a 2025 ranked game, Swiftplay, and ARAM: Mayhem. The fixture history endpoint respects exact queue selection and returns newest first. The tests verify that the default request is unfiltered, mode badges and per-queue win rates/average K/D/A remain separate, a delayed or failed match is disclosed as an incomplete sample, and refresh repairs its counts. A separate refresh regression replaces the fifth history ID while leaving the first four unchanged, holds any obsolete detail response, and verifies the replacement and updated denominators. Initial imports also assert one detail request per match. ARAM review facts withhold Summoner's Rift farming and vision analysis. Build Memory preserves exact-queue eligibility, including between ordinary ARAM and Mayhem.

Cache regressions count intercepted browser requests through repeated refreshes, exact-queue changes, match review navigation, returning to the profile and reloading. Successful summaries must be reused, while a failed summary can be retried without requesting the successful ones again. A controlled 429 response preserves the existing sample, disables refresh with a visible countdown, makes no further request before `Retry-After` expires, and recovers on the next explicit refresh. A separate case recovers initially unavailable account identity and rank without reloading successful summaries. The tests advance the browser's date instead of waiting through a real cooldown. The existing match failure workflow also checks explicit recovery of unavailable item references. Separate unit tests cover concurrent request coalescing, bounded browser requests, Redis cache fills, upstream budgets and API admission; browser fixture counts alone do not establish real Riot request counts.

Successful visual checks write **15 fixture-only PNGs** to `player-visuals/`: gateway and profile All/ARAM/Ranked views at 1440×900, 390×844, and 359×603, a full-motion desktop gateway frame, and compact Builds/Memory views. These are human-review artifacts, not screenshot baselines. Captures wait for lookup hydration, imported match data and fonts; reduced-motion cases also check viewport controls, horizontal overflow and absence of running infinite gateway animations. The view-switch regression preserves history filters while Builds/Memory show their own content and Memory keeps only its relevant external mode control. A separate keyboard test submits the lookup through its native focus order. The compact shared map is checked on gateway, profile, and match surfaces.

A passing run verifies those browser behaviors against controlled data. It does **not** establish live Riot access, AI-provider availability, Vercel authorization, production safety settings, or a successful review of a real player's match. Those integration checks must be performed separately against the protected preview. Chronology fixtures deliberately include matches before, at, and after the adjustment's tracking start.

Failed tests retain a trace and screenshot under the normal Playwright output directory. `--list` verifies test discovery only; it does not execute the browser assertions.
