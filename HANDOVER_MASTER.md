# RiftScry — master agent handover

Updated: 2026-11-03. Repository: [ionutn0301/riftscry](https://github.com/ionutn0301/riftscry).

## Start here

The user wants a free, managed backend with social accounts and existing personal
features adapted to accounts. Supabase Auth + hosted Postgres was chosen to keep
this to one new service. No self-hosted server or custom password management was
introduced. The user explicitly requested merging
[PR #77](https://github.com/ionutn0301/riftscry/pull/77) and creating this handover.

**The code and database are implemented. Social login is not activated.**
`PUBLIC_AUTH_PROVIDERS` is intentionally empty in Vercel until a real OAuth provider
and redirect allowlist are configured. The Account page explains that setup is in
progress and guest functionality remains available. Do not mistake a successful
build or mocked OAuth test for a working live social login.

This file ships with PR #77. Use that PR's merge record and the current `main` HEAD
for the final release SHA; do not assume the old feature-branch SHA is production.
The user authorized the merge despite the previously disclosed unfinished OAuth
activation. Merging `main` triggers the existing Vercel production Git deployment.
Check its completion separately before claiming that production is live.

## Next steps, in order

1. Check PR #77's merge record, current `main`, the resulting GitHub Actions runs,
   and Vercel's production deployment. A final test-assertion correction is described
   below; do not report the entire CI suite green without inspecting the new run.
2. Complete Supabase dashboard authentication. The connector can provision projects
   and run SQL, but its available tools did not expose Auth provider/URL settings.
   Browser sign-in was attempted; the secure ChatGPT login prompt timed out and a
   fresh Supabase dashboard check was still signed out. A manual browser handoff
   was offered. Do not assume that session survived or authentication completed.
3. In the **existing** Supabase project, configure at least one social provider:
   Google, GitHub, or Discord are supported by the application. No provider choice
   was finalized. The user's selection of ChatGPT during dashboard sign-in was
   only a dashboard login method, not a requested application OAuth provider.
4. Register/configure the provider OAuth app as needed. Use the callback Supabase
   displays; for this project it is expected to be
   `https://vpirgetchbflxwrwjgzm.supabase.co/auth/v1/callback`. Keep provider secrets
   in Supabase's provider settings. Never request passwords or secrets in chat or
   put them in git. Follow the environment's secure credential/handoff workflow.
5. Set Supabase Site URL to `https://riftscry.vercel.app`. Add exact application
   redirects: `https://riftscry.vercel.app/auth/callback`,
   `http://localhost:4321/auth/callback`, and the selected preview origin followed
   by `/auth/callback` if using a preview. Avoid broad wildcard production redirects.
6. Set Vercel `PUBLIC_AUTH_PROVIDERS` to only enabled providers, such as `github`
   or `google,github`. Rebuild the intended deployment: these are build-time public
   variables. Do not enable buttons before the provider is configured.
7. Verify a real sign-in/callback/sign-out round trip, first sign-in account
   creation, two independent accounts, a second browser/device, guest import,
   offline edits, and conflict resolution. Mocked tests cannot verify credentials
   or the hosted redirect settings. Preserve deployment protection during testing.

Project creation and schema installation are already complete. Do not create
another project or rerun the initial migration blindly. See
[docs/ACCOUNTS.md](docs/ACCOUNTS.md) for the detailed setup/operations guide; its
generic setup steps 1–2 are already done for this project.

## Infrastructure and routing

| Resource | Identifier / state |
| --- | --- |
| Supabase project | `riftscry`, ref `vpirgetchbflxwrwjgzm`, Frankfurt `eu-central-1` |
| Supabase organization | `ionutn0301's Org`, ID `ldmybobswrglaxkvrpmx`; Free plan |
| Supabase API URL | `https://vpirgetchbflxwrwjgzm.supabase.co` |
| Applied migration | `supabase/migrations/20261103135354_account_workspaces.sql` |
| Vercel team | `ionutn0301s-projects`, ID `team_L6BlILw6401DMAX3LmdEfd9d` |
| Vercel project | `riftscry`, ID `prj_k5dcQpAhbwA78SgEzq62DZBuaLzC` |
| Production hostname | `riftscry.vercel.app` |
| Feature branch | `feat/supabase-accounts` |
| Verified preview build | Deployment `dpl_fxqQdb9F5bY5Knb35A79QArcotM9`, READY for application commit `91721a9ab14f55c93d8eb4ee62be8823e7ed950e` |
| Preview branch alias | `riftscry-git-feat-supabase-accounts-ionutn0301s-projects.vercel.app` |

`PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and empty
`PUBLIC_AUTH_PROVIDERS` were set for Vercel Production/Development and branch-scoped
Preview for `feat/supabase-accounts`. Other preview branches were not configured.
Retrieve the publishable key from the connected project if needed; this handover
intentionally contains no credentials. Never expose a service-role/secret key.

The project was created with a quoted cost of $0, without paid add-ons. Free-tier
limits and inactivity pausing still apply; consult the dated pricing references in
`docs/ACCOUNTS.md` before promising ongoing free capacity. Existing Riot/Redis/AI
costs are separate from the new backend.

Vercel deployment protection remains enabled. The preview built successfully, but
the connector's preview-content/share-link calls reported unavailable access even
with the explicit team ID. No protection settings were weakened to work around it.
Use the appropriate authorized deployment access path if live preview QA is needed.

## What changed

| Feature | Account behavior |
| --- | --- |
| Champion pool | Private synchronized champion selection |
| Notebook | Notes, saved loadouts, cards, reflections, and existing notebook backups |
| Build Memory | Private records separated by Riot player inside the RiftScry account |
| Momentum | Bounded progress records per Riot player |
| Saved findings | Private synchronized kept records |
| Player shortcuts | Recent and legacy remembered player |
| Reading continuity | Reviewed patch, reading resume, and focused signal |
| Theme/motion preferences | Remain device-local |
| Riot API caches, temporary navigation, AI responses | Never uploaded by account sync |

An app account does **not** verify ownership of a selected Riot ID. Existing Riot
approval/access gates, server-only API credentials, Redis budgets/cache, explicit
AI opt-in, and bounded history imports remain intact.

### Storage and synchronization contract

- Guest records keep their original browser keys. Signing in does not silently
  import them. The Account page offers an explicit additive import.
- Import copies categories missing from the account. Existing categories, including
  tombstones, win. Guest originals remain unchanged. To merge two notebooks, use
  the notebook's existing merge-import format.
- Signed-in cache/outbox uses `riftscry:account:v1:<user-id>`. An allowlist limits
  which existing keys can be synced. Unresolved initial auth scope blocks personal
  writes; identity changes lock the scope and fully reload to discard stale forms.
- The local value and dirty flag are written atomically. Sync runs after edits,
  on focus, visibility restoration, and reconnect. There is no constant polling
  or paid Realtime dependency.
- Server revisions implement compare-and-swap. A stale write preserves both
  versions locally and asks the user which to keep; it does not silently merge text.
- Sign-out flushes and refuses to discard pending/conflicting edits. Successful
  sign-out clears the active account cache and restores the guest workspace.
- Workspace export is a recovery archive, including conflicting versions. It is
  **not** an importable notebook backup. The notebook has its own import/export.
- React consumers of `$account` use `useStore($account, { ssr: 'initial' })` so
  server-rendered disabled attributes hydrate correctly. Preserve this detail.

### Database boundary

`public.account_records` has a composite `(user_id, record_key)` primary key, an
`auth.users` foreign key with cascading deletion, RLS owner-only SELECT, and no
direct client INSERT/UPDATE/DELETE grants. Anonymous users cannot read or write it.

The public `save_account_record` wrapper invokes the private
`riftscry_private.save_account_record` implementation. Ownership comes exclusively
from `auth.uid()`. The function uses a fixed empty search path, explicit grants,
a per-user advisory transaction lock, JSON/key checks, quotas, and expected
revision checks. The private schema must not be exposed through the Data API.

Current caps: 200 records, 2 MB per value, 4 MB of logical values per user. Existing
feature-specific caps remain tighter where applicable. Null values act as
tombstones for revision/conflict history. This design constrains individual
growth; it does not promise unlimited free project storage.

## Code map

| Path | Responsibility |
| --- | --- |
| `src/lib/account/storage.ts` | Scope, allowlisted adapter, account state, durable cache/outbox, quotas |
| `src/lib/account/client.ts` | Supabase SDK, PKCE/session lifecycle, cloud sync/import/sign-out/conflicts |
| `src/lib/account/sync.ts` | Pure reconciliation and acknowledgement logic |
| `src/lib/account/validation.ts` | Validate legacy guest records before import |
| `src/components/account/AccountPanel.tsx` | Account controls, export/import, sync errors/conflict actions |
| `src/components/account/SyncStatus.tsx` | Shared sync-status indicator |
| `src/pages/account.astro`, `src/pages/auth/callback.astro` | Account and OAuth-return routes |
| `src/layouts/Layout.astro`, `src/styles/account.css` | Shared bootstrap and presentation |
| `supabase/migrations/20261103135354_account_workspaces.sql` | Schema, RLS, RPC, grants, limits |
| `tests/account-e2e/accounts.spec.ts` | Actual SDK with deterministic mocked Auth/Data APIs |
| `tests/unit/account-database.test.ts` | Actual migration executed in PGlite/Postgres |
| `tests/unit/account-sync.test.ts`, `tests/unit/browser/account-storage.test.ts` | Reconciliation and storage isolation tests |

Existing personal-storage callers were adapted in the pool, companion notebook,
player identity, Build Memory, Momentum, findings, resume/signal utilities, and
their components/scripts. Do not introduce new direct `localStorage` calls for
account-owned records; use the adapter and extend its explicit key allowlist and
database validation together when necessary.

## Verification record and remaining CI work

Application baseline: `91721a9ab14f55c93d8eb4ee62be8823e7ed950e`.
Evidence: [CI run 250](https://github.com/ionutn0301/riftscry/actions/runs/41692039279).
These are observed results for that commit, not a claim about future runs:

| Check | Observed result |
| --- | --- |
| Typecheck | Pass; one pre-existing unused-import hint |
| Unit/database suite | 673 tests, 66 files passed |
| Production build + archive contract | Pass; 624 generated pages |
| Account Playwright suite | All 6 passed: PKCE, 1440/390px layout, guest import/cross-device/sign-out, offline/conflicts, separate accounts |
| Actual hosted SQL checks | Owner isolation, revision conflict, direct-write denial, anonymous denial passed; test identities rolled back |
| Supabase advisors | Security and performance returned no findings |
| Surface regressions | Desktop, mobile WebKit, and mobile Chromium passed |
| Briefing / transition / homepage composition | Passed |
| Full production browser journeys | Desktop and mobile Chromium passed; mobile WebKit was still running at handover drafting |
| Home-flight job | Cancelled; inspect/rerun before claiming complete CI success |
| Player workflow suite | 186 passed, 3 failed at assertions expecting the old browser-only save message |

The final handover commit updates those three assertions in
`tests/player-e2e/player.spec.ts` to the implemented workspace save message.
It retains the subsequent persistence, player-isolation, and revision checks.
The correction changes tests only, not application behavior. **A fresh CI run is
still required to confirm the complete player workflows and any cancelled job.**
Check the latest PR/main workflow rather than repeatedly rerunning the old SHA.

Local browser execution in the agent workspace was unavailable: the standard
Chromium download failed and an alternate Chromium process crashed on launch.
GitHub-hosted Playwright produced the verified browser results and account screenshots.
Do not claim that the browser suite passed locally. CI artifacts have limited
retention; old screenshots elsewhere in the repository may describe earlier UI.

## Local setup and checks

Stack: Astro 7, React 19 islands, Nanostores, TypeScript, pnpm 11, Node >=22,
Vercel adapter. Added exact versions: `@supabase/supabase-js` 2.118.0 and
dev-only `@electric-sql/pglite` 0.5.14.

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
node scripts/verify-atlas.mjs
pnpm exec playwright install --with-deps chromium webkit
pnpm exec playwright test --config=playwright.accounts.config.ts
pnpm exec playwright test --config=playwright.player.config.ts
pnpm e2e
```

For the corrected player tests alone:

```bash
pnpm exec playwright test --config=playwright.player.config.ts player.spec.ts \
  --grep 'AI suggestion prefills|manual adjustments persist|material revision updates'
```

The account Playwright config uses a fake Supabase project and mock sessions; do
not replace them with production credentials. Its dev server uses localhost port
4325 and `ASTRO_DEV_BACKGROUND=1` to prevent Astro's agent-mode daemon detachment.
For normal development, follow `.env.example` and `pnpm dev`; only enable social
provider values after configuring the corresponding hosted provider.

The working checkout used during this task was
`/workspace/scratch/58b7bea679fd/riftscry`. Treat that as ephemeral; GitHub is the
durable source. An unrelated untracked temporary image under `public/story-review`
was left untouched and excluded from commits.

## Wider application context

The existing product has an immersive archive homepage, native route navigation,
automatic Riot-match briefings, patch catch-up/impact, player histories, match
review, Build Memory, Momentum, and an optional notebook. Preserve recorded
evidence versus personal notes, exact queue/patch/player scopes, accessible native
links, reduced-motion behavior, and the existing request budgets.

Useful reading:

- [Account setup and operations](docs/ACCOUNTS.md)
- [Product contract](PRODUCT.md) and [design contract](DESIGN.md)
- [Architecture](docs/ARCHITECTURE.md) and [player release](docs/player-release.md)
- [Data provenance](docs/DATA.md) and [contributing checks](CONTRIBUTING.md)
- [First useful imported game](docs/first-result/README.md)
- [Momentum](docs/momentum/README.md)

Some historical architecture/release prose describes older homepage components or
browser-only behavior. The current route imports and account implementation take
precedence for present behavior. Inspect current code before extending an old design.

## Definition of completion for the next agent

The next release is complete when the merge and production deployment are confirmed,
the updated CI checks pass, a configured provider signs a real user into `/account`,
two real users remain isolated, cross-device saves work, and guest/offline data is
preserved. Update this file with that evidence and any remaining limitations.
