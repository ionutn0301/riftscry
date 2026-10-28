# Player workflow browser tests

Run from the repository root after installing the locked dependencies and a supported Playwright browser:

```sh
pnpm exec playwright test --config=playwright.player.config.ts
```

The configuration reuses a local development server on port 3000 when available. Otherwise it starts the normal development command. A separately installed browser can be selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

These tests intercept `/api/player/*` **inside the test browser only**. The fixtures are under this test directory and are not served by application routes. They do not set Riot access flags, load API keys, disable Vercel protection, or represent the tester's account.

The suite exercises lookup form submission, readable metadata, grouped loadouts, navigation, a fixture AI success and failure, evidence disclosure, draft confirmation, local note persistence and isolation, coherent revisions, prospective follow-up, explicit custom-condition confirmation and reversal, legacy activation, and corrupt-storage recovery.

A passing run verifies those browser behaviors against controlled data. It does **not** establish live Riot access, AI-provider availability, Vercel authorization, production safety settings, or a successful review of a real player's match. Those integration checks must be performed separately against the protected preview. Chronology fixtures deliberately include matches before, at, and after the adjustment's tracking start.

Failed tests retain a trace and screenshot under the normal Playwright output directory. `--list` verifies test discovery only; it does not execute the browser assertions.
